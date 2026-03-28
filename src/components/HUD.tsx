'use client';

import { type FC } from 'react';
import { type GameStats, type GameSettings } from '@/game/state/game-state';

interface Props {
  stats: GameStats;
  settings: GameSettings;
}

const HUD: FC<Props> = ({ stats, settings }) => {
  const totalHearts = Math.min(Math.max(stats.maxHealth, 1), 5);
  const filledHearts = Math.max(0, stats.health);
  const isLowHealth = filledHearts === 1;

  return (
    <div
      className="absolute inset-x-0 top-0 z-10 pointer-events-none"
      style={{ padding: '16px 16px 0' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>

        {/* ── Left: Hearts + Coins + Power-ups ───────────────── */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeSlideUp 0.4s ease both' }}
        >
          {/* Hearts */}
          <div className="ios-hud-pill" style={{ gap: 4 }}>
            {Array.from({ length: totalHearts }).map((_, i) => (
              <HeartIcon
                key={i}
                filled={i < filledHearts}
                pulsing={isLowHealth && i < filledHearts}
              />
            ))}
          </div>

          {/* Coins */}
          <div className="ios-hud-pill" style={{ gap: 5 }}>
            <CoinIcon />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.88)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {stats.coins}
            </span>
          </div>

          {/* Power-ups */}
          {stats.powerUps.length > 0 && (
            <div style={{ display: 'flex', gap: 4, animation: 'fadeIn 0.25s ease both' }}>
              {stats.powerUps.map((pu, i) => (
                <div key={i} className="ios-hud-pill" style={{ fontSize: 14, lineHeight: 1 }}>
                  {pu}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Center: Score + Distance ────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            animation: 'fadeSlideUp 0.45s ease 0.05s both',
          }}
        >
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '-0.3px',
              color: 'rgba(255,255,255,0.95)',
              textShadow: '0 2px 14px rgba(0,0,0,0.65)',
              fontVariantNumeric: 'tabular-nums',
              lineHeight: 1.05,
            }}
          >
            {stats.score.toLocaleString()}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: 'rgba(235,235,245,0.32)',
              letterSpacing: '0.04em',
              fontVariantNumeric: 'tabular-nums',
              marginTop: 2,
            }}
          >
            {Math.round(stats.distance)}m
          </div>
        </div>

        {/* ── Right: Biome + FPS ──────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 6,
            animation: 'fadeSlideUp 0.4s ease 0.08s both',
          }}
        >
          <div className="ios-hud-pill">
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'rgba(235,235,245,0.48)',
                letterSpacing: '0.02em',
              }}
            >
              {stats.biome}
            </span>
          </div>
          {settings.showFPS && (
            <span
              style={{
                fontSize: 10,
                color: 'rgba(235,235,245,0.2)',
                fontVariantNumeric: 'tabular-nums',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                lineHeight: 1,
              }}
            >
              {stats.fps} fps
            </span>
          )}
        </div>

      </div>
    </div>
  );
};

export default HUD;

/* ── Icon components ─────────────────────────────────────────── */

const HeartIcon: FC<{ filled: boolean; pulsing: boolean }> = ({ filled, pulsing }) => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill={filled ? '#FF3B30' : 'rgba(255,255,255,0.14)'}
    style={
      pulsing
        ? { animation: 'heartBeat 1s ease-in-out infinite', filter: 'drop-shadow(0 0 3px rgba(255,59,48,0.55))' }
        : filled
          ? { filter: 'drop-shadow(0 0 2px rgba(255,59,48,0.38))' }
          : undefined
    }
  >
    <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
  </svg>
);

const CoinIcon: FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#FFD60A" />
    <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
    <text
      x="12" y="16"
      textAnchor="middle"
      fontSize="11"
      fontWeight="700"
      fill="rgba(0,0,0,0.55)"
      fontFamily="-apple-system, sans-serif"
    >
      $
    </text>
  </svg>
);
