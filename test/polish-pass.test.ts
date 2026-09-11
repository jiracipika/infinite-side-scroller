import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paintGroundTexture, STRATA_DEPTHS } from "@/game/rendering/textures";
import { readFileSync } from "node:fs";

function recorder() {
  const calls: unknown[][] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === "canvas") return { width: 800, height: 600 };
        return (...args: unknown[]) => {
          calls.push([prop as string, ...args]);
          return undefined;
        };
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const heights = Array.from({ length: 100 }, () => 300);

describe("polish: underground must not read as flat black", () => {
  it("strata reaches at least 75% of the depth budget in both detail tiers", () => {
    for (const detail of [true, false]) {
      const r = recorder();
      paintGroundTexture(r.ctx, {
        heights,
        chunkWorldX: 0,
        chunkIndex: 3,
        offsetX: 0,
        offsetY: 0,
        depthPx: 720, // full canvas depth like the live chunk pass
        ground: "#a3e635",
        groundDark: "#2a2438",
        detail,
      });
      // Deepest stroked y across strata + speckles + pebbles.
      let maxY = 0;
      for (const c of r.calls) {
        if (c[0] === "moveTo" || c[0] === "lineTo") {
          const y = Number(c[2]);
          if (Number.isFinite(y)) maxY = Math.max(maxY, y);
        }
      }
      // Surface sits at ~300; depth budget 720 → the band below the deepest
      // legacy stratum (300+88) must not be empty: texture past 75% depth.
      assert.ok(
        maxY >= 300 + 720 * 0.75,
        `deepest texture y=${maxY} (detail=${detail}); flat black band returns below it`,
      );
    }
  });

  it("low detail still paints multiple deep strata (variety, not one line)", () => {
    const r = recorder();
    paintGroundTexture(r.ctx, {
      heights, chunkWorldX: 0, chunkIndex: 3, offsetX: 0, offsetY: 0,
      depthPx: 720, ground: "#a3e635", groundDark: "#2a2438", detail: false,
    });
    const strokes = r.calls.filter((c) => c[0] === "stroke").length;
    assert.ok(strokes >= 5, `expected several strata strokes, got ${strokes}`);
    assert.ok(STRATA_DEPTHS.length >= 3);
  });
});

describe("polish: shield orb must not fight the lavender moon", () => {
  it("shield case uses the violet family, not cyan", () => {
    const src = readFileSync(
      new URL("../src/game/rendering/renderer.ts", import.meta.url),
      "utf8",
    );
    const shieldCase = src.slice(
      src.indexOf('case "shield"'),
      src.indexOf('case "magnet"'),
    );
    assert.ok(!/#67e8f9|#0891b2|#22d3ee|#06b6d4/.test(shieldCase),
      "cyan still present in shield case");
    assert.ok(/#c4b5fd|#a78bfa|#8b5cf6|#7c3aed|#6d28d9/.test(shieldCase),
      "shield case should draw from the violet family");
  });
});
