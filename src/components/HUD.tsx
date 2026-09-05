'use client';

import { useRef, useState, useEffect, type FC } from 'react';
import styles from './HUD.module.css';
import { type GameStats, type GameSettings, type PowerUpTimerEntry } from '@/game/state/game-state';
import { useGameHaptics } from '@/game/input/haptics';
import { fpsBucket } from './fps-readout';

interface Props {
  stats: GameStats;
  settings: GameSettings;
}

/**
 * Local neon-comic palette (approved art direction). Inline accents in the
 * TSX use these so the HUD never reaches into global CSS variables.
 */
const INK = {
  lime: '#c7ff4d',
  violet: '#9570ff',
  coral: '#ff7166',
  offwhite: '#f4f2ed',
} as const;

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
  // resets. Transitions from lime → amber → coral as the window closes, and
  // enables a fast pulse in the final second so players feel the pressure.
  const COMBO_DECAY_SECONDS = 3.0;
  const comboTime = stats.comboTimeRemaining ?? 0;
  const comboFraction = Math.min(1, comboTime / COMBO_DECAY_SECONDS);
  const comboUrgencyActive = comboTime > 0 && comboTime < 1.5;
  const comboUrgencyFastPulse = comboTime > 0 && comboTime < 1.0;
  const comboUrgency = {
    fraction: comboFraction,
    mid: comboFraction >= 0.33 && comboFraction < 0.66,
    hot: comboFraction < 0.33,
    active: comboUrgencyActive,
    fastPulse: comboUrgencyFastPulse,
  };

  const specialActive =
    stats.specialActiveRemaining !== undefined && stats.specialActiveRemaining > 0;
  const specialFillPct = specialActive
    ? 100
    : stats.specialName && stats.specialCooldownTotal
      ? Math.max(0, Math.min(100, (1 - (stats.specialCooldownRemaining ?? 0) / stats.specialCooldownTotal) * 100))
      : 0;

  return (
    <>
      {/* Low health vignette (global class — coral pulse, reduced-motion aware) */}
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

          {/* ── Left cluster: Hearts + Coins + Lives + Power-ups ── */}
          <div className={styles.cluster} style={{ animation: 'fadeSlideUp 0.4s ease both' }}>
            {/* Hearts — coral danger panel */}
            <div
              className={styles.heartsPanel}
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

            {/* Coins — lime progression panel */}
            <div className={styles.coinsPanel} style={{ gap: 5 }} aria-label={`${stats.coins} coins`}>
              <CoinIcon />
              <span
                aria-hidden="true"
                className={styles.labelLime}
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                {stats.coins}
              </span>
            </div>

            {/* Extra lives — the run starts with two, so only surface earned lives. */}
            {stats.lives > 2 && (
              <div className={styles.livesPanel} style={{ gap: 4 }} aria-label={`${stats.lives - 2} extra lives`}>
                <span aria-hidden="true" className={styles.livesText} style={{ fontSize: 13 }}>
                  {"\u2764"}+{stats.lives - 2}
                </span>
              </div>
            )}

            {/* Power-ups — violet contextual-ability panels with countdown bars */}
            {stats.powerUps.length > 0 && (
              <div className={styles.powerUpsRow} style={{ animation: 'fadeIn 0.25s ease both' }}>
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

          {/* ── Center cluster: Score + Distance + Level + Special + Combo ── */}
          <div className={styles.centerCol} style={{ animation: 'fadeSlideUp 0.45s ease 0.05s both' }}>
            <div
              key={scoreFlash ? 'flash' : 'idle'}
              aria-label={`${stats.score.toLocaleString()} points`}
              className={`${styles.score} ${scoreFlash ? styles.scorePop : ''}`}
              style={{ fontSize: 32 }}
            >
              <span aria-hidden="true">{stats.score.toLocaleString()}</span>
            </div>
            <div
              aria-hidden="true"
              className={styles.caption}
              style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}
            >
              {Math.round(stats.distance)}m
            </div>

            {/* Level progress (lime progression accent; coral when time is short) */}
            {stats.levelTarget && stats.levelTarget > 0 && (
              <div
                className={styles.levelBlock}
                role="progressbar"
                aria-valuenow={Math.round(((stats.levelProgress ?? stats.distance) / stats.levelTarget) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Level progress"
              >
                <div className={styles.levelTrack}>
                  <div
                    className={styles.levelFill}
                    style={{ width: `${Math.min(100, ((stats.levelProgress ?? stats.distance) / stats.levelTarget) * 100)}%` }}
                  />
                </div>
                <div className={styles.levelCaption}>
                  {Math.floor(stats.levelProgress ?? stats.distance)}/{stats.levelTarget}{stats.levelObjective === 'coins' ? ' coins' : stats.levelObjective === 'kills' ? ' KOs' : 'm'}
                </div>
                {stats.levelTimeRemaining !== undefined && stats.levelTimeRemaining > 0 && (
                  <div
                    aria-hidden="true"
                    className={`${styles.levelTimeCaption} ${stats.levelTimeRemaining < 10 ? styles.levelTimeHot : ''}`}
                  >
                    {Math.ceil(stats.levelTimeRemaining)}s
                  </div>
                )}
              </div>
            )}

            {/* Character special — the ✦ touch control / V key starts a short
                pulse attack, then this meter makes its timed cooldown honest.
                Violet contextual-ability panel; lime readout while firing. */}
            {stats.specialName && stats.specialCooldownTotal && (
              <div
                className={styles.specialPanel}
                aria-label={`${stats.specialName}: ${specialActive ? 'active' : `${Math.ceil(stats.specialCooldownRemaining ?? 0)} seconds until ready`}`}
              >
                <div className={styles.specialHeader}>
                  <span className={styles.specialName}>✦ {stats.specialName}</span>
                  <span className={specialActive ? styles.specialTimeActive : styles.specialTime}>
                    {specialActive ? 'NOW' : `${Math.ceil(stats.specialCooldownRemaining ?? 0)}s`}
                  </span>
                </div>
                <div aria-hidden="true" className={styles.specialTrack}>
                  <div
                    className={`${styles.specialFill} ${specialActive ? styles.specialFillActive : ''}`}
                    style={{ width: `${specialFillPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Combo counter with decay urgency bar (lime → amber → coral) */}
            {(stats.comboCount ?? 0) > 1 && (
              <div className={styles.comboBlock}>
                <div
                  key={comboFlash ? 'flash' : 'idle'}
                  aria-label={`Combo of ${stats.comboCount}, multiplier ${stats.comboMultiplier}x`}
                  className={`${styles.comboPill} ${comboUrgency.active ? styles.comboPillHot : ''}`}
                  style={{
                    animation: comboUrgency.fastPulse
                      ? 'comboUrgencyPulse 0.4s ease-in-out infinite alternate'
                      : comboFlash
                        ? 'scoreFlash 0.2s ease both'
                        : undefined,
                  }}
                >
                  <span aria-hidden="true">{stats.comboCount} COMBO x{stats.comboMultiplier}</span>
                </div>
                {/* Combo decay urgency bar */}
                <div aria-hidden="true" className={styles.comboTrack}>
                  <div
                    className={`${styles.comboFill} ${comboUrgency.hot ? styles.comboFillHot : comboUrgency.mid ? styles.comboFillMid : ''}`}
                    style={{ width: `${comboUrgency.fraction * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Right cluster: Biome + Time of day + FPS ────────── */}
          <div className={styles.rightCol} style={{ animation: 'fadeSlideUp 0.4s ease 0.08s both' }}>
            {/* Biome panel — keyed on biome so it animates on change */}
            <div
              key={stats.biome}
              className={styles.panel}
              style={{ animation: 'biomeReveal 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
              aria-label={`Current biome: ${stats.biome}`}
            >
              <span aria-hidden="true" className={styles.biomeCaption}>{stats.biome}</span>
            </div>
            {/* Time-of-day indicator */}
            {stats.dayPhase && (
              <div className={styles.dayPanel} aria-hidden="true">
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
 * A power-up panel with an optional countdown bar beneath the emoji.
 * When `timer` is provided, shows a shrinking bar (violet → amber → coral as
 * the effect approaches expiry). In the final 2 seconds the panel pulses to
 * draw attention.
 */
const PowerUpPill: FC<{
  emoji: string;
  timer?: PowerUpTimerEntry;
}> = ({ emoji, timer }) => {
  const hasTimer = timer != null && timer.remaining > 0;
  if (!hasTimer) {
    return (
      <div className={styles.powerUpPanel} style={{ fontSize: 14, lineHeight: 1 }}>
        {emoji}
      </div>
    );
  }

  const maxDur = POWER_UP_MAX_DURATION[timer.type] ?? 10;
  const fraction = Math.min(1, timer.remaining / maxDur);
  const isExpiring = timer.remaining < 2;
  const barColor =
    fraction < 0.3 ? INK.coral
      : fraction < 0.5 ? '#ffd60a'
        : INK.violet;

  return (
    <div
      className={styles.powerUpPanel}
      style={{
        fontSize: 14,
        lineHeight: 1,
        animation: isExpiring ? 'comboUrgencyPulse 0.5s ease-in-out infinite alternate' : undefined,
      }}
    >
      <span>{emoji}</span>
      <div aria-hidden="true" className={styles.barTrack} style={{ width: 24, height: 2 }}>
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
    fill={filled ? INK.coral : 'rgba(244, 242, 237, 0.22)'}
    aria-hidden="true"
    style={
      pulsing
        ? {
            animation: 'heartBeat 1s ease-in-out infinite',
            filter: 'drop-shadow(0 0 4px rgba(255,113,102,0.6))',
          }
        : filled
          ? { filter: 'drop-shadow(0 0 2px rgba(255,113,102,0.42))' }
          : undefined
    }
  >
    <path d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z" />
  </svg>
);

const CoinIcon: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill={INK.lime} />
    <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.5" />
    <text
      x="12" y="16.5"
      textAnchor="middle"
      fontSize="10"
      fontWeight="800"
      fill="rgba(10,10,15,0.6)"
      fontFamily="-apple-system, sans-serif"
    >
      $
    </text>
  </svg>
);

/* ── FPS / frame-time readout ────────────────────────────────── */

const FPS_COLORS: Record<'good' | 'ok' | 'bad', string> = {
  good: styles.fpsGood,
  ok: styles.fpsOk,
  bad: styles.fpsBad,
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
    <div aria-hidden="true" className={styles.fpsCol}>
      <span
        className={color}
        style={{
          fontSize: 10,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(fps)} fps
      </span>
      {sub && (
        <span
          className={styles.caption}
          style={{
            fontSize: 9,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {sub}
        </span>
      )}
    </div>
  );
};
