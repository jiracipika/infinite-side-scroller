import { Stack } from 'expo-router';

// Single-screen shell: one route, no tab bar. Settings and leaderboard live
// in slide-up sheets rendered inside the game screen.
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
