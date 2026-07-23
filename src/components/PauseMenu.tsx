'use client';

import { useState, useEffect, useRef, type FC } from 'react';
import { useGameStore } from './GameStore';
import { getSfxEngine } from '@/game/audio';
import { resolvePauseKey } from './pause-keys';
import {
  getPauseConfirmationCopy,
  type PauseConfirmationAction,
} from './pause-confirmation';
import TouchControlSettings from './TouchControlSettings';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

const PauseMenu: FC<Props> = ({ onResume, onRestart, onQuit }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [confirmation, setConfirmation] = useState<PauseConfirmationAction | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const resumeButtonRef = useRef<HTMLButtonElement>(null);
  const cancelConfirmationRef = useRef<HTMLButtonElement>(null);
  const keyboardReadyRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);

  // Treat the pause sheet as a real modal: move focus into it, contain keyboard
  // navigation, and return focus to the control that opened it.
  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    resumeButtonRef.current?.focus({ preventScroll: true });

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => {
      document.removeEventListener('keydown', trapFocus);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (confirmation) cancelConfirmationRef.current?.focus({ preventScroll: true });
    else resumeButtonRef.current?.focus({ preventScroll: true });
  }, [confirmation]);

  // Keyboard shortcuts: R = Restart, Q = Main Menu.
  // - Grace period (250ms) so a key held through the pause transition does not
  //   fire before the sheet finishes mounting / the stagger animation starts.
  // - Modifier guard (via resolvePauseKey) prevents hijacking Ctrl+R reload,
  //   Cmd+Q quit browser, Alt+Q, Shift+R, and other OS/browser shortcuts.
  // - Debounce: keys auto-repeat on hold; only act on the first keydown.
  // - Escape is NOT bound here: page.tsx owns the global Escape toggle and
  //   already resumes when state === "paused". Binding it again would
  //   double-fire the resume action.
  // - Space is never bound: it is the jump key, and a reflexive press should
  //   never silently restart or quit a run from the pause screen.
  useEffect(() => {
    keyboardReadyRef.current = false;
    const grace = window.setTimeout(() => { keyboardReadyRef.current = true; }, 250);

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || confirmation) return;
      const action = resolvePauseKey(
        e.code,
        e.ctrlKey || e.metaKey || e.altKey || e.shiftKey,
      );
      if (!action) return;
      // Debounce: ignore if this exact key already fired since mount.
      if (lastKeyRef.current === e.code) return;
      // Wait until the mount grace window has elapsed.
      if (!keyboardReadyRef.current) return;
      lastKeyRef.current = e.code;
      e.preventDefault();
      setConfirmation(action);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(grace);
      window.removeEventListener('keydown', onKey);
    };
  }, [confirmation]);

  // page.tsx owns the global Escape-to-resume shortcut. While a destructive
  // confirmation is open, consume Escape during capture so it backs out to the
  // pause menu instead of unexpectedly resuming gameplay.
  useEffect(() => {
    if (!confirmation) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.code !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      lastKeyRef.current = null;
      setConfirmation(null);
    };
    document.addEventListener('keydown', cancelOnEscape, true);
    return () => document.removeEventListener('keydown', cancelOnEscape, true);
  }, [confirmation]);

  const confirmCopy = confirmation ? getPauseConfirmationCopy(confirmation) : null;
  const cancelConfirmation = () => {
    lastKeyRef.current = null;
    setConfirmation(null);
  };
  const runConfirmedAction = () => {
    if (confirmation === 'restart') onRestart();
    if (confirmation === 'quit') onQuit();
  };

  return (
    <div
      className="absolute inset-0 flex items-end sm:items-center justify-center"
      style={{ animation: 'iosFadeIn 0.18s ease' }}
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pause-menu-title"
    >
      <span id="pause-menu-title" className="sr-only">Game paused</span>
      {/* Frosted overlay */}
      <div
        className="absolute inset-0 ios-overlay"
        aria-hidden="true"
        onClick={confirmation ? cancelConfirmation : onResume}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 340,
          maxHeight: 'calc(100dvh - max(24px, env(safe-area-inset-top, 0px)) - max(24px, env(safe-area-inset-bottom, 0px)))',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          padding: '0 8px 16px',
          animation: 'iosModalIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {confirmation && confirmCopy ? (
          <div
            className="ios-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="pause-confirmation-title"
            aria-describedby="pause-confirmation-description"
            style={{
              padding: '24px 18px 14px',
              textAlign: 'center',
              boxShadow: '0 20px 64px rgba(0,0,0,0.72), 0 0 0 0.5px rgba(255,255,255,0.08)',
            }}
          >
            <div aria-hidden="true" style={{ fontSize: 30, lineHeight: 1, marginBottom: 12 }}>
              {confirmation === 'restart' ? '↻' : '⚠'}
            </div>
            <h2 id="pause-confirmation-title" className="ios-title2" style={{ marginBottom: 8 }}>
              {confirmCopy.title}
            </h2>
            <p
              id="pause-confirmation-description"
              className="ios-footnote"
              style={{ lineHeight: 1.45, margin: '0 auto 20px', maxWidth: 280 }}
            >
              {confirmCopy.description}
            </p>
            <button
              ref={cancelConfirmationRef}
              type="button"
              className="ios-btn-primary"
              onClick={cancelConfirmation}
              style={{ width: '100%', minHeight: 48, fontSize: 16, fontWeight: 700 }}
            >
              Keep Playing
            </button>
            <button
              type="button"
              className="ios-action-row ios-action-row-destructive"
              onClick={runConfirmedAction}
              style={{ width: '100%', minHeight: 48, marginTop: 6, fontWeight: 700 }}
            >
              {confirmCopy.confirmLabel}
            </button>
            <p className="ios-footnote" style={{ marginTop: 8 }}>
              Press Escape to go back
            </p>
          </div>
        ) : (
          <>
            {/* ── Main action sheet ───────────────────────────── */}
            <div
              className="ios-sheet"
              style={{
                marginBottom: 10,
                boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.06)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '16px 16px 12px',
                  borderBottom: '0.5px solid var(--ios-separator)',
                  gap: 4,
                }}
              >
                <div aria-hidden="true" style={{ fontSize: 20, lineHeight: 1, marginBottom: 2 }}>⏸</div>
                <h2
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--ios-label3)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Paused
                </h2>
              </div>

              <ActionRow
                icon={<PlayIcon />}
                label="Resume"
                bold
                buttonRef={resumeButtonRef}
                onClick={onResume}
                delay={30}
              />
              <ActionRow
                icon={<RestartIcon />}
                label="Restart"
                kbdHint="R"
                onClick={() => setConfirmation('restart')}
                delay={70}
              />
              <ActionRow
                icon={<SettingsIcon />}
                label={showSettings ? 'Hide Settings' : 'Settings'}
                muted
                onClick={() => setShowSettings((s) => !s)}
                delay={110}
              />
              <ActionRow
                icon={<QuitIcon />}
                label="Main Menu"
                destructive
                kbdHint="Q"
                onClick={() => setConfirmation('quit')}
                delay={150}
              />
            </div>

            <div
              className="ios-sheet"
              style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.06)' }}
            >
              <button
                className="ios-action-row ios-action-row-bold"
                onClick={onResume}
                style={{ animation: 'rowSlideIn 0.3s ease 0.2s both' }}
              >
                Cancel
              </button>
            </div>

            {showSettings && (
              <div
                style={{ marginTop: 10, animation: 'iosSlideDown 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
              >
                <SettingsPanel />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PauseMenu;

/* ── Action row with icon + stagger ─────────────────────────── */

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  bold?: boolean;
  muted?: boolean;
  destructive?: boolean;
  kbdHint?: string;
  buttonRef?: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  delay: number;
}

const ActionRow: FC<ActionRowProps> = ({
  icon,
  label,
  bold,
  muted,
  destructive,
  kbdHint,
  buttonRef,
  onClick,
  delay,
}) => (
  <button
    ref={buttonRef}
    className={[
      'ios-action-row',
      bold        ? 'ios-action-row-bold'        : '',
      muted       ? 'ios-action-row-label'       : '',
      destructive ? 'ios-action-row-destructive' : '',
    ].join(' ')}
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      animation: `rowSlideIn 0.3s ease ${delay}ms both`,
    }}
  >
    <span
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        opacity: 0.65,
      }}
    >
      {icon}
    </span>
    {label}
    {kbdHint && <kbd className="ios-kbd-hint" aria-hidden="true">{kbdHint}</kbd>}
  </button>
);

/* ── Settings Panel ─────────────────────────────────────────── */

const SettingsPanel: FC = () => {
  const { settings, setSettings } = useGameStore();

  return (
    <div>
      <p className="ios-section-header">Settings</p>
      <div className="ios-sheet">
        {/* Volume slider */}
        <div
          className="ios-row"
          style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, paddingTop: 13, paddingBottom: 13 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="ios-row-label">Volume</span>
            <span
              className="ios-footnote"
              style={{ fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}
            >
              {Math.round(settings.masterVolume * 100)}%
            </span>
          </div>
          <input
            type="range" min="0" max="1" step="0.05"
            value={settings.masterVolume}
            onChange={(e) => {
              setSettings({ masterVolume: parseFloat(e.target.value) });
              getSfxEngine().play('click');
            }}
          />
        </div>

        {/* Show FPS */}
        <div className="ios-row">
          <span className="ios-row-label">Show FPS</span>
          <IOSToggle
            checked={settings.showFPS}
            onChange={(v) => setSettings({ showFPS: v })}
          />
        </div>

        {/* Mobile vibration feedback */}
        <div className="ios-row">
          <span className="ios-row-label">Haptics</span>
          <IOSToggle
            checked={settings.hapticsEnabled}
            onChange={(v) => setSettings({ hapticsEnabled: v })}
          />
        </div>

        {/* Touch layout, target size, and visibility */}
        <TouchControlSettings />

        {/* Reduced particles */}
        <div className="ios-row">
          <span className="ios-row-label">Reduced Particles</span>
          <IOSToggle
            checked={settings.reducedParticles}
            onChange={(v) => setSettings({ reducedParticles: v })}
          />
        </div>

        {/* Reduced motion (accessibility) */}
        <ReducedMotionRow
          value={settings.reducedMotion}
          onChange={(reducedMotion) => setSettings({ reducedMotion })}
        />

        <CameraModeRow
          value={settings.cameraMode}
          onChange={(cameraMode) => setSettings({ cameraMode })}
        />
      </div>
    </div>
  );
};

const CameraModeRow: FC<{
  value: 'auto' | 'horizontal' | 'vertical';
  onChange: (value: 'auto' | 'horizontal' | 'vertical') => void;
}> = ({ value, onChange }) => {
  const modes: Array<{ id: 'auto' | 'horizontal' | 'vertical'; label: string }> = [
    { id: 'auto', label: 'Auto' },
    { id: 'horizontal', label: 'Wide' },
    { id: 'vertical', label: 'Tall' },
  ];

  return (
    <div className="ios-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <span className="ios-row-label">Camera</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={value === mode.id ? 'ios-btn-primary' : 'ios-btn-secondary'}
            onClick={() => {
              onChange(mode.id);
              getSfxEngine().play('click');
            }}
            style={{ height: 34, fontSize: 13 }}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── iOS Toggle ─────────────────────────────────────────────── */

const ReducedMotionRow: FC<{
  value: 'auto' | 'on' | 'off';
  onChange: (value: 'auto' | 'on' | 'off') => void;
}> = ({ value, onChange }) => {
  const options: Array<{ id: 'auto' | 'on' | 'off'; label: string; hint?: string }> = [
    { id: 'auto', label: 'Auto' },
    { id: 'on', label: 'On' },
    { id: 'off', label: 'Off' },
  ];

  return (
    <div className="ios-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <span className="ios-row-label">Reduced Motion</span>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={value === opt.id ? 'ios-btn-primary' : 'ios-btn-secondary'}
            onClick={() => {
              onChange(opt.id);
              getSfxEngine().play('click');
            }}
            style={{ height: 34, fontSize: 13 }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <span className="ios-footnote" style={{ marginTop: 2 }}>
        Auto honors your system setting. On cuts screen shake &amp; large animations.
      </span>
    </div>
  );
};

/* ── iOS Toggle (original) ──────────────────────────────────── */

const IOSToggle: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    className="ios-toggle-track"
    onClick={() => {
      onChange(!checked);
      getSfxEngine().play('click');
    }}
    style={{ background: checked ? 'var(--ios-green)' : 'var(--ios-fill)' }}
    role="switch"
    aria-checked={checked}
  >
    <div
      className="ios-toggle-thumb"
      style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
    />
  </button>
);

/* ── Row icons (minimal SVG) ─────────────────────────────────── */

const PlayIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const RestartIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

const SettingsIcon: FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const QuitIcon: FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
