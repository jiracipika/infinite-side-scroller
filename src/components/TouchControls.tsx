'use client';

import { useEffect, useCallback, useRef, useState, type FC } from 'react';

/**
 * Touch controls overlay for mobile — iOS game controller aesthetic.
 *
 * Layout:
 *   Left side  — Left / Right D-pad buttons
 *   Right side — Dash / Attack / Carry (small) + Jump (large, blue)
 *
 * Emits 'game-input' CustomEvents consumed by InputManager.
 * Respects iOS safe-area-inset-bottom for notched devices.
 */
interface TouchControlsProps {
  channel?: string;
  compact?: boolean;
  forceVisible?: boolean;
  hapticsEnabled?: boolean;
}

const TouchControls: FC<TouchControlsProps> = ({
  channel = 'game-input', compact = false, forceVisible = false, hapticsEnabled = true,
}) => {
  const [leftHeld, setLeftHeld] = useState(false);
  const [rightHeld, setRightHeld] = useState(false);
  const [jumpHeld, setJumpHeld] = useState(false);
  const [attackHeld, setAttackHeld] = useState(false);
  const [dashHeld, setDashHeld] = useState(false);
  const [carryHeld, setCarryHeld] = useState(false);

  const emit = useCallback((type: string, value: boolean) => {
    window.dispatchEvent(new CustomEvent(channel, { detail: { type, value } }));
  }, [channel]);

  const pulseHaptic = useCallback((pattern: number | number[] = 8) => {
    // Best-effort mobile feedback. Unsupported browsers simply no-op.
    if (!hapticsEnabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try { navigator.vibrate(pattern); } catch { /* Ignore restricted browser failures. */ }
  }, [hapticsEnabled]);

  const startLeft = useCallback(() => { emit('move-left', true); setLeftHeld(true); pulseHaptic(6); }, [emit, pulseHaptic]);
  const endLeft = useCallback(() => { emit('move-left', false); setLeftHeld(false); }, [emit]);
  const startRight = useCallback(() => { emit('move-right', true); setRightHeld(true); pulseHaptic(6); }, [emit, pulseHaptic]);
  const endRight = useCallback(() => { emit('move-right', false); setRightHeld(false); }, [emit]);
  const startJump = useCallback(() => { emit('jump-press', true); setJumpHeld(true); pulseHaptic(10); }, [emit, pulseHaptic]);
  const endJump = useCallback(() => { emit('jump-press', false); setJumpHeld(false); }, [emit]);
  const startAttack = useCallback(() => { emit('attack-press', true); setAttackHeld(true); pulseHaptic([8, 18, 8]); }, [emit, pulseHaptic]);
  const endAttack = useCallback(() => { emit('attack-press', false); setAttackHeld(false); }, [emit]);
  const startDash = useCallback(() => { emit('dash-press', true); setDashHeld(true); pulseHaptic(14); }, [emit, pulseHaptic]);
  const endDash = useCallback(() => { emit('dash-press', false); setDashHeld(false); }, [emit]);
  const startCarry = useCallback(() => { emit('carry-press', true); setCarryHeld(true); pulseHaptic(8); }, [emit, pulseHaptic]);
  const endCarry = useCallback(() => { emit('carry-press', false); setCarryHeld(false); }, [emit]);

  const releaseAll = useCallback(() => {
    setLeftHeld(false); setRightHeld(false);
    setJumpHeld(false); setAttackHeld(false); setDashHeld(false); setCarryHeld(false);
    emit('move-left', false); emit('move-right', false);
    emit('jump-press', false); emit('attack-press', false); emit('dash-press', false); emit('carry-press', false);
    pulseHaptic(0);
  }, [emit, pulseHaptic]);

  useEffect(() => {
    const releaseOnHidden = () => {
      if (document.visibilityState === 'hidden') releaseAll();
    };
    window.addEventListener('blur', releaseAll);
    window.addEventListener('pagehide', releaseAll);
    document.addEventListener('visibilitychange', releaseOnHidden);
    return () => {
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('pagehide', releaseAll);
      document.removeEventListener('visibilitychange', releaseOnHidden);
    };
  }, [releaseAll]);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);

  if (!isTouchDevice && !forceVisible) return null;

  // Bottom offset — honours iOS safe area (notch/home bar)
  const bottomInset = 'max(24px, env(safe-area-inset-bottom, 24px))';

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none select-none"
      style={{ touchAction: 'none' }}
    >
      {/* ── Left: D-Pad ──────────────────────────────────────── */}
      <div
        className="absolute pointer-events-auto"
        style={{ bottom: compact ? 'max(12px, env(safe-area-inset-bottom, 12px))' : bottomInset, left: compact ? 10 : 16, display: 'flex', gap: compact ? 8 : 10 }}
      >
        <TouchBtn
          active={leftHeld}
          onStart={startLeft}
          onEnd={endLeft}
          size={compact ? 'md' : 'lg'}
          aria-label="Move left"
        >
          <ChevronLeft />
        </TouchBtn>
        <TouchBtn
          active={rightHeld}
          onStart={startRight}
          onEnd={endRight}
          size={compact ? 'md' : 'lg'}
          aria-label="Move right"
        >
          <ChevronRight />
        </TouchBtn>
      </div>

      {/* ── Right: Dash + Attack + Carry + Jump ─────────────── */}
      <div
        className="absolute pointer-events-auto"
        style={{
          bottom: compact ? 'max(12px, env(safe-area-inset-bottom, 12px))' : bottomInset,
          right: compact ? 10 : 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: compact ? 8 : 10,
        }}
      >
        <div style={{ display: 'flex', gap: compact ? 8 : 10 }}>
          <TouchBtn
            active={dashHeld}
            onStart={startDash}
            onEnd={endDash}
            size={compact ? 'xs' : 'sm'}
            tint="purple"
            aria-label="Dash"
          >
            <DashLabel />
          </TouchBtn>
          <TouchBtn
            active={attackHeld}
            onStart={startAttack}
            onEnd={endAttack}
            size={compact ? 'xs' : 'sm'}
            tint="orange"
            aria-label="Attack"
          >
            <AtkLabel />
          </TouchBtn>
          <TouchBtn
            active={carryHeld}
            onStart={startCarry}
            onEnd={endCarry}
            size={compact ? 'xs' : 'sm'}
            tint="green"
            aria-label="Carry teammate"
          >
            <CarryLabel />
          </TouchBtn>
        </div>
        <TouchBtn
          active={jumpHeld}
          onStart={startJump}
          onEnd={endJump}
          size={compact ? 'md' : 'lg'}
          tint="blue"
          aria-label="Jump"
        >
          <ChevronUp />
        </TouchBtn>
      </div>
    </div>
  );
};

export default TouchControls;

/* ── Touch Button ───────────────────────────────────────────── */

interface TouchBtnProps {
  active: boolean;
  onStart: () => void;
  onEnd: () => void;
  size: 'xs' | 'sm' | 'md' | 'lg';
  tint?: 'blue' | 'orange' | 'purple' | 'green';
  'aria-label': string;
  children: React.ReactNode;
}

const TINTS = {
  blue:   {
    bg:         'rgba(0,122,255,0.2)',
    bgActive:   'rgba(0,122,255,0.58)',
    border:     'rgba(0,122,255,0.22)',
    borderActive: 'rgba(0,122,255,0.7)',
    glow:       '0 0 16px rgba(0,122,255,0.45)',
  },
  orange: {
    bg:         'rgba(255,149,0,0.18)',
    bgActive:   'rgba(255,149,0,0.56)',
    border:     'rgba(255,149,0,0.22)',
    borderActive: 'rgba(255,149,0,0.7)',
    glow:       '0 0 14px rgba(255,149,0,0.42)',
  },
  purple: {
    bg:         'rgba(175,82,222,0.18)',
    bgActive:   'rgba(175,82,222,0.56)',
    border:     'rgba(175,82,222,0.22)',
    borderActive: 'rgba(175,82,222,0.7)',
    glow:       '0 0 14px rgba(175,82,222,0.42)',
  },
  green: {
    bg:         'rgba(52,199,89,0.18)',
    bgActive:   'rgba(52,199,89,0.56)',
    border:     'rgba(52,199,89,0.22)',
    borderActive: 'rgba(52,199,89,0.7)',
    glow:       '0 0 14px rgba(52,199,89,0.42)',
  },
  none: {
    bg:         'rgba(120,120,128,0.22)',
    bgActive:   'rgba(120,120,128,0.52)',
    border:     'rgba(255,255,255,0.1)',
    borderActive: 'rgba(255,255,255,0.28)',
    glow:       '0 0 12px rgba(255,255,255,0.15)',
  },
};

const TouchBtn: FC<TouchBtnProps> = ({
  active, onStart, onEnd, size, tint, children, 'aria-label': ariaLabel,
}) => {
  const activePointerRef = useRef<number | null>(null);
  const dim = size === 'lg' ? 66 : size === 'md' ? 56 : size === 'sm' ? 50 : 42;
  const t = TINTS[tint ?? 'none'];

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    onStart();
  };

  const handlePointerRelease = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerRef.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    onEnd();
  };

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        width: dim,
        height: dim,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: active ? t.bgActive : t.bg,
        border: `1.5px solid ${active ? t.borderActive : t.border}`,
        backdropFilter: 'blur(12px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(12px) saturate(1.3)',
        boxShadow: active ? t.glow : 'none',
        transition: 'background 0.07s ease, border-color 0.07s ease, box-shadow 0.1s ease, transform 0.08s ease',
        transform: active ? 'scale(0.92)' : 'scale(1)',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onLostPointerCapture={(e) => {
        if (activePointerRef.current === e.pointerId) {
          activePointerRef.current = null;
          onEnd();
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
};

/* ── Icons ──────────────────────────────────────────────────── */

const STROKE = 'rgba(235,235,245,0.8)';

const ChevronLeft: FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight: FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const ChevronUp: FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="rgba(235,235,245,0.9)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const AtkLabel: FC = () => (
  <span style={{
    fontSize: 11,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: '0.06em',
    lineHeight: 1,
  }}>
    ATK
  </span>
);

const DashLabel: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="rgba(255,255,255,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const CarryLabel: FC = () => (
  <span style={{
    fontSize: 10,
    fontWeight: 800,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: '0.05em',
    lineHeight: 1,
  }}>
    HELP
  </span>
);
