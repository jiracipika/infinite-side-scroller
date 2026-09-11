import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../src/components/StartScreen.module.css", import.meta.url),
  "utf8",
);

describe("menu comic devices (menu polish round 2)", () => {
  it("mode cards get a notched comic corner via clip-path", () => {
    const m = css.match(/\.modeGrid button:global\(\.dash-mode-card-v2\)\s*\{[^}]*\}/);
    assert.ok(m, "mode card base rule not found");
    assert.ok(/clip-path:\s*polygon\(/.test(m[0]), "mode cards lack a clipped corner");
  });

  it("mode cards carry a halftone dot field like the splash art", () => {
    const m = css.match(/\.modeGrid button:global\(\.dash-mode-card-v2\)\s*\{[^}]*\}/);
    assert.ok(m);
    assert.ok(/radial-gradient\([^)]*circle[^)]*\)/.test(m[0]),
      "no halftone dot layer on mode cards");
  });

  it("card shadow reads as print misregistration (violet under ink)", () => {
    const m = css.match(/\.modeGrid button:global\(\.dash-mode-card-v2\)\s*\{[^}]*\}/);
    assert.ok(m);
    // two-layer offset shadow: violet plate + deep ink plate
    assert.ok(/box-shadow:[^;]*#[0-9a-f]{6}[^;]*#[0-9a-f]{6}/.test(m[0]),
      "expected two-layer offset box-shadow");
  });

  it("unselected roster cards get the violet hatch wash (not flat dark)", () => {
    // Multiple .dash-character-card-v3 rules exist; the one owning the
    // background must carry the hatch.
    const rules = [...css.matchAll(/[^{}]*\.dash-character-card-v3\)\s*\{[^}]*\}/g)].map((m) => m[0]);
    const bgRule = rules.find((r) => /background/.test(r) && !/is-active/.test(r));
    assert.ok(bgRule, "background-owning roster card rule not found");
    assert.ok(/repeating-linear-gradient/.test(bgRule),
      "roster cards have no hatch backdrop");
  });
});
