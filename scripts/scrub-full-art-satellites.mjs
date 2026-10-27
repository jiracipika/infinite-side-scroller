#!/usr/bin/env node
// Satellite scrubber for the committed full-art figures.
//
// The board segmentation in generate-full-art.mjs keeps the largest blob and
// re-attaches anything within 14px of its box — which is exactly how panel
// furniture (palette strips, sample swatches, decorative orbs, frame slivers)
// rode into design/full-art/<id>.png and then straight through the skeletal
// rig, where distance-weighted bones warp the satellites into the animation.
//
// This script deletes the audited satellite components from the committed
// figures, trims the canvas back to the figure, refits the fraction-space
// rigs in src/game/rendering/fullart-rig.ts to the new image boxes, and
// regenerates the embedded WebP data + preview sheet.
//
// Every drop is PINNED to the component bbox measured during the audit
// (2026-10-27, visual + pixel-variance verification, see docs/art/). If a
// figure no longer matches — already scrubbed, or regenerated from a new
// artist drop — the entry reports as stale and is skipped; re-audit before
// extending the table. Run after every `npm run art:fullart` regeneration.
//
//   node scripts/scrub-full-art-satellites.mjs            # scrub + regenerate data
//   node scripts/scrub-full-art-satellites.mjs --refit    # also refit fullart-rig.ts
//                                                          (once per scrub)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const artDir = path.join(root, 'design', 'full-art');
const dataOut = path.join(root, 'src', 'game', 'rendering', 'character-fullart-data.ts');
const rigFile = path.join(root, 'src', 'game', 'rendering', 'fullart-rig.ts');
const MAX_EDGE = 192;
const refit = process.argv.includes('--refit');

/** Component id (CCL scan order) + the bbox it must still occupy, from the
 * audit. id alone is unstable across regenerations; the bbox pin makes the
 * policy fail loudly instead of deleting the wrong blob. */
const DROPS = {
  // Two solid palette legend strips glued down Ansley's left edge (fill
  // 0.95/0.99, swatch columns with cherry/heart icons).
  cherry: [
    { id: 1, box: [1, 72, 55, 313] },
    { id: 2, box: [1, 676, 61, 919] },
  ],
  // Big palette grid below-left of the figure, right-edge frame sliver,
  // bottom-left swatch grid, flat navy ground band (variance 47).
  knight: [
    { id: 1, box: [6, 187, 657, 871] },
    { id: 2, box: [581, 231, 614, 331] },
    { id: 6, box: [10, 605, 310, 865] },
    { id: 9, box: [71, 851, 705, 900] },
  ],
  // Orange decorative orb with dark jagged rim, left of her waist.
  velvet: [{ id: 1, box: [1, 300, 182, 486] }],
  // Candelabra + roses still-life vignette on a stone ledge.
  rosalia: [{ id: 1, box: [1, 300, 184, 488] }],
  // Wide soul-mist wisp band under the floating reaper's robe.
  grimshaw: [{ id: 1, box: [114, 756, 536, 861] }],
  // Mini companion-drone sketch hovering at his chest — the rig has no bone
  // for it, so it just smeared with the torso.
  cyborg: [{ id: 2, box: [427, 406, 505, 516] }],
  // Pale frame sliver at the far right edge. Everything else on this board
  // is shaded armor/blade art (verified by pixel variance) — kept as-is.
  tank: [{ id: 8, box: [600, 397, 666, 734] }],
};

const near = (a, b, tol = 6) => Math.abs(a - b) <= tol;

function components(opaque, W, H) {
  const n = W * H;
  const label = new Int32Array(n).fill(-1);
  const comps = [];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (!opaque[s] || label[s] !== -1) continue;
    const c = { id: comps.length, size: 0, minX: W, minY: H, maxX: -1, maxY: -1 };
    let sp = 0; stack[sp++] = s; label[s] = c.id;
    while (sp > 0) {
      const i = stack[--sp];
      c.size++;
      const x = i % W, y = (i / W) | 0;
      if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y;
      const visit = (j) => { if (opaque[j] && label[j] === -1) { label[j] = c.id; stack[sp++] = j; } };
      if (x > 0) visit(i - 1); if (x < W - 1) visit(i + 1);
      if (y > 0) visit(i - W); if (y < H - 1) visit(i + W);
    }
    comps.push(c);
  }
  return { comps, label };
}

const transforms = {};
const results = [];

for (const [id, drops] of Object.entries(DROPS)) {
  const file = path.join(artDir, `${id}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const n = W * H;
  const opaque = new Uint8Array(n);
  for (let i = 0; i < n; i++) opaque[i] = data[i * 4 + 3] > 40 ? 1 : 0;
  const { comps, label } = components(opaque, W, H);

  const stale = [];
  const dropped = [];
  for (const d of drops) {
    const c = comps[d.id];
    const box = c ? [c.minX, c.minY, c.maxX, c.maxY] : null;
    if (!box || !box.every((v, k) => near(v, d.box[k]))) {
      stale.push({ want: d, got: c ? { id: d.id, size: c.size, box } : null });
      continue;
    }
    dropped.push(c);
  }
  if (stale.length) {
    results.push({ id, status: 'stale', stale });
    continue;
  }
  if (!dropped.length) { results.push({ id, status: 'already-clean' }); continue; }

  const dropIds = new Set(dropped.map((c) => c.id));
  const out = Buffer.from(data);
  for (let i = 0; i < n; i++) if (dropIds.has(label[i])) out[i * 4 + 3] = 0;

  // Re-tighten to the surviving content, generator-style padding.
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let i = 0; i < n; i++) {
    if (out[i * 4 + 3] <= 40) continue;
    const x = i % W, y = (i / W) | 0;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  const pad = Math.max(4, Math.round(Math.max(maxX - minX, maxY - minY) * 0.015));
  const left = Math.max(0, minX - pad), top = Math.max(0, minY - pad);
  const cw = Math.min(W - left, maxX - minX + 1 + pad * 2);
  const ch = Math.min(H - top, maxY - minY + 1 + pad * 2);
  await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .extract({ left, top, width: cw, height: ch })
    .png()
    .toFile(file);
  transforms[id] = { W0: W, H0: H, left, top, W1: cw, H1: ch };
  results.push({
    id, status: 'scrubbed',
    dropped: dropped.map((c) => ({ id: c.id, size: c.size })),
    box: { W0: W, H0: H, left, top, W1: cw, H1: ch },
  });
}

const scrubbed = results.filter((r) => r.status === 'scrubbed');
const stale = results.filter((r) => r.status === 'stale');
console.log(JSON.stringify(results, null, 2));

// ---- Rig refit: landmarks are fractions of the SOURCE IMAGE, so every
// trimmed figure needs its rig remapped or the bones drift off the body.
if (refit) {
  if (!scrubbed.length && !stale.length) console.log('rig refit: nothing to do');
  else if (stale.length) { console.error('rig refit skipped: stale pins present, resolve those first'); process.exit(1); }
  else {
    let src = readFileSync(rigFile, 'utf8');
    for (const [id, t] of Object.entries(transforms)) {
      const blockRe = new RegExp(`(\\n  ${id}: \\{)([\\s\\S]*?)(\\},)(\\n)`);
      const m = src.match(blockRe);
      if (!m) { console.error(`rig refit: no block for ${id}`); process.exit(1); }
      const fx = (x) => (x * t.W0 - t.left) / t.W1;
      const fy = (y) => (y * t.H0 - t.top) / t.H1;
      const num = (v) => {
        const r = Math.round(v * 10000) / 10000;
        return String(r).replace(/^0\./, '.');
      };
      let body = m[2];
      body = body.replace(/\[\s*(-?\.?\d+(?:e-?\d+)?),\s*(-?\.?\d+(?:e-?\d+)?)\s*\]/g,
        (_, a, b) => `[${num(fx(parseFloat(a)))},${num(fy(parseFloat(b)))}]`);
      body = body.replace(/(headY:|hemY:)(\.?\d+)/g, (_, k, v) => `${k}${num(fy(parseFloat(v)))}`);
      src = src.slice(0, m.index) + m[1] + body + m[3] + m[4] + src.slice(m.index + m[0].length);
      console.log(`rig refit: ${id} -> box ${t.W1}x${t.H1} at +${t.left},+${t.top}`);
    }
    writeFileSync(rigFile, src);
  }
}

// ---- Embedded WebP data + contact sheet (mirrors generate-full-art.mjs).
const ids = readdirSync(artDir).filter((f) => f.endsWith('.png') && f !== 'preview.png').map((f) => f.replace(/\.png$/, '')).sort();
const entries = [];
const meta = {};
for (const id of ids) {
  const file = path.join(artDir, `${id}.png`);
  const m = await sharp(file).metadata();
  meta[id] = { width: m.width, height: m.height };
  const scale = MAX_EDGE / Math.max(m.width, m.height);
  const webp = await sharp(file)
    .resize(Math.max(1, Math.round(m.width * scale)), Math.max(1, Math.round(m.height * scale)), { kernel: 'lanczos3' })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
  entries.push(`  ${JSON.stringify(id)}: 'data:image/webp;base64,${webp.toString('base64')}',`);
}
const banner = `// GENERATED by scripts/generate-full-art.mjs — do not edit by hand.
// Source of truth: design/full-art/<id>.webp, segmented from the redesign
// boards in design/full-art/src/<id>.png. Regenerate after replacing art,
// then run scripts/scrub-full-art-satellites.mjs to strip panel satellites.
// Each entry is the character's FRONT figure with transparency, longest edge
// ${MAX_EDGE}px — the full-art lane draws it pose-transformed into the collision box.
export const CHARACTER_FULL_ART: Record<string, string> = {
${entries.join('\n')}
};
`;
writeFileSync(dataOut, banner);

// Contact sheet, same layout as the generator's.
const cell = 220, cols = 4, rows = Math.ceil(ids.length / cols);
const composites = [];
for (let i = 0; i < ids.length; i++) {
  const id = ids[i], m = meta[id];
  const h = 190, w = Math.min(cell - 16, Math.max(1, Math.round(m.width * (h / m.height))));
  const thumb = await sharp(path.join(artDir, `${id}.png`)).resize(w, h).png().toBuffer();
  composites.push({ input: thumb, left: (i % cols) * cell + Math.round((cell - w) / 2), top: Math.floor(i / cols) * cell + 22 });
  composites.push({
    input: Buffer.from(`<svg width="${cell}" height="20"><text x="${cell / 2}" y="14" fill="#f4f2ed" font-family="monospace" font-size="13" text-anchor="middle">${id} ${m.width}x${m.height}</text></svg>`),
    left: (i % cols) * cell, top: Math.floor(i / cols) * cell,
  });
}
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 33, g: 24, b: 43, alpha: 1 } } })
  .composite(composites)
  .png()
  .toFile(path.join(artDir, 'preview.png'));

console.log(JSON.stringify({
  scrubbed: scrubbed.map((r) => r.id),
  stale: stale.map((r) => r.id),
  regenerated: dataOut.replace(root + '/', ''),
  preview: 'design/full-art/preview.png',
}, null, 2));
