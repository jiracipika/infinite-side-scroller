import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { EMPTY_PLAYER_BEST, loadPlayerBest, type PlayerBest } from '../../lib/player-best';
import { loadRunHistory, clearRunHistory, formatRunDate, type RunEntry } from '../../lib/run-history';
import { useReducedMotion, motionSpring } from '../../hooks/useReducedMotion';
import { selectionHaptic } from '../../lib/haptics';
import { PressableScale } from '../../components/PressableScale';

// ─── SpringCard — spring-in on mount ────────────────────────────────
const SpringCard: React.FC<{
  children: React.ReactNode;
  style?: object;
  delay?: number;
}> = ({ children, style, delay = 0 }) => {
  const reduced = useReducedMotion();
  const translateY = useRef(new Animated.Value(reduced ? 0 : 12)).current;
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0.8)).current;

  useEffect(() => {
    if (reduced) return;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          ...motionSpring(reduced),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, reduced, translateY, opacity]);

  return (
    <Animated.View style={{ transform: [{ translateY }], opacity }}>
      <View style={style}>
        {children}
      </View>
    </Animated.View>
  );
};

export default function LeaderboardScreen() {
  const [best, setBest] = React.useState<PlayerBest>(EMPTY_PLAYER_BEST);
  const [history, setHistory] = React.useState<RunEntry[]>([]);

  useFocusEffect(React.useCallback(() => {
    let active = true;
    void loadPlayerBest().then(value => {
      if (active) setBest(value);
    });
    void loadRunHistory().then(runs => {
      if (active) setHistory(runs);
    });
    return () => { active = false; };
  }, []));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Your Best</Text>
        <Text style={styles.subtitle}>Your strongest local run, saved securely on this device.</Text>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {/* ─── Coming Soon Card ─── */}
        <SpringCard delay={0}>
          <View style={styles.comingSoonCard} accessible accessibilityLabel="Online leaderboard coming soon">
            <Text style={styles.comingSoonEyebrow}>ONLINE LEADERBOARD</Text>
            <Text style={styles.comingSoonTitle}>Coming soon</Text>
            <Text style={styles.comingSoonBody}>Until then, beat the only score that matters: yours.</Text>
          </View>
        </SpringCard>

        {/* ─── Hero Card — Personal Best with gradient accent ─── */}
        <SpringCard delay={60}>
          <View style={styles.bestHeroOuter}>
            <LinearGradient
              colors={['#0A84FF', 'rgba(10,132,255,0.55)', 'rgba(10,132,255,0.15)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bestHeroGradient}
            >
              {/* Inner glass card */}
              <View style={styles.bestHeroInner}>
                <Text style={styles.bestHeroLabel}>PERSONAL BEST SCORE</Text>
                <Text style={styles.bestHeroValue}>{best.score.toLocaleString()}</Text>
                <Text style={styles.bestHeroHint}>{best.score > 0 ? 'A new run is waiting to top it.' : 'Start your first run to set the bar.'}</Text>
              </View>
            </LinearGradient>
          </View>
        </SpringCard>

        {/* ─── Stat Grid ─── */}
        <SpringCard delay={120}>
          <View style={styles.statGrid}>
            <BestStat label="Distance" value={`${best.distance.toLocaleString()} m`} />
            <BestStat label="Coins" value={best.coins.toLocaleString()} />
            <BestStat label="Best Combo" value={best.maxCombo > 0 ? `x${best.maxCombo}` : '—'} />
            <BestStat label="Defeated" value={best.enemiesDefeated.toLocaleString()} />
          </View>
        </SpringCard>

        {/* ─── Recent Runs ─── */}
        {history.length > 0 && (
          <SpringCard delay={180}>
            <View style={styles.recentSection}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Recent Runs</Text>
                <PressableScale
                  onPress={() => {
                    selectionHaptic();
                    Alert.alert(
                      'Clear Run History',
                      'Remove all recent runs from this device? Your personal best is kept.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Clear',
                          style: 'destructive',
                          onPress: async () => {
                            await clearRunHistory();
                            setHistory([]);
                          },
                        },
                      ],
                    );
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear run history"
                  accessibilityHint="Removes all recent runs from this device"
                >
                  <Text style={styles.clearBtnText}>Clear</Text>
                </PressableScale>
              </View>
              {history.map((run, i) => (
                <View key={run.timestamp + '-' + i} style={styles.runRow}>
                  <View style={styles.runRowLeft}>
                    <View style={styles.runRankBadge}>
                      <Text style={styles.runRank}>{i + 1}</Text>
                    </View>
                    <View>
                      <Text style={styles.runScore}>{run.score.toLocaleString()}</Text>
                      <Text style={styles.runDetails}>
                        {Math.round(run.distance).toLocaleString()}m · {run.coins} coins · x{run.maxCombo} combo
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.runDate}>{formatRunDate(run.timestamp)}</Text>
                </View>
              ))}
            </View>
          </SpringCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const BestStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.statCard} accessible accessibilityLabel={`${label}: ${value}`}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101014',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    lineHeight: 21,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  // ─── Coming Soon Glass Card ───
  comingSoonCard: {
    marginBottom: 16,
    padding: 20,
    borderRadius: 18,
    backgroundColor: 'rgba(28,28,30,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  comingSoonEyebrow: {
    color: '#79b8ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 7,
  },
  comingSoonTitle: {
    color: '#ffffff',
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  comingSoonBody: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    lineHeight: 21,
  },
  // ─── Hero Card ───
  bestHeroOuter: {
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
  },
  bestHeroGradient: {
    borderRadius: 22,
    padding: 1.5,
  },
  bestHeroInner: {
    borderRadius: 20,
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(10,20,40,0.85)',
  },
  bestHeroLabel: {
    color: '#9cc7ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  bestHeroValue: {
    color: '#ffffff',
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '900',
    letterSpacing: -1.2,
    textShadowColor: 'rgba(10,132,255,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  bestHeroHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 10,
  },
  // ─── Stat Grid ───
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 4,
  },
  statCard: {
    width: '47%',
    padding: 16,
    backgroundColor: 'rgba(28,28,30,0.6)',
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
    marginHorizontal: 5,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    color: '#f5f7ff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
  // ─── Recent Runs ───
  recentSection: {
    marginTop: 8,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  recentTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  clearBtnText: {
    color: 'rgba(248,113,113,0.75)',
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 4,
    paddingHorizontal: 8,
    minHeight: 44,
    textAlignVertical: 'center',
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(28,28,30,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  runRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  runRankBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,132,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(10,132,255,0.2)',
  },
  runRank: {
    color: 'rgba(10,132,255,0.9)',
    fontSize: 13,
    fontWeight: '800',
  },
  runScore: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  runDetails: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  runDate: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
  },
});
