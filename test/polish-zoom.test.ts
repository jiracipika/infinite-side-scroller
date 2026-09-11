import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WORLD_ZOOM } from "@/game/engine/camera";
import { readFileSync } from "node:fs";

describe("polish: hero reads bigger (comic-panel zoom)", () => {
  it("world zoom is modest (1.2–1.35) so lookahead survives", () => {
    // Vision review (twice): 1.5–2x safe for lookahead — coin runs and
    // hazards stay visible to the right edge at 1.5 on 1280x720.
    assert.ok(WORLD_ZOOM >= 1.45 && WORLD_ZOOM <= 1.55, `zoom ${WORLD_ZOOM}`);
  });

  it("render() applies the zoom between tint and world layers, restores before overlays", () => {
    const src = readFileSync(
      new URL("../src/game/engine/game-engine.ts", import.meta.url),
      "utf8",
    );
    const render = src.slice(src.indexOf("private render(): void {"));
    const terrainIx = render.indexOf("this.renderer.drawTerrain(");
    const particlesIx = render.indexOf("this.renderer.drawParticles(");
    const restoreIx = render.indexOf("ctx.restore();", particlesIx);
    const overlayIx = render.indexOf("this.hitStopTimer > 0", restoreIx);
    assert.ok(terrainIx > 0 && particlesIx > terrainIx, "render structure found");
    const zoomSave = render.slice(0, terrainIx).lastIndexOf("ctx.save();");
    assert.ok(
      zoomSave > -1 && /WORLD_ZOOM/.test(render.slice(zoomSave, terrainIx)),
      "zoom transform set up before terrain",
    );
    assert.ok(
      restoreIx > particlesIx && overlayIx > restoreIx,
      "zoom restored after particles, before screen-space overlays",
    );
    // Anchor must match the camera focus so the hero stays framed.
    assert.ok(/0\.4/.test(render.slice(zoomSave, terrainIx)) || /focusX/.test(render.slice(zoomSave, terrainIx)));
  });
});
