// ESM loader hook for the mobile game-settings test.
// Intercepts imports of @react-native-async-storage/async-storage and
// redirects them to a data URL that reads from a global mock store.
import { pathToFileURL } from 'node:url';

const mockCode = `
const store = globalThis.__asyncStorageMock;
export function getItem(k) { return store.getItem(k); }
export function setItem(k, v) { return store.setItem(k, v); }
export function multiGet(keys) { return store.multiGet(keys); }
export function removeItem(k) { return store.removeItem(k); }
export default { getItem, setItem, multiGet, removeItem };
`;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.includes('@react-native-async-storage/async-storage')) {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(mockCode),
      shortCircuit: true,
      format: 'module',
    };
  }
  return nextResolve(specifier, context);
}
