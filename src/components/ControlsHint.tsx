'use client';

import { useEffect, useState, type FC } from 'react';
import { playUiClick } from '@/game/audio';
import { Icon } from './Icon';

/**
 * Compact controls explainer for the start screen.
 * - Desktop (pointer: fine): keyboard map
 * - Touch (pointer: coarse): on-screen layout summary
 * - Collapsible; collapsed state persists in localStorage so returning
 *   players don't see it after their first session.
 */
const ControlsHint: FC<{ dismissible?: boolean }> = ({ dismissible = true }) => {
  const [isTouch, setIsTouch] = useState(false);
  const [dismissed, setDismissed] = useState(true); // hidden until mounted (SSR-safe)

  useEffect(() => {
    try {
      setIsTouch(window.matchMedia('(pointer: coarse)').matches);
      setDismissed(localStorage.getItem('dash-controls-hint-dismissed') === '1');
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissible && dismissed) return null;

  const dismiss = () => {
    playUiClick();
    setDismissed(true);
    try { localStorage.setItem('dash-controls-hint-dismissed', '1'); } catch {}
  };

  return (
    <div
      role="note"
      aria-label="Controls overview"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
        padding: '10px 14px',
        margin: '0 0 4px',
        borderRadius: 12,
        background: 'rgba(13,16,26,0.72)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: 12.5,
        color: 'rgba(255,255,255,0.62)',
        lineHeight: 1.5,
      }}
    >
      {isTouch ? (
        <>
          <strong style={{ color: '#fff', fontSize: 12, letterSpacing: 0.4 }}>TOUCH CONTROLS</strong>
          <span>Left side: slide pad to move · Right side: buttons for jump / attack / melee / dash / special / carry teammate · Pause sits top-right</span>
          <span>Hold attack to keep firing · Layout is adjustable in Settings</span>
        </>
      ) : (
        <>
          <strong style={{ color: '#fff', fontSize: 12, letterSpacing: 0.4 }}>KEYBOARD</strong>
          <span><Key>A</Key>/<Key>D</Key> or <Key>←</Key>/<Key>→</Key> move</span>
          <span><Key>Space</Key> jump · Ninja, Mage, Spirit / double-jump power-up: jump again in air · tap before landing to buffer</span>
          <span>Hold <Key>Z</Key> shoot · Hold <Key>C</Key> melee</span>
          <span>Hold a direction + <Key>X</Key> dash · then <Key>Space</Key> dash-jump</span>
          <span><Key>V</Key> special</span>
          <span><Key>Esc</Key> pause</span>
        </>
      )}
      {dismissible && <button
        onClick={dismiss}
        aria-label="Hide controls hint"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          marginLeft: 'auto',
          minHeight: 44,
          background: 'transparent',
          border: 'none',
          color: 'var(--dv-muted)',
          fontSize: 13,
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: 8,
        }}
      >
        Got it <Icon name="close" size={13} />
      </button>}
    </div>
  );
};

const Key: FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd
    style={{
      display: 'inline-block',
      minWidth: 20,
      padding: '1px 5px',
      borderRadius: 5,
      background: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.14)',
      borderBottomWidth: 2,
      fontSize: 12,
      fontFamily: 'inherit',
      color: '#fff',
      textAlign: 'center',
    }}
  >
    {children}
  </kbd>
);

export default ControlsHint;
