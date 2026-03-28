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
        <div className="ios-sheet" style={{ marginBottom: 10 }}>
          {/* Sheet title */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '14px 16px 12px',
              borderBottom: '0.5px solid var(--ios-separator)',
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--ios-label2)',
                letterSpacing: '0.02em',
              }}
            >
              PAUSED
            </p>
          </div>

          {/* Resume — primary bold */}
          <button
            className="ios-action-row ios-action-row-bold"
            onClick={onResume}
          >
            Resume
          </button>

          {/* Restart */}
          <button
            className="ios-action-row"
            onClick={onRestart}
          >
            Restart
          </button>

          {/* Settings toggle */}
          <button
            className="ios-action-row ios-action-row-label"
            onClick={() => setShowSettings((s) => !s)}
          >
            Settings
          </button>

          {/* Quit — destructive */}
          <button
            className="ios-action-row ios-action-row-destructive"
            onClick={onQuit}
          >
            Quit to Menu
          </button>
        </div>

        {/* ── Cancel (iOS pattern) ─────────────────────────── */}
        <div className="ios-sheet">
          <button
            className="ios-action-row ios-action-row-bold"
            onClick={onResume}
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
