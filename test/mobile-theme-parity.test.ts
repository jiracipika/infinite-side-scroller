import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SHELL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../apps/mobile");
const THEME = {
  bg: "#0a0a0f",
  card: "#1c1c2e",
  accent: "#c7ff4d",
};

function shellSourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx|ts)$/.test(name)) out.push(p);
    }
  };
  walk(join(SHELL_ROOT, "app"));
  walk(join(SHELL_ROOT, "components"));
  walk(join(SHELL_ROOT, "lib"));
  return out;
}

describe("polish: mobile shell shares the web ink theme", () => {
  it("no iOS-blue accent or off-theme gray background remains", () => {
    const offenders: string[] = [];
    for (const f of shellSourceFiles()) {
      const src = readFileSync(f, "utf8");
      if (/#0A84FF|10,132,255|#101014/i.test(src)) offenders.push(f);
    }
    assert.deepEqual(offenders, [], "iOS-blue/off-theme colors still present");
  });

  it("the ink theme tokens are actually used", () => {
    const all = shellSourceFiles().map((f) => readFileSync(f, "utf8")).join("\n");
    assert.ok(all.includes(THEME.accent), "lime accent missing");
    assert.ok(all.includes(THEME.bg), "ink background missing");
  });

  it("dark ink text on lime buttons, not white", () => {
    const src = readFileSync(join(SHELL_ROOT, "app/(tabs)/index.tsx"), "utf8");
    // every style whose backgroundColor is the lime accent must pair with
    // dark text in the following style block (catch the white-on-lime case).
    const blocks = src.split(/(\w+):\s*\{/).slice(1);
    for (let i = 0; i < blocks.length; i += 2) {
      const name = blocks[i];
      const body = blocks[i + 1] ?? "";
      if (/backgroundColor:\s*'#c7ff4d'/.test(body) && /color:\s*'#fff'/.test(body)) {
        assert.fail(`${name}: white text on lime accent`);
      }
    }
  });
});
