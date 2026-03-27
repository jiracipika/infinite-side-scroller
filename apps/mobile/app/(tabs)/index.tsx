import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  Platform,
  SafeAreaView,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const GAME_HTML = require('../../assets/game.html');

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
}

const DEFAULT_STATS: GameStats = {
  score: 0, coins: 0, distance: 0,
  health: 3, maxHealth: 3, biome: 'Grassland',
  fps: 60, powerUps: [],
};

export default function GameScreen() {
  const webViewRef = useRef<WebView>(null);
  const [gameState, setGameState] = useState<GameState>('menu');
  const [stats, setStats] = useState<GameStats>(DEFAULT_STATS);
  const [highScore, setHighScore] = useState(0);
  const [showMenu, setShowMenu] = useState(true);

  const sendInput = useCallback((type: string, value: boolean) => {
    webViewRef.current?.injectJavaScript(
      `window.dispatchEvent(new CustomEvent('game-input', {detail: {type:'${type}',value:${value}}})); true;`
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
  const holdRef = useRef<{ type: string } | null>(null);

  const handleTouchStart = useCallback((type: string) => {
    holdRef.current = { type };
    sendInput(type, true);
  }, [sendInput]);

  const handleTouchEnd = useCallback((type: string) => {
    if (holdRef.current?.type === type) {
      holdRef.current = null;
      sendInput(type, false);
    }
  }, [sendInput]);

  const releaseAll = useCallback(() => {
    if (holdRef.current) {
      sendInput(holdRef.current.type, false);
      holdRef.current = null;
    }
  }, [sendInput]);

  return (
    <View style={styles.touchOverlay} pointerEvents="box-none">
      {/* Left side: D-pad */}
      <View style={styles.leftControls}>
        <DirectionButton
          icon="arrow-back"
          onPress={() => handleTouchStart('move-left')}
          onRelease={() => handleTouchEnd('move-left')}
        />
        <View style={{ width: 12 }} />
        <DirectionButton
          icon="arrow-forward"
          onPress={() => handleTouchStart('move-right')}
          onRelease={() => handleTouchEnd('move-right')}
        />
      </View>

      {/* Right side: Jump + Attack */}
      <View style={styles.rightControls}>
        <DirectionButton
          size="sm"
          icon="flash"
          onPress={() => handleTouchStart('attack-press')}
          onRelease={() => handleTouchEnd('attack-press')}
          accent="orange"
        />
        <View style={{ height: 12 }} />
        <DirectionButton
          size="lg"
          icon="arrow-up"
          onPress={() => handleTouchStart('jump-press')}
          onRelease={() => handleTouchEnd('jump-press')}
          accent="blue"
        />
      </View>
    </View>
  );
};

const DirectionButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  size?: 'sm' | 'lg';
  accent?: 'blue' | 'orange';
  onPress: () => void;
  onRelease: () => void;
}> = ({ icon, size = 'lg', accent, onPress, onRelease }) => {
  const btnSize = size === 'lg' ? 64 : 48;

  return (
    <TouchableOpacity
      onPressIn={onPress}
      onPressOut={onRelease}
      style={[
        styles.touchBtn,
        { width: btnSize, height: btnSize, borderRadius: btnSize / 2 },
        accent === 'blue' && styles.touchBtnBlue,
        accent === 'orange' && styles.touchBtnOrange,
      ]}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={size === 'lg' ? 24 : 18} color="rgba(255,255,255,0.7)" />
    </TouchableOpacity>
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
          <View style={styles.hudBadge}>
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
          <View style={styles.hudBadge}>
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
          <TouchableOpacity onPress={onPause} style={styles.pauseBtn}>
            <Ionicons name="pause" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

// ─── Menu Overlay ──────────────────────────────────────────────────

const MenuOverlay: React.FC<{ onPlay: (seed?: number) => void; highScore: number }> = ({ onPlay, highScore }) => (
  <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(26,26,46,0.9)']} style={styles.overlay}>
    <View style={styles.menuContent}>
      <Text style={styles.title}>Infinite</Text>
      <Text style={styles.subtitle}>SIDE SCROLLER</Text>
      <View style={styles.divider} />

      {highScore > 0 && (
        <View style={styles.highScoreRow}>
          <Text style={styles.highScoreLabel}>✦ Best Score</Text>
          <Text style={styles.highScoreValue}>{highScore.toLocaleString()}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.playBtn} onPress={() => onPlay()} activeOpacity={0.8}>
        <Text style={styles.playBtnText}>Play</Text>
      </TouchableOpacity>

      <Text style={styles.controlsHint}>
        Touch controls: D-pad on left, Jump/Attack on right
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

      <TouchableOpacity style={styles.playBtn} onPress={onResume} activeOpacity={0.8}>
        <Text style={styles.playBtnText}>Resume</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryBtn} onPress={onRestart} activeOpacity={0.8}>
        <Text style={styles.secondaryBtnText}>Restart</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.quitBtn} onPress={onQuit} activeOpacity={0.8}>
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
        </View>

        <TouchableOpacity style={styles.playBtn} onPress={onRestart} activeOpacity={0.8}>
          <Text style={styles.playBtnText}>Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onQuit} activeOpacity={0.8}>
          <Text style={styles.secondaryBtnText}>Main Menu</Text>
        </TouchableOpacity>
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
  rightControls: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    alignItems: 'flex-end',
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
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuContent: {
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 32,
  },
  title: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 16,
    fontWeight: '300',
    letterSpacing: 8,
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
    gap: 8,
    marginTop: 8,
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
  playBtn: {
    marginTop: 8,
    width: 280,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4488cc',
  },
  playBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryBtn: {
    width: 280,
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
  quitBtn: {
    width: 280,
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
