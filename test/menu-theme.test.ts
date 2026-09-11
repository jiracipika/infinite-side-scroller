import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const startScreen = readFileSync(
  new URL("../src/components/StartScreen.tsx", import.meta.url),
  "utf8",
);

describe("menu ink-theme parity (menu polish pass)", () => {
  it("stat bars use the ink palette, not old neon blue/teal", () => {
    assert.ok(!/#7170ff|#10b981/i.test(startScreen),
      "old neon stat colors still present in StartScreen.tsx");
    assert.ok(/#9d82ff/.test(startScreen), "SPD bar should use ink violet");
    assert.ok(/#c7ff4d/.test(startScreen), "JMP bar should use ink lime");
    // HP red stays: health semantic shared with the in-game health orb.
  });

  it("compete card's coral edge is a documented semantic accent", () => {
    const css = readFileSync(
      new URL("../src/components/StartScreen.module.css", import.meta.url),
      "utf8",
    );
    assert.ok(/compete[\s\S]{0,120}border-left-color:\s*#ff7166/.test(css));
    assert.ok(/coral/.test(css.toLowerCase()), "coral accent must be documented");
  });

  it("profile button no longer renders a bare placeholder dot", () => {
    assert.ok(!/>\s*●\s*</.test(startScreen),
      "bare ● glyph still used for the profile button");
    assert.ok(/aria-label="Open player profile"/.test(startScreen));
  });
});
