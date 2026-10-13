#!/usr/bin/env node
/**
 * Bake the original bespoke designs into crisp pixel strips. No character
 * anatomy or palette is reinvented: the ink painters are the art masters.
 * Requires Playwright (PLAYWRIGHT_PACKAGE can point to an installed package).
 * CHROMIUM_EXECUTABLE optionally selects a local Chromium binary.
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const bundle = await build({
  stdin: {
    contents: `export { CHARACTERS } from './src/game/data/characters';
      export { drawCharacterInkArt } from './src/game/rendering/character-art';`,
    resolveDir: root, loader: 'ts',
  },
  bundle: true, format: 'iife', globalName: 'Masters', write: false,
  // Baking must work before sheets/layouts exist and must never read pixel art.
  plugins: [{ name: 'ink-masters-only', setup(build) {
    build.onLoad({ filter: /character-sheets-data\.ts$/ }, () => ({
      contents: 'export const CHARACTER_SHEETS = {}; export const CHARACTER_SHEET_LAYOUTS = {};',
      loader: 'ts',
    }));
  } }],
});
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE } : {}),
});
try {
  const page = await browser.newPage();
  await page.setContent('<!doctype html><body></body>');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const sheets = await page.evaluate(() => {
    const density = 2; // half-world-pixel detail preserves eyes, jewellery and costume motifs
    const poses = [{}, { stride: 2.4 }, { airborne: true }, { dashing: true },
      { melee: 0.5 }, { airborne: true, tumble: 0.5 }];
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 256;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const anchorX = 120, anchorY = 80;
    const result = [];
    for (const char of Masters.CHARACTERS) {
      const frames = [];
      let left = canvas.width, top = canvas.height, right = 0, bottom = 0;
      let idleBounds;
      for (const [index, pose] of poses.entries()) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const palette = new Set();
        const recorder = new Proxy(ctx, {
          get(target, key) {
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
          },
          set(target, key, value) {
            if (key === 'fillStyle' || key === 'strokeStyle') palette.add(value);
            return Reflect.set(target, key, value, target);
          },
        });
        ctx.save(); ctx.translate(anchorX, anchorY); ctx.scale(density, density);
        Masters.drawCharacterInkArt(recorder, char, char.width, char.height, pose);
        ctx.restore();
        const colors = [...palette].map(hex => {
          if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Non-solid master colour ${char.id}: ${hex}`);
          return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        });
        const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = frame.data;
        let fl = canvas.width, ft = canvas.height, fr = 0, fb = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 96) { data.fill(0, i, i + 4); continue; }
          // Remove anti-alias blends using only this character's authored colours.
          let best, distance = Infinity;
          for (const color of colors) {
            const d = color.reduce((sum, c, channel) => sum + (c - data[i + channel]) ** 2, 0);
            if (d < distance) { distance = d; best = color; }
          }
          data.set([...best, 255], i);
          const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width);
          fl = Math.min(fl, x); ft = Math.min(ft, y); fr = Math.max(fr, x + 1); fb = Math.max(fb, y + 1);
        }
        if (fl <= 0 || ft <= 0 || fr >= canvas.width || fb >= canvas.height) {
          throw new Error(`${char.id} pose ${index} overflows the authoring canvas`);
        }
        if (index === 0) idleBounds = {
          left: (fl - anchorX) / density, top: (ft - anchorY) / density,
          right: (fr - anchorX) / density, bottom: (fb - anchorY) / density,
        };
        left = Math.min(left, fl); top = Math.min(top, ft);
        right = Math.max(right, fr); bottom = Math.max(bottom, fb);
        frames.push(frame);
      }
      // One common origin across all poses: accessories never crop, feet never drift.
      left -= 2; top -= 2; right += 2; bottom += 2;
      const frameWidth = right - left, frameHeight = bottom - top;
      const strip = document.createElement('canvas');
      strip.width = frameWidth * poses.length; strip.height = frameHeight;
      const stripCtx = strip.getContext('2d');
      frames.forEach((frame, index) => {
        ctx.putImageData(frame, 0, 0);
        stripCtx.drawImage(canvas, left, top, frameWidth, frameHeight,
          index * frameWidth, 0, frameWidth, frameHeight);
      });
      result.push({ id: char.id, png: strip.toDataURL('image/png').split(',')[1], layout: {
        frameWidth, frameHeight, originX: anchorX - left, originY: anchorY - top,
        density, bodyWidth: char.width, bodyHeight: char.height, idleBounds,
      } });
    }
    return result;
  });
  const layouts = {};
  for (const { id, png, layout } of sheets) {
    writeFileSync(path.join(root, 'design', 'sheets', `${id}.png`), Buffer.from(png, 'base64'));
    layouts[id] = layout;
  }
  writeFileSync(path.join(root, 'design', 'sheets', 'layouts.json'), JSON.stringify(layouts, null, 2) + '\n');
  console.log(`Painted ${sheets.length} identity-faithful pixel sheets. Run generate-character-sheets.mjs next.`);
} finally {
  await browser.close();
}
