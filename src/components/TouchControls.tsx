'use client';

import { useEffect, useRef, type FC, useCallback } from 'react';

/**
 * Touch controls overlay for mobile.
 * Virtual joystick on left, jump button on right.
 */
const TouchControls: FC = () => {
  const leftRef = useRef<HTMLDivElement>(null);
  const jumpRef = useRef<HTMLButtonElement>(null);
  const activeTouches = useRef<Map<number, { type: 'move' | 'jump'; startX: number; startY: number }>>(new Map());

  const emit = useCallback((type: string, value: boolean | number) => {
    window.dispatchEvent(new CustomEvent('game-input', { detail: { type, value } }));
  }, []);

  useEffect(() => {
    const area = leftRef.current;
    const jump = jumpRef.current;
    if (!area || !jump) return;

    const prevent = (e: TouchEvent) => e.preventDefault();

    const handleTouchStart = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        // Check if touch is on jump button
        const jr = jump.getBoundingClientRect();
        if (t.clientX >= jr.left - 20 && t.clientX <= jr.right + 20 &&
            t.clientY >= jr.top - 20 && t.clientY <= jr.bottom + 20) {
          activeTouches.current.set(t.identifier, { type: 'jump', startX: t.clientX, startY: t.clientY });
          emit('jump-press', true);
          continue;
        }

        activeTouches.current.set(t.identifier, { type: 'move', startX: t.clientX, startY: t.clientY });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const data = activeTouches.current.get(t.identifier);
        if (!data || data.type !== 'move') continue;

        const dx = t.clientX - data.startX;
        const threshold = 15;

        if (dx < -threshold) emit('move-left', true);
        else emit('move-left', false);

        if (dx > threshold) emit('move-right', true);
        else emit('move-right', false);
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        const data = activeTouches.current.get(t.identifier);
        if (data?.type === 'jump') emit('jump-press', false);
        if (data?.type === 'move') {
          emit('move-left', false);
          emit('move-right', false);
        }
        activeTouches.current.delete(t.identifier);
      }
    };

    // Only attach on touch devices
    const mql = window.matchMedia('(hover: none) and (pointer: coarse)');
    if (!mql.matches) return;

    area.addEventListener('touchstart', handleTouchStart, { passive: false });
    area.addEventListener('touchmove', handleTouchMove, { passive: false });
    area.addEventListener('touchend', handleTouchEnd, { passive: false });
    area.addEventListener('touchcancel', handleTouchEnd, { passive: false });
    jump.addEventListener('touchstart', prevent, { passive: false });

    return () => {
      area.removeEventListener('touchstart', handleTouchStart);
      area.removeEventListener('touchmove', handleTouchMove);
      area.removeEventListener('touchend', handleTouchEnd);
      area.removeEventListener('touchcancel', handleTouchEnd);
      jump.removeEventListener('touchstart', prevent);
    };
  }, [emit]);

  return (
    <div className="absolute inset-0 z-20 md:hidden">
      {/* Left half: movement area */}
      <div
        ref={leftRef}
        className="absolute left-0 top-0 w-1/2 h-full"
        style={{ touchAction: 'none' }}
      >
        {/* Visual joystick hint */}
        <div className="absolute bottom-24 left-8 w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/15" />
        </div>
      </div>

      {/* Right side: jump button */}
      <button
        ref={jumpRef}
        className="absolute bottom-24 right-8 w-16 h-16 rounded-full
                   bg-white/10 border border-white/15 backdrop-blur-sm
                   flex items-center justify-center
                   active:bg-white/20 active:scale-95 transition-all"
        style={{ touchAction: 'none' }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/60">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
};

export default TouchControls;
