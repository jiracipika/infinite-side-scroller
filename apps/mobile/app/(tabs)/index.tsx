import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Text,
  Dimensions,
  Platform,
  AppState,
  SafeAreaView,
  Share,
  type GestureResponderEvent,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const GAME_HTML = require('../../assets/game.html');

const MENU_STEPS = [
  { title: 'Warm up', detail: 'Start endless and learn the rhythm.' },
  { title: 'Collect', detail: 'Bank coins for checkpoints and upgrades.' },
  { title: 'Compete', detail: 'Beat your best run from the board.' },
];

type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

interface GameStats {
  score: number;
  coins: number;
  distance: number;
  health: number;
  maxHealth: number;
  biome: string;
  fps: number;
  powerUps: string[];
  maxCombo: number;
  enemiesDefeated: number;
}

const DEFAULT_STATS: GameStats = {
  score: 0, coins: 0, distance: 0,
  health: 3, maxHealth: 3, biome: 'Grassland',
  fps: 60, powerUps: [], maxCombo: 0, enemiesDefeated: 0,
};

export default function GameScreen() {
  const webViewRef = useRef<WebView>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [stats, setStats] = useState<GameStats>(DEFAULT_STATS);
  const [highScore, setHighScore] = useState(0);
  const [showMenu, setShowMenu] = useState(true);

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
      if (data.type === 'stats') {
        setStats({
          score: data.score,
          coins: data.coins,
          distance: data.distance,
          health: data.health,
          maxHealth: data.maxHealth,
          biome: data.biome,
          fps: data.fps,
          powerUps: data.powerUps || [],
          maxCombo: data.maxCombo || 0,
          enemiesDefeated: data.enemiesDefeated || 0,
        });
      } else if (data.type === 'gameover') {
        setGameState('gameover');
        setHighScore(prev => Math.max(prev, data.score || stats.score));
      }
    } catch {}
  }, [stats.score]);

  const handlePlay = useCallback((seed?: number) => {
    const s = seed ?? Math.floor(Math.random() * 999999);
    setGameState('playing');
    setShowMenu(false);
    // Small delay to ensure WebView is ready
    setTimeout(() => {
      callEngine(`setSeed(${s})`);
      callEngine('resume');
    }, 100);
  }, [callEngine]);

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
    const seed = Math.floor(Math.random() * 999999);
    setGameState('playing');
    setShowMenu(false);
    setTimeout(() => {
      callEngine(`setSeed(${seed})`);
      callEngine('resume');
    }, 100);
  }, [callEngine]);

  const handleQuit = useCallback(() => {
    setGameState('menu');
    setShowMenu(true);
    callEngine(`setSeed(42)`);
  }, [callEngine]);

  // WebView injected JS for reduced particles
  const injectedJS = `
    // Override ParticleSystem constructor to set reduced particles
    const origProto = ParticleSystem.prototype;
    const origConstructor = this.ParticleSystem;
    true;
  `;

  return (
    <View style={styles.container}>
      {/* Game WebView */}
      <View style={styles.webviewContainer}>
        <WebView
          ref={webViewRef}
          source={GAME_HTML}
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
          onError={(e) => console.warn('WebView error:', e.nativeEvent)}
          setSupportMultipleWindows={false}
        />
      </View>

      {/* HUD overlay during gameplay */}
      {gameState === 'playing' && <HUD stats={stats} onPause={handlePause} />}

      {/* Touch controls during gameplay */}
      {gameState === 'playing' && (
        <TouchControls sendInput={sendInput} />
      )}

      {/* Menu overlays */}
      {showMenu && gameState === 'menu' && (
        <MenuOverlay onPlay={handlePlay} highScore={highScore} />
      )}

      {gameState === 'paused' && (
        <PauseOverlay onResume={handleResume} onRestart={handleRestart} onQuit={handleQuit} />
      )}

      {gameState === 'gameover' && (
        <GameOverOverlay
          stats={stats}
          highScore={highScore}
          onRestart={handleRestart}
          onQuit={handleQuit}
        />
      )}
    </View>
  );
}

// ─── Touch Controls ────────────────────────────────────────────────

const TouchControls: React.FC<{
  sendInput: (type: string, value: boolean) => void;
}> = ({ sendInput }) => {
  const heldInputsRef = useRef<Set<string>>(new Set());
  const [movementDirection, setMovementDirectionState] = useState<-1 | 0 | 1>(0);

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

  const setMovementDirection = useCallback((next: -1 | 0 | 1) => {
    const previous = heldInputsRef.current.has('move-left')
      ? -1
      : heldInputsRef.current.has('move-right')
        ? 1
        : 0;
    if (previous === next) return;
    if (previous === -1) handleTouchEnd('move-left');
    if (previous === 1) handleTouchEnd('move-right');
    if (next === -1) handleTouchStart('move-left');
    if (next === 1) handleTouchStart('move-right');
    setMovementDirectionState(next);
  }, [handleTouchEnd, handleTouchStart]);

  const releaseAll = useCallback(() => {
    for (const type of heldInputsRef.current) {
      sendInput(type, false);
    }
    heldInputsRef.current.clear();
    setMovementDirectionState(0);
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
      {/* Left side: one broad pad supports press-and-slide direction changes. */}
      <View style={styles.leftControls}>
        <NativeMovementPad
          direction={movementDirection}
          onDirectionChange={setMovementDirection}
        />
      </View>

      {/* Right side: independent action targets support simultaneous fingers. */}
      <View style={styles.rightControls}>
        <View style={styles.actionRow}>
          <DirectionButton
            size="sm"
            icon="speedometer"
            label="Dash"
            hint="Tap to dash in the facing direction"
            onPress={() => handleTouchStart('dash-press')}
            onRelease={() => handleTouchEnd('dash-press')}
            accent="purple"
          />
          <DirectionButton
            size="sm"
            icon="flash"
            label="Attack"
            hint="Hold to attack while running"
            onPress={() => handleTouchStart('attack-press')}
            onRelease={() => handleTouchEnd('attack-press')}
            accent="orange"
          />
        </View>
        <View style={{ height: 12 }} />
        <DirectionButton
          size="lg"
          icon="arrow-up"
          label="Jump"
          hint="Hold to jump over obstacles"
          onPress={() => handleTouchStart('jump-press')}
          onRelease={() => handleTouchEnd('jump-press')}
          accent="blue"
        />
      </View>
    </View>
  );
};

const NativeMovementPad: React.FC<{
  direction: -1 | 0 | 1;
  onDirectionChange: (direction: -1 | 0 | 1) => void;
}> = ({ direction, onDirectionChange }) => {
  const width = 148;
  const updateDirection = useCallback((event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    const normalized = Math.max(0, Math.min(1, x / width));
    onDirectionChange(normalized <= 0.4 ? -1 : normalized >= 0.6 ? 1 : 0);
  }, [onDirectionChange]);

  return (
    <Pressable
      onPressIn={updateDirection}
      onTouchMove={updateDirection}
      onPressOut={() => onDirectionChange(0)}
      onTouchCancel={() => onDirectionChange(0)}
      accessibilityRole="adjustable"
      accessibilityLabel="Movement pad"
      accessibilityHint="Hold and slide left or right to move"
      accessibilityValue={{ text: direction === -1 ? 'Moving left' : direction === 1 ? 'Moving right' : 'Neutral' }}
      style={styles.movementPad}
    >
      <View pointerEvents="none" style={[styles.movementHalf, direction === -1 && styles.movementHalfActive]}>
        <Ionicons name="arrow-back" size={26} color="rgba(255,255,255,0.82)" />
      </View>
      <View pointerEvents="none" style={styles.movementPadDivider} />
      <View pointerEvents="none" style={[styles.movementHalf, direction === 1 && styles.movementHalfActive]}>
        <Ionicons name="arrow-forward" size={26} color="rgba(255,255,255,0.82)" />
      </View>
    </Pressable>
  );
};

const DirectionButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'lg';
  accent?: 'blue' | 'orange' | 'purple';
  label: string;
  hint: string;
  onPress: () => void;
  onRelease: () => void;
}> = ({ icon, size = 'lg', accent, label, hint, onPress, onRelease }) => {
  const btnSize = size === 'lg' ? 64 : 48;

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
      <Ionicons name={icon} size={size === 'lg' ? 24 : 18} color="rgba(255,255,255,0.7)" />
    </Pressable>
  );
};

// ─── HUD ───────────────────────────────────────────────────────────

const HUD: React.FC<{ stats: GameStats; onPause: () => void }> = ({ stats, onPause }) => {
  const hearts = Array.from({ length: stats.maxHealth }).map((_, i) => i);

  return (
    <SafeAreaView style={styles.hudContainer} pointerEvents="box-none">
      <View style={styles.hudRow} pointerEvents="box-none">
        {/* Left: Hearts + Coins */}
        <View style={styles.hudLeft}>
          <View
            style={styles.hudBadge}
            accessible
            accessibilityLabel={`Health ${stats.health} of ${stats.maxHealth}`}
          >
            {hearts.map(i => (
              <Text
                key={i}
                style={[
                  styles.heart,
                  i < stats.health ? styles.heartFull : styles.heartEmpty,
                ]}
              >
                ♥
              </Text>
            ))}
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

        {/* Center: Score */}
        <View style={styles.hudCenter}>
          <Text style={styles.scoreText}>{stats.score.toLocaleString()}</Text>
          <Text style={styles.distanceText}>{Math.round(stats.distance)}m</Text>
        </View>

        {/* Right: Biome + Pause */}
        <View style={styles.hudRight}>
          <View style={styles.hudBadge}>
            <Text style={styles.biomeText}>{stats.biome}</Text>
          </View>
          <TouchableOpacity
            onPress={onPause}
            style={styles.pauseBtn}
            accessibilityRole="button"
            accessibilityLabel="Pause game"
            accessibilityHint="Pauses the current run"
          >
            <Ionicons name="pause" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─── Menu Overlay ──────────────────────────────────────────────────

const MenuOverlay: React.FC<{ onPlay: (seed?: number) => void; highScore: number }> = ({ onPlay, highScore }) => (
  <LinearGradient colors={['rgba(0,0,0,0.92)', 'rgba(8,12,22,0.96)', 'rgba(16,20,34,0.98)']} style={styles.overlay}>
    <View style={styles.ambientGlowA} />
    <View style={styles.ambientGlowB} />
    <View style={styles.menuContent}>
      <View style={styles.appMark}>
        <Text style={styles.appMarkText}>∞</Text>
      </View>
      <Text style={styles.title}>Dashverse</Text>
      <Text style={styles.subtitle}>RUN · COLLECT · COMPETE</Text>

      <View style={styles.menuGlassPanel}>
        <View style={styles.menuHeaderRow}>
          <View>
            <Text style={styles.panelEyebrow}>Today's route</Text>
            <Text style={styles.panelTitle}>Pick up speed in three moves.</Text>
          </View>
          <View style={styles.readyPill}>
            <View style={styles.readyDot} />
            <Text style={styles.readyText}>Ready</Text>
          </View>
        </View>

        {highScore > 0 && (
          <View style={styles.highScoreRow}>
            <Text style={styles.highScoreLabel}>Best Score</Text>
            <Text style={styles.highScoreValue}>{highScore.toLocaleString()}</Text>
          </View>
        )}

        <View style={styles.menuStepGrid}>
          {MENU_STEPS.map((step, index) => (
            <View key={step.title} style={styles.menuStepRow}>
              <Text style={styles.menuStepIndex}>{index + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuStepTitle}>{step.title}</Text>
                <Text style={styles.menuStepDetail}>{step.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={styles.playBtn}
        onPress={() => onPlay()}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Play Endless"
        accessibilityHint="Start a new endless run"
      >
        <LinearGradient colors={['#0A84FF', '#5E5CE6', '#BF5AF2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.playBtnGradient}>
          <Text style={styles.playBtnText}>Play Endless</Text>
          <Text style={styles.playBtnSubtext}>Jump straight into a run</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Text style={styles.controlsHint}>
        Touch controls stay low: move left, jump/attack right.
      </Text>
    </View>
  </LinearGradient>
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

      <TouchableOpacity style={styles.playBtn} onPress={onResume} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Resume run">
        <Text style={styles.playBtnText}>Resume</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={onRestart} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Restart run">
        <Text style={styles.secondaryBtnText}>Restart</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.quitBtn} onPress={onQuit} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Quit to menu">
        <Text style={styles.quitBtnText}>Quit to Menu</Text>
      </TouchableOpacity>
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

        <TouchableOpacity style={styles.playBtn} onPress={onRestart} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Play again">
          <Text style={styles.playBtnText}>Play Again</Text>
        </TouchableOpacity>

        <View style={styles.gameOverActions}>
          <TouchableOpacity style={styles.gameOverSecondaryBtn} onPress={() => { void handleShare(); }} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Share this run result">
            <Text style={styles.secondaryBtnText}>{shareStatus}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gameOverSecondaryBtn} onPress={onQuit} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Return to main menu">
            <Text style={styles.secondaryBtnText}>Main Menu</Text>
          </TouchableOpacity>
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

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

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
  touchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  leftControls: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  movementPad: {
    width: 148,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  movementHalf: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  movementHalfActive: {
    backgroundColor: 'rgba(10,132,255,0.48)',
  },
  movementPadDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  rightControls: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    alignItems: 'flex-end',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  touchBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  heart: { fontSize: 14, lineHeight: 16 },
  heartFull: { color: '#f87171' },
  heartEmpty: { color: 'rgba(255,255,255,0.15)' },
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
  biomeText: { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '500' },
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
    backgroundColor: 'rgba(10,132,255,0.18)',
  },
  ambientGlowB: {
    position: 'absolute',
    width: SCREEN_W * 0.72,
    height: SCREEN_W * 0.72,
    borderRadius: SCREEN_W,
    bottom: -SCREEN_W * 0.22,
    left: -SCREEN_W * 0.24,
    backgroundColor: 'rgba(191,90,242,0.14)',
  },
  menuContent: {
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 430,
  },
  appMark: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  appMarkText: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    color: 'rgba(235,235,245,0.45)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  divider: {
    width: 48,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 4,
  },
  highScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  highScoreLabel: {
    color: 'rgba(250,204,21,0.7)',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  highScoreValue: {
    color: 'rgba(250,204,21,0.9)',
    fontSize: 14,
    fontWeight: '600',
  },
  menuGlassPanel: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(28,28,30,0.58)',
    padding: 14,
    gap: 12,
    overflow: 'hidden',
  },
  menuHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelEyebrow: {
    color: 'rgba(235,235,245,0.42)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  panelTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 4,
  },
  readyPill: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.3)',
    backgroundColor: 'rgba(48,209,88,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  readyDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: '#30D158',
  },
  readyText: {
    color: '#30D158',
    fontSize: 12,
    fontWeight: '700',
  },
  menuStepGrid: {
    gap: 8,
  },
  menuStepRow: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.045)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
  },
  menuStepIndex: {
    width: 30,
    height: 30,
    borderRadius: 10,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#0A84FF',
    fontSize: 13,
    fontWeight: '900',
    backgroundColor: 'rgba(10,132,255,0.18)',
  },
  menuStepTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  menuStepDetail: {
    color: 'rgba(235,235,245,0.58)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  playBtn: {
    marginTop: 4,
    width: '100%',
    minHeight: 62,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
    shadowColor: '#0A84FF',
    shadowOpacity: 0.34,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
  },
  playBtnGradient: {
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
  playBtnSubtext: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
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
