'use client';

import { useState, type FC } from 'react';
import { useGameStore } from './GameStore';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

const PauseMenu: FC<Props> = ({ onResume, onRestart, onQuit }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div
      className="absolute inset-0 flex items-end sm:items-center justify-center"
      style={{ animation: 'iosFadeIn 0.18s ease' }}
    >
      {/* Frosted overlay */}
      <div className="absolute inset-0 ios-overlay" onClick={onResume} />

      {/* Sheet */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 340,
          padding: '0 8px 16px',
          animation: 'iosModalIn 0.38s cubic-bezier(0.34,1.56,0.64,1) both',
        }}
      >
        {/* ── Main action sheet ───────────────────────────── */}
        <div
          className="ios-sheet"
          style={{
            marginBottom: 10,
            boxShadow: '0 16px 48px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.06)',
          }}
        >
          {/* Sheet title */}
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
            <div style={{ fontSize: 20, lineHeight: 1, marginBottom: 2 }}>⏸</div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--ios-label3)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Paused
            </p>
          </div>

          {/* Resume — primary bold */}
          <ActionRow
            icon={<PlayIcon />}
            label="Resume"
            bold
            onClick={onResume}
            delay={30}
          />

          {/* Restart */}
          <ActionRow
            icon={<RestartIcon />}
            label="Restart"
            onClick={onRestart}
            delay={70}
          />

          {/* Settings toggle */}
          <ActionRow
            icon={<SettingsIcon />}
            label={showSettings ? 'Hide Settings' : 'Settings'}
            muted
            onClick={() => setShowSettings((s) => !s)}
            delay={110}
          />

          {/* Quit — destructive */}
          <ActionRow
            icon={<QuitIcon />}
            label="Quit to Menu"
            destructive
            onClick={onQuit}
            delay={150}
          />
        </div>

        {/* ── Cancel (iOS pattern) ─────────────────────────── */}
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

        {/* ── Settings expansion ───────────────────────────── */}
        {showSettings && (
          <div
            style={{ marginTop: 10, animation: 'iosSlideDown 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <SettingsPanel />
          </div>
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
  onClick: () => void;
  delay: number;
}

const ActionRow: FC<ActionRowProps> = ({ icon, label, bold, muted, destructive, onClick, delay }) => (
  <button
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
            onChange={(e) => setSettings({ masterVolume: parseFloat(e.target.value) })}
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

        {/* Reduced particles */}
        <div className="ios-row">
          <span className="ios-row-label">Reduced Particles</span>
          <IOSToggle
            checked={settings.reducedParticles}
            onChange={(v) => setSettings({ reducedParticles: v })}
          />
        </div>
      </div>
    </div>
  );
};

/* ── iOS Toggle ─────────────────────────────────────────────── */

const IOSToggle: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    className="ios-toggle-track"
    onClick={() => onChange(!checked)}
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
