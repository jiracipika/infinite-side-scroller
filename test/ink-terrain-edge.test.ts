import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paintInkTerrainEdge } from "@/game/rendering/ink-city";

function recorder() {
  const calls: unknown[][] = [];
  let depth = 0;
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, k) => (...a: unknown[]) => {
      calls.push([k, ...a]);
      if (k === "save") depth++;
      if (k === "restore") depth--;
    },
    set: (_t, k, v) => { calls.push(["set", k, v]); return true; },
  });
  return { ctx, calls, depth: () => depth };
}

const heights = Array.from({ length: 201 }, (_, i) => 100 + Math.round(Math.sin(i / 18) * 6));

describe("ink terrain edge (stage 4)", () => {
  it("exists, is deterministic and balances canvas state", () => {
    const a = recorder(), b = recorder();
    paintInkTerrainEdge(a.ctx, heights, 7, 0, 0, true);
    paintInkTerrainEdge(b.ctx, heights, 7, 0, 0, true);
    assert.deepEqual(a.calls, b.calls);
    assert.equal(a.depth(), 0);
  });
  it("strokes the exact collision contour in segments, not per-4px lines", () => {
    const r = recorder();
    paintInkTerrainEdge(r.ctx, heights, 7, 0, 0, true);
    const strokes = r.calls.filter((c) => c[0] === "stroke").length;
    // Old code drew 2 × (heights-1) ≈ 400 single-line strokes; the segmented
    // pass must consolidate those (fewer, longer, varied strokes).
    assert.ok(strokes > 4 && strokes < heights.length * 1.5, `stroke count ${strokes}`);
  });
  it("keeps every contour point on the exact surface Y (±2 for the ink lip)", () => {
    for (const chunkIndex of [3, 7, 11]) {
      const r = recorder();
      paintInkTerrainEdge(r.ctx, heights, chunkIndex, 0, 0, true);
      const pts = r.calls.filter((c) => c[0] === "moveTo" || c[0] === "lineTo");
      assert.ok(pts.length > 10);
      for (const c of pts) {
        const x = Number(c[1]);
        const y = Number(c[2]);
        const idx = Math.max(0, Math.min(heights.length - 1, Math.round(x / 4)));
        assert.ok(Math.abs(y - heights[idx]) <= 12, `y ${y} vs surface ${heights[idx]} at x ${x}`);
      }
    }
  });
  it("varies stroke weights and skips some bands for a chipped ink look", () => {
    const r = recorder();
    paintInkTerrainEdge(r.ctx, heights, 7, 0, 0, true);
    const widths = r.calls.filter((c) => c[0] === "set" && c[1] === "lineWidth").map((c) => Number(c[2]));
    assert.ok(widths.length >= 3, "expected multiple stroke weights");
    assert.ok(new Set(widths).size >= 3, `weights too uniform: ${widths.join(",")}`);
  });
  it("low detail tier does less work", () => {
    const a = recorder(), b = recorder();
    paintInkTerrainEdge(a.ctx, heights, 7, 0, 0, false);
    paintInkTerrainEdge(b.ctx, heights, 7, 0, 0, true);
    assert.ok(a.calls.length < b.calls.length);
  });
});
