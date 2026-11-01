import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Dimensions,
  useWindowDimensions,
  AppState,
  SafeAreaView,
  Share,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { loadPlayerBest, savePlayerBest } from '../lib/player-best';
import { appendRunHistory } from '../lib/run-history';
import { loadGameSettings, DEFAULT_GAME_SETTINGS, type GameSettings } from '../lib/game-settings';
import { useMobileHaptics } from '../hooks/useMobileHaptics';
import { FadeTransition } from '../components/FadeTransition';
import { LoadingSpinner, LoadingProgressBar } from '../components/LoadingSpinner';
import {
  ParticleBurst,
  ScreenShake,
  useParticleBurst,
  useScreenShake,
} from '../components/ParticleBurst';
import { AnimatedScore, AnimatedHeart, AnimatedHealthBar } from '../components/AnimatedUI';
import { PressableScale } from '../components/PressableScale';
import { SettingsSheet } from '../components/SettingsSheet';
import { LeaderboardSheet } from '../components/LeaderboardSheet';

const GAME_HTML = require('../assets/game.html');
// Metro html assets don't resolve in Android release builds: the asset gets
// flattened to res/raw and the WebView is handed a stub 'http://assets_game/'
// URL, which trips ERR_CLEARTEXT_NOT_PERMITTED and the engine never loads
// (works in dev because Metro serves the asset over localhost). The
// patch-android.sh post-prebuild step copies game.html into
// android/app/src/main/assets so Android can load it as a plain file:// URL.
const GAME_SOURCE =
  Platform.OS === 'android'
    ? { uri: 'file:///android_asset/game.html', baseUrl: 'file:///android_asset/game.html' }
    : GAME_HTML;

type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

interface GameStats {
  score: number;
  coins: number;
  distance: number;
  health: number;
  maxHealth: number;
  lives: number;
  comboCount: number;
  biome: string;
  fps: number;
  powerUps: string[];
  maxCombo: number;
  enemiesDefeated: number;
}

const DEFAULT_STATS: GameStats = {
  score: 0, coins: 0, distance: 0,
  health: 3, maxHealth: 3, lives: 3, comboCount: 0,
  biome: 'Grassland',
  fps: 60, powerUps: [], maxCombo: 0, enemiesDefeated: 0,
};

/**
 * Single-screen shell (no tabs): the menu IS the app — title, best score,
 * one Play button, and settings/leaderboard as corner icons that open
 * slide-up sheets. Everything else in this file is the run itself.
 */
export default function GameScreen() {
  const webViewRef = useRef<WebView>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [stats, setStats] = useState<GameStats>(DEFAULT_STATS);
  const [highScore, setHighScore] = useState(0);
  const [showMenu, setShowMenu] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);
  const [webViewReady, setWebViewReady] = useState(false);
  const [webViewError, setWebViewError] = useState(false);
  const [runRequestId, setRunRequestId] = useState(0);
  const [largeControls, setLargeControls] = useState(DEFAULT_GAME_SETTINGS.largeControls);
  const [hapticsEnabled, setHapticsEnabled] = useState(DEFAULT_GAME_SETTINGS.hapticsEnabled);
  const [showFPS, setShowFPS] = useState(DEFAULT_GAME_SETTINGS.showFPS);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const pendingRunRef = useRef<number | null>(null);
  const gameStateRef = useRef<GameState>('menu');
  const settingsRef = useRef<GameSettings>(DEFAULT_GAME_SETTINGS);
  // Track previous stat values to detect damage/coin milestones for particles.
  const prevStatsRef = useRef<GameStats>(DEFAULT_STATS);

  // Particle bursts and screen shake for key gameplay events.
  const [damageBurstKey, triggerDamageBurst] = useParticleBurst();
  const [shakeKey, triggerShake] = useScreenShake();
  const [coinBurstKey, triggerCoinBurst] = useParticleBurst();

  // Watch the stats stream for events that should fire visual effects.
  useEffect(() => {
    if (gameState !== 'playing') {
      prevStatsRef.current = stats;
      return;
    }
    const prev = prevStatsRef.current;
    // Damage taken — screen shake + red particle burst.
    if (stats.health < prev.health) {
      triggerShake();
      triggerDamageBurst();
    }
    // Coin collected — gold particle burst.
    if (stats.coins > prev.coins) {
      triggerCoinBurst();
    }
    prevStatsRef.current = stats;
  }, [stats, gameState, triggerShake, triggerDamageBurst, triggerCoinBurst]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Gameplay haptics — watches the stats stream from the WebView bridge and
  // fires native vibration patterns on damage, coins, combo milestones, etc.
  // Only active during gameplay and when the persisted setting is enabled.
  useMobileHaptics(stats, hapticsEnabled && gameState === 'playing');

  useEffect(() => {
    let mounted = true;
    void loadPlayerBest().then(best => {
      if (mounted) setHighScore(best.score);
    });
    return () => { mounted = false; };
  }, []);

  // Load persisted settings on mount and after the settings sheet closes
  // (so changes made in the sheet are picked up immediately).
  const refreshSettings = useCallback(() => {
    let mounted = true;
    void loadGameSettings().then(settings => {
      if (!mounted) return;
      settingsRef.current = settings;
      setLargeControls(settings.largeControls);
      setHapticsEnabled(settings.hapticsEnabled);
      setShowFPS(settings.showFPS);
      // Push audio/particle preferences into the engine if the WebView is alive.
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(
          `try { window.__gameControls.setAudioVolumes(${settings.masterVolume}, ${settings.sfxVolume}, ${settings.musicVolume}); } catch(e){} true;`
        );
        webViewRef.current.injectJavaScript(
          `try { window.__gameControls.setUserReducedParticles(${settings.reducedParticles}); } catch(e){} true;`
        );
      }
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const cleanup = refreshSettings();
    return cleanup;
  }, [refreshSettings]);

  const sendInput = useCallback((type: string, value: boolean) => {
    const detail = JSON.stringify({ type, value });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('game-input', { detail: ${detail} })); true;`
    );
  }, []);

  const callEngine = useCallback((fn: string) => {
    webViewRef.current?.injectJavaScript(`try { window.__gameControls.${fn}(); } catch(e){} true;`);
  }, []);

  const handleMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'ready') {
        setWebViewReady(true);
      } else if (data.type === 'stats') {
        setStats({
          score: data.score,
          coins: data.coins,
          distance: data.distance,
          health: data.health,
          maxHealth: data.maxHealth,
          lives: typeof data.lives === 'number' ? data.lives : 3,
          comboCount: typeof data.comboCount === 'number' ? data.comboCount : 0,
          biome: data.biome,
          fps: data.fps,
          powerUps: data.powerUps || [],
          maxCombo: data.maxCombo || 0,
          enemiesDefeated: data.enemiesDefeated || 0,
        });
      } else if (data.type === 'gameover') {
        const score = Math.max(0, Math.floor(typeof data.score === 'number' ? data.score : stats.score));
        const runStats = {
          score,
          distance: typeof data.distance === 'number' ? data.distance : stats.distance,
          coins: typeof data.coins === 'number' ? data.coins : stats.coins,
          maxCombo: typeof data.maxCombo === 'number' ? data.maxCombo : stats.maxCombo,
          enemiesDefeated: typeof data.enemiesDefeated === 'number' ? data.enemiesDefeated : stats.enemiesDefeated,
        };
        setGameState('gameover');
        void appendRunHistory(runStats);
        setHighScore(prev => {
          if (score <= prev) return prev;
          void savePlayerBest(runStats);
          return score;
        });
      }
    } catch {}
  }, [stats.score]);

  const handleRenderProcessGone = useCallback(() => {
    // A terminated Chromium renderer cannot recover its current document. Return
    // to the native menu and give the next Play action a fresh local WebView.
    console.warn('Dashverse game renderer terminated; remounting on next run.');
    pendingRunRef.current = null;
    setWebViewReady(false);
    setWebViewError(true);
    setWebViewKey(previous => previous + 1);
    setGameState('menu');
    setShowMenu(true);
  }, []);

  const queueRun = useCallback((seed: number) => {
    pendingRunRef.current = seed;
    setWebViewReady(false);
    setWebViewError(false);
    setRunRequestId(previous => previous + 1);
    setGameState('playing');
    setShowMenu(false);
  }, []);

  useEffect(() => {
    const seed = pendingRunRef.current;
    if (!webViewReady || seed === null) return;

    pendingRunRef.current = null;
    // Apply persisted settings before starting the run so the first frame
    // respects audio volumes and particle preferences.
    const s = settingsRef.current;
    webViewRef.current?.injectJavaScript(
      `try { window.__gameControls.setAudioVolumes(${s.masterVolume}, ${s.sfxVolume}, ${s.musicVolume}); window.__gameControls.setUserReducedParticles(${s.reducedParticles}); window.__gameControls.resumeAudio(); } catch(e){} true;`
    );
    callEngine(`setSeed(${seed})`);
    callEngine('resume');
  }, [callEngine, runRequestId, webViewReady]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active' && gameStateRef.current === 'playing') {
        // Do not auto-resume after calls/app switching: the player explicitly
        // chooses when to continue a paused mobile run.
        gameStateRef.current = 'paused';
        setGameState('paused');
        callEngine('pause');
      }
    });
    return () => subscription.remove();
  }, [callEngine]);

  const handlePlay = useCallback((seed?: number) => {
    queueRun(seed ?? Math.floor(Math.random() * 999999));
  }, [queueRun]);

  const handlePause = useCallback(() => {
    if (gameState === 'playing') {
      setGameState('paused');
      callEngine('pause');
    }
  }, [gameState, callEngine]);

  const handleResume = useCallback(() => {
    setGameState('playing');
    callEngine('resume');
  }, [callEngine]);

  const handleRestart = useCallback(() => {
    queueRun(Math.floor(Math.random() * 999999));
  }, [queueRun]);

  const handleQuit = useCallback(() => {
    pendingRunRef.current = null;
    setGameState('menu');
    setShowMenu(true);
  }, []);

  return (
    <ScreenShake shakeKey={shakeKey} intensity={6} duration={350}>
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" hidden={gameState === 'playing'} />
      {/*
        Android WebView is a native surface and can be composited above sibling
        React Native views. Mount it only after Play is pressed so the native
        menu is never hidden behind the WebView's initial white document.
      */}
      {gameState !== 'menu' && (
        <View style={styles.webviewContainer}>
          <WebView
            key={webViewKey}
            ref={webViewRef}
            source={GAME_SOURCE}
            style={styles.webview}
            onLoadStart={() => setWebViewReady(false)}
            onMessage={handleMessage}
            originWhitelist={['*']}
            allowFileAccess
            domStorageEnabled
            javaScriptEnabled
            scalesPageToFit={false}
            scrollEnabled={false}
            bounces={false}
            showsVerticalScrollIndicator={false}
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled={false}
            onError={(e) => {
              console.warn('WebView error:', e.nativeEvent);
              setWebViewError(true);
            }}
            onRenderProcessGone={handleRenderProcessGone}
            setSupportMultipleWindows={false}
          />
          {/* WebView loading animation — shown while the game HTML loads. */}
          {!webViewReady && !webViewError && (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <LoadingSpinner label="Loading" size={48} color="#c7ff4d" />
              <View style={{ marginTop: 20 }}>
                <LoadingProgressBar width={160} height={3} color="#c7ff4d" />
              </View>
            </View>
          )}
          {/* WebView error overlay — shown if the game engine fails to load. */}
          {webViewError && (
            <View style={styles.loadingOverlay}>
              <Ionicons name="warning" size={48} color="rgba(248,113,113,0.8)" />
              <Text style={styles.webviewErrorTitle}>Failed to Load</Text>
              <Text style={styles.webviewErrorBody}>
                The game engine couldn't start. Check your connection and try again.
              </Text>
              <PressableScale
                style={styles.webviewErrorRetryBtn}
                onPress={() => handleRestart()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading the game"
              >
                <Text style={styles.webviewErrorRetryText}>Retry</Text>
              </PressableScale>
            </View>
          )}
        </View>
      )}

      {/* Damage particle burst — centered on screen */}
      <ParticleBurst
        burstKey={damageBurstKey}
        config={{
          count: 10,
          colors: ['#f87171', '#ef4444', '#fca5a5', '#rgba(248,113,113,0.5)'],
          minRadius: 20,
          maxRadius: 60,
          minSize: 3,
          maxSize: 8,
          duration: 500,
        }}
      />
      {/* Coin particle burst — gold sparkle */}
      <ParticleBurst
        burstKey={coinBurstKey}
        config={{
          count: 8,
          colors: ['#facc15', '#fde68a', '#fbbf24', '#fef08a'],
          minRadius: 24,
          maxRadius: 70,
          minSize: 3,
          maxSize: 7,
          duration: 550,
        }}
      />

      {/* HUD overlay during gameplay */}
      {gameState === 'playing' && <HUD stats={stats} onPause={handlePause} showFPS={showFPS} />}

      {/* Touch controls during gameplay */}
      {gameState === 'playing' && (
        <TouchControls sendInput={sendInput} largeControls={largeControls} />
      )}

      {/* Menu overlays */}
      {showMenu && gameState === 'menu' && (
        <FadeTransition
          visible={true}
          slideDirection="up"
          slideDistance={30}
          duration={400}
          gradientColors={['rgba(0,0,0,0.94)', 'rgba(8,12,22,0.97)', 'rgba(16,20,34,0.99)']}
        >
          <MenuOverlay
            onPlay={handlePlay}
            highScore={highScore}
            onOpenSettings={() => setShowSettings(true)}
            onOpenLeaderboard={() => setShowLeaderboard(true)}
          />
        </FadeTransition>
      )}

      {gameState === 'paused' && (
        <FadeTransition
          visible={true}
          slideDirection="none"
          duration={250}
          gradientColors={['rgba(0,0,0,0.5)', 'rgba(26,26,46,0.8)']}
        >
          <PauseOverlay onResume={handleResume} onRestart={handleRestart} onQuit={handleQuit} />
        </FadeTransition>
      )}

      {gameState === 'gameover' && (
        <FadeTransition
          visible={true}
          slideDirection="up"
          slideDistance={40}
          duration={350}
          gradientColors={['rgba(0,0,0,0.7)', 'rgba(26,26,46,0.9)']}
        >
          <GameOverOverlay
            stats={stats}
            highScore={highScore}
            onRestart={handleRestart}
            onQuit={handleQuit}
          />
        </FadeTransition>
      )}

      {/* Corner-icon sheets (from the menu only) */}
      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onChanged={refreshSettings}
      />
      <LeaderboardSheet
        visible={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
    </View>
    </ScreenShake>
  );
}

// ─── Touch Controls (one-thumb auto-runner) ────────────────────────
// The character always runs right — the engine locks the horizontal axis in
// auto-run mode and fires attacks automatically inside engagement range.
// The player only jumps and slides (dash) — two buttons, one thumb.

const TouchControls: React.FC<{
  sendInput: (type: string, value: boolean) => void;
  largeControls?: boolean;
}> = ({ sendInput, largeControls = false }) => {
  const heldInputsRef = useRef<Set<string>>(new Set());

  const handleTouchStart = useCallback((type: string) => {
    if (heldInputsRef.current.has(type)) return;
    heldInputsRef.current.add(type);
    sendInput(type, true);
  }, [sendInput]);

  const handleTouchEnd = useCallback((type: string) => {
    if (!heldInputsRef.current.has(type)) return;
    heldInputsRef.current.delete(type);
    sendInput(type, false);
  }, [sendInput]);

  const releaseAll = useCallback(() => {
    for (const type of heldInputsRef.current) {
      sendInput(type, false);
    }
    heldInputsRef.current.clear();
  }, [sendInput]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') releaseAll();
    });
    return () => subscription.remove();
  }, [releaseAll]);

  // Releasing on unmount covers navigation, pause/game-over overlays, and fast
  // refreshes that remove the controls while a finger is still held down.
  useEffect(() => {
    return releaseAll;
  }, [releaseAll]);

  return (
    <View style={styles.touchOverlay} pointerEvents="box-none">
      {/* Right side: big jump target, slide (dash) tucked beside it so both
          sit under the thumb arc with independent touch targets. */}
      <View style={styles.rightControls}>
        <ActionIconButton
          size={largeControls ? 'md' : 'sm'}
          icon="flash"
          label="Slide"
          hint="Dash through danger without stopping"
          onPress={() => handleTouchStart('dash-press')}
          onRelease={() => handleTouchEnd('dash-press')}
          accent="purple"
        />
        <Pressable
          onPressIn={() => handleTouchStart('jump-press')}
          onPressOut={() => handleTouchEnd('jump-press')}
          onTouchCancel={() => handleTouchEnd('jump-press')}
          accessibilityRole="button"
          accessibilityLabel="Jump"
          accessibilityHint="Tap to jump; tap again mid-air for a double jump"
          style={[styles.jumpBtn, largeControls && styles.jumpBtnLarge]}
        >
          <Ionicons name="arrow-up" size={largeControls ? 34 : 28} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>
    </View>
  );
};

const ActionIconButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'md';
  accent?: 'blue' | 'orange' | 'purple';
  label: string;
  hint: string;
  onPress: () => void;
  onRelease: () => void;
}> = ({ icon, size = 'sm', accent, label, hint, onPress, onRelease }) => {
  const btnSize = size === 'md' ? 60 : 50;

  return (
    <Pressable
      onPressIn={onPress}
      onPressOut={onRelease}
      onTouchCancel={onRelease}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={[
        styles.touchBtn,
        { width: btnSize, height: btnSize, borderRadius: btnSize / 2 },
        accent === 'blue' && styles.touchBtnBlue,
        accent === 'orange' && styles.touchBtnOrange,
        accent === 'purple' && styles.touchBtnPurple,
      ]}
    >
      <Ionicons name={icon} size={size === 'md' ? 24 : 20} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
};

// ─── HUD ───────────────────────────────────────────────────────────

const HUD: React.FC<{ stats: GameStats; onPause: () => void; showFPS?: boolean }> = ({ stats, onPause, showFPS = false }) => {
  const hearts = Array.from({ length: stats.maxHealth }).map((_, i) => i);

  return (
    <SafeAreaView style={styles.hudContainer} pointerEvents="box-none">
      <View style={styles.hudRow} pointerEvents="box-none">
        {/* Left: Health bar + Coins */}
        <View style={styles.hudLeft}>
          <View
            accessible
            accessibilityLabel={`Health ${stats.health} of ${stats.maxHealth}`}
          >
            {/* Animated health bar with smooth fill transitions */}
            <AnimatedHealthBar
              health={stats.health}
              maxHealth={stats.maxHealth}
              width={90}
              height={6}
            />
            {/* Heart icons with pulse on damage */}
            <View style={styles.heartsRow}>
              {hearts.map(i => (
                <AnimatedHeart
                  key={i}
                  filled={i < stats.health}
                  size={14}
                  color="#f87171"
                  emptyColor="rgba(255,255,255,0.15)"
                />
              ))}
            </View>
          </View>
          <View style={styles.hudBadge} accessible accessibilityLabel={`${stats.coins} coins`}>
            <Text style={styles.coinDot}>●</Text>
            <Text style={styles.coinCount}>{stats.coins}</Text>
          </View>
          {stats.powerUps.length > 0 && (
            <View style={styles.powerUps}>
              {stats.powerUps.map((pu, i) => (
                <Text key={i} style={styles.powerUpText}>{pu}</Text>
              ))}
            </View>
          )}
        </View>

        {/* Center: Score (animated counter) */}
        <View style={styles.hudCenter}>
          <AnimatedScore
            value={stats.score}
            duration={350}
            textStyle={styles.scoreText}
          />
          <Text style={styles.distanceText}>{Math.round(stats.distance)}m</Text>
        </View>

        {/* Right: FPS (optional) + Pause */}
        <View style={styles.hudRight}>
          {showFPS && (
            <View style={styles.hudBadge} accessible accessibilityLabel={`${Math.round(stats.fps)} FPS`}>
              <Text style={styles.fpsText}>{Math.round(stats.fps)} FPS</Text>
            </View>
          )}
          <PauseButton onPress={onPause} />
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─── Pause Button (with press feedback + haptics) ───────────────────

const PauseButton: React.FC<{ onPress: () => void }> = ({ onPress }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => {
        Animated.spring(scale, { toValue: 0.9, damping: 30, stiffness: 600, useNativeDriver: true }).start();
        Vibration.vibrate(8);
      }}
      onPressOut={() => {
        Animated.spring(scale, { toValue: 1, damping: 20, stiffness: 300, useNativeDriver: true }).start();
      }}
      onPress={onPress}
      style={styles.pauseBtn}
      accessibilityRole="button"
      accessibilityLabel="Pause game"
      accessibilityHint="Pauses the current run"
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name="pause" size={16} color="rgba(255,255,255,0.7)" />
      </Animated.View>
    </Pressable>
  );
};

// ─── Menu Overlay (single screen — the app IS this screen) ─────────

const MenuOverlay: React.FC<{
  onPlay: (seed?: number) => void;
  highScore: number;
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
}> = ({ onPlay, highScore, onOpenSettings, onOpenLeaderboard }) => {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
  <LinearGradient colors={['rgba(0,0,0,0.94)', 'rgba(8,12,22,0.97)', 'rgba(16,20,34,0.99)']} style={styles.overlay}>
    <View style={styles.ambientGlowA} />
    <View style={styles.ambientGlowB} />

    {/* Corner icons: settings + leaderboard sheets */}
    <View style={styles.cornerIcons}>
      <CornerIconButton
        icon="trophy"
        label="Leaderboard"
        hint="See your best runs and personal records"
        onPress={onOpenLeaderboard}
      />
      <CornerIconButton
        icon="settings"
        label="Settings"
        hint="Tune audio, performance, and touch controls"
        onPress={onOpenSettings}
      />
    </View>

    <View style={[styles.menuContent, isLandscape && styles.menuContentLandscape]}>
      <View style={styles.appMark}>
        <Text style={styles.appMarkText}>∞</Text>
      </View>
      <Text style={styles.title}>Dashverse</Text>
      <Text style={styles.subtitle}>RUN · COLLECT · COMPETE</Text>

      {highScore > 0 && (
        <View style={styles.bestPill} accessible accessibilityLabel={`Personal best score ${highScore}`}>
          <Text style={styles.bestPillLabel}>BEST</Text>
          <Text style={styles.bestPillValue}>{highScore.toLocaleString()}</Text>
        </View>
      )}

      {/* Stretch wrapper: PressableScale applies style to its inner view, so
          width:'100%' would resolve against the hug-content Pressable and
          collapse — the wrapper owns the width instead. */}
      <View style={styles.playBtnWrap}>
        <PressableScale
          style={styles.playBtn}
          onPress={() => onPlay()}
          accessibilityRole="button"
          accessibilityLabel="Play Endless"
          accessibilityHint="Start a new endless run"
        >
          <LinearGradient colors={['#c7ff4d', '#5E5CE6', '#BF5AF2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playBtnGradient}>
            <Text style={styles.playBtnText}>Play</Text>
          </LinearGradient>
        </PressableScale>
      </View>

      <Text style={styles.controlsHint}>
        Auto-runs right · tap to jump · slide through danger
      </Text>
    </View>
  </LinearGradient>
  );
};

const CornerIconButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}> = ({ icon, label, hint, onPress }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={hint}
    style={styles.cornerIconBtn}
  >
    <Ionicons name={icon} size={22} color="rgba(255,255,255,0.72)" />
  </Pressable>
);

// ─── Pause Overlay ─────────────────────────────────────────────────

const PauseOverlay: React.FC<{
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}> = ({ onResume, onRestart, onQuit }) => (
  <LinearGradient colors={['rgba(0,0,0,0.5)', 'rgba(26,26,46,0.8)']} style={styles.overlay}>
    <View style={styles.menuContent}>
      <Text style={styles.overlayTitle}>Paused</Text>

      <View style={styles.playBtnWrap}>
        <PressableScale style={styles.playBtn} onPress={onResume} accessibilityRole="button" accessibilityLabel="Resume run">
          <Text style={styles.playBtnText}>Resume</Text>
        </PressableScale>
      </View>

      <PressableScale style={styles.secondaryBtn} onPress={onRestart} accessibilityRole="button" accessibilityLabel="Restart run">
        <Text style={styles.secondaryBtnText}>Restart</Text>
      </PressableScale>

      <PressableScale style={styles.quitBtn} onPress={onQuit} accessibilityRole="button" accessibilityLabel="Quit to menu">
        <Text style={styles.quitBtnText}>Quit to Menu</Text>
      </PressableScale>
    </View>
  </LinearGradient>
);

// ─── Game Over Overlay ─────────────────────────────────────────────

const GameOverOverlay: React.FC<{
  stats: GameStats;
  highScore: number;
  onRestart: () => void;
  onQuit: () => void;
}> = ({ stats, highScore, onRestart, onQuit }) => {
  const isNewHigh = stats.score >= highScore && stats.score > 0;
  const [shareStatus, setShareStatus] = useState('Share Run');

  const handleShare = useCallback(async () => {
    const message = [
      'My Dashverse run',
      `Score ${Math.max(0, Math.floor(stats.score)).toLocaleString('en-US')} · ${Math.max(0, Math.floor(stats.distance)).toLocaleString('en-US')}m`,
      `${Math.max(0, Math.floor(stats.coins)).toLocaleString('en-US')} coins · x${Math.max(0, Math.floor(stats.maxCombo)).toLocaleString('en-US')} combo · ${Math.max(0, Math.floor(stats.enemiesDefeated)).toLocaleString('en-US')} defeated`,
      'Can you beat it?',
    ].join('\n');

    try {
      const result = await Share.share({ title: 'Dashverse run', message });
      if (result.action === Share.sharedAction) setShareStatus('Shared!');
    } catch {
      setShareStatus('Unavailable');
    }
  }, [stats]);

  useEffect(() => {
    if (shareStatus === 'Share Run') return;
    const timeout = setTimeout(() => setShareStatus('Share Run'), 2400);
    return () => clearTimeout(timeout);
  }, [shareStatus]);

  return (
    <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(26,26,46,0.9)']} style={styles.overlay}>
      <View style={styles.menuContent}>
        <Text style={styles.overlayTitle}>Game Over</Text>

        {isNewHigh && (
          <View style={styles.newHighBadge}>
            <Text style={styles.newHighText}>New High Score!</Text>
          </View>
        )}

        <View style={styles.statsGrid}>
          <StatCard label="Score" value={stats.score.toLocaleString()} highlight={isNewHigh} />
          <StatCard label="Best" value={highScore.toLocaleString()} />
          <StatCard label="Distance" value={`${Math.round(stats.distance)}m`} />
          <StatCard label="Coins" value={`${stats.coins}`} />
          <StatCard label="Best Combo" value={stats.maxCombo > 0 ? `x${stats.maxCombo}` : '—'} />
          <StatCard label="Defeated" value={`${stats.enemiesDefeated}`} />
        </View>

        <View style={styles.playBtnWrap}>
          <PressableScale style={styles.playBtn} onPress={onRestart} accessibilityRole="button" accessibilityLabel="Play again">
            <Text style={styles.playBtnText}>Play Again</Text>
          </PressableScale>
        </View>

        <View style={styles.gameOverActions}>
          <PressableScale style={styles.gameOverSecondaryBtn} onPress={() => { void handleShare(); }} accessibilityRole="button" accessibilityLabel="Share this run result">
            <Text style={styles.secondaryBtnText}>{shareStatus}</Text>
          </PressableScale>
          <PressableScale style={styles.gameOverSecondaryBtn} onPress={onQuit} accessibilityRole="button" accessibilityLabel="Return to main menu">
            <Text style={styles.secondaryBtnText}>Main Menu</Text>
          </PressableScale>
        </View>
      </View>
    </LinearGradient>
  );
};

const StatCard: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
  </View>
);

// ─── Styles ────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  webviewContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 8, 20, 0.95)',
    zIndex: 5,
  },
  webviewErrorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  webviewErrorBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 40,
  },
  webviewErrorRetryBtn: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#c7ff4d',
  },
  webviewErrorRetryText: {
    color: '#0a0a0f',
    fontSize: 16,
    fontWeight: '700',
  },
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  rightControls: {
    position: 'absolute',
    bottom: 44,
    right: 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  jumpBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(59,130,246,0.24)',
    borderWidth: 1.5,
    borderColor: 'rgba(59,130,246,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jumpBtnLarge: {
    width: 108,
    height: 108,
    borderRadius: 54,
  },
  touchBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  touchBtnBlue: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    borderColor: 'rgba(59,130,246,0.3)',
  },
  touchBtnOrange: {
    backgroundColor: 'rgba(249,115,22,0.2)',
    borderColor: 'rgba(249,115,22,0.3)',
  },
  touchBtnPurple: {
    backgroundColor: 'rgba(175,82,222,0.22)',
    borderColor: 'rgba(191,90,242,0.38)',
  },
  hudContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  hudRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hudLeft: { flexDirection: 'column', gap: 6 },
  hudCenter: { flex: 1, alignItems: 'center' },
  hudRight: { flexDirection: 'column', alignItems: 'flex-end', gap: 6 },
  hudBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heartsRow: { flexDirection: 'row', gap: 2, marginTop: 4 },
  coinDot: { fontSize: 10, color: '#facc15' },
  coinCount: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  powerUps: { flexDirection: 'row', gap: 4 },
  powerUpText: { fontSize: 14, lineHeight: 16 },
  scoreText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 28,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  distanceText: { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 2 },
  fpsText: { color: 'rgba(48,209,88,0.8)', fontSize: 11, fontWeight: '600' },
  pauseBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambientGlowA: {
    position: 'absolute',
    width: SCREEN_W * 0.9,
    height: SCREEN_W * 0.9,
    borderRadius: SCREEN_W,
    top: -SCREEN_W * 0.32,
    right: -SCREEN_W * 0.28,
    backgroundColor: 'rgba(142,121,158,0.22)',
  },
  ambientGlowB: {
    position: 'absolute',
    width: SCREEN_W * 0.72,
    height: SCREEN_W * 0.72,
    borderRadius: SCREEN_W,
    bottom: -SCREEN_W * 0.22,
    left: -SCREEN_W * 0.24,
    backgroundColor: 'rgba(191,90,242,0.16)',
  },
  cornerIcons: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    gap: 10,
    zIndex: 2,
  },
  cornerIconBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  menuContent: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 430,
  },
  // The same portrait-first composition stays readable in a short landscape
  // viewport while the game itself expands to the full horizontal canvas.
  menuContentLandscape: {
    maxWidth: 740,
    transform: [{ scale: 0.66 }],
  },
  appMark: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(10, 132, 255, 0.28)',
    shadowColor: '#c7ff4d',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  appMarkText: {
    color: '#c7ff4d',
    fontSize: 46,
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 52,
    fontWeight: '800',
    letterSpacing: -1.2,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(235,235,245,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  bestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.25)',
    backgroundColor: 'rgba(250,204,21,0.08)',
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  bestPillLabel: {
    color: 'rgba(250,204,21,0.7)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  bestPillValue: {
    color: 'rgba(250,204,21,0.95)',
    fontSize: 16,
    fontWeight: '800',
  },
  playBtnWrap: {
    width: '100%',
    marginTop: 4,
  },
  playBtn: {
    width: '100%',
    minHeight: 62,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c7ff4d',
    shadowColor: '#c7ff4d',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  playBtnGradient: {
    width: '100%',
    minHeight: 62,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: 280,
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  gameOverActions: {
    width: 280,
    flexDirection: 'row',
    gap: 8,
  },
  gameOverSecondaryBtn: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  quitBtn: {
    width: 280,
    minHeight: 48,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quitBtnText: {
    color: 'rgba(248,113,113,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  overlayTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 36,
    fontWeight: '700',
  },
  newHighBadge: {
    backgroundColor: 'rgba(250,204,21,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(250,204,21,0.3)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  newHighText: {
    color: '#facc15',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    width: 280,
  },
  statCard: {
    width: '46%',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    alignItems: 'center',
  },
  statCardHighlight: {
    backgroundColor: 'rgba(250,204,21,0.1)',
    borderColor: 'rgba(250,204,21,0.2)',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statValue: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 2,
  },
  statValueHighlight: {
    color: '#facc15',
  },
  controlsHint: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
});
