import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Infinite Side Scroller</Text>
      <Text style={styles.version}>v1.0.0</Text>

      <Text style={styles.description}>
        An endless side-scrolling adventure. Explore procedurally generated worlds with diverse biomes, defeat enemies, collect coins, and survive as long as you can.
      </Text>

      <Text style={styles.sectionTitle}>Controls</Text>
      <View style={styles.controlsList}>
        <ControlRow label="Move Left/Right" value="D-pad (left side)" />
        <ControlRow label="Jump" value="Blue button (right)" />
        <ControlRow label="Attack" value="Orange button (right)" />
        <ControlRow label="Double Jump" value="Jump again in air" />
        <ControlRow label="Dash" value="Auto-attack nearby enemies" />
      </View>

      <Text style={styles.sectionTitle}>Features</Text>
      <View style={styles.featuresList}>
        <FeatureItem>🌍 Procedurally generated worlds</FeatureItem>
        <FeatureItem>🏔️ Multiple biomes (Forest, Desert, Lava, Sky...)</FeatureItem>
        <FeatureItem>👾 Diverse enemies with AI</FeatureItem>
        <FeatureItem>💰 Coins & power-ups</FeatureItem>
        <FeatureItem>📈 Increasing difficulty</FeatureItem>
        <FeatureItem>👑 Boss fights every 50 chunks</FeatureItem>
      </View>

      <Text style={styles.footer}>Built with Expo • React Native • Canvas</Text>
    </ScrollView>
  );
}

const ControlRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.controlRow}>
    <Text style={styles.controlLabel}>{label}</Text>
    <Text style={styles.controlValue}>{value}</Text>
  </View>
);

const FeatureItem: React.FC<{ children: string }> = ({ children }) => (
  <Text style={styles.featureItem}>{children}</Text>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  content: {
    padding: 24,
    paddingBottom: 100,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  version: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    marginBottom: 24,
  },
  description: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 12,
  },
  controlsList: {
    marginBottom: 28,
    gap: 8,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  controlValue: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
  },
  featuresList: {
    marginBottom: 28,
    gap: 8,
  },
  featureItem: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
});
