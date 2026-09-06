import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  cityBlock,
  paintIndustrialCity,
  paintRooftopFacade,
  paintInkSlab,
  paintRoofProp,
  INK,
} from "@/game/rendering/ink-city";
function recorder() {
  const calls: unknown[][] = [];
  let depth = 0;
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get:
      (_, k) =>
      (...a: unknown[]) => {
        calls.push([k, ...a]);
        if (k === "save") depth++;
        if (k === "restore") depth--;
      },
    set: (_, k, v) => {
      calls.push(["set", k, v]);
      return true;
    },
  });
  return { ctx, calls, depth: () => depth };
}
describe("industrial screenprint rendering", () => {
  it("world cells are stable, bounded and varied including negative chunks", () => {
    for (let i = -100; i < 100; i++)
      for (let l = 0; l < 3; l++) {
        const b = cityBlock(i, l);
        assert.deepEqual(b, cityBlock(i, l));
        assert.ok(b.width >= 70 && b.width < 132);
        assert.ok(b.height >= 100 && b.height < 320);
      }
    assert.notDeepEqual(cityBlock(1, 0), cityBlock(2, 0));
  });
  it("city tiers remain deterministic, opaque and restore canvas state", () => {
    for (const detail of [false, true]) {
      const a = recorder(),
        b = recorder();
      paintIndustrialCity(a.ctx, 1280, 720, -500, 80, detail);
      paintIndustrialCity(b.ctx, 1280, 720, -500, 80, detail);
      assert.deepEqual(a.calls, b.calls);
      assert.equal(a.depth(), 0);
      assert.ok(a.calls.length < 7000);
      const fills = a.calls.filter(
        (c) => c[0] === "set" && c[1] === "fillStyle",
      );
      assert.ok(fills.every((c) => /^#[a-f0-9]{6}$/.test(String(c[2]))));
    }
  });
  it("low detail reduces work without deleting silhouettes", () => {
    const a = recorder(),
      b = recorder();
    paintIndustrialCity(a.ctx, 1280, 720, 0, 0, false);
    paintIndustrialCity(b.ctx, 1280, 720, 0, 0, true);
    assert.ok(a.calls.length < b.calls.length);
    assert.equal(
      a.calls.filter((c) => c[0] === "fill").length,
      b.calls.filter((c) => c[0] === "fill").length,
    );
  });
  it("slab keeps collision top exact and puts broken edge below it", () => {
    const r = recorder();
    paintInkSlab(r.ctx, 10, 90, 120, 5);
    assert.ok(
      r.calls.some((c) => c[0] === "moveTo" && c[1] === 10 && c[2] === 90),
    );
    assert.ok(
      r.calls.some((c) => c[0] === "lineTo" && c[1] === 130 && c[2] === 90),
    );
    assert.ok(
      r.calls
        .filter((c) => c[0] === "lineTo" || c[0] === "moveTo")
        .every((c) => Number(c[2]) >= 90),
    );
    assert.equal(r.depth(), 0);
  });
  it("facade is immutable and below playable surface", () => {
    const heights = Array(201).fill(100);
    const r = recorder();
    paintRooftopFacade(r.ctx, heights, 1, 0, 0, 720, true);
    assert.deepEqual(heights, Array(201).fill(100));
    assert.ok(
      r.calls
        .filter(
          (c) => c[0] === "lineTo" || c[0] === "moveTo" || c[0] === "fillRect",
        )
        .every((c) => Number(c[2]) > 100),
    );
    assert.equal(r.depth(), 0);
  });
  it("noncolliding props never masquerade as lime traversal edges", () => {
    for (const kind of ["tree", "rock", "bush"]) {
      const r = recorder();
      paintRoofProp(r.ctx, 10, 20, 1, kind, 1);
      assert.ok(!r.calls.some((c) => c[0] === "set" && c[2] === INK.lime));
      assert.equal(r.depth(), 0);
    }
  });
});
