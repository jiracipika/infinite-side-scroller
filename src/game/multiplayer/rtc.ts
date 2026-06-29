/**
 * WebRTC peer-to-peer transport for low-latency local multiplayer.
 *
 * Replaces HTTP polling (40–150 ms per sync) with a direct device-to-device
 * data channel. On the same Wi-Fi this drops round-trip latency to ~1–5 ms
 * because every packet skips the HTTP server entirely.
 *
 * Signaling (SDP offer/answer + ICE candidates) is exchanged via the existing
 * HTTP server, but only once during connection setup — gameplay sync then
 * flows P2P.
 *
 * Connectivity hardening:
 *  - STUN + TURN servers. STUN handles ~80% of NATs; TURN relays traffic for
 *    the remaining symmetric/restrictive NATs so connectivity always works.
 *  - Trickle ICE: candidates are exchanged as soon as they're gathered instead
 *    of waiting for full gathering to complete inside the SDP.
 *  - Extended ICE gathering timeout (3s) for slow mobile networks.
 */

/** Peer sync message — same shape as the HTTP sync payload, plus RTT probe. */
export interface RTCSyncMessage {
  type: 'sync';
  ts: number; // sender's performance.now() at send time (for RTT)
  seq?: number; // monotonic sync sequence; lets receivers ignore stale unordered packets
  receivedAt?: number; // local receive time, filled in by the browser client
  echoTs?: number; // echoes the peer's last-received ts for RTT calc
  snapshot?: import('./types').NetPlayerSnapshot;
  input?: import('./types').NetInputCommand;
  enemies?: import('./types').NetEnemySnapshot[];
  carryTargetId?: string | null;
  dropCarry?: boolean;
  characterId?: string;
  name?: string;
  killedEnemyIds?: string[]; // cross-player enemy defeat sync
}

export interface RTCPingMessage {
  type: 'ping';
  ts: number;
}

export interface RTCPongMessage {
  type: 'pong';
  ts: number; // echo of the ping ts
}

export type RTCMessage = RTCSyncMessage | RTCPingMessage | RTCPongMessage;

export interface RTCSignaling {
  sdp?: RTCSessionDescriptionInit;
  candidates?: RTCIceCandidateInit[];
}

export type RTCConnectionState = 'idle' | 'connecting' | 'connected' | 'failed' | 'closed';

interface RTCConfig {
  iceServers?: RTCIceServer[];
}

/** Build the ICE server list from env-configured TURN/STUN servers. */
function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  // TURN servers are configured via next.config public runtime env.
  // Format: "turn:host:port:user:credential" or full "turn:host:port?transport=tcp:user:credential"
  const turnUrls = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_TURN_URLS ?? process.env.TURN_URLS ?? '')
    : '';
  const turnUser = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_TURN_USER ?? process.env.TURN_USER ?? '')
    : '';
  const turnCred = typeof process !== 'undefined'
    ? (process.env.NEXT_PUBLIC_TURN_CREDENTIAL ?? process.env.TURN_CREDENTIAL ?? '')
    : '';

  if (turnUrls && turnUser && turnCred) {
    const urls = turnUrls.split(',').map((s) => s.trim()).filter(Boolean);
    servers.push({ urls, username: turnUser, credential: turnCred });
  }

  return servers;
}

const DEFAULT_ICE_SERVERS = getIceServers();

/** Default ICE gathering timeout — generous enough for mobile networks. */
const DEFAULT_ICE_TIMEOUT_MS = 3000;

export class RTCTransport {
  private pc: RTCPeerConnection;
  private channel: RTCDataChannel | null = null;
  private state: RTCConnectionState = 'idle';
  private lastReceivedTs = 0;
  private rttEwma = 0;

  onOpen?: () => void;
  onMessage?: (msg: RTCMessage) => void;
  onClose?: () => void;
  onStateChange?: (state: RTCConnectionState) => void;
  /** Fired for each local ICE candidate gathered (trickle ICE). */
  onIceCandidate?: (candidate: RTCIceCandidateInit) => void;

  constructor(config?: RTCConfig) {
    this.pc = new RTCPeerConnection({
      iceServers: config?.iceServers ?? DEFAULT_ICE_SERVERS,
    });

    // Track connection state
    this.pc.onconnectionstatechange = () => {
      const st = this.pc.connectionState;
      if (st === 'connected') this.setState('connected');
      else if (st === 'failed') this.setState('failed');
      else if (st === 'disconnected' || st === 'closed') {
        if (this.state === 'connected') this.setState('closed');
      }
    };

    // Trickle ICE: emit each candidate as it's discovered
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onIceCandidate?.(event.candidate.toJSON());
      }
    };
  }

  get connectionState(): RTCConnectionState { return this.state; }
  get isOpen(): boolean { return this.state === 'connected' && this.channel?.readyState === 'open'; }
  get rtt(): number { return this.rttEwma; }
  get bufferedAmount(): number { return this.channel?.bufferedAmount ?? 0; }

  // ── Host side: create data channel + SDP offer ──────────────────────

  async createOffer(iceTimeoutMs = DEFAULT_ICE_TIMEOUT_MS): Promise<RTCSessionDescriptionInit> {
    this.setState('connecting');
    this.channel = this.pc.createDataChannel('game', {
      // Gameplay state is resent every tick, so stale ordered packets should not
      // block newer movement updates on spotty Wi‑Fi. Unordered + short
      // retransmit keeps controls responsive and prevents head-of-line stalls.
      ordered: false,
      maxPacketLifeTime: 90,
    });
    this.setupChannel(this.channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIce(iceTimeoutMs);
    return this.pc.localDescription!;
  }

  // ── Joiner side: accept offer, create answer ────────────────────────

  async acceptOfferAndAnswer(
    remoteOffer: RTCSessionDescriptionInit,
    iceTimeoutMs = DEFAULT_ICE_TIMEOUT_MS,
  ): Promise<RTCSessionDescriptionInit> {
    this.setState('connecting');
    this.pc.ondatachannel = (event) => {
      this.channel = event.channel;
      this.setupChannel(this.channel);
    };

    await this.pc.setRemoteDescription(remoteOffer);
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitForIce(iceTimeoutMs);
    return this.pc.localDescription!;
  }

  // ── Host side: accept the joiner's answer ───────────────────────────

  async acceptAnswer(remoteAnswer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(remoteAnswer);
  }

  /** Add a remote ICE candidate received via signaling (trickle ICE). */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch {
      // Ignore — can happen if candidate arrives before remote description
    }
  }

  /** Add multiple remote ICE candidates. */
  async addIceCandidates(candidates: RTCIceCandidateInit[]): Promise<void> {
    await Promise.all(candidates.map((c) => this.addIceCandidate(c)));
  }

  // ── Send a message over the data channel ────────────────────────────

  send(msg: RTCMessage): boolean {
    if (!this.isOpen) return false;
    if ((this.channel?.bufferedAmount ?? 0) > 64_000) return false;
    try {
      this.channel!.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }

  /** Send a ping to probe RTT. */
  ping(): void {
    this.send({ type: 'ping', ts: performance.now() });
  }

  close(): void {
    try { this.channel?.close(); } catch {}
    try { this.pc.close(); } catch {}
    this.channel = null;
    this.setState('closed');
  }

  // ── Internals ───────────────────────────────────────────────────────

  private setupChannel(ch: RTCDataChannel): void {
    ch.binaryType = 'arraybuffer';
    ch.bufferedAmountLowThreshold = 16_000;
    ch.onopen = () => {
      this.setState('connected');
      this.onOpen?.();
    };
    ch.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as RTCMessage;
        this.handleMessage(msg);
      } catch { /* ignore malformed */ }
    };
    ch.onclose = () => {
      if (this.state === 'connected') {
        this.setState('closed');
        this.onClose?.();
      }
    };
    ch.onerror = () => {
      // Don't immediately fail — the channel may recover or close will fire
    };
  }

  private handleMessage(msg: RTCMessage): void {
    if (msg.type === 'ping') {
      // Echo back immediately
      this.send({ type: 'pong', ts: msg.ts });
      return;
    }
    if (msg.type === 'pong') {
      const rtt = performance.now() - msg.ts;
      this.rttEwma = this.rttEwma === 0 ? rtt : this.rttEwma * 0.8 + rtt * 0.2;
      return;
    }
    // sync message
    if (msg.ts) this.lastReceivedTs = msg.ts;
    this.onMessage?.(msg);
  }

  private waitForIce(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') return resolve();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') {
          clearTimeout(timer);
          finish();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', check);
    });
  }

  private setState(s: RTCConnectionState): void {
    this.state = s;
    this.onStateChange?.(s);
  }
}

/** Check if WebRTC is available in the current environment. */
export function isRTCAvailable(): boolean {
  return typeof RTCPeerConnection !== 'undefined' && typeof RTCDataChannel !== 'undefined';
}
