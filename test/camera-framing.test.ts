import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Camera, DEFAULT_CAMERA_CONFIG } from "@/game/engine/camera";

describe("graphic-novel framing (stage 5)", () => {
  it("places the hero left-of-center for lookahead and keeps the stage low", () => {
    // Composition review 2026-09-10: hero at 37% + horizon at 55% left ~45%
    // of the frame as dead underground. Comic-panel framing: hero ~left
    // third, ground line near the lower rule-of-thirds.
    assert.equal(DEFAULT_CAMERA_CONFIG.focusX, 0.4);
    assert.equal(DEFAULT_CAMERA_CONFIG.horizontalFocusY, 0.6);
    // Portrait screens keep more headroom (sky/moon is the identity there).
    assert.ok(DEFAULT_CAMERA_CONFIG.verticalFocusY >= 0.5 && DEFAULT_CAMERA_CONFIG.verticalFocusY <= 0.56);
    // Split-screen panes are exempt from the single-player composition.
    assert.equal(DEFAULT_CAMERA_CONFIG.splitFocusY, 0.6);
  });
  it("lookahead increases without breaking the left wall clamp", () => {
    const cam = new Camera();
    cam.setScreenSize(1280, 720);
    cam.update(0, 300, 1);
    assert.equal(cam.x, 0, "player at x=0 must clamp camera to 0");
    cam.update(1000, 300, 10);
    assert.ok(cam.x > 0);
    // With focusX 0.4 the camera trails the player: player screen x ~512.
    const playerScreenX = 1000 - cam.renderX;
    assert.ok(playerScreenX > 450 && playerScreenX < 600, `screenX ${playerScreenX}`);
  });
});
