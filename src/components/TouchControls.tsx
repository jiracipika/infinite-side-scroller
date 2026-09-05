'use client';

import { useEffect, useCallback, useRef, useState, type FC } from 'react';
import type { TouchControlLayout, TouchControlSize } from '@/game/state/game-state';
import {
  resolveTouchButtonDimension,
  resolveTouchControlPlacement,
  resolveTouchDirection,
  type TouchButtonSize,
} from '@/game/input/touch-controls';

/**
 * Touch controls overlay for mobile — neon ink controller panels.
 *
 * Layout:
 *   Left side  — Left / Right D-pad buttons
 *   Right side — Special / Dash / ATK / Melee / Carry (small) + Jump (large, lime)
 *
 * Emits 'game-input' CustomEvents consumed by InputManager.
 * Respects iOS safe-area-inset-bottom for notched devices.
 */
interface TouchControlsProps {
  channel?: string;
  compact?: boolean;
  forceVisible?: boolean;
  hapticsEnabled?: boolean;
  layout?: TouchControlLayout;
  controlSize?: TouchControlSize;
  opacity?: number;
  onPause?: () => void;
}

const TouchControls: FC<TouchControlsProps> = ({
  channel = 'game-input',
  compact = false,
  forceVisible = false,
  hapticsEnabled = true,
  layout = 'standard',
  controlSize = 'standard',
  opacity = 0.82,
  onPause,
}) => {
  const [leftHeld, setLeftHeld] = useState(false);
  const [rightHeld, setRightHeld] = useState(false);
  const [jumpHeld, setJumpHeld] = useState(false);
  const [attackHeld, setAttackHeld] = useState(false);
  const [dashHeld, setDashHeld] = useState(false);
  const [carryHeld, setCarryHeld] = useState(false);
  const [meleeHeld, setMeleeHeld] = useState(false);
  const [specialHeld, setSpecialHeld] = useState(false);
  const movementDirectionRef = useRef<-1 | 0 | 1>(0);

  const emit = useCallback((type: string, value: boolean) => {
    window.dispatchEvent(new CustomEvent(channel, { detail: { type, value } }));
  }, [channel]);

  const pulseHaptic = useCallback((pattern: number | number[] = 8) => {
    // Best-effort mobile feedback. Unsupported browsers simply no-op.
    if (!hapticsEnabled || typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    try { navigator.vibrate(pattern); } catch { /* Ignore restricted browser failures. */ }
  }, [hapticsEnabled]);

  const setMovementDirection = useCallback((next: -1 | 0 | 1) => {
    const previous = movementDirectionRef.current;
    if (previous === next) return;
    if (previous === -1) emit('move-left', false);
    if (previous === 1) emit('move-right', false);
    movementDirectionRef.current = next;
    setLeftHeld(next === -1);
    setRightHeld(next === 1);
    if (next === -1) emit('move-left', true);
    if (next === 1) emit('move-right', true);
    if (next !== 0) pulseHaptic(6);
  }, [emit, pulseHaptic]);
  const startJump = useCallback(() => { emit('jump-press', true); setJumpHeld(true); pulseHaptic(10); }, [emit, pulseHaptic]);
  const endJump = useCallback(() => { emit('jump-press', false); setJumpHeld(false); }, [emit]);
  const startAttack = useCallback(() => { emit('attack-press', true); setAttackHeld(true); pulseHaptic([8, 18, 8]); }, [emit, pulseHaptic]);
  const endAttack = useCallback(() => { emit('attack-press', false); setAttackHeld(false); }, [emit]);
  const startDash = useCallback(() => { emit('dash-press', true); setDashHeld(true); pulseHaptic(14); }, [emit, pulseHaptic]);
  const endDash = useCallback(() => { emit('dash-press', false); setDashHeld(false); }, [emit]);
  const startCarry = useCallback(() => { emit('carry-press', true); setCarryHeld(true); pulseHaptic(8); }, [emit, pulseHaptic]);
  const endCarry = useCallback(() => { emit('carry-press', false); setCarryHeld(false); }, [emit]);
  const startMelee = useCallback(() => { emit('melee-press', true); setMeleeHeld(true); pulseHaptic([12, 20, 12]); }, [emit, pulseHaptic]);
  const endMelee = useCallback(() => { emit('melee-press', false); setMeleeHeld(false); }, [emit]);
  const startSpecial = useCallback(() => { emit('special-press', true); setSpecialHeld(true); pulseHaptic([16, 25, 22]); }, [emit, pulseHaptic]);
  const endSpecial = useCallback(() => { emit('special-press', false); setSpecialHeld(false); }, [emit]);

  const releaseAll = useCallback(() => {
    movementDirectionRef.current = 0;
    setLeftHeld(false); setRightHeld(false);
    setJumpHeld(false); setAttackHeld(false); setDashHeld(false); setCarryHeld(false); setMeleeHeld(false); setSpecialHeld(false);
    emit('move-left', false); emit('move-right', false);
    emit('jump-press', false); emit('attack-press', false); emit('dash-press', false); emit('carry-press', false); emit('melee-press', false); emit('special-press', false);
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
  const placement = resolveTouchControlPlacement(layout);
  const movementSide = placement.movement === 'right'
    ? { right: compact ? 10 : 16 }
    : { left: compact ? 10 : 16 };
  const actionSide = placement.actions === 'left'
    ? { left: compact ? 10 : 16 }
    : { right: compact ? 10 : 16 };
  const safeOpacity = Math.max(0.55, Math.min(1, opacity));

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none select-none"
      style={{ touchAction: 'none' }}
      role="group"
      aria-label="Touch game controls"
    >
      {/* Pause button — top-right corner, above the HUD so it never overlaps. */}
      {onPause && (
        <button
          type="button"
          aria-label="Pause game"
          onPointerDown={(e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            pulseHaptic(8);
            onPause();
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            top: 'max(12px, env(safe-area-inset-top, 12px))',
            right: 'max(12px, env(safe-area-inset-right, 12px))',
            width: compact ? 38 : 44,
            height: compact ? 38 : 44,
            borderRadius: '4px 16px 4px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            pointerEvents: 'auto',
            color: '#f4f2ed',
            background: '#1c1c2e',
            border: '2px solid #9570ff',
            opacity: safeOpacity,
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            zIndex: 5,
          }}
        >
          <PauseIcon />
        </button>
      )}

      {/* Movement cluster — side follows the player's handedness preference. */}
      <div
        className="absolute pointer-events-auto"
        role="group"
        aria-label="Movement controls"
        style={{
          bottom: compact ? 'max(12px, env(safe-area-inset-bottom, 12px))' : bottomInset,
          ...movementSide,
          display: 'flex',
          gap: compact ? 8 : 10,
          opacity: safeOpacity,
        }}
      >
        <MovementPad
          direction={leftHeld ? -1 : rightHeld ? 1 : 0}
          onDirectionChange={setMovementDirection}
          controlSize={controlSize}
          compact={compact}
        />
      </div>

      {/* Action cluster occupies the opposite side. */}
      <div
        className="absolute pointer-events-auto"
        role="group"
        aria-label="Action controls"
        style={{
          bottom: compact ? 'max(12px, env(safe-area-inset-bottom, 12px))' : bottomInset,
          ...actionSide,
          display: 'flex',
          flexDirection: 'column',
          alignItems: layout === 'mirrored' ? 'flex-start' : 'flex-end',
          gap: compact ? 8 : 10,
          opacity: safeOpacity,
        }}
      >
        <div style={{ display: 'flex', gap: compact ? 8 : 10 }}>
          <TouchBtn active={specialHeld} onStart={startSpecial} onEnd={endSpecial}
            size={compact ? 'xs' : 'sm'} controlSize={controlSize} compact={compact}
            tint="cyan" aria-label="Special attack"><SpecialLabel /></TouchBtn>
          <TouchBtn
            active={dashHeld}
            onStart={startDash}
            onEnd={endDash}
            size={compact ? 'xs' : 'sm'}
            controlSize={controlSize}
            compact={compact}
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
            controlSize={controlSize}
            compact={compact}
            tint="orange"
            aria-label="Attack"
          >
            <AtkLabel />
          </TouchBtn>
          <TouchBtn
            active={meleeHeld}
            onStart={startMelee}
            onEnd={endMelee}
            size={compact ? 'xs' : 'sm'}
            controlSize={controlSize}
            compact={compact}
            tint="red"
            aria-label="Melee slash"
          >
            <MeleeLabel />
          </TouchBtn>
          <TouchBtn
            active={carryHeld}
            onStart={startCarry}
            onEnd={endCarry}
            size={compact ? 'xs' : 'sm'}
            controlSize={controlSize}
            compact={compact}
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
          controlSize={controlSize}
          compact={compact}
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

/* ── Sliding Movement Pad ───────────────────────────────────── */

interface MovementPadProps {
  direction: -1 | 0 | 1;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
  controlSize: TouchControlSize;
  compact: boolean;
}

const MovementPad: FC<MovementPadProps> = ({ direction, onDirectionChange, controlSize, compact }) => {
  const activePointerRef = useRef<number | null>(null);
  const height = resolveTouchButtonDimension(compact ? 'md' : 'lg', controlSize, compact);
  const width = Math.round(height * 2.15);

  const updateFromPointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onDirectionChange(resolveTouchDirection(e.clientX - rect.left, rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    updateFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    e.preventDefault();
    updateFromPointer(e);
  };

  const releasePointer = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    onDirectionChange(0);
  };

  return (
    <button
      type="button"
      aria-label={`Movement pad. ${direction === -1 ? 'Moving left' : direction === 1 ? 'Moving right' : 'Neutral'}. Slide left or right`}
      style={{
        width,
        height,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        borderRadius: '4px 18px 4px 18px',
        overflow: 'hidden',
        color: '#f4f2ed',
        background: '#1c1c2e',
        border: '2px solid #9570ff',
        boxShadow: '4px 4px 0 #0a0a0f',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={releasePointer}
      onPointerCancel={releasePointer}
      onLostPointerCapture={(e) => {
        if (activePointerRef.current === e.pointerId) {
          activePointerRef.current = null;
          onDirectionChange(0);
        }
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span style={{ height: '100%', display: 'grid', placeItems: 'center', background: direction === -1 ? '#c7ff4d' : 'transparent', color: direction === -1 ? '#0a0a0f' : '#c7ff4d' }}>
        <ChevronLeft />
      </span>
      <span style={{ height: '100%', display: 'grid', placeItems: 'center', background: direction === 1 ? '#c7ff4d' : 'transparent', color: direction === 1 ? '#0a0a0f' : '#c7ff4d' }}>
        <ChevronRight />
      </span>
    </button>
  );
};

/* ── Touch Button ───────────────────────────────────────────── */

interface TouchBtnProps {
  active: boolean;
  onStart: () => void;
  onEnd: () => void;
  size: TouchButtonSize;
  controlSize: TouchControlSize;
  compact: boolean;
  tint?: 'blue' | 'orange' | 'purple' | 'green' | 'cyan' | 'red';
  'aria-label': string;
  children: React.ReactNode;
}

// Semantic accents shared by held fills and idle outlines. Input bindings stay
// independent of appearance; opacity remains the player's explicit preference.
const inkTint = (accent: string) => ({
  bg: '#1c1c2e', bgActive: accent, border: accent, borderActive: accent,
});
const TINTS = {
  blue: inkTint('#c7ff4d'),
  orange: inkTint('#ff7166'),
  purple: inkTint('#9570ff'),
  green: inkTint('#c7ff4d'),
  cyan: inkTint('#9570ff'),
  red: inkTint('#ff7166'),
  none: inkTint('#f4f2ed'),
};

const TouchBtn: FC<TouchBtnProps> = ({
  active, onStart, onEnd, size, controlSize, compact, tint, children, 'aria-label': ariaLabel,
}) => {
  const activePointerRef = useRef<number | null>(null);
  const dim = resolveTouchButtonDimension(size, controlSize, compact);
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
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        width: dim,
        height: dim,
        borderRadius: '4px 16px 4px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: active ? '#0a0a0f' : t.border,
        background: active ? t.bgActive : t.bg,
        border: `1.5px solid ${active ? t.borderActive : t.border}`,
        boxShadow: active ? '1px 1px 0 #0a0a0f' : '4px 4px 0 #0a0a0f',
        transition: 'background 0.07s ease, border-color 0.07s ease, box-shadow 0.1s ease, transform 0.08s ease',
        transform: 'none',
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

const STROKE = 'currentColor';

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
    stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M18 15l-6-6-6 6" />
  </svg>
);

const AtkLabel: FC = () => (
  <span style={{
    fontSize: 11,
    fontWeight: 800,
    color: 'inherit',
    letterSpacing: '0.06em',
    lineHeight: 1,
  }}>
    ATK
  </span>
);

const MeleeLabel: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={STROKE} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
  >
    {/* Sword: blade + guard, tilted like the DashLabel arrow language */}
    <path d="M14.5 4.5L19.5 9.5L9 20L4 20L4 15Z" fill="rgba(255,255,255,0.22)" />
    <path d="M14.5 4.5L19.5 9.5" />
    <path d="M7.5 13.5L10.5 16.5" />
  </svg>
);

const SpecialLabel: FC = () => (
  <span style={{ fontSize: 15, fontWeight: 900, color: 'inherit', lineHeight: 1 }}>✦</span>
);

const DashLabel: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
    stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);

const CarryLabel: FC = () => (
  <span style={{
    fontSize: 10,
    fontWeight: 800,
    color: 'inherit',
    letterSpacing: '0.05em',
    lineHeight: 1,
  }}>
    HELP
  </span>
);

const PauseIcon: FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={STROKE}>
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);