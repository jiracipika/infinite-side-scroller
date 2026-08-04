import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { EMPTY_PLAYER_BEST, loadPlayerBest, type PlayerBest } from '../../lib/player-best';
import { loadRunHistory, formatRunDate, type RunEntry } from '../../lib/run-history';

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

      <View style={styles.comingSoonCard} accessible accessibilityLabel="Online leaderboard coming soon">
        <Text style={styles.comingSoonEyebrow}>ONLINE LEADERBOARD</Text>
        <Text style={styles.comingSoonTitle}>Coming soon</Text>
        <Text style={styles.comingSoonBody}>Until then, beat the only score that matters: yours.</Text>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        <View style={styles.bestHero}>
          <Text style={styles.bestHeroLabel}>PERSONAL BEST SCORE</Text>
          <Text style={styles.bestHeroValue}>{best.score.toLocaleString()}</Text>
          <Text style={styles.bestHeroHint}>{best.score > 0 ? 'A new run is waiting to top it.' : 'Start your first run to set the bar.'}</Text>
        </View>

        <View style={styles.statGrid}>
          <BestStat label="Distance" value={`${best.distance.toLocaleString()} m`} />
          <BestStat label="Coins" value={best.coins.toLocaleString()} />
          <BestStat label="Best Combo" value={best.maxCombo > 0 ? `x${best.maxCombo}` : '—'} />
          <BestStat label="Defeated" value={best.enemiesDefeated.toLocaleString()} />
        </View>

        {/* Recent Runs */}
        {history.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent Runs</Text>
            {history.map((run, i) => (
              <View key={run.timestamp + '-' + i} style={styles.runRow}>
                <View style={styles.runRowLeft}>
                  <Text style={styles.runRank}>#{i + 1}</Text>
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
    backgroundColor: '#090b12',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 18,
  },
  title: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    lineHeight: 21,
  },
  comingSoonCard: {
    marginHorizontal: 24,
    marginBottom: 20,
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#141a27',
    borderWidth: 1,
    borderColor: '#273247',
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
    color: '#a8b4c8',
    fontSize: 15,
    lineHeight: 21,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  bestHero: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: '#102e58',
    borderWidth: 1,
    borderColor: '#2d6fbd',
    marginBottom: 16,
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
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '900',
    letterSpacing: -1,
  },
  bestHeroHint: {
    color: '#c2d8f5',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
  },
  statCard: {
    width: '47%',
    padding: 16,
    backgroundColor: '#141a27',
    borderColor: '#273247',
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: 10,
    marginHorizontal: 5,
  },
  statLabel: {
    color: '#9ba8bb',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  statValue: {
    color: '#f5f7ff',
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  recentSection: {
    marginTop: 12,
  },
  recentTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#141a27',
    borderWidth: 1,
    borderColor: '#273247',
    marginBottom: 8,
  },
  runRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  runRank: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 24,
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
