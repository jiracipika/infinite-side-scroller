import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string) => readFileSync(new URL(`../src/components/${name}`, import.meta.url), "utf8");
const menu = read("StartScreen.tsx");
const css = read("StartScreen.module.css");
const cover = read("InkCover.tsx");

describe("menu presentation", () => {
  it("uses the game sky, city, ledge and equipped runner in the cover", () => {
    for (const painter of ["drawBackgroundSky", "drawBackgroundParallax", "paintInkSlab"]) {
      assert.match(cover, new RegExp(`${painter}\\(ctx`));
    }
    assert.match(menu, /<InkCover characterId=\{selectedChar\}/);
    assert.match(cover, /<CharacterSprite characterId=\{characterId\}/);
  });

  it("uses each runner's special color on both the stage and roster", () => {
    assert.match(menu, /"--runner-accent": previewCharacter\.specialColor/);
    assert.match(menu, /"--runner-accent": c\.specialColor/);
    assert.match(css, /var\(--runner-accent\)/);
  });

  it("keeps an independent equipped marker when inspecting the roster", () => {
    assert.match(menu, /aria-pressed=\{inspecting\}/);
    assert.match(menu, /data-equipped=\{equipped \|\| undefined\}/);
    assert.match(css, /button\[data-equipped\][^{]*\{[^}]*var\(--dv-action\)/);
  });
});
