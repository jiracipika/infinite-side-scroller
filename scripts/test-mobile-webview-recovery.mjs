import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('apps/mobile/app/index.tsx', 'utf8');

assert.match(source, /onError=\{recoverWebView\}/, 'A failed document load must open the recovery screen');
assert.match(source, /onRenderProcessGone=\{recoverWebView\}/, 'Android renderer exits must be recoverable');
assert.match(source, /onContentProcessDidTerminate=\{recoverWebView\}/, 'iOS renderer exits must be recoverable');
assert.match(source, /setTimeout\([\s\S]+?recoverWebView\(\)[\s\S]+?, ENGINE_LOAD_TIMEOUT_MS\)/, 'Missing ready messages must time out');
assert.match(source, /if \(run\.id !== webViewKey\) return;/, 'Earlier WebViews cannot deliver messages to the current run');
assert.match(source, /key=\{webViewKey\}/, 'A new run must mount a fresh WebView');
assert.match(source, /const id = runRef\.current\.id \+ 1;[\s\S]+?setWebViewKey\(id\);/, 'Each load attempt needs its own key');
assert.match(source, /onPress=\{\(\) => queueRun\(runRef\.current\.seed\)\}/, 'Retry must preserve the selected run seed');
assert.match(source, /const handleQuit = useCallback\(\(\) => \{\s*transitionTo\('menu'\)/, 'A player can return to the menu');

console.log('Mobile load timeout, renderer recovery and retry wiring verified.');
