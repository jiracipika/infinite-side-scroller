import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  ActivityIndicator,
  Animated,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { usePersistedSetting } from '../hooks/usePersistedSetting';
import { useReducedMotion, motionSpring } from '../hooks/useReducedMotion';
import { selectionHaptic } from '../lib/haptics';
import { DEFAULT_GAME_SETTINGS, type GameSettings } from '../lib/game-settings';
import { PressableScale } from './PressableScale';

/**
 * Settings, presented as a slide-up sheet from the single-screen menu
 * (replaces the old Settings tab). `onChanged` fires whenever the sheet
 * closes so the game screen can push fresh preferences to the engine.
 */
export function SettingsSheet({
  visible,
  onClose,
  onChanged,
}: {
  visible: boolean;
  onClose: () => void;
  onChanged?: (settings: GameSettings) => void;
}) {
  const [masterVolume, setMasterVolume, loadedMaster] = usePersistedSetting('masterVolume', DEFAULT_GAME_SETTINGS.masterVolume);
  const [sfxVolume, setSfxVolume, loadedSfx] = usePersistedSetting('sfxVolume', DEFAULT_GAME_SETTINGS.sfxVolume);
  const [musicVolume, setMusicVolume, loadedMusic] = usePersistedSetting('musicVolume', DEFAULT_GAME_SETTINGS.musicVolume);
  const [showFPS, setShowFPS, loadedFps] = usePersistedSetting('showFPS', DEFAULT_GAME_SETTINGS.showFPS);
  const [reducedParticles, setReducedParticles, loadedParticles] = usePersistedSetting('reducedParticles', DEFAULT_GAME_SETTINGS.reducedParticles);
  const [hapticsEnabled, setHapticsEnabled, loadedHaptics] = usePersistedSetting('hapticsEnabled', DEFAULT_GAME_SETTINGS.hapticsEnabled);
  const [largeControls, setLargeControls, loadedLarge] = usePersistedSetting('largeControls', DEFAULT_GAME_SETTINGS.largeControls);
  const [leftHanded, setLeftHanded, loadedHand] = usePersistedSetting('leftHanded', DEFAULT_GAME_SETTINGS.leftHanded);

  const allLoaded = loadedMaster && loadedSfx && loadedMusic && loadedFps && loadedParticles && loadedHaptics && loadedLarge && loadedHand;

  const handleClose = () => {
    if (hapticsEnabled) selectionHaptic();
    if (allLoaded) {
      onChanged?.({ masterVolume, sfxVolume, musicVolume, showFPS, reducedParticles, hapticsEnabled, largeControls, leftHanded });
    }
    onClose();
  };

  if (!allLoaded) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
        <SafeAreaView style={[styles.container, styles.loading]} edges={['top', 'left', 'right', 'bottom']}>
          <ActivityIndicator size="large" color="#c7ff4d" />
        </SafeAreaView>
      </Modal>
    );
  }

  const handleToggle = (setter: (v: boolean) => void, value: boolean) => {
    if (hapticsEnabled) selectionHaptic();
    setter(value);
  };

  const handleSliderChange = (setter: (v: number) => void, value: number) => {
    setter(value);
  };

  const handleSliderRelease = () => {
    if (hapticsEnabled) selectionHaptic();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.sheetHeader}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            accessibilityHint="Returns to the main menu"
            style={styles.sheetCloseBtn}
          >
            <Ionicons name="chevron-down" size={26} color="rgba(255,255,255,0.7)" />
          </Pressable>
          <Text style={styles.sheetTitle} accessibilityRole="header">Settings</Text>
          <View style={styles.sheetCloseBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.subtitle}>
            Tune audio, performance, and visual load for the way you play.
          </Text>

          {/* ─── Audio Section ─── */}
          <SectionHeader title="Audio" />
          <GlassCard style={styles.sectionCard} delay={0}>
            <SettingRow label="Master Volume" value={`${Math.round(masterVolume * 100)}%`}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={masterVolume}
                onValueChange={(v) => handleSliderChange(setMasterVolume, v)}
                onSlidingComplete={handleSliderRelease}
                minimumTrackTintColor="#c7ff4d"
                maximumTrackTintColor="rgba(255,255,255,0.12)"
                thumbTintColor="#fff"
                accessibilityLabel="Master volume"
                accessibilityHint="Adjusts the overall game volume"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(masterVolume * 100), text: `${Math.round(masterVolume * 100)} percent` }}
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="SFX Volume" value={`${Math.round(sfxVolume * 100)}%`}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={sfxVolume}
                onValueChange={(v) => handleSliderChange(setSfxVolume, v)}
                onSlidingComplete={handleSliderRelease}
                minimumTrackTintColor="#c7ff4d"
                maximumTrackTintColor="rgba(255,255,255,0.14)"
                thumbTintColor="#fff"
                accessibilityLabel="Sound effects volume"
                accessibilityHint="Adjusts jump, attack, and pickup sounds"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(sfxVolume * 100), text: `${Math.round(sfxVolume * 100)} percent` }}
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Music Volume" value={`${Math.round(musicVolume * 100)}%`}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={1}
                step={0.05}
                value={musicVolume}
                onValueChange={(v) => handleSliderChange(setMusicVolume, v)}
                onSlidingComplete={handleSliderRelease}
                minimumTrackTintColor="#c7ff4d"
                maximumTrackTintColor="rgba(255,255,255,0.14)"
                thumbTintColor="#fff"
                accessibilityLabel="Music volume"
                accessibilityHint="Adjusts the background soundtrack volume"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(musicVolume * 100), text: `${Math.round(musicVolume * 100)} percent` }}
              />
            </SettingRow>
          </GlassCard>

          {/* ─── Gameplay Section ─── */}
          <SectionHeader title="Gameplay" />
          <GlassCard style={styles.sectionCard} delay={60}>
            <SettingRow label="Show FPS" value={showFPS ? 'On' : 'Off'}>
              <Switch
                value={showFPS}
                onValueChange={(v) => handleToggle(setShowFPS, v)}
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#c7ff4d' }}
                thumbColor="#fff"
                accessibilityLabel="Show frames per second"
                accessibilityHint="Toggles a performance counter during runs"
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Reduced Particles" value={reducedParticles ? 'On' : 'Off'}>
              <Switch
                value={reducedParticles}
                onValueChange={(v) => handleToggle(setReducedParticles, v)}
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#c7ff4d' }}
                thumbColor="#fff"
                accessibilityLabel="Reduced particles"
                accessibilityHint="Lowers decorative effects for smoother and calmer play"
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Large Touch Controls" value={largeControls ? 'On' : 'Off'}>
              <Switch
                value={largeControls}
                onValueChange={(v) => handleToggle(setLargeControls, v)}
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#c7ff4d' }}
                thumbColor="#fff"
                accessibilityLabel="Large touch controls"
                accessibilityHint="Increases on-screen button sizes for easier tapping"
              />
            </SettingRow>
            <SettingDivider />
            <SettingRow label="Controls Side" value={leftHanded ? 'Left' : 'Right'}>
              <Switch
                value={leftHanded}
                onValueChange={(v) => handleToggle(setLeftHanded, v)}
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#c7ff4d' }}
                thumbColor="#fff"
                accessibilityLabel="Left-handed touch controls"
                accessibilityHint="Moves Jump and Slide to the left side of the screen"
              />
            </SettingRow>
          </GlassCard>

          {/* ─── Accessibility Section ─── */}
          <SectionHeader title="Accessibility" />
          <GlassCard style={styles.sectionCard} delay={120}>
            <SettingRow label="Haptics" value={hapticsEnabled ? 'On' : 'Off'}>
              <Switch
                value={hapticsEnabled}
                onValueChange={(v) => handleToggle(setHapticsEnabled, v)}
                trackColor={{ false: 'rgba(255,255,255,0.18)', true: '#c7ff4d' }}
                thumbColor="#fff"
                accessibilityLabel="Haptic feedback"
                accessibilityHint="Toggles vibration feedback during gameplay"
              />
            </SettingRow>
          </GlassCard>

          {/* ─── Reset Button ─── */}
          <GlassCard style={styles.resetCardWrap} delay={180}>
            <PressableScale
              haptic={hapticsEnabled}
              onPress={() => {
                Alert.alert(
                  'Reset Settings',
                  'Restore all options to their default values?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Reset',
                      style: 'destructive',
                      onPress: () => {
                        setMasterVolume(DEFAULT_GAME_SETTINGS.masterVolume);
                        setSfxVolume(DEFAULT_GAME_SETTINGS.sfxVolume);
                        setMusicVolume(DEFAULT_GAME_SETTINGS.musicVolume);
                        setShowFPS(DEFAULT_GAME_SETTINGS.showFPS);
                        setReducedParticles(DEFAULT_GAME_SETTINGS.reducedParticles);
                        setHapticsEnabled(DEFAULT_GAME_SETTINGS.hapticsEnabled);
                        setLargeControls(DEFAULT_GAME_SETTINGS.largeControls);
                        setLeftHanded(DEFAULT_GAME_SETTINGS.leftHanded);
                      },
                    },
                  ],
                );
              }}
              accessibilityRole="button"
              accessibilityLabel="Reset settings to defaults"
              accessibilityHint="Restores all audio, performance, and visual options to their original values"
            >
              <LinearGradient
                colors={['rgba(255,69,58,0.18)', 'rgba(255,69,58,0.08)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.resetBtnGradient}
              >
                <Ionicons name="refresh-circle" size={22} color="rgba(255,99,88,0.9)" style={{ marginRight: 8 }} />
                <Text style={styles.resetBtnText}>Reset to Defaults</Text>
              </LinearGradient>
            </PressableScale>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Glass Card wrapper ─────────────────────────────────────────────
const GlassCard: React.FC<{
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
    <Animated.View
      style={[
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={[styles.glassCard, style]}>
        {children}
      </View>
    </Animated.View>
  );
};

// ─── Section Header ─────────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

// ─── Setting Row ────────────────────────────────────────────────────
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

const SettingDivider: React.FC = () => <View style={styles.divider} />;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sheetCloseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 24,
  },
  // ─── Section Headers ───
  sectionHeader: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: 4,
    marginBottom: 8,
    marginTop: 4,
  },
  // ─── Glass Card ───
  glassCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(28,28,30,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  sectionCard: {
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 8,
  },
  // ─── Setting Row ───
  settingRow: {
    minHeight: 44,
    paddingVertical: 12,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  label: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
    flex: 1,
  },
  controlRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 44,
  },
  valueText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 0,
  },
  // ─── Reset Button ───
  resetCardWrap: {
    marginTop: 16,
    marginBottom: 24,
  },
  resetBtnGradient: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,99,88,0.2)',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetBtnText: {
    color: 'rgba(255,99,88,0.85)',
    fontSize: 15,
    fontWeight: '600',
  },
});
