/**
 * WebRTC peer-to-peer transport for low-latency local multiplayer.
 *
 * Replaces HTTP polling (40–150 ms per sync) with a direct device-to-device
 * data channel. On the same Wi-Fi this drops round-trip latency to ~1–5 ms
 * because every packet skips the HTTP server entirely.
 *
 * Signaling (SDP offer/answer) is exchanged via the existing HTTP server,
 * but only once during connection setup — gameplay sync then flows P2P.
 */

/** Peer sync message — same shape as the HTTP sync payload, plus RTT probe. */
export interface RTCSyncMessage {
  type: 'sync';
  ts: number; // sender's performance.now() at send time (for RTT)
  echoTs?: number; // echoes the peer's last-received ts for RTT calc
  snapshot?: import('./types').NetPlayerSnapshot;
  input?: import('./types').NetInputCommand;
  enemies?: import('./types').NetEnemySnapshot[];
  carryTargetId?: string | null;
  dropCarry?: boolean;
  characterId?: string;
  name?: string;
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

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

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
  }

  get connectionState(): RTCConnectionState { return this.state; }
  get isOpen(): boolean { return this.state === 'connected' && this.channel?.readyState === 'open'; }
  get rtt(): number { return this.rttEwma; }

  // ── Host side: create data channel + SDP offer ──────────────────────

  async createOffer(iceTimeoutMs = 1500): Promise<RTCSessionDescriptionInit> {
    this.setState('connecting');
    this.channel = this.pc.createDataChannel('game', {
      ordered: true, // reliable ordered — matches existing HTTP semantics
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
    iceTimeoutMs = 1500,
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

  // ── Send a message over the data channel ────────────────────────────

  send(msg: RTCMessage): boolean {
    if (!this.isOpen) return false;
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
    // Track echo for RTT — but we use ping/pong instead for accuracy
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
