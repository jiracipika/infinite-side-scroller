'use client';

import { useEffect, useCallback, useState, type FC } from 'react';

/**
 * Touch controls overlay for mobile — iOS game controller aesthetic.
 *
 * Layout:
 *   Left side  — Left / Right D-pad buttons
 *   Right side — Attack (smaller, orange) + Jump (large, blue)
 *
 * Emits 'game-input' CustomEvents consumed by InputManager.
 * Respects iOS safe-area-inset-bottom for notched devices.
 */
const TouchControls: FC = () => {
  const [leftHeld,   setLeftHeld]   = useState(false);
  const [rightHeld,  setRightHeld]  = useState(false);
  const [jumpHeld,   setJumpHeld]   = useState(false);
  const [attackHeld, setAttackHeld] = useState(false);

  const emit = useCallback((type: string, value: boolean) => {
    window.dispatchEvent(new CustomEvent('game-input', { detail: { type, value } }));
  }, []);

  const startLeft   = useCallback(() => { setLeftHeld(true);    emit('move-left',    true);  }, [emit]);
  const endLeft     = useCallback(() => { setLeftHeld(false);   emit('move-left',    false); }, [emit]);
  const startRight  = useCallback(() => { setRightHeld(true);   emit('move-right',   true);  }, [emit]);
  const endRight    = useCallback(() => { setRightHeld(false);  emit('move-right',   false); }, [emit]);
  const startJump   = useCallback(() => { setJumpHeld(true);    emit('jump-press',   true);  }, [emit]);
  const endJump     = useCallback(() => { setJumpHeld(false);   emit('jump-press',   false); }, [emit]);
  const startAttack = useCallback(() => { setAttackHeld(true);  emit('attack-press', true);  }, [emit]);
  const endAttack   = useCallback(() => { setAttackHeld(false); emit('attack-press', false); }, [emit]);

  const releaseAll = useCallback(() => {
    setLeftHeld(false); setRightHeld(false);
    setJumpHeld(false); setAttackHeld(false);
    emit('move-left', false); emit('move-right', false);
    emit('jump-press', false); emit('attack-press', false);
  }, [emit]);

  useEffect(() => {
    window.addEventListener('blur', releaseAll);
    return () => window.removeEventListener('blur', releaseAll);
  }, [releaseAll]);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);

  if (!isTouchDevice) return null;

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
        style={{ bottom: bottomInset, left: 16, display: 'flex', gap: 10 }}
      >
        <TouchBtn
          active={leftHeld}
          onStart={startLeft}
          onEnd={endLeft}
          size="lg"
          aria-label="Move left"
        >
          <ChevronLeft />
        </TouchBtn>
        <TouchBtn
          active={rightHeld}
          onStart={startRight}
          onEnd={endRight}
          size="lg"
          aria-label="Move right"
        >
          <ChevronRight />
        </TouchBtn>
      </div>

      {/* ── Right: Attack + Jump ─────────────────────────────── */}
      <div
        className="absolute pointer-events-auto"
        style={{
          bottom: bottomInset,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 10,
        }}
      >
        <TouchBtn
          active={attackHeld}
          onStart={startAttack}
          onEnd={endAttack}
          size="sm"
          tint="orange"
          aria-label="Attack"
        >
          <AtkLabel />
        </TouchBtn>
        <TouchBtn
          active={jumpHeld}
          onStart={startJump}
          onEnd={endJump}
          size="lg"
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
  size: 'sm' | 'lg';
  tint?: 'blue' | 'orange';
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
  const dim = size === 'lg' ? 66 : 50;
  const t = TINTS[tint ?? 'none'];

  return (
    <button
      aria-label={ariaLabel}
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
      }}
      onTouchStart={(e) => { e.preventDefault(); onStart(); }}
      onTouchEnd={(e)   => { e.preventDefault(); onEnd(); }}
      onTouchCancel={(e) => { e.preventDefault(); onEnd(); }}
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
