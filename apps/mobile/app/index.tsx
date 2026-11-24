import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Image,
  useWindowDimensions,
  AppState,
  BackHandler,
  ScrollView,
  Share,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { loadPlayerBest, normalizePlayerBest, savePlayerBest } from '../lib/player-best';
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
// android/app/src/main/assets for release builds. Development uses Metro.
const GAME_SOURCE =
  Platform.OS === 'android' && !__DEV__
    ? { uri: 'file:///android_asset/game.html', baseUrl: 'file:///android_asset/game.html' }
    : GAME_HTML;

type GameState = 'menu' | 'loading' | 'playing' | 'paused' | 'gameover' | 'error';

const ENGINE_LOAD_TIMEOUT_MS = 15_000;

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
  const [webViewKey, setWebViewKey] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_GAME_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const runRef = useRef({ id: 0, seed: 0, pauseOnReady: false });
  const gameStateRef = useRef<GameState>('menu');
  const latestStatsRef = useRef(DEFAULT_STATS);
  const bestScoreRef = useRef(0);
  const settingsRef = useRef<GameSettings>(DEFAULT_GAME_SETTINGS);
  const { largeControls, leftHanded, showFPS, hapticsEnabled } = settings;

  const transitionTo = useCallback((state: GameState) => {
    gameStateRef.current = state;
    setGameState(state);
  }, []);

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

  useMobileHaptics(stats, hapticsEnabled && gameState === 'playing');

  const injectGameScript = useCallback((script: string) => {
    webViewRef.current?.injectJavaScript(`window.__gameControls.${script}; true;`);
  }, []);

  const applySettings = useCallback((next: GameSettings) => {
    settingsRef.current = next;
    setSettings(next);
    if (gameStateRef.current === 'playing' || gameStateRef.current === 'paused') {
      injectGameScript(`applySettings(${JSON.stringify(next)})`);
    }
  }, [injectGameScript]);

  useEffect(() => {
    let mounted = true;
    void loadPlayerBest().then(best => {
      if (!mounted) return;
      bestScoreRef.current = Math.max(bestScoreRef.current, best.score);
      setHighScore(bestScoreRef.current);
    });
    void loadGameSettings().then(saved => {
      if (mounted && settingsRef.current === DEFAULT_GAME_SETTINGS) applySettings(saved);
    });
    return () => { mounted = false; };
  }, [applySettings]);

  const sendInput = useCallback((type: string, value: boolean) => {
    if (gameStateRef.current !== 'playing') return;
    const detail = JSON.stringify({ type, value });
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('game-input', { detail: ${detail} })); true;`
    );
  }, []);

  const handleMessage = useCallback((e: WebViewMessageEvent) => {
    const run = runRef.current;
    if (run.id !== webViewKey) return;

    try {
      const data = JSON.parse(e.nativeEvent.data);
      const phase = gameStateRef.current;
      if (data.type === 'ready' && phase === 'loading') {
        const appState = AppState.currentState;
        const paused = run.pauseOnReady || (appState != null && appState !== 'active');
        const options = { seed: run.seed, paused, settings: settingsRef.current };
        injectGameScript(`startRun(${JSON.stringify(options)})`);
        transitionTo(paused ? 'paused' : 'playing');
      } else if (data.type === 'stats' && phase === 'playing') {
        const nextStats = {
          score: data.score,
          coins: data.coins,
          distance: data.distance,
          health: data.health,
          maxHealth: data.maxHealth,
          lives: data.lives ?? 3,
          comboCount: data.comboCount ?? 0,
          biome: data.biome,
          fps: data.fps,
          powerUps: data.powerUps ?? [],
          maxCombo: data.maxCombo ?? 0,
          enemiesDefeated: data.enemiesDefeated ?? 0,
        };
        latestStatsRef.current = nextStats;
        setStats(nextStats);
      } else if (data.type === 'gameover' && (phase === 'playing' || phase === 'paused')) {
        const stats = latestStatsRef.current;
        const runStats = normalizePlayerBest({
          score: data.score ?? stats.score,
          distance: data.distance ?? stats.distance,
          coins: data.coins ?? stats.coins,
          maxCombo: data.maxCombo ?? stats.maxCombo,
          enemiesDefeated: data.enemiesDefeated ?? stats.enemiesDefeated,
        });
        setStats({ ...stats, ...runStats });
        transitionTo('gameover');
        void appendRunHistory(runStats);
        const newBest = runStats.score > bestScoreRef.current;
        setIsNewBest(newBest);
        if (newBest) {
          bestScoreRef.current = runStats.score;
          setHighScore(runStats.score);
          void savePlayerBest(runStats);
        }
      }
    } catch {
      // Ignore messages other than JSON from the bundled game.
    }
  }, [injectGameScript, transitionTo, webViewKey]);

  const recoverWebView = useCallback(() => {
    if (runRef.current.id !== webViewKey) return;
    const phase = gameStateRef.current;
    if (phase === 'loading' || phase === 'playing' || phase === 'paused') transitionTo('error');
  }, [transitionTo, webViewKey]);

  useEffect(() => {
    if (gameState !== 'loading') return;
    const timeout = setTimeout(() => {
      if (gameStateRef.current === 'loading') recoverWebView();
    }, ENGINE_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [gameState, recoverWebView]);

  const queueRun = useCallback((seed: number) => {
    if (gameStateRef.current === 'loading') return;
    const id = runRef.current.id + 1;
    runRef.current = { id, seed, pauseOnReady: false };
    latestStatsRef.current = DEFAULT_STATS;
    prevStatsRef.current = DEFAULT_STATS;
    setStats(DEFAULT_STATS);
    setIsNewBest(false);
    setWebViewKey(id);
    transitionTo('loading');
  }, [transitionTo]);

  const handleRestart = useCallback(() => {
    queueRun(Math.floor(Math.random() * 999999));
  }, [queueRun]);

  const handlePause = useCallback(() => {
    if (gameStateRef.current !== 'playing') return;
    transitionTo('paused');
    injectGameScript('pause()');
  }, [injectGameScript, transitionTo]);

  const handleResume = useCallback(() => {
    if (gameStateRef.current !== 'paused') return;
    transitionTo('playing');
    injectGameScript('resume()');
  }, [injectGameScript, transitionTo]);

  const handleQuit = useCallback(() => {
    transitionTo('menu');
  }, [transitionTo]);

  useEffect(() => {
    const pauseForInterruption = () => {
      if (gameStateRef.current === 'loading') runRef.current.pauseOnReady = true;
      handlePause();
    };
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') pauseForInterruption();
    });
    const blur = Platform.OS === 'android'
      ? AppState.addEventListener('blur', pauseForInterruption)
      : null;
    return () => {
      subscription.remove();
      blur?.remove();
    };
  }, [handlePause]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (gameStateRef.current === 'menu') return false;
      if (gameStateRef.current === 'playing') handlePause();
      else handleQuit();
      return true;
    });
    return () => subscription.remove();
  }, [handlePause, handleQuit]);

  return (
    <ScreenShake shakeKey={shakeKey} intensity={6} duration={350}>
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" hidden={gameState !== 'menu'} />
      {/*
        Android WebView is a native surface and can be composited above sibling
        React Native views. Mount it only after Play is pressed so the native
        menu is never hidden behind the WebView's initial white document.
      */}
      {gameState !== 'menu' && gameState !== 'error' && (
        <View style={styles.webviewContainer} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <WebView
            key={webViewKey}
            ref={webViewRef}
            source={GAME_SOURCE}
            style={styles.webview}
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
            onError={recoverWebView}
            onRenderProcessGone={recoverWebView}
            onContentProcessDidTerminate={recoverWebView}
            mediaPlaybackRequiresUserAction={false}
            setSupportMultipleWindows={false}
          />
        </View>
      )}
      {gameState === 'loading' && (
        <View style={styles.loadingOverlay}>
          <LoadingSpinner label="Loading" size={48} color="#c7ff4d" />
          <View style={{ marginTop: 20 }}>
            <LoadingProgressBar width={160} height={3} color="#c7ff4d" />
          </View>
        </View>
      )}
      {gameState === 'error' && (
        <SafeAreaView style={styles.loadingOverlay}>
          <Ionicons name="warning" size={42} color="#f8a4a4" />
          <Text style={styles.webviewErrorTitle} accessibilityRole="header">Couldn’t load the game</Text>
          <Text style={styles.webviewErrorBody}>Retry this run or return to the menu.</Text>
          <PressableScale
            style={styles.webviewErrorRetryBtn}
            onPress={() => queueRun(runRef.current.seed)}
            accessibilityRole="button"
            accessibilityLabel="Retry loading the game"
            haptic={hapticsEnabled}
          >
            <Text style={styles.webviewErrorRetryText}>Retry</Text>
          </PressableScale>
          <PressableScale style={styles.quitBtn} onPress={handleQuit} accessibilityRole="button" haptic={hapticsEnabled}>
            <Text style={styles.quitBtnText}>Main Menu</Text>
          </PressableScale>
        </SafeAreaView>
      )}

      {/* Damage particle burst — centered on screen */}
      <ParticleBurst
        burstKey={damageBurstKey}
        config={{
          count: 10,
          colors: ['#f87171', '#ef4444', '#fca5a5', 'rgba(248,113,113,0.5)'],
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
      {gameState === 'playing' && <HUD stats={stats} onPause={handlePause} showFPS={showFPS} hapticsEnabled={hapticsEnabled} />}

      {/* Touch controls during gameplay */}
      {gameState === 'playing' && (
        <TouchControls sendInput={sendInput} largeControls={largeControls} leftHanded={leftHanded} />
      )}

      {/* Menu overlays */}
      {gameState === 'menu' && (
        <FadeTransition
          visible={true}
          slideDirection="up"
          slideDistance={30}
          duration={400}
          gradientColors={['#30243d', '#201929', '#13101b']}
        >
          <MenuOverlay
            onPlay={handleRestart}
            hapticsEnabled={hapticsEnabled}
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
          gradientColors={['#13101b88', '#201929ed']}
        >
          <PauseOverlay onResume={handleResume} onRestart={handleRestart} onQuit={handleQuit} hapticsEnabled={hapticsEnabled} />
        </FadeTransition>
      )}

      {gameState === 'gameover' && (
        <FadeTransition
          visible={true}
          slideDirection="up"
          slideDistance={40}
          duration={350}
          gradientColors={['#13101bbf', '#201929f4']}
        >
          <GameOverOverlay
            stats={stats}
            highScore={highScore}
            isNewBest={isNewBest}
            hapticsEnabled={hapticsEnabled}
            onRestart={handleRestart}
            onQuit={handleQuit}
          />
        </FadeTransition>
      )}

      {/* Corner-icon sheets (from the menu only) */}
      <SettingsSheet
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        onChanged={applySettings}
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
  leftHanded: boolean;
}> = ({ sendInput, largeControls = false, leftHanded }) => {
  const insets = useSafeAreaInsets();
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

  const activate = (type: string) => {
    handleTouchStart(type);
    handleTouchEnd(type);
  };

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
      <View style={[
        styles.actionControls,
        { bottom: insets.bottom + 16 },
        leftHanded
          ? { left: insets.left + 16, flexDirection: 'row-reverse' }
          : { right: insets.right + 16 },
      ]}>
        <Pressable
          onPressIn={() => handleTouchStart('dash-press')}
          onPressOut={() => handleTouchEnd('dash-press')}
          onTouchCancel={() => handleTouchEnd('dash-press')}
          accessibilityRole="button"
          accessibilityLabel="Slide"
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'activate') activate('dash-press');
          }}
          style={({ pressed }) => [styles.slideBtn, largeControls && styles.slideBtnLarge, pressed && styles.actionPressed]}
        >
          <Ionicons name="flash" size={20} color="#f4f2ed" />
          <Text style={styles.actionLabel}>Slide</Text>
        </Pressable>
        <Pressable
          onPressIn={() => handleTouchStart('jump-press')}
          onPressOut={() => handleTouchEnd('jump-press')}
          onTouchCancel={() => handleTouchEnd('jump-press')}
          accessibilityRole="button"
          accessibilityLabel="Jump"
          accessibilityHint="Tap again in the air to double jump"
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'activate') activate('jump-press');
          }}
          style={({ pressed }) => [styles.jumpBtn, largeControls && styles.jumpBtnLarge, pressed && styles.actionPressed]}
        >
          <Ionicons name="arrow-up" size={largeControls ? 32 : 26} color="#f4f2ed" />
          <Text style={styles.actionLabel}>Jump</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ─── HUD ───────────────────────────────────────────────────────────

const HUD: React.FC<{
  stats: GameStats;
  onPause: () => void;
  showFPS: boolean;
  hapticsEnabled: boolean;
}> = ({ stats, onPause, showFPS, hapticsEnabled }) => {
  const hearts = Array.from({ length: stats.maxHealth }).map((_, i) => i);

  return (
    <SafeAreaView style={styles.hudContainer} edges={['top', 'left', 'right']} pointerEvents="box-none">
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
          <PauseButton onPress={onPause} hapticsEnabled={hapticsEnabled} />
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─── Pause Button (with press feedback + haptics) ───────────────────

const PauseButton: React.FC<{ onPress: () => void; hapticsEnabled: boolean }> = ({ onPress, hapticsEnabled }) => {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPressIn={() => {
        Animated.spring(scale, { toValue: 0.9, damping: 30, stiffness: 600, useNativeDriver: true }).start();
        if (hapticsEnabled) Vibration.vibrate(8);
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
  onPlay: () => void;
  hapticsEnabled: boolean;
  highScore: number;
  onOpenSettings: () => void;
  onOpenLeaderboard: () => void;
}> = ({ onPlay, hapticsEnabled, highScore, onOpenSettings, onOpenLeaderboard }) => {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height * 1.25;
  const compact = height < 690;

  return (
  <LinearGradient colors={['#30243d', '#201929', '#13101b']} style={styles.overlay}>
    {/* Corner icons: settings + leaderboard sheets */}
    <View style={[styles.cornerIcons, { top: insets.top + 12, right: insets.right + 12 }]}>
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

    <View style={[
      styles.launchLayout,
      { paddingLeft: insets.left + 20, paddingRight: insets.right + 20, paddingTop: insets.top + 64, paddingBottom: insets.bottom + 12 },
      isLandscape && styles.launchLandscape,
    ]}>
      <Image
        accessible={false}
        source={require('../assets/ruins-cover.jpg')}
        resizeMode="cover"
        style={[styles.launchCover, isLandscape && styles.launchCoverLandscape,
          !isLandscape && { height: Math.min(300, height * (compact ? 0.30 : 0.34)) }]}
      />
      <View style={[styles.menuContent, styles.launchContent]}>
        <Text style={styles.title} accessibilityRole="header" accessibilityLabel="Dashverse" numberOfLines={1} adjustsFontSizeToFit>
          DASH<Text style={styles.titleAccent}>VERSE</Text>
        </Text>

        {highScore > 0 && (
          <View style={styles.bestPill} accessible accessibilityLabel={`Personal best score ${highScore}`}>
            <Text style={styles.bestPillLabel}>BEST</Text>
            <Text style={styles.bestPillValue}>{highScore.toLocaleString()}</Text>
          </View>
        )}

        <View style={styles.playBtnWrap}>
          <PressableScale
            style={styles.playBtn}
            onPress={onPlay}
            haptic={hapticsEnabled}
            accessibilityRole="button"
            accessibilityLabel="Play Endless"
            accessibilityHint="Start a new endless run"
          >
            <Text style={styles.playBtnText}>Play Endless</Text>
          </PressableScale>
        </View>

        <Text style={styles.controlsHint}>Jump over gaps · Slide through danger</Text>
      </View>
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
  hapticsEnabled: boolean;
  onRestart: () => void;
  onQuit: () => void;
}> = ({ onResume, onRestart, onQuit, hapticsEnabled }) => (
  <LinearGradient colors={['#13101b88', '#201929ed']} style={styles.overlay}>
    <SafeAreaView style={styles.menuContent}>
      <Text style={styles.overlayTitle} accessibilityRole="header">Paused</Text>

      <View style={styles.playBtnWrap}>
        <PressableScale style={styles.playBtn} onPress={onResume} accessibilityRole="button" accessibilityLabel="Resume run" haptic={hapticsEnabled}>
          <Text style={styles.playBtnText}>Resume</Text>
        </PressableScale>
      </View>

      <PressableScale style={styles.secondaryBtn} onPress={onRestart} accessibilityRole="button" accessibilityLabel="Restart run" haptic={hapticsEnabled}>
        <Text style={styles.secondaryBtnText}>Restart</Text>
      </PressableScale>

      <PressableScale style={styles.quitBtn} onPress={onQuit} accessibilityRole="button" accessibilityLabel="Quit to menu" haptic={hapticsEnabled}>
        <Text style={styles.quitBtnText}>Quit to Menu</Text>
      </PressableScale>
    </SafeAreaView>
  </LinearGradient>
);

// ─── Game Over Overlay ─────────────────────────────────────────────

const GameOverOverlay: React.FC<{
  stats: GameStats;
  highScore: number;
  isNewBest: boolean;
  hapticsEnabled: boolean;
  onRestart: () => void;
  onQuit: () => void;
}> = ({ stats, highScore, isNewBest, hapticsEnabled, onRestart, onQuit }) => {
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
    <LinearGradient colors={['#13101bbf', '#201929f4']} style={styles.overlay}>
      <SafeAreaView style={styles.resultsSafeArea}>
        <ScrollView contentContainerStyle={styles.resultsScroll}>
          <View style={styles.menuContent}>
            <Text style={styles.overlayTitle} accessibilityRole="header">Game Over</Text>

            {isNewBest && (
              <View style={styles.newHighBadge}>
                <Text style={styles.newHighText}>New High Score!</Text>
              </View>
            )}

            <View style={styles.statsGrid}>
              <StatCard label="Score" value={stats.score.toLocaleString()} highlight={isNewBest} />
              <StatCard label="Best" value={highScore.toLocaleString()} />
              <StatCard label="Distance" value={`${Math.round(stats.distance)}m`} />
              <StatCard label="Coins" value={`${stats.coins}`} />
              <StatCard label="Best Combo" value={stats.maxCombo > 0 ? `x${stats.maxCombo}` : '—'} />
              <StatCard label="Defeated" value={`${stats.enemiesDefeated}`} />
            </View>

            <View style={styles.playBtnWrap}>
              <PressableScale style={styles.playBtn} onPress={onRestart} accessibilityRole="button" accessibilityLabel="Play again" haptic={hapticsEnabled}>
                <Text style={styles.playBtnText}>Play Again</Text>
              </PressableScale>
            </View>

            <View style={styles.gameOverActions}>
              <PressableScale style={styles.gameOverSecondaryBtn} onPress={() => { void handleShare(); }} accessibilityRole="button" accessibilityLabel="Share this run result" haptic={hapticsEnabled}>
                <Text style={styles.secondaryBtnText}>{shareStatus}</Text>
              </PressableScale>
              <PressableScale style={styles.gameOverSecondaryBtn} onPress={onQuit} accessibilityRole="button" accessibilityLabel="Return to main menu" haptic={hapticsEnabled}>
                <Text style={styles.secondaryBtnText}>Main Menu</Text>
              </PressableScale>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
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
  actionControls: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  jumpBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#272c20',
    borderWidth: 2,
    borderColor: '#c7ff4d',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  jumpBtnLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  slideBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#30243d',
    borderWidth: 1,
    borderColor: '#a18bb4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideBtnLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  actionLabel: {
    color: '#f4f2ed',
    fontSize: 11,
    fontWeight: '700',
  },
  actionPressed: { opacity: 0.75 },
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
  launchLayout: {
    flex: 1,
    width: '100%',
    maxWidth: 872,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
  },
  launchLandscape: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  launchCover: {
    width: '100%',
    maxWidth: 450,
    borderRadius: 14,
    backgroundColor: '#201929',
  },
  launchCoverLandscape: {
    flex: 1,
    width: undefined,
    height: '100%',
    maxHeight: 320,
  },
  launchContent: {
    flexShrink: 1,
    paddingHorizontal: 0,
    maxWidth: 320,
    gap: 10,
  },
  cornerIcons: {
    position: 'absolute',
    flexDirection: 'row',
    gap: 10,
    zIndex: 2,
  },
  cornerIconBtn: {
    width: 46,
    height: 46,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#201929',
    borderWidth: 1,
    borderColor: '#59476c',
  },
  menuContent: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 430,
  },
  title: {
    color: '#f4f2ed',
    fontSize: 46,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: -2.4,
    textAlign: 'center',
    textShadowColor: '#6b4d89',
    textShadowRadius: 1,
    textShadowOffset: { width: 2, height: 3 },
  },
  titleAccent: {
    color: '#c7ff4d',
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
    borderRadius: 7,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c7ff4d',
    shadowColor: '#c7ff4d',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  playBtnText: {
    color: '#13101b',
    fontSize: 18,
    fontWeight: '800',
  },
  secondaryBtn: {
    minWidth: 120,
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
    width: '100%',
    justifyContent: 'center',
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
    minWidth: 120,
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
  resultsSafeArea: {
    width: '100%',
    flex: 1,
  },
  resultsScroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    width: '100%',
    justifyContent: 'center',
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
