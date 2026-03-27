import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

export default function LeaderboardScreen() {
  const [selectedTab, setSelectedTab] = React.useState<'global' | 'local'>('global');

  // Placeholder leaderboard data
  const globalScores = [
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

  const localScores = [
    { rank: 1, name: 'You', score: '45,670', coins: '156', highlight: true },
    { rank: 2, name: 'Yesterday', score: '32,140', coins: '98' },
    { rank: 3, name: 'BestRun', score: '28,950', coins: '87' },
    { rank: 4, name: 'QuickRun', score: '21,340', coins: '62' },
    { rank: 5, name: 'TestRun', score: '15,670', coins: '45' },
  ];

  const scores = selectedTab === 'global' ? globalScores : localScores;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>

      {/* Tab Switcher */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'global' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('global')}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'global' && styles.tabButtonTextActive]}>
            Global
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, selectedTab === 'local' && styles.tabButtonActive]}
          onPress={() => setSelectedTab('local')}
        >
          <Text style={[styles.tabButtonText, selectedTab === 'local' && styles.tabButtonTextActive]}>
            Your Best
          </Text>
        </TouchableOpacity>
      </View>

      {/* Leaderboard List */}
      <ScrollView style={styles.listContainer} contentContainerStyle={styles.listContent}>
        <View style={styles.headerRow}>
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
            highlight={(entry as any).highlight}
          />
        ))}

        {/* Footer note */}
        {selectedTab === 'global' && (
          <Text style={styles.footerNote}>
            Global leaderboard coming soon! Compete with players worldwide.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const LeaderboardEntry: React.FC<{
  rank: number;
  name: string;
  score: string;
  coins: string;
  highlight?: boolean;
}> = ({ rank, name, score, coins, highlight }) => {
  const getRankColor = () => {
    if (rank === 1) return '#fbbf24'; // Gold
    if (rank === 2) return '#9ca3af'; // Silver
    if (rank === 3) return '#b45309'; // Bronze
    return 'rgba(255,255,255,0.4)';
  };

  const getRankIcon = () => {
    if (rank === 1) return '👑';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  return (
    <View style={[styles.entryRow, highlight && styles.entryRowHighlight]}>
      <Text style={[styles.entryRank, { color: getRankColor() }]}>
        {getRankIcon()}
      </Text>
      <Text style={[styles.entryName, highlight && styles.entryNameHighlight]}>
        {name}
      </Text>
      <Text style={[styles.entryScore, highlight && styles.entryScoreHighlight]}>
        {score}
      </Text>
      <Text style={styles.entryCoins}>{coins} 💰</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 20,
  },
  tabSwitcher: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(68, 136, 204, 0.2)',
  },
  tabButtonText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#4488cc',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  headerRank: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    width: 40,
  },
  headerName: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    flex: 1,
  },
  headerScore: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    width: 70,
    textAlign: 'right',
  },
  headerCoins: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    width: 70,
    textAlign: 'right',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  entryRowHighlight: {
    backgroundColor: 'rgba(68, 136, 204, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(68, 136, 204, 0.2)',
  },
  entryRank: {
    fontSize: 16,
    fontWeight: '600',
    width: 40,
    textAlign: 'center',
  },
  entryName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  entryNameHighlight: {
    color: '#fff',
    fontWeight: '600',
  },
  entryScore: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
    width: 70,
    textAlign: 'right',
  },
  entryScoreHighlight: {
    color: '#4488cc',
  },
  entryCoins: {
    color: 'rgba(250, 204, 21, 0.6)',
    fontSize: 13,
    width: 70,
    textAlign: 'right',
  },
  footerNote: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },
});
