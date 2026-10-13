import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sheetFrameForPose, SHEET_FRAME, characterSheetReady, ensureCharacterSheetsLoading,
  drawCharacterSheet, subscribeCharacterArt, setPreferredArtStyle } from '@/game/rendering/sprite-sheet';
import { CHARACTER_SHEETS, CHARACTER_SHEET_LAYOUTS } from '@/game/rendering/character-sheets-data';
import { CHARACTERS } from '@/game/data/characters';
import { readFileSync } from 'node:fs';

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
    assert.deepEqual(Object.keys(CHARACTER_SHEETS).sort(), CHARACTERS.map(c => c.id).sort());
    for (const [id, src] of Object.entries(CHARACTER_SHEETS)) {
      assert.match(src, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/, `${id} strip`);
      const png = Buffer.from(src.split(',')[1], 'base64');
      assert.deepEqual(png, readFileSync(new URL(`../design/sheets/${id}.png`, import.meta.url)), 'embedded art matches source');
      const layout = CHARACTER_SHEET_LAYOUTS[id];
      assert.equal(png.readUInt32BE(16), layout.frameWidth * 6);
      assert.equal(png.readUInt32BE(20), layout.frameHeight);
      const character = CHARACTERS.find(c => c.id === id)!;
      assert.equal(layout.bodyWidth, character.width);
      assert.equal(layout.bodyHeight, character.height);
      assert.ok(layout.originX > 0 && layout.originX < layout.frameWidth);
      assert.ok(layout.originY >= 0 && layout.originY < layout.frameHeight);
    }
    assert.ok('ninja' in CHARACTER_SHEETS, 'ninja sheet ships');
  });

  it('nothing is sheet-ready in a bare node context — procedural fallback intact', () => {
    ensureCharacterSheetsLoading(); // SSR must not consume the subsequent browser load.
    assert.equal(characterSheetReady('ninja'), false);
  });

  it('repaints loaded previews, anchors every pose to the original body and restores canvas state', () => {
    const images: Array<{ onload: () => void; src: string }> = [];
    class FakeImage {
      onload = () => {};
      src = '';
      constructor() { images.push(this); }
    }
    const originalImage = globalThis.Image;
    globalThis.Image = FakeImage as unknown as typeof Image;
    let paints = 0;
    const unsubscribe = subscribeCharacterArt('ninja', () => { paints++; });
    try {
      ensureCharacterSheetsLoading();
      assert.equal(images.length, CHARACTERS.length);
      ensureCharacterSheetsLoading();
      assert.equal(images.length, CHARACTERS.length, 'loads once');
      images.find(image => image.src === CHARACTER_SHEETS.ninja)!.onload();
      assert.equal(paints, 1, 'ready event redraws the preview');
      let args: unknown[] = [];
      let saved = false;
      const context = {
        imageSmoothingEnabled: true,
        save() { saved = this.imageSmoothingEnabled; },
        restore() { this.imageSmoothingEnabled = saved; },
        drawImage(...values: unknown[]) { args = values; },
      };
      const layout = CHARACTER_SHEET_LAYOUTS.ninja;
      for (const [pose, frame] of [[{}, 0], [{ dashing: true }, 3], [{ tumble: 0.5 }, 5]] as const) {
        assert.equal(drawCharacterSheet(context as unknown as CanvasRenderingContext2D, 'ninja', 40, 60, pose), true);
        assert.deepEqual(args.slice(1), [frame * layout.frameWidth, 0, layout.frameWidth, layout.frameHeight,
          -layout.originX, -layout.originY, layout.frameWidth, layout.frameHeight]);
        assert.equal(context.imageSmoothingEnabled, true);
      }
      setPreferredArtStyle('ninja', 'ink');
      assert.equal(paints, 2, 'style event redraws the preview');
      assert.equal(drawCharacterSheet(context as unknown as CanvasRenderingContext2D, 'ninja', 20, 30), false);
      unsubscribe();
      setPreferredArtStyle('ninja', 'pixel');
      assert.equal(paints, 2, 'unmounted previews stop listening');
    } finally {
      unsubscribe();
      setPreferredArtStyle('ninja', 'pixel');
      if (originalImage) globalThis.Image = originalImage;
      else Reflect.deleteProperty(globalThis, 'Image');
    }
  });
});
