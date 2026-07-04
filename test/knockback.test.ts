import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHARACTERS,
  getCharacterById,
} from '@/game/data/characters';

// ── Knockback resistance: validates that Cyborg's advertised ability ──
// ("Resists knockback with a reliable health pool") is backed by real
// character data. The engine reads knockbackResistance to scale knockback
// velocity in game-engine.ts (enemy collision, shield bash, separation).

describe('knockbackResistance character data', () => {
  it('Cyborg has knockbackResistance of 0.5', () => {
    const cyborg = getCharacterById('cyborg');
    assert.equal(
      cyborg.knockbackResistance,
      0.5,
      'Cyborg should have 50% knockback resistance to match its ability description',
    );
  });

  it('Cyborg is the only character with non-zero resistance', () => {
    const resistant = CHARACTERS.filter(
      (c) => (c.knockbackResistance ?? 0) > 0,
    );
    assert.equal(resistant.length, 1, 'only Cyborg should resist knockback');
    assert.equal(resistant[0].id, 'cyborg');
  });

  it('all knockbackResistance values are in [0, 1] range', () => {
    for (const c of CHARACTERS) {
      if (c.knockbackResistance === undefined) continue;
      assert.ok(
        c.knockbackResistance >= 0 && c.knockbackResistance <= 1,
        `${c.id} knockbackResistance ${c.knockbackResistance} out of [0,1] range`,
      );
    }
  });

  it('base characters (knight, ninja, tank) have no knockback resistance', () => {
    for (const id of ['knight', 'ninja', 'tank']) {
      const c = getCharacterById(id);
      const r = c.knockbackResistance ?? 0;
      assert.equal(r, 0, `${id} should have 0 knockback resistance`);
    }
  });

  it('every character with knockbackResistance has a matching ability description', () => {
    for (const c of CHARACTERS) {
      if (!c.knockbackResistance) continue;
      const desc = c.ability.toLowerCase();
      assert.ok(
        desc.includes('knockback') || desc.includes('resist'),
        `${c.id} has knockbackResistance ${c.knockbackResistance} but ability text doesn't mention knockback/resist: "${c.ability}"`,
      );
    }
  });
});
