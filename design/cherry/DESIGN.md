# Cherry — character design record

Red-haired, cherry-obsessed, a little gothic — designed to slot into
DashVerse's inked graphic-novel roster (see `docs/plans/graphic-novel-fidelity.md`).
Shipped as roster id **`cherry`** ("Cherry"), unlockable for 450 coins.

## Brief

- Red hair, cherry vibes (stems, bows, a cherry charm, a cherry-red parasol)
- "A bit gothic": near-black lolita silhouette, pale skin, corset lacing
- Must match the existing art: procedural ink anatomy, filled bent limbs,
  broken contours, one disciplined accent color, readable over dark terrain

## Iterations (see `preview/contact-sheet.png`)

Three silhouettes were authored side by side in `concepts.ts` and rendered
across idle / run / air / dash / melee / tumble plus a 28px chip render.
Three render passes; the fix loop between passes was driven by what the
contact sheet exposed.

| | Concept | Weapon | Verdict |
|---|---|---|---|
| A | **Midnight Lolita** — twin-tails with stem bows, scalloped bell skirt, parasol | parasol bonk | ✅ **shipped** |
| B | Cherry Reaper — hooded cape, shadowed face, cherry-stem whip | whip lash | ❌ cut |
| C | Cherry Punk — bob with black streaks, cropped jacket, cherry knuckle | knuckle punch | ❌ cut |

**Why A won**

1. **On-brief cherry integration** — the motif is structural (stem bows tie
   the tails, the charm hangs at her collar, the parasol canopy IS a cherry),
   not printed on (C's cherry-print tee).
2. **Unique silhouette** — she's the only skirt in the roster; B's hood
   duplicated Ninja's faceless read, and at 22×32 the hood+cape+skirt+boots
   stack turned to mud (visible in pass 1–2 of the sheet).
3. **Biggest animation surface** — three flowing elements (two tail locks
   with wave/reach physics, skirt sway, parasol arc) vs Ninja's single scarf,
   so every pose parameter moves multiple silhouettes.
4. **Chip legibility** — at the 28px select-grid render A still reads as
   "red-haired girl in a black dress"; B read as a red smudge.

**Fix loop across passes**

- Pass 1 → 2: hair rendered as one giant banner; tails rebuilt as two
  distinct locks with a gap and bounded reach; parasol canopy enlarged.
- Pass 2 → 3: parasol was occluded (drawn behind the hair, parked over the
  head) — moved to a last-drawn, up-forward shoulder carry with the dash
  trail routed below the hair mass; tails given a wind droop.

## Shipped stats (`src/game/data/characters.ts`)

Speed 1.12 / jump 1.12 / HP 3 (between Ninja 1.3/1.1/2 and Knight 1.0/1.0/3),
parasol melee (dmg 1, 0.3s cd, 42px), innate double jump (floats like
mage/spirit), special **Cherry Bomb** (9s, `#e5304a`).

## Files

- `src/game/rendering/ink-cherry.ts` — shipped art (bespoke, ink-ninja idiom)
- `design/cherry/concepts.ts` — all three concepts (kept for future reskins)
- `design/cherry/preview/` — esbuild contact-sheet harness
- `test/ink-cherry.test.ts` — art contracts + roster/ability pins
- `scripts/test-fidelity-browser.mjs` — captures real in-game frames per action
