#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const root = process.cwd(), out = process.env.ART_SCREENSHOTS || path.join(root, 'artifacts/character-framing');
mkdirSync(out, { recursive: true });
const { outputFiles } = await build({ stdin: { contents: `
import {CHARACTERS} from './src/game/data/characters';
import {CHARACTER_FULL_ART} from './src/game/rendering/character-fullart-data';
import {drawCharacterArt} from './src/game/rendering/character-art';
import {ensureCharacterFullArtLoading,characterFullArtReady} from './src/game/rendering/character-fullart';
import {ensureCharacterSheetsLoading,characterSheetReady,setPreferredArtStyle} from './src/game/rendering/sprite-sheet';
import {characterPreviewBounds,fitCharacterPreview} from './src/game/rendering/character-framing';
import {characterPreviewPose} from './src/game/rendering/character-performance';
window.art={CHARACTERS,CHARACTER_FULL_ART,drawCharacterArt,ensureCharacterFullArtLoading,characterFullArtReady,
ensureCharacterSheetsLoading,characterSheetReady,setPreferredArtStyle,characterPreviewBounds,fitCharacterPreview,characterPreviewPose};
`, resolveDir: root }, bundle: true, format: 'iife', write: false });
const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.setContent(`<canvas id="probe" width="512" height="512"></canvas><script>${outputFiles[0].text}</script>`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { window.art.ensureCharacterFullArtLoading(); window.art.ensureCharacterSheetsLoading(); });
  await page.waitForFunction(() => window.art.CHARACTERS.every(c => window.art.characterFullArtReady(c.id) && window.art.characterSheetReady(c.id)));
  const report = await page.evaluate(() => {
    const a = window.art, canvas = document.querySelector('#probe'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imageDraw = CanvasRenderingContext2D.prototype.drawImage;
    const clippedFrames = [], clippedPreviews = []; let current; let previewChecks = 0, frameChecks = 0;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      if (this.canvas === canvas && image instanceof HTMLCanvasElement && current?.style === 'fullart') {
        frameChecks++;
        const pixels = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
        let edges = 0;
        for (let x = 0; x < image.width; x++) for (const y of [0, 1, image.height - 2, image.height - 1]) if (pixels[(y * image.width + x) * 4 + 3] > 16) edges++;
        for (let y = 0; y < image.height; y++) for (const x of [0, 1, image.width - 2, image.width - 1]) if (pixels[(y * image.width + x) * 4 + 3] > 16) edges++;
        if (edges) clippedFrames.push({ ...current, edges });
      }
      return imageDraw.call(this, image, ...args);
    };
    for (const char of a.CHARACTERS) for (const style of ['fullart', 'ink', 'pixel']) {
      a.setPreferredArtStyle(char.id, style);
      for (const action of ['idle', 'run', 'jump', 'attack']) {
        const bounds = a.characterPreviewBounds(char, action, true);
        for (const size of [38, 124]) for (const right of [true, false]) for (let i = 0; i < 12; i++) {
          current = { id: char.id, style, action, size, right, sample: i };
          const frame = a.fitCharacterPreview(bounds, size), pose = a.characterPreviewPose(char, i * 1.5 / 12, action);
          canvas.width = size; canvas.height = size;
          ctx.save(); ctx.translate(right ? frame.x : size - frame.x, frame.y); ctx.scale(right ? frame.scale : -frame.scale, frame.scale);
          a.drawCharacterArt(ctx, char, char.width, char.height, pose); ctx.restore();
          const pixels = ctx.getImageData(0, 0, size, size).data; let edges = 0, opaque = 0;
          for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            if (pixels[(y * size + x) * 4 + 3] <= 16) continue;
            opaque++; if (x < 2 || x >= size - 2 || y < 2 || y >= size - 2) edges++;
          }
          previewChecks++;
          if (edges || !opaque) clippedPreviews.push({ ...current, edges, opaque });
        }
      }
      if (style === 'fullart') {
        // Dashes and combined air attacks also need safe internal raster bounds.
        canvas.width = 512; canvas.height = 512;
        for (const pose of [{ dashing: true }, { airborne: true, melee: .5, verticalVelocity: -300 }, { land: 1 }, { airborne: true, launch: 1, verticalVelocity: -520 }]) {
          current = { id: char.id, style, pose }; ctx.setTransform(1, 0, 0, 1, 200, 200);
          a.drawCharacterArt(ctx, char, char.width, char.height, pose);
        }
      }
    }
    return { characters: a.CHARACTERS.length, styles: 3, previewChecks, frameChecks, clippedFrames, clippedPreviews };
  });
  writeFileSync(path.join(out, 'evidence.json'), JSON.stringify({ ...report, errors }, null, 2));
  assert.deepEqual(report.clippedFrames, [], 'internal animation rasters must retain every pixel');
  assert.deepEqual(report.clippedPreviews, [], 'all poses must fit the menu canvas in both directions');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ ...report, errors, output: out }, null, 2));
} finally { await browser.close(); }
