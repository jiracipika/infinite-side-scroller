import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { getPauseConfirmationCopy } from '@/components/pause-confirmation';

const pauseMenuSource = readFileSync(
  fileURLToPath(new URL('../src/components/PauseMenu.tsx', import.meta.url)),
  'utf8',
);

describe('pause destructive-action confirmation', () => {
  it('explains exactly what restart and quit preserve or discard', () => {
    assert.deepEqual(getPauseConfirmationCopy('restart'), {
      title: 'Restart this run?',
      description: 'Your current score, coins, and distance for this run will be reset.',
      confirmLabel: 'Restart Run',
    });
    assert.deepEqual(getPauseConfirmationCopy('quit'), {
      title: 'Return to the main menu?',
      description: 'Your current run will end. Banked progression and completed-run history stay safe.',
      confirmLabel: 'End Run',
    });
  });

  it('exposes a labelled modal and nested alert dialog to assistive technology', () => {
    assert.match(pauseMenuSource, /role="dialog"/);
    assert.match(pauseMenuSource, /aria-modal="true"/);
    assert.match(pauseMenuSource, /aria-labelledby="pause-menu-title"/);
    assert.match(pauseMenuSource, /role="alertdialog"/);
    assert.match(pauseMenuSource, /aria-labelledby="pause-confirmation-title"/);
    assert.match(pauseMenuSource, /aria-describedby="pause-confirmation-description"/);
  });

  it('routes both pointer and keyboard destructive actions through confirmation', () => {
    assert.match(pauseMenuSource, /onClick=\{\(\) => setConfirmation\('restart'\)\}/);
    assert.match(pauseMenuSource, /onClick=\{\(\) => setConfirmation\('quit'\)\}/);
    assert.match(pauseMenuSource, /onClick=\{runConfirmedAction\}/);
    assert.match(pauseMenuSource, /cancelConfirmationRef/);
  });
});
