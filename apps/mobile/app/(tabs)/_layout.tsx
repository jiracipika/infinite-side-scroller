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
        tabBarActiveTintColor: '#4488cc',
        tabBarInactiveTintColor: '#666',
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
    backgroundColor: '#1a1a2e',
    borderTopColor: '#333',
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    height: Platform.OS === 'ios' ? 80 : 56,
  },
  tabBarItem: {
    minHeight: 48,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
