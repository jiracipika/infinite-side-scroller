import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = '@game_settings_';

/**
 * A React hook that mirrors useState but transparently persists the value
 * to AsyncStorage. The value is read once on mount, and every update writes
 * back. The third tuple element is a `loaded` boolean that is false until
 * the persisted value (if any) has been hydrated, so callers can avoid
 * flickering default UI.
 *
 * Works for any JSON-serialisable value.
 */
export function usePersistedSetting<T>(
  key: string,
  defaultValue: T,
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const fullKey = STORAGE_PREFIX + key;
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const mountedRef = useRef(true);

  // Hydrate from storage on mount.
  useEffect(() => {
    mountedRef.current = true;
    let didSync = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(fullKey);
        if (mountedRef.current && raw !== null) {
          setValue(JSON.parse(raw) as T);
        }
      } catch {
        // Corrupt or unreadable entry — fall back to default silently.
      } finally {
        if (mountedRef.current && !didSync) {
          didSync = true;
          setLoaded(true);
        }
      }
    })();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullKey]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        // Fire-and-forget write; AsyncStorage errors are non-fatal.
        AsyncStorage.setItem(fullKey, JSON.stringify(resolved)).catch(() => {});
        return resolved;
      });
    },
    [fullKey],
  );

  return [value, update, loaded];
}
