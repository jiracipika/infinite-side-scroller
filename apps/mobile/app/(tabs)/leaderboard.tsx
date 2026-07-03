import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ScoreEntry = {
  rank: number;
  name: string;
  score: string;
  coins: string;
  highlight?: boolean;
};

export default function LeaderboardScreen() {
  const [selectedTab, setSelectedTab] = React.useState<'global' | 'local'>('global');

  const globalScores: ScoreEntry[] = [
    { rank: 1, name: 'SpeedRunner99', score: '125,430', coins: '342' },
    { rank: 2, name: 'PlatformMaster', score: '98,750', coins: '289' },
    { rank: 3, name: 'JumpKing', score: '87,200', coins: '265' },
    { rank: 4, name: 'SkyExplorer', score: '76,890', coins: '234' },
    { rank: 5, name: 'CoinCollector', score: '72,340', coins: '387' },
    { rank: 6, name: 'EndlessWalker', score: '68,920', coins: '198' },
    { rank: 7, name: 'BossHunter', score: '65,100', coins: '212' },
    { rank: 8, name: 'NightRunner', score: '61,870', coins: '176' },
    { rank: 9, name: 'DesertWanderer', score: '58,430', coins: '165' },
    { rank: 10, name: 'ForestGhost', score: '55,120', coins: '143' },
  ];

  const localScores: ScoreEntry[] = [
    { rank: 1, name: 'You', score: '45,670', coins: '156', highlight: true },
    { rank: 2, name: 'Yesterday', score: '32,140', coins: '98' },
    { rank: 3, name: 'BestRun', score: '28,950', coins: '87' },
    { rank: 4, name: 'QuickRun', score: '21,340', coins: '62' },
    { rank: 5, name: 'TestRun', score: '15,670', coins: '45' },
  ];

  const scores = selectedTab === 'global' ? globalScores : localScores;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">Leaderboard</Text>
        <Text style={styles.subtitle}>Compare score, distance, and coin runs without leaving the game.</Text>
      </View>

      <View style={styles.tabSwitcher} accessibilityRole="tablist">
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'global' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('global')}
          accessibilityRole="tab"
          accessibilityLabel="Global leaderboard"
          accessibilityState={{ selected: selectedTab === 'global' }}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'global' && styles.tabButtonTextActive]}>
            Global
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'local' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('local')}
          accessibilityRole="tab"
          accessibilityLabel="Your best runs"
          accessibilityState={{ selected: selectedTab === 'local' }}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'local' && styles.tabButtonTextActive]}>
            Your Best
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        <View style={styles.headerRow} accessible accessibilityLabel="Leaderboard columns: rank, player, score, coins">
          <Text style={styles.headerRank}>#</Text>
          <Text style={styles.headerName}>Player</Text>
          <Text style={styles.headerScore}>Score</Text>
          <Text style={styles.headerCoins}>Coins</Text>
        </View>

        {scores.map((entry) => (
          <LeaderboardEntry
            key={entry.rank}
            rank={entry.rank}
            name={entry.name}
            score={entry.score}
            coins={entry.coins}
            highlight={entry.highlight}
          />
        ))}

        {selectedTab === 'global' && (
          <Text style={styles.footerNote}>
            Global leaderboard coming soon. Local runs still count toward your best score.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const LeaderboardEntry: React.FC<ScoreEntry> = ({ rank, name, score, coins, highlight }) => {
  const getRankColor = () => {
    if (rank === 1) return '#fbbf24';
    if (rank === 2) return '#d1d5db';
    if (rank === 3) return '#d97706';
    return 'rgba(255,255,255,0.52)';
  };

  const getRankIcon = () => {
    if (rank === 1) return '1st';
    if (rank === 2) return '2nd';
    if (rank === 3) return '3rd';
    return `${rank}`;
  };

  return (
    <View
      style={[styles.entryRow, highlight && styles.entryRowHighlight]}
      accessible
      accessibilityLabel={`${rank}. ${name}. Score ${score}. ${coins} coins${highlight ? '. Your highlighted run.' : ''}`}
    >
      <Text style={[styles.entryRank, { color: getRankColor() }]}>{getRankIcon()}</Text>
      <Text style={[styles.entryName, highlight && styles.entryNameHighlight]}>{name}</Text>
      <Text style={[styles.entryScore, highlight && styles.entryScoreHighlight]}>{score}</Text>
      <Text style={styles.entryCoins}>{coins} coins</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 18,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    lineHeight: 21,
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(68, 136, 204, 0.24)',
  },
  tabButtonText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  tabButtonTextActive: {
    color: '#8ec5ff',
    fontWeight: '800',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  headerRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  headerRank: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    width: 44,
  },
  headerName: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    flex: 1,
  },
  headerScore: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    width: 72,
    textAlign: 'right',
  },
  headerCoins: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    width: 82,
    textAlign: 'right',
  },
  entryRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  entryRowHighlight: {
    backgroundColor: 'rgba(68, 136, 204, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(68, 136, 204, 0.32)',
  },
  entryRank: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
    width: 44,
    textAlign: 'center',
  },
  entryName: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    flex: 1,
  },
  entryNameHighlight: {
    color: '#fff',
    fontWeight: '800',
  },
  entryScore: {
    color: 'rgba(255,255,255,0.64)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    width: 72,
    textAlign: 'right',
  },
  entryScoreHighlight: {
    color: '#8ec5ff',
  },
  entryCoins: {
    color: 'rgba(250, 204, 21, 0.72)',
    fontSize: 13,
    lineHeight: 18,
    width: 82,
    textAlign: 'right',
  },
  footerNote: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 18,
    fontStyle: 'italic',
  },
});
