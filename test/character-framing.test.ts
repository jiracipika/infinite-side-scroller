import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { fitCharacterPreview } from '../src/game/rendering/character-framing';
import { fullArtFrameRect, FULL_ART_CACHE_BYTE_LIMIT } from '../src/game/rendering/fullart-mesh';
import { CHARACTER_FULL_ART } from '../src/game/rendering/character-fullart-data';
import { applyCharacterSheetPalette } from '../src/game/rendering/character-palette';

describe('complete character framing', () => {
  it('fits wide weapons and tall hats in both directions at every menu size', () => {
    for (const bounds of [
      { left: -32, top: -24, right: 54, bottom: 36 },
      { left: -10, top: -43, right: 29, bottom: 34 },
    ]) for (const size of [38, 64, 124, 132, 192]) {
      const frame = fitCharacterPreview(bounds, size);
      for (const x of [bounds.left, bounds.right]) for (const y of [bounds.top, bounds.bottom]) {
        const px = frame.x + x * frame.scale, py = frame.y + y * frame.scale;
        assert.ok(px >= 2 && px <= size - 2 && py >= 2 && py <= size - 2);
        assert.ok(size - px >= 2 && size - px <= size - 2, 'mirrored figure also fits');
      }
    }
  });

  it('allocates room for poses extending beyond the old fixed sprite frame', () => {
    const points: [number, number][] = [[-89, -70], [345, 330], [-102, 260]];
    const rect = fullArtFrameRect(points);
    for (const [x, y] of points) {
      assert.ok(x - rect.left >= 3 && x - rect.left <= rect.width - 3);
      assert.ok(y - rect.top >= 3 && y - rect.top <= rect.height - 3);
    }
    assert.ok(FULL_ART_CACHE_BYTE_LIMIT <= 28 * 1024 * 1024, 'variable frame sizes retain a bounded cache');
  });

  for (const id of ['cherry', 'velvet', 'rosalia', 'ember', 'marionette', 'ninja', 'dorian']) {
    it(`${id}: repaired artwork has transparent clearance on every edge`, async () => {
      const bytes = Buffer.from(CHARACTER_FULL_ART[id].split(',')[1], 'base64');
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let opaque = 0;
      for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
        const alpha = data[(y * info.width + x) * 4 + 3];
        if (alpha < 16) continue;
        opaque++;
        assert.ok(x >= 2 && x < info.width - 2 && y >= 2 && y < info.height - 2, `${x},${y} touches texture edge`);
      }
      assert.ok(opaque > info.width * info.height * .2, 'the figure itself remains present');
    });
  }
});

describe('Ansley’s complexion in alternate styles', () => {
  it('darkens every pixel face while preserving her white outfit details and red accents', async () => {
    const { data } = await sharp('design/sheets/cherry.png').ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const before = new Uint8ClampedArray(data), after = new Uint8ClampedArray(data);
    applyCharacterSheetPalette('cherry', after, 192);
    const changed = Array(6).fill(0);
    let white = 0;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 192; x++) {
      const i = (y * 192 + x) * 4;
      if (after[i] === 244 && after[i + 1] === 242 && after[i + 2] === 237 && after[i + 3]) white++;
      if (before[i] !== after[i]) {
        changed[Math.floor(x / 32)]++;
        assert.deepEqual([...after.slice(i, i + 3)], [147, 86, 61]);
        assert.equal(after[i + 3], before[i + 3]);
      } else assert.deepEqual([...after.slice(i, i + 4)], [...before.slice(i, i + 4)]);
    }
    assert.ok(changed.every(n => n > 0), 'all six poses have the new complexion');
    assert.ok(white > 200, 'white clothing and highlights survive');
    const other = before.slice(); applyCharacterSheetPalette('knight', other, 192);
    assert.deepEqual(other, before, 'other heroes retain their palettes');
  });
});
