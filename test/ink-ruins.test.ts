import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cityBlock, windowGrid } from "@/game/rendering/ink-city";
import { paintFracturedMoon } from "@/game/rendering/ink-moon";

describe("ruined city determinism (stage 3)", () => {
  it("exposes seeded broken-roofline variants with real variety", () => {
    const roofs = new Set<number>();
    for (let i = -40; i < 40; i++) for (let l = 0; l < 3; l++) {
      const b = cityBlock(i, l);
      assert.deepEqual(b.roof, cityBlock(i, l).roof);
      assert.ok(Number.isInteger(b.roof) && b.roof >= 0 && b.roof <= 3, `roof ${b.roof}`);
      roofs.add(b.roof);
    }
    assert.ok(roofs.size >= 3, `expected variety, got ${[...roofs].join(",")}`);
  });
  it("window grids vary pitch and lit clusters per building", () => {
    const pitches = new Set<number>();
    for (let i = -40; i < 40; i++) for (let l = 0; l < 3; l++) {
      const g = windowGrid(i, l);
      assert.deepEqual(g, windowGrid(i, l));
      assert.ok(g.pitch >= 24 && g.pitch <= 44, `pitch ${g.pitch}`);
      assert.ok(g.rows.every((row) => row.length >= 0 && row.length <= 4));
      assert.ok(g.rows.every((row) => row.every((c) => c >= 0 && c < 5)));
      pitches.add(g.pitch);
    }
    assert.ok(pitches.size >= 4, `expected pitch variety, got ${[...pitches].join(",")}`);
    // At least one building must have an unlit (missing) window row band:
    // uniform window walls are exactly the tidy look being removed.
    let hasGap = false;
    for (let i = -40; i < 40 && !hasGap; i++)
      hasGap = windowGrid(i, 2).rows.some((row) => row.length === 0);
    assert.ok(hasGap, "some buildings should skip a window band entirely");
  });
});

describe("fractured moon plates (stage 3)", () => {
  const recorder = () => {
    const calls: unknown[][] = [];
    let depth = 0;
    let points: number[][] = [];
    const polys: { fill: string; points: number[][] }[] = [];
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_, k) => (...a: unknown[]) => {
        calls.push([k, ...a]);
        if (k === "save") depth++;
        if (k === "restore") depth--;
        if (k === "moveTo") points = [[a[0] as number, a[1] as number]];
        if (k === "lineTo") points.push([a[0] as number, a[1] as number]);
        if (k === "fill") polys.push({ fill: String(lastFill), points: [...points] });
        if (k === "closePath") points.push(points[0]);
      },
      set: (_, k, v) => { calls.push(["set", k, v]); lastFill = k === "fillStyle" ? v : lastFill; return true; },
    });
    let lastFill = "";
    return { ctx, polys, depth: () => depth, calls };
  };
  it("paints >=6 deterministic shard plates inside the halo radius", () => {
    const a = recorder(), b = recorder();
    paintFracturedMoon(a.ctx, 640, 400, 80, 1);
    paintFracturedMoon(b.ctx, 640, 400, 80, 1);
    assert.deepEqual(a.calls, b.calls);
    assert.equal(a.depth(), 0);
    const plates = a.polys.filter((p) => p.points.length >= 3);
    assert.ok(plates.length >= 6, `expected shard plates, got ${plates.length}`);
    for (const p of plates)
      for (const [x, y] of p.points) {
        assert.ok(Number.isFinite(x) && Number.isFinite(y));
        assert.ok(Math.abs(x - 640) <= 160 && Math.abs(y - 400) <= 160, `plate out of bounds ${x},${y}`);
      }
  });
  it("keeps every fill a hex or rgba ink string (no gradients on plates)", () => {
    const a = recorder();
    paintFracturedMoon(a.ctx, 640, 400, 80, 1);
    const fills = a.calls.filter((c) => c[0] === "set" && c[1] === "fillStyle");
    assert.ok(fills.length > 0);
    for (const c of fills)
      assert.match(String(c[2]), /^(#[0-9a-f]{6}|rgba\([^)]*\))$/i);
  });
});
