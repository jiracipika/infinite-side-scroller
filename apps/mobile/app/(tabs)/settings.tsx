import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { usePersistedSetting } from '../../hooks/usePersistedSetting';

export default function SettingsScreen() {
  const [masterVolume, setMasterVolume, loadedMaster] = usePersistedSetting('masterVolume', 0.7);
  const [sfxVolume, setSfxVolume, loadedSfx] = usePersistedSetting('sfxVolume', 0.8);
  const [musicVolume, setMusicVolume, loadedMusic] = usePersistedSetting('musicVolume', 0.6);
  const [showFPS, setShowFPS, loadedFps] = usePersistedSetting('showFPS', false);
  const [reducedParticles, setReducedParticles, loadedParticles] = usePersistedSetting('reducedParticles', true);

  const allLoaded = loadedMaster && loadedSfx && loadedMusic && loadedFps && loadedParticles;

  if (!allLoaded) {
    return (
      <SafeAreaView style={[styles.container, styles.loading]} edges={['top']}>
        <ActivityIndicator size="large" color="#4488cc" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">Settings</Text>
        <Text style={styles.subtitle}>
          Tune audio, performance, and visual load for the way you play.
        </Text>

        <SettingRow label="Master Volume" value={`${Math.round(masterVolume * 100)}%`}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={masterVolume}
            onValueChange={setMasterVolume}
            minimumTrackTintColor="#4488cc"
            maximumTrackTintColor="rgba(255,255,255,0.14)"
            thumbTintColor="#fff"
            accessibilityLabel="Master volume"
            accessibilityHint="Adjusts the overall game volume"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(masterVolume * 100), text: `${Math.round(masterVolume * 100)} percent` }}
          />
        </SettingRow>

        <SettingRow label="SFX Volume" value={`${Math.round(sfxVolume * 100)}%`}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={sfxVolume}
            onValueChange={setSfxVolume}
            minimumTrackTintColor="#4488cc"
            maximumTrackTintColor="rgba(255,255,255,0.14)"
            thumbTintColor="#fff"
            accessibilityLabel="Sound effects volume"
            accessibilityHint="Adjusts jump, attack, and pickup sounds"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(sfxVolume * 100), text: `${Math.round(sfxVolume * 100)} percent` }}
          />
        </SettingRow>

        <SettingRow label="Music Volume" value={`${Math.round(musicVolume * 100)}%`}>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={musicVolume}
            onValueChange={setMusicVolume}
            minimumTrackTintColor="#4488cc"
            maximumTrackTintColor="rgba(255,255,255,0.14)"
            thumbTintColor="#fff"
            accessibilityLabel="Music volume"
            accessibilityHint="Adjusts background music volume"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(musicVolume * 100), text: `${Math.round(musicVolume * 100)} percent` }}
          />
        </SettingRow>

        <SettingRow label="Show FPS" value={showFPS ? 'On' : 'Off'}>
          <Switch
            value={showFPS}
            onValueChange={setShowFPS}
            trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#4488cc' }}
            thumbColor="#fff"
            accessibilityLabel="Show frames per second"
            accessibilityHint="Toggles a performance counter during runs"
          />
        </SettingRow>

        <SettingRow label="Reduced Particles" value={reducedParticles ? 'On' : 'Off'}>
          <Switch
            value={reducedParticles}
            onValueChange={setReducedParticles}
            trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#4488cc' }}
            thumbColor="#fff"
            accessibilityLabel="Reduced particles"
            accessibilityHint="Lowers decorative effects for smoother and calmer play"
          />
        </SettingRow>

        <TouchableOpacity
          style={styles.resetBtn}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Reset settings to defaults"
          accessibilityHint="Restores all audio, performance, and visual options to their original values"
          onPress={() =>
            Alert.alert(
              'Reset Settings',
              'Restore all options to their default values?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Reset',
                  style: 'destructive',
                  onPress: () => {
                    setMasterVolume(0.7);
                    setSfxVolume(0.8);
                    setMusicVolume(0.6);
                    setShowFPS(false);
                    setReducedParticles(true);
                  },
                },
              ],
            )
          }
        >
          <Text style={styles.resetBtnText}>Reset to Defaults</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const SettingRow: React.FC<{ label: string; value: string; children: React.ReactNode }> = ({
  label,
  value,
  children,
}) => (
  <View style={styles.settingRow}>
    <View style={styles.settingHeader}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.valueText}>{value}</Text>
    </View>
    <View style={styles.controlRow}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 100,
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
    marginBottom: 24,
  },
  settingRow: {
    minHeight: 64,
    marginBottom: 18,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    flex: 1,
  },
  controlRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 48,
  },
  valueText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
  },
  resetBtn: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  resetBtnText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontWeight: '600',
  },
});
