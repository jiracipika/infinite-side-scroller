import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Platform } from 'react-native';

const TabIcon = ({ name, color, size }: { name: React.ComponentProps<typeof Ionicons>['name']; color: string; size: number }) =>
  React.createElement(Ionicons, { name, size, color });

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#0A84FF',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Game',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="game-controller" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="trophy" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    // Glassmorphic blur effect simulated with rgba on dark base.
    // Semi-transparent so content scrolls subtly underneath.
    backgroundColor: 'rgba(16,16,20,0.82)',
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 0.5,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    height: Platform.OS === 'ios' ? 84 : 62,
    elevation: 0,
    // Subtle blue accent glow that bleeds upward from the bar.
    shadowColor: '#0A84FF',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  tabBarItem: {
    minHeight: 48,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
