import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Slider,
  ScrollView,
} from 'react-native';

export default function SettingsScreen() {
  const [reducedParticles, setReducedParticles] = useState(true);
  const [showFPS, setShowFPS] = useState(false);
  const [masterVolume, setMasterVolume] = useState(0.7);
  const [sfxVolume, setSfxVolume] = useState(0.8);
  const [musicVolume, setMusicVolume] = useState(0.6);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <SettingRow label="Master Volume">
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.05}
          value={masterVolume}
          onValueChange={setMasterVolume}
          minimumTrackTintColor="#4488cc"
          maximumTrackTintColor="rgba(255,255,255,0.1)"
          thumbTintColor="#fff"
        />
        <Text style={styles.valueText}>{Math.round(masterVolume * 100)}%</Text>
      </SettingRow>

      <SettingRow label="SFX Volume">
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.05}
          value={sfxVolume}
          onValueChange={setSfxVolume}
          minimumTrackTintColor="#4488cc"
          maximumTrackTintColor="rgba(255,255,255,0.1)"
          thumbTintColor="#fff"
        />
        <Text style={styles.valueText}>{Math.round(sfxVolume * 100)}%</Text>
      </SettingRow>

      <SettingRow label="Music Volume">
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.05}
          value={musicVolume}
          onValueChange={setMusicVolume}
          minimumTrackTintColor="#4488cc"
          maximumTrackTintColor="rgba(255,255,255,0.1)"
          thumbTintColor="#fff"
        />
        <Text style={styles.valueText}>{Math.round(musicVolume * 100)}%</Text>
      </SettingRow>

      <SettingRow label="Show FPS">
        <Switch
          value={showFPS}
          onValueChange={setShowFPS}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#4488cc' }}
          thumbColor="#fff"
        />
      </SettingRow>

      <SettingRow label="Reduced Particles">
        <Switch
          value={reducedParticles}
          onValueChange={setReducedParticles}
          trackColor={{ false: 'rgba(255,255,255,0.15)', true: '#4488cc' }}
          thumbColor="#fff"
        />
      </SettingRow>
    </ScrollView>
  );
}

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <View style={styles.settingRow}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.controlRow}>{children}</View>
  </View>
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
    marginBottom: 24,
  },
  settingRow: {
    marginBottom: 20,
  },
  label: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    marginBottom: 8,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  valueText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    width: 36,
    textAlign: 'right',
  },
});
