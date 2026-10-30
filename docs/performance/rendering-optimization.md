# Rendering performance with the existing graphics

The bottleneck was repeated construction of painted character poses. Five distinct running characters can use 240 phase frames, while the old shared cache evicted after 96 entries or 28 MiB. Crowded scenes repeatedly re-rasterized the same poses with hundreds of clipped texture draws per figure.

The cache now allows up to 512 entries and 64 MiB of cached pixel storage, allocated on demand and shared by menus, local/remote players and court enemies. This is a memory-for-rendering tradeoff; the limits still evict old frames. No pixel storage is reserved up front.

Two additional optimizations reduce work when a pose must be constructed:

- Fit skin weights against one shared rest skeleton per character, rather than solving that skeleton again for each of the 875 mesh vertices.
- Calculate bone rotation trigonometry once per pose and precompile immutable triangle source geometry. Vertices reuse those transforms; triangle drawing no longer allocates temporary coordinate arrays.

The original grid, frame placement, seam overlap, texture sampling, frame timing and pose quantization are preserved. Character assets, particle counts, lighting, scenery, effects, screen resolution and adaptive-quality behavior are unchanged. The mobile WebView and animation studio use the same optimized renderer.

## Validation

The browser regression compares exact RGBA output for all 17 characters across 24 poses, including cloth, transparent edges, dashes, jump/landing impulses, ranged/melee overlays and rotated weapons. It requires zero changed pixels. Unit tests also compare the old per-vertex solver and the optimized shared-transform solver with exact coordinate equality.

The benchmark runs old and new renderers sequentially with the same seed, camera movement, animated characters, full-quality scenery, shield/magnet/speed visuals and particle bursts. It fixes DPR at 1 and disables adaptive quality for both versions. It measures render submission time over 360 simulated frames per scenario, excluding the first 60 frames from steady-state averages. These are headless Chromium render-work measurements, not a claim about a device's display refresh rate.

Measured in Chromium 154.0.8037.57 at 1280×720, DPR 1, with full quality and no CPU throttling.

| Court enemies plus the hero | Previous average | Optimized average | Previous p95 | Optimized p95 |
| --- | --- | --- | --- | --- |
| 0 | 1.08 ms | 1.05 ms | 1.40 ms | 1.40 ms |
| 4 | 67.96 ms | 2.24 ms | 82.10 ms | 13.90 ms |
| 8 | 105.78 ms | 0.77 ms | 130.80 ms | 1.30 ms |

The largest gains occur with several painted characters on screen. The solo fixture was already inexpensive in steady state. Cached pixel storage peaked at 31.3 MiB in this run. All 408 character/pose comparisons had zero changed pixels.

First-time poses still require synchronous rasterization, so cold-frame hitches remain possible. A separate short solo production-game diagnostic under 4× CPU throttling stayed around 11 FPS before and after this change. This optimization addresses repeated pose construction and cache eviction; it does not establish a universal FPS improvement or remove every rendering bottleneck.

Raw results: [benchmark evidence](renderer-benchmark.json).

Run from a checkout containing the baseline commit:

```bash
BASELINE_REF=1555e41 npm run benchmark:renderer
```

If Playwright is provided outside the checkout, set `PLAYWRIGHT_PACKAGE` to its package.json and optionally `CHROMIUM_PATH` to the browser executable. `PERF_OUTPUT` selects the evidence directory; by default it uses the operating system's temporary directory. Run without another build, browser benchmark or test suite competing for CPU.

The command saves timing/cache data and before/after pose sheets and fails if any character pixel changes or the frame cache exceeds 64 MiB.

Additional validation:

- `npm run verify`: full verification ladder, typecheck, lint and 1,031 core unit tests, plus the existing UI and offline checks.
- `npm run build`: production build.
- `npm run test:character-framing`: 9,792 preview checks and 3,332 frame-boundary checks, with no clipping.
- `npm run test:character-browser`: desktop/mobile layouts, style switching and real gameplay actions across all 17 characters.
- `npm run test:character-mobile`: all 17 characters in the offline mobile bundle, including native movement and jump controls.
