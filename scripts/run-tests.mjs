#!/usr/bin/env node
/**
 * Unit test runner — uses Node's built-in test runner with native TypeScript
 * type stripping (requires Node >= 22). Zero external test dependencies.
 *
 * The alias loader resolves the at-slash path alias so test files import
 * source modules exactly as app code does.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const loaderUrl = pathToFileURL(path.join(ROOT, 'scripts', 'test-alias-loader.mjs')).href;
const testDir = path.join(ROOT, 'test');

// Collect test files explicitly (avoids directory-import resolution issues).
const testFiles = fs.readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort()
  .map((f) => path.join(testDir, f));

if (testFiles.length === 0) {
  console.error('No .test.ts files found in ' + testDir);
  process.exit(1);
}

// Build the --import data: URL that registers our custom loader.
// Must use an absolute file: URL for the loader, not a relative path.
const importHook = `data:text/javascript,` +
  encodeURIComponent(
    `import { register } from 'node:module'; register(${JSON.stringify(loaderUrl)});`
  );

const result = spawnSync(process.execPath, [
  '--experimental-strip-types',
  '--no-warnings',
  '--import', importHook,
  '--test',
  ...testFiles,
], {
  cwd: ROOT,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
