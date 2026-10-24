#!/usr/bin/env node
// Full-art character lane generator.
//
// Reads the redesign reference boards in design/full-art/src/<id>.png
// (front / side / back + expression layout), segments the big FRONT figure
// off the decorated board background and emits:
//   design/full-art/<id>.png                     — extracted figure (QA + source of truth)
//   design/full-art/preview.png                  — labeled contact sheet for visual QA
//   src/game/rendering/character-fullart-data.ts — WebP data URIs the game embeds
//
// Segmentation: region-growing flood fill from the board edges (tolerance per
// board), then the largest connected non-background component is kept — that
// is always the front figure; frame lines, sparkles and side/back views are
// either flood-eaten or end up as smaller components.
//
// Run after replacing any board art:
//   node scripts/generate-full-art.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const srcDir = path.join(root, 'design', 'full-art', 'src');
const outDir = path.join(root, 'design', 'full-art');
const dataOut = path.join(root, 'src', 'game', 'rendering', 'character-fullart-data.ts');

/** Final sprite box (longest edge, px). Gameplay draws the figure at ~36px
 * tall and menus at ~64px; 192 keeps >3x headroom on every surface. */
const MAX_EDGE = 192;

// Per-board segmentation knobs. tolerance: RGB distance a pixel may drift
// from the background region it grew from before it counts as figure — kept
// LOW so growth crosses the smooth board backdrop but stalls at the hard
// silhouette outline instead of leaking into dark costumes.
// crop: fractional guard box [x0, y0, x1, y1] applied BEFORE segmentation to
// keep the side/back views and expression panels out of contention.
const BOARDS = {
  cherry:     { tolerance: 6, crop: [0.025, 0.09, 0.40, 0.98] },
  cyborg:     { tolerance: 8, crop: [0.02, 0.07, 0.43, 0.97] },
  dorian:     { tolerance: 10, crop: [0.015, 0.07, 0.51, 0.97] },
  ember:      { tolerance: 10, crop: [0.02, 0.16, 0.51, 0.97] },
  grimshaw:   { tolerance: 7, crop: [0.02, 0.03, 0.45, 0.98] },
  healer:     { tolerance: 10, crop: [0.02, 0.05, 0.44, 0.98] },
  knight:     { tolerance: 7, crop: [0.02, 0.02, 0.655, 0.70] },
  mage:       { tolerance: 10, crop: [0.02, 0.02, 0.60, 0.70] },
  marionette: { tolerance: 10, crop: [0.02, 0.14, 0.51, 0.98] },
  mortimer:   { tolerance: 7, crop: [0.02, 0.05, 0.45, 0.97] },
  ninja:      { tolerance: 5, crop: [0.02, 0.02, 0.58, 0.70] },
  onyx:       { tolerance: 10, crop: [0.02, 0.03, 0.555, 0.98] },
  rosalia:    { tolerance: 10, crop: [0.02, 0.16, 0.51, 0.98] },
  spirit:     { tolerance: 10, crop: [0.02, 0.04, 0.44, 0.98] },
  tank:       { tolerance: 6, crop: [0.02, 0.02, 0.62, 0.70] },
  velvet:     { tolerance: 7, crop: [0.02, 0.16, 0.51, 0.97] },
};

function segment({ data, original, width, height }, tolerance) {
  // `data` is the blurred copy the fill reasons over; `original` supplies the
  // exported pixels so art stays crisp while segmentation ignores grain.
  const n = width * height;
  // bg[i] = 1 once the pixel joined the background region.
  const bg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0, tail = 0;

  // Store parent colors in parallel arrays so growth tracks local gradients
  // (board backdrops vignette; a fixed key color would stall on the edges).
  const pr = new Uint8Array(n), pg = new Uint8Array(n), pb = new Uint8Array(n);

  const seed = (i) => {
    if (bg[i]) return;
    const o = i * 4;
    bg[i] = 1; pr[i] = data[o]; pg[i] = data[o + 1]; pb[i] = data[o + 2];
    queue[tail++] = i;
  };
  for (let x = 0; x < width; x++) { seed(x); seed((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seed(y * width); seed(y * width + width - 1); }

  const tol2 = tolerance * tolerance;
  while (head < tail) {
    const i = queue[head++];
    const r = pr[i], g = pg[i], b = pb[i];
    const x = i % width, y = (i / width) | 0;
    const tryGrow = (j) => {
      if (bg[j]) return;
      const o = j * 4;
      const dr = data[o] - r, dg = data[o + 1] - g, db = data[o + 2] - b;
      if (dr * dr + dg * dg + db * db > tol2) return;
      bg[j] = 1; pr[j] = data[o]; pg[j] = data[o + 1]; pb[j] = data[o + 2];
      queue[tail++] = j;
    };
    if (x > 0) tryGrow(i - 1);
    if (x < width - 1) tryGrow(i + 1);
    if (y > 0) tryGrow(i - width);
    if (y < height - 1) tryGrow(i + width);
  }

  // Connected components of the figure mask (4-connectivity). The FRONT
  // figure is a large SOLID TALL blob; frame networks, panel strips, sparkles
  // and text are either flood-eaten or thin (low fill ratio) — so candidates
  // are scored by bbox area weighted by fill, among reasonably solid blobs.
  const label = new Int32Array(n).fill(-1);
  const comp = [];
  const stack = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    if (bg[s] || label[s] !== -1) continue;
    const c = { id: comp.length, size: 0, minX: width, minY: height, maxX: -1, maxY: -1 };
    let sp = 0;
    stack[sp++] = s; label[s] = c.id;
    while (sp > 0) {
      const i = stack[--sp];
      c.size++;
      const x = i % width, y = (i / width) | 0;
      if (x < c.minX) c.minX = x; if (x > c.maxX) c.maxX = x;
      if (y < c.minY) c.minY = y; if (y > c.maxY) c.maxY = y;
      const visit = (j) => {
        if (bg[j] || label[j] !== -1) return;
        label[j] = c.id; stack[sp++] = j;
      };
      if (x > 0) visit(i - 1);
      if (x < width - 1) visit(i + 1);
      if (y > 0) visit(i - width);
      if (y < height - 1) visit(i + width);
    }
    comp.push(c);
  }
  for (const c of comp) {
    c.bboxW = c.maxX - c.minX + 1;
    c.bboxH = c.maxY - c.minY + 1;
    c.fill = c.size / (c.bboxW * c.bboxH);
    c.score = c.bboxW * c.bboxH * c.fill;
  }
  const regionH = height;
  let best = comp
    .filter((c) => c.fill >= 0.30 && c.bboxH >= regionH * 0.35 && c.size >= 2000)
    .sort((a, b) => b.score - a.score)[0];
  if (!best) best = comp.slice().sort((a, b) => b.size - a.size)[0]; // desperate fallback

  // The silhouette often arrives split (a neck gap or belt line the fill
  // crossed leaves helmet vs torso as separate blobs). Re-attach substantial
  // components that sit close to the winning blob — figure parts, not
  // speckles — by repeatedly merging anything within 14px whose union stays
  // blob-like. Tiny decorations never reach the size gate.
  const GAP = 14;
  const merged = new Set([best.id]);
  let grew = true;
  while (grew) {
    grew = false;
    const box = {
      left: Math.min(...[...merged].map((id) => comp[id].minX)),
      top: Math.min(...[...merged].map((id) => comp[id].minY)),
      right: Math.max(...[...merged].map((id) => comp[id].maxX)),
      bottom: Math.max(...[...merged].map((id) => comp[id].maxY)),
    };
    for (const c of comp) {
      if (merged.has(c.id) || c.size < best.size * 0.02) continue;
      const near =
        c.minX <= box.right + GAP && c.maxX >= box.left - GAP &&
        c.minY <= box.bottom + GAP && c.maxY >= box.top - GAP;
      if (!near) continue;
      merged.add(c.id);
      grew = true;
    }
  }

  // Hole-fill: background pockets enclosed by the figure (visor slits, cloak
  // folds, prop gaps) belong INSIDE the silhouette. Flood the bg from the
  // crop border; enclosed bg is flipped to figure before emitting.
  const outside = new Uint8Array(n);
  const ostack = new Int32Array(n);
  let osp = 0;
  const seedOut = (i) => { if (bg[i] && !outside[i]) { outside[i] = 1; ostack[osp++] = i; } };
  for (let x = 0; x < width; x++) { seedOut(x); seedOut((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { seedOut(y * width); seedOut(y * width + width - 1); }
  while (osp > 0) {
    const i = ostack[--osp];
    const x = i % width, y = (i / width) | 0;
    const visit = (j) => { if (bg[j] && !outside[j]) { outside[j] = 1; ostack[osp] = j; osp++; } };
    if (x > 0) visit(i - 1);
    if (x < width - 1) visit(i + 1);
    if (y > 0) visit(i - width);
    if (y < height - 1) visit(i + width);
  }
  // Winning component, plus background pockets it encloses. Other non-bg
  // components (sparkles, titles, satellites) stay out.
  const isFigure = (i) => merged.has(label[i]) || (bg[i] === 1 && !outside[i]);

  // Emit RGBA (ORIGINAL pixels) with the winning component opaque.
  const out = Buffer.alloc(n * 4);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (isFigure(i)) {
      out[o] = original[o]; out[o + 1] = original[o + 1]; out[o + 2] = original[o + 2]; out[o + 3] = 255;
      const x = i % width, y = (i / width) | 0;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) throw new Error('segmentation produced an empty figure');
  // Feather the cutout edge 1px so the silhouette does not alias hard when
  // the engine scales the sprite down (alpha-only; colors untouched).
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = y * width + x, o = i * 4;
      if (out[o + 3] === 0) continue;
      const neighbors = [x > 0 ? i - 1 : i, x < width - 1 ? i + 1 : i, y > 0 ? i - width : i, y < height - 1 ? i + width : i];
      if (neighbors.some((j) => !isFigure(j))) out[o + 3] = 210;
    }
  }
  const mergedSize = [...merged].reduce((a, id) => a + comp[id].size, 0);
  const mbW = maxX - minX + 1, mbH = maxY - minY + 1;
  return {
    data: out, width, height,
    box: { left: minX, top: minY, width: mbW, height: mbH },
    figureFraction: mergedSize / n,
    fill: mergedSize / (mbW * mbH),
  };
}

async function extract(id, { tolerance, crop }) {
  const file = path.join(srcDir, `${id}.png`);
  const img = sharp(file, { ensureAlpha: true });
  const meta = await img.metadata();
  let region = { left: 0, top: 0, width: meta.width, height: meta.height };
  if (crop) {
    region = {
      left: Math.round(crop[0] * meta.width),
      top: Math.round(crop[1] * meta.height),
      width: Math.round((crop[2] - crop[0]) * meta.width),
      height: Math.round((crop[3] - crop[1]) * meta.height),
    };
  }
  const raw = await img.extract(region).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: rawW, height: rawH } = raw.info;
  if (raw.info.channels !== 4) throw new Error(`expected RGBA raw pixels, got ${raw.info.channels} channels`);
  // Flood fill runs on a MEDIAN-FILTERED copy: raw board grain defeats
  // per-pixel growth (it stalls in scanlines), and a Gaussian blur smears
  // away the very silhouette step the fill must respect — the median kills
  // grain while PRESERVING edge steps. The winning mask is applied to the
  // original pixels, so the exported art stays crisp.
  const filteredRaw = await sharp(raw.data, { raw: { width: rawW, height: rawH, channels: 4 } })
    .median(5)
    .raw()
    .toBuffer({ resolveWithObject: true });
  let filtered = filteredRaw.data;
  if (filteredRaw.info.channels === 3) {
    // sharp may drop alpha through the op for raw input; re-expand.
    filtered = Buffer.alloc(rawW * rawH * 4);
    for (let i = 0; i < rawW * rawH; i++) {
      filtered[i * 4] = filteredRaw.data[i * 3];
      filtered[i * 4 + 1] = filteredRaw.data[i * 3 + 1];
      filtered[i * 4 + 2] = filteredRaw.data[i * 3 + 2];
      filtered[i * 4 + 3] = 255;
    }
  }
  const cut = segment({ data: filtered, original: raw.data, width: rawW, height: rawH }, tolerance);
  const pad = Math.max(4, Math.round(Math.max(cut.box.width, cut.box.height) * 0.015));
  const left = Math.max(0, cut.box.left - pad);
  const top = Math.max(0, cut.box.top - pad);
  const width = Math.min(rawW - left, cut.box.width + pad * 2);
  const height = Math.min(rawH - top, cut.box.height + pad * 2);
  const figure = await sharp(cut.data, { raw: { width: rawW, height: rawH, channels: 4 } })
    .extract({ left, top, width, height })
    .png()
    .toFile(path.join(outDir, `${id}.png`));
  const scale = MAX_EDGE / Math.max(figure.width, figure.height);
  const webp = await sharp(path.join(outDir, `${id}.png`))
    .resize(Math.max(1, Math.round(figure.width * scale)), Math.max(1, Math.round(figure.height * scale)), { kernel: 'lanczos3' })
    .webp({ quality: 92, alphaQuality: 100 })
    .toBuffer();
  return { id, webp, width: figure.width, height: figure.height, figureFraction: cut.figureFraction.toFixed(3), fill: cut.fill.toFixed(2) };
}

const ids = readdirSync(srcDir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')).sort();
if (ids.length === 0) { console.error('no boards found in design/full-art/src/'); process.exit(1); }

const results = [];
for (const id of ids) {
  const cfg = BOARDS[id] ?? { tolerance: 30 };
  results.push(await extract(id, cfg));
}

// Contact sheet for visual QA: every figure at 2x its gameplay height on a
// mid-dark backdrop, labeled, so a bad cutout is obvious at a glance.
const cell = 220, cols = 4, rows = Math.ceil(results.length / cols);
const composites = [];
for (let i = 0; i < results.length; i++) {
  const r = results[i];
  const h = 190, w = Math.min(cell - 16, Math.max(1, Math.round(r.width * (h / r.height))));
  const thumb = await sharp(path.join(outDir, `${r.id}.png`)).resize(w, h).png().toBuffer();
  composites.push({ input: thumb, left: (i % cols) * cell + Math.round((cell - w) / 2), top: Math.floor(i / cols) * cell + 22 });
  const label = Buffer.from(`<svg width="${cell}" height="20"><text x="${cell / 2}" y="14" fill="#f4f2ed" font-family="monospace" font-size="13" text-anchor="middle">${r.id} ${r.width}x${r.height}</text></svg>`);
  composites.push({ input: label, left: (i % cols) * cell, top: Math.floor(i / cols) * cell });
}
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 33, g: 24, b: 43, alpha: 1 } } })
  .composite(composites)
  .png()
  .toFile(path.join(outDir, 'preview.png'));

// Embedded data module (mirrors character-sheets-data.ts conventions).
const entries = results.map((r) => `  ${JSON.stringify(r.id)}: 'data:image/webp;base64,${r.webp.toString('base64')}',`);
const banner = `// GENERATED by scripts/generate-full-art.mjs — do not edit by hand.
// Source of truth: design/full-art/<id>.webp, segmented from the redesign
// boards in design/full-art/src/<id>.png. Regenerate after replacing art.
// Each entry is the character's FRONT figure with transparency, longest edge
// ${MAX_EDGE}px — the full-art lane draws it pose-transformed into the collision box.
export const CHARACTER_FULL_ART: Record<string, string> = {
${entries.join('\n')}
};
`;
writeFileSync(dataOut, banner);

console.log(JSON.stringify({
  generated: dataOut.replace(root + '/', ''),
  figures: results.map(({ id, width, height, figureFraction, fill }) => ({ id, width, height, figureFraction, fill })),
  preview: 'design/full-art/preview.png',
}, null, 2));
