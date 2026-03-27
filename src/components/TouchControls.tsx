'use client';

import { useEffect, useRef, useState, type FC, useCallback } from 'react';

/**
 * Touch controls overlay for mobile.
 *
 * Layout:
 *   Left side  — Left / Right arrow buttons
 *   Right side — Jump (large) + Attack (smaller)
 *
 * Auto-shows only on touch devices; hidden on desktop via Tailwind's `md:hidden`.
 * Emits 'game-input' CustomEvents consumed by InputManager.
 */
const TouchControls: FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [leftHeld, setLeftHeld] = useState(false);
  const [rightHeld, setRightHeld] = useState(false);
  const [jumpHeld, setJumpHeld] = useState(false);
  const [attackHeld, setAttackHeld] = useState(false);

  const emit = useCallback((type: string, value: boolean) => {
    window.dispatchEvent(new CustomEvent('game-input', { detail: { type, value } }));
  }, []);

  // ── Directional buttons ────────────────────────────────────────────────────

  const startLeft = useCallback(() => { setLeftHeld(true); emit('move-left', true); }, [emit]);
  const endLeft   = useCallback(() => { setLeftHeld(false); emit('move-left', false); }, [emit]);

  const startRight = useCallback(() => { setRightHeld(true); emit('move-right', true); }, [emit]);
  const endRight   = useCallback(() => { setRightHeld(false); emit('move-right', false); }, [emit]);

  // ── Jump / Attack ──────────────────────────────────────────────────────────

  const startJump = useCallback(() => { setJumpHeld(true); emit('jump-press', true); }, [emit]);
  const endJump   = useCallback(() => { setJumpHeld(false); emit('jump-press', false); }, [emit]);

  const startAttack = useCallback(() => { setAttackHeld(true); emit('attack-press', true); }, [emit]);
  const endAttack   = useCallback(() => { setAttackHeld(false); emit('attack-press', false); }, [emit]);

  // Release all on touch cancel / focus loss
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

  // Only render on actual touch devices
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }, []);

  if (!isTouchDevice) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20 pointer-events-none select-none"
      style={{ touchAction: 'none' }}
    >
      {/* ── Left Side: D-Pad arrows ────────────────────────── */}
      <div className="absolute bottom-8 left-6 flex gap-3 pointer-events-auto">
        {/* Left arrow */}
        <TouchBtn
          active={leftHeld}
          onStart={startLeft}
          onEnd={endLeft}
          size="lg"
          aria-label="Move left"
        >
          <ArrowLeft />
        </TouchBtn>

        {/* Right arrow */}
        <TouchBtn
          active={rightHeld}
          onStart={startRight}
          onEnd={endRight}
          size="lg"
          aria-label="Move right"
        >
          <ArrowRight />
        </TouchBtn>
      </div>

      {/* ── Right Side: Jump + Attack ──────────────────────── */}
      <div className="absolute bottom-8 right-6 flex flex-col items-end gap-3 pointer-events-auto">
        {/* Attack (smaller, top) */}
        <TouchBtn
          active={attackHeld}
          onStart={startAttack}
          onEnd={endAttack}
          size="sm"
          accent="orange"
          aria-label="Attack"
        >
          <span className="text-xs font-bold text-white/70 tracking-wide">ATK</span>
        </TouchBtn>

        {/* Jump (larger, bottom) */}
        <TouchBtn
          active={jumpHeld}
          onStart={startJump}
          onEnd={endJump}
          size="lg"
          accent="blue"
          aria-label="Jump"
        >
          <ArrowUp />
        </TouchBtn>
      </div>
    </div>
  );
};

export default TouchControls;

// ── Sub-components ────────────────────────────────────────────────────────────

interface TouchBtnProps {
  active: boolean;
  onStart: () => void;
  onEnd: () => void;
  size: 'sm' | 'lg';
  accent?: 'blue' | 'orange';
  'aria-label': string;
  children: React.ReactNode;
}

const TouchBtn: FC<TouchBtnProps> = ({ active, onStart, onEnd, size, accent, children, 'aria-label': ariaLabel }) => {
  const base = size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  const accentBg = active
    ? accent === 'blue'
      ? 'bg-blue-500/40 border-blue-400/50'
      : accent === 'orange'
        ? 'bg-orange-500/40 border-orange-400/50'
        : 'bg-white/25 border-white/30'
    : 'bg-white/10 border-white/15';

  return (
    <button
      aria-label={ariaLabel}
      className={`${base} rounded-full flex items-center justify-center
                  border backdrop-blur-sm transition-colors duration-75
                  ${accentBg}`}
      style={{ touchAction: 'none' }}
      onTouchStart={(e) => { e.preventDefault(); onStart(); }}
      onTouchEnd={(e) => { e.preventDefault(); onEnd(); }}
      onTouchCancel={(e) => { e.preventDefault(); onEnd(); }}
    >
      {children}
    </button>
  );
};

const ArrowLeft: FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ArrowRight: FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const ArrowUp: FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/70">
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);
