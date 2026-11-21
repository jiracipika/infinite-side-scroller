import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const menu = readFileSync(new URL("../src/components/StartScreen.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/StartScreen.module.css", import.meta.url), "utf8");
const theme = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

describe("menu and gameplay color parity", () => {
  it("uses the shared lime, violet and coral accents for mode categories", () => {
    assert.match(css, /:global\(\.solo\) \{ --mode-accent: var\(--dv-action\)/);
    assert.match(css, /:global\(\.coop\) \{ --mode-accent: var\(--dv-violet\)/);
    assert.match(css, /:global\(\.compete\) \{ --mode-accent: var\(--dv-danger\)/);
    assert.match(theme, /--dv-danger: #ff7166;/);
    assert.match(theme, /--dv-action: #c7ff4d;/);
  });

  it("provides explicit labels for both loadout and profile navigation", () => {
    assert.match(menu, /aria-label="Open player profile"/);
    assert.match(menu, /aria-label="Open character select"/);
  });
});
