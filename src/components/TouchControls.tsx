'use client';

import { useEffect, useRef, useState, type FC, useCallback } from 'react';

/**
 * Touch controls overlay for mobile — iOS game controller aesthetic.
 *
 * Layout:
 *   Left side  — Left / Right arrow buttons (D-pad style)
 *   Right side — Jump (large, #007AFF) + Attack (smaller, #FF9500)
 *
 * Emits 'game-input' CustomEvents consumed by InputManager.
 */
const TouchControls: FC = () => {
  const [leftHeld, setLeftHeld]     = useState(false);
  const [rightHeld, setRightHeld]   = useState(false);
  const [jumpHeld, setJumpHeld]     = useState(false);
  const [attackHeld, setAttackHeld] = useState(false);

  const emit = useCallback((type: string, value: boolean) => {
    window.dispatchEvent(new CustomEvent('game-input', { detail: { type, value } }));
  }, []);

  const startLeft   = useCallback(() => { setLeftHeld(true);    emit('move-left', true); }, [emit]);
  const endLeft     = useCallback(() => { setLeftHeld(false);   emit('move-left', false); }, [emit]);
  const startRight  = useCallback(() => { setRightHeld(true);   emit('move-right', true); }, [emit]);
  const endRight    = useCallback(() => { setRightHeld(false);  emit('move-right', false); }, [emit]);
  const startJump   = useCallback(() => { setJumpHeld(true);    emit('jump-press', true); }, [emit]);
  const endJump     = useCallback(() => { setJumpHeld(false);   emit('jump-press', false); }, [emit]);
  const startAttack = useCallback(() => { setAttackHeld(true);  emit('attack-press', true); }, [emit]);
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

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none select-none"
      style={{ touchAction: 'none' }}
    >
      {/* ── Left: D-Pad ──────────────────────────────────────── */}
      <div
        className="absolute pointer-events-auto"
        style={{ bottom: 28, left: 20, display: 'flex', gap: 10 }}
      >
        <TouchBtn active={leftHeld}  onStart={startLeft}  onEnd={endLeft}  size="lg" aria-label="Move left">
          <ChevronLeft />
        </TouchBtn>
        <TouchBtn active={rightHeld} onStart={startRight} onEnd={endRight} size="lg" aria-label="Move right">
          <ChevronRight />
        </TouchBtn>
      </div>

      {/* ── Right: Attack + Jump ─────────────────────────────── */}
      <div
        className="absolute pointer-events-auto"
        style={{ bottom: 28, right: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}
      >
        <TouchBtn active={attackHeld} onStart={startAttack} onEnd={endAttack} size="sm" tint="orange" aria-label="Attack">
          <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', letterSpacing: '0.05em' }}>
            ATK
          </span>
        </TouchBtn>
        <TouchBtn active={jumpHeld} onStart={startJump} onEnd={endJump} size="lg" tint="blue" aria-label="Jump">
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

const TINT_COLORS = {
  blue:   { active: 'rgba(0,122,255,0.55)',  idle: 'rgba(0,122,255,0.18)' },
  orange: { active: 'rgba(255,149,0,0.55)',  idle: 'rgba(255,149,0,0.18)' },
  none:   { active: 'rgba(120,120,128,0.45)', idle: 'rgba(120,120,128,0.2)' },
};

const TouchBtn: FC<TouchBtnProps> = ({
  active, onStart, onEnd, size, tint, children, 'aria-label': ariaLabel,
}) => {
  const dim = size === 'lg' ? 64 : 48;
  const colors = TINT_COLORS[tint ?? 'none'];

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
        background: active ? colors.active : colors.idle,
        border: `1px solid ${active ? colors.active : 'rgba(255,255,255,0.1)'}`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transition: 'background 0.06s ease, transform 0.08s ease',
        transform: active ? 'scale(0.93)' : 'scale(1)',
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

/* ── SF Symbol–equivalent chevrons ─────────────────────────── */

const ChevronLeft: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="rgba(235,235,245,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="rgba(235,235,245,0.75)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const ChevronUp: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke="rgba(235,235,245,0.85)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M18 15l-6-6-6 6" />
  </svg>
);
