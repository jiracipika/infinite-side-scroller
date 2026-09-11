import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

it('enemy source audit does not load optional browser tooling without GAME_URL', () => {
  const env: NodeJS.ProcessEnv = { ...process.env, PLAYWRIGHT_PACKAGE: '/nonexistent/optional-playwright/package.json' };
  delete env.GAME_URL;
  const result = spawnSync(process.execPath, ['scripts/test-ink-enemy-palette.mjs'], {
    cwd: process.cwd(), env, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /source audit only/);
});
