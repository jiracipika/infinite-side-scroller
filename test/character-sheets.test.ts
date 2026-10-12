import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sheetFrameForPose, SHEET_FRAME, characterSheetReady } from '@/game/rendering/sprite-sheet';
import { CHARACTER_SHEETS } from '@/game/rendering/character-sheets-data';

describe('character sprite sheets', () => {
  it('maps poses to the six-frame strip with gameplay-first precedence', () => {
    assert.equal(sheetFrameForPose({}), SHEET_FRAME.idle);
    assert.equal(sheetFrameForPose({ stride: 2 }), SHEET_FRAME.run);
    assert.equal(sheetFrameForPose({ stride: -2 }), SHEET_FRAME.run);
    assert.equal(sheetFrameForPose({ airborne: true }), SHEET_FRAME.air);
    assert.equal(sheetFrameForPose({ dashing: true, airborne: true }), SHEET_FRAME.dash);
    assert.equal(sheetFrameForPose({ melee: 0.5 }), SHEET_FRAME.melee);
    assert.equal(sheetFrameForPose({ tumble: 0.4, dashing: true, melee: 0.5 }), SHEET_FRAME.tumble);
  });

  it('keeps the idle sway from reading as a run frame', () => {
    assert.equal(sheetFrameForPose({ stride: 0.35 }), SHEET_FRAME.idle);
  });

  it('embeds a valid data-url strip for every shipped sheet', () => {
    assert.ok(Object.keys(CHARACTER_SHEETS).length >= 1, 'at least one sheet ships');
    for (const [id, src] of Object.entries(CHARACTER_SHEETS)) {
      assert.match(src, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/, `${id} strip`);
    }
    assert.ok('ninja' in CHARACTER_SHEETS, 'ninja sheet ships');
  });

  it('nothing is sheet-ready in a bare node context — procedural fallback intact', () => {
    assert.equal(characterSheetReady('ninja'), false);
  });
});
