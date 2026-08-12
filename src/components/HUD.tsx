'use client';

import { useRef, useState, useEffect, type FC } from 'react';
import { type GameStats, type GameSettings, type PowerUpTimerEntry } from '@/game/state/game-state';
import { useGameHaptics } from '@/game/input/haptics';
import { fpsBucket } from './fps-readout';

interface Props {
  stats: GameStats;
  settings: GameSettings;
}

const HUD: FC<Props> = ({ stats, settings }) => {
  // Gameplay haptics (mobile). No-op on browsers without the Vibration API.
  useGameHaptics(stats, settings.hapticsEnabled);

  const totalHearts = Math.min(Math.max(stats.maxHealth, 1), 5);
  const filledHearts = Math.max(0, stats.health);
  const isLowHealth = filledHearts === 1;
  const isDead = filledHearts === 0;

  // Score flash on increase (debounced — only triggers every ~200ms change)
  const prevScoreRef = useRef(stats.score);
  const [scoreFlash, setScoreFlash] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (stats.score > prevScoreRef.current) {
      prevScoreRef.current = stats.score;
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      setScoreFlash(true);
      flashTimerRef.current = setTimeout(() => setScoreFlash(false), 280);
    } else {
      prevScoreRef.current = stats.score;
    }
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [stats.score]);

  // Combo flash animation
  const prevComboRef = useRef(stats.comboCount ?? 0);
  const [comboFlash, setComboFlash] = useState(false);
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cc = stats.comboCount ?? 0;
    if (cc > prevComboRef.current) {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      setComboFlash(true);
      comboTimerRef.current = setTimeout(() => setComboFlash(false), 200);
    }
    prevComboRef.current = cc;
    return () => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    };
  }, [stats.comboCount]);

  // Combo decay urgency — communicates how much time is left before the combo
  // resets. Transitions from green → yellow → red as the window closes, and
  // enables a fast pulse in the final second so players feel the pressure.
  const COMBO_DECAY_SECONDS = 3.0;
  const comboTime = stats.comboTimeRemaining ?? 0;
  const comboFraction = Math.min(1, comboTime / COMBO_DECAY_SECONDS);
  const comboUrgencyActive = comboTime > 0 && comboTime < 1.5;
  const comboUrgencyFastPulse = comboTime > 0 && comboTime < 1.0;
  const comboUrgency = {
    fraction: comboFraction,
    gradient:
      comboFraction < 0.33
        ? 'linear-gradient(90deg, #ef4444, #f87171)'
        : comboFraction < 0.66
          ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
          : 'linear-gradient(90deg, #22c55e, #4ade80)',
    active: comboUrgencyActive,
    fastPulse: comboUrgencyFastPulse,
  };

  return (
    <>
      {/* Low health vignette — fullscreen pulsing red edge */}
      {(isLowHealth || isDead) && (
        <div
          className="absolute inset-0 z-0 pointer-events-none ios-low-health-vignette"
          aria-hidden="true"
        />
      )}

      <div
        className="absolute inset-x-0 top-0 z-10 pointer-events-none"
        role="status"
        aria-live="off"
        aria-label="Heads up display"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 16px)',
          paddingRight: 'calc(env(safe-area-inset-right, 0px) + 16px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>

          {/* ── Left: Hearts + Coins + Power-ups ───────────────── */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 6, animation: 'fadeSlideUp 0.4s ease both' }}
          >
            {/* Hearts */}
            <div
              className="ios-hud-pill"
              style={{ gap: 5 }}
              aria-label={`Health: ${filledHearts} of ${totalHearts} hearts${isLowHealth ? ', low health' : ''}`}
              role="status"
            >
              {Array.from({ length: totalHearts }).map((_, i) => (
                <HeartIcon
                  key={i}
                  filled={i < filledHearts}
                  pulsing={isLowHealth && i < filledHearts}
                />
              ))}
            </div>

            {/* Coins */}
            <div className="ios-hud-pill" style={{ gap: 5 }} aria-label={`${stats.coins} coins`}>
              <CoinIcon />
              <span
                aria-hidden="true"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--ios-label)',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {stats.coins}
              </span>
            </div>

            {/* Extra lives — the run starts with two, so only surface earned lives. */}
            {stats.lives > 2 && (
              <div className="ios-hud-pill" style={{ gap: 4 }} aria-label={`${stats.lives - 2} extra lives`}>
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--ios-orange)',
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {"\u2764"}+{stats.lives - 2}
                </span>
              </div>
            )}

            {/* Power-ups — with countdown bars for timed effects */}
            {stats.powerUps.length > 0 && (
              <div style={{ display: 'flex', gap: 4, animation: 'fadeIn 0.25s ease both' }}>
                {stats.powerUps.map((pu, i) => {
                  // Match the emoji to the timer entry so we can show the bar.
                  const timerEntry = stats.powerUpTimers?.find(t => POWER_UP_EMOJI[t.type] === pu);
                  return (
                    <PowerUpPill
                      key={`${pu}-${i}`}
                      emoji={pu}
                      timer={timerEntry}
                    />
                  );
                })}
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
              key={scoreFlash ? 'flash' : 'idle'}
              aria-label={`${stats.score.toLocaleString()} points`}
              style={{
                fontSize: 32,
                fontWeight: 700,
                letterSpacing: '-0.4px',
                color: 'var(--ios-label)',
                textShadow: '0 2px 16px rgba(0,0,0,0.7)',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1.05,
                animation: scoreFlash ? 'scoreFlash 0.28s ease both' : undefined,
                transformOrigin: 'center bottom',
              }}
            >
              <span aria-hidden="true">{stats.score.toLocaleString()}</span>
            </div>
            <div
              aria-hidden="true"
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: 'var(--ios-label3)',
                letterSpacing: '0.04em',
                fontVariantNumeric: 'tabular-nums',
                marginTop: 3,
              }}
            >
              {Math.round(stats.distance)}m
            </div>

            {/* Level progress bar */}
            {stats.levelTarget && stats.levelTarget > 0 && (
              <div style={{ marginTop: 4, width: 80 }} role="progressbar" aria-valuenow={Math.round(((stats.levelProgress ?? stats.distance) / stats.levelTarget) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Level progress">
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 2,
                    width: `${Math.min(100, ((stats.levelProgress ?? stats.distance) / stats.levelTarget) * 100)}%`,
                    background: 'linear-gradient(90deg, var(--ios-green), var(--ios-tint))',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.62)', marginTop: 2, textAlign: 'center', fontWeight: 700 }}>
                  {Math.floor(stats.levelProgress ?? stats.distance)}/{stats.levelTarget}{stats.levelObjective === 'coins' ? ' coins' : stats.levelObjective === 'kills' ? ' KOs' : 'm'}
                </div>
                {stats.levelTimeRemaining !== undefined && stats.levelTimeRemaining > 0 && (
                  <div
                    aria-hidden="true"
                    style={{
                      fontSize: 10, fontWeight: 700, color: stats.levelTimeRemaining < 10 ? 'var(--ios-red)' : 'var(--ios-tint)',
                      marginTop: 2, textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Math.ceil(stats.levelTimeRemaining)}s
                  </div>
                )}
              </div>
            )}

            {/* Character special — the ✦ touch control / V key starts a short
                pulse attack, then this meter makes its timed cooldown honest. */}
            {stats.specialName && stats.specialCooldownTotal && (
              <div
                className="ios-hud-pill"
                aria-label={`${stats.specialName}: ${stats.specialActiveRemaining && stats.specialActiveRemaining > 0 ? 'active' : `${Math.ceil(stats.specialCooldownRemaining ?? 0)} seconds until ready`}`}
                style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 86 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 9, fontWeight: 800, color: stats.specialActiveRemaining && stats.specialActiveRemaining > 0 ? '#67e8f9' : 'rgba(255,255,255,0.7)' }}>
                  <span>✦ {stats.specialName}</span>
                  <span>{stats.specialActiveRemaining && stats.specialActiveRemaining > 0 ? 'NOW' : `${Math.ceil(stats.specialCooldownRemaining ?? 0)}s`}</span>
                </div>
                <div aria-hidden="true" style={{ height: 3, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,0.14)' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${stats.specialActiveRemaining && stats.specialActiveRemaining > 0 ? 100 : Math.max(0, Math.min(100, (1 - (stats.specialCooldownRemaining ?? 0) / stats.specialCooldownTotal) * 100))}%`,
                    background: stats.specialActiveRemaining && stats.specialActiveRemaining > 0 ? 'linear-gradient(90deg, #22d3ee, #c084fc, #facc15)' : 'linear-gradient(90deg, #0ea5e9, #67e8f9)',
                    transition: 'width 0.12s linear',
                  }} />
                </div>
              </div>
            )}

            {/* Combo counter with decay urgency bar */}
            {(stats.comboCount ?? 0) > 1 && (
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div
                  key={comboFlash ? 'flash' : 'idle'}
                  aria-label={`Combo of ${stats.comboCount}, multiplier ${stats.comboMultiplier}x`}
                  style={{
                    padding: '2px 10px',
                    borderRadius: 10,
                    background: comboUrgency.active
                      ? 'rgba(239, 68, 68, 0.22)'
                      : 'rgba(255, 214, 10, 0.22)',
                    border: comboUrgency.active
                      ? '1px solid rgba(239, 68, 68, 0.5)'
                      : '1px solid rgba(255, 214, 10, 0.4)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: comboUrgency.active ? 'var(--ios-red)' : 'var(--ios-yellow)',
                    fontVariantNumeric: 'tabular-nums',
                    animation: comboUrgency.fastPulse
                      ? 'comboUrgencyPulse 0.4s ease-in-out infinite alternate'
                      : comboFlash
                        ? 'scoreFlash 0.2s ease both'
                        : undefined,
                    textShadow: comboUrgency.active
                      ? '0 0 8px rgba(239, 68, 68, 0.6)'
                      : '0 0 8px rgba(255, 214, 10, 0.5)',
                  }}
                >
                  <span aria-hidden="true">{stats.comboCount} COMBO x{stats.comboMultiplier}</span>
                </div>
                {/* Combo decay urgency bar */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 76,
                    height: 3,
                    borderRadius: 2,
                    background: 'rgba(255,255,255,0.1)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{
                    height: '100%',
                    width: `${comboUrgency.fraction * 100}%`,
                    borderRadius: 2,
                    background: comboUrgency.gradient,
                    transition: 'width 0.12s linear',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Biome + FPS ──────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
              // Keep biome/FPS clear of pause button in the top-right corner.
              marginRight: 46,
              animation: 'fadeSlideUp 0.4s ease 0.08s both',
            }}
          >
            {/* Biome pill — keyed on biome so it animates on change */}
            <div
              key={stats.biome}
              className="ios-hud-pill"
              style={{ animation: 'biomeReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
              aria-label={`Current biome: ${stats.biome}`}
            >
              <span
                aria-hidden="true"
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--ios-label2)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {stats.biome}
              </span>
            </div>
            {/* Time-of-day indicator */}
            {stats.dayPhase && (
              <div className="ios-hud-pill" style={{ gap: 3 }} aria-hidden="true">
                <span style={{ fontSize: 11, lineHeight: 1 }}>
                  {stats.dayPhase === 'dawn' ? '\u{1F305}' : stats.dayPhase === 'day' ? '\u{2600}\u{FE0F}' : stats.dayPhase === 'dusk' ? '\u{1F31E}' : '\u{1F319}'}
                </span>
              </div>
            )}
            {settings.showFPS && (
              <FpsReadout
                fps={stats.fps}
                frameTimeMs={stats.frameTimeMs}
                frameTime95Ms={stats.frameTime95Ms}
              />
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default HUD;

/* ── Icon components ─────────────────────────────────────────── */

/**
 * Emoji display for each timed power-up type. Used by the HUD to match
 * a powerUpTimers entry to the emoji shown in the powerUps array.
 * Mirrors the popup labels in the engine's collectible handler.
 */
const POWER_UP_EMOJI: Record<string, string> = {
  shield: '\u{1F6E1}\u{FE0F}',  // 🛡️
  speedBoost: '\u26A1',          // ⚡
  magnet: '\u{1F9F2}',           // 🧲
  slingshot: '\u{1F3AF}',        // 🎯 — must match the emoji the engine pushes
  bow: '\u{1F3F9}',              // 🏹
  healingAura: '\u{1F49A}',      // 💚
};

/**
 * Default max duration (seconds) for each power-up — used to compute the
 * fraction remaining for the countdown bar. If the actual duration exceeds
 * this (e.g. progression bonuses), the bar stays full until it drops below.
 */
const POWER_UP_MAX_DURATION: Record<string, number> = {
  shield: 8,
  speedBoost: 5,
  magnet: 8,
  slingshot: 10,
  bow: 10,
  healingAura: 10,
};

/**
 * A power-up pill with an optional countdown bar beneath the emoji.
 * When `timer` is provided, shows a shrinking bar that turns from green →
 * yellow → red as the effect approaches expiry. In the final 2 seconds the
 * pill pulses to draw attention.
 */
const PowerUpPill: FC<{
  emoji: string;
  timer?: PowerUpTimerEntry;
}> = ({ emoji, timer }) => {
  const hasTimer = timer != null && timer.remaining > 0;
  if (!hasTimer) {
    return (
      <div className="ios-hud-pill" style={{ fontSize: 14, lineHeight: 1 }}>
        {emoji}
      </div>
    );
  }

  const maxDur = POWER_UP_MAX_DURATION[timer.type] ?? 10;
  const fraction = Math.min(1, timer.remaining / maxDur);
  const isExpiring = timer.remaining < 2;
  const barColor =
    fraction < 0.3 ? 'var(--ios-red)'
      : fraction < 0.5 ? 'var(--ios-yellow)'
        : 'var(--ios-green)';

  return (
    <div
      className="ios-hud-pill"
      style={{
        fontSize: 14,
        lineHeight: 1,
        padding: '3px 6px',
        flexDirection: 'column',
        gap: 2,
        animation: isExpiring ? 'comboUrgencyPulse 0.5s ease-in-out infinite alternate' : undefined,
      }}
    >
      <span>{emoji}</span>
      <div
        aria-hidden="true"
        style={{
          width: 24,
          height: 2,
          borderRadius: 1,
          background: 'rgba(255,255,255,0.12)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${fraction * 100}%`,
            borderRadius: 1,
            background: barColor,
            transition: 'width 0.15s linear',
          }}
        />
      </div>
    </div>
  );
};

const HeartIcon: FC<{ filled: boolean; pulsing: boolean }> = ({ filled, pulsing }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={filled ? 'var(--ios-red)' : 'rgba(255,255,255,0.13)'}
    aria-hidden="true"
    style={
      pulsing
        ? {
            animation: 'heartBeat 1s ease-in-out infinite',
            filter: 'drop-shadow(0 0 4px rgba(255,59,48,0.65))',
          }
        : filled
          ? { filter: 'drop-shadow(0 0 2px rgba(255,59,48,0.42))' }
          : undefined
    }
  >
    <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
  </svg>
);

const CoinIcon: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="var(--ios-yellow)" />
    <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" />
    <text
      x="12" y="16.5"
      textAnchor="middle"
      fontSize="10"
      fontWeight="800"
      fill="rgba(0,0,0,0.5)"
      fontFamily="-apple-system, sans-serif"
    >
      $
    </text>
  </svg>
);

/* ── FPS / frame-time readout ────────────────────────────────── */

const FPS_COLORS: Record<'good' | 'ok' | 'bad', string> = {
  good: 'var(--ios-green)',
  ok: 'var(--ios-yellow)',
  bad: 'var(--ios-red)',
};

const FpsReadout: FC<{
  fps: number;
  frameTimeMs?: number;
  frameTime95Ms?: number;
}> = ({ fps, frameTimeMs, frameTime95Ms }) => {
  const bucket = fpsBucket(fps);
  const color = FPS_COLORS[bucket];
  // Show the p95 (worst-typical) frame time when available — it reveals stutter
  // that the plain average hides. Fall back to the current frame time, then to
  // nothing if the profiler hasn't populated yet (e.g. first frame).
  const p95 = frameTime95Ms != null && frameTime95Ms > 0 ? frameTime95Ms : null;
  const cur = frameTimeMs != null && frameTimeMs > 0 ? frameTimeMs : null;
  const sub =
    p95 != null ? `p95 ${p95.toFixed(1)}ms`
      : cur != null ? `${cur.toFixed(1)}ms`
        : null;
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          fontSize: 10,
          color,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(fps)} fps
      </span>
      {sub && (
        <span
          style={{
            fontSize: 9,
            color: 'var(--ios-label3)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
};
