import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COIN_REDEEM_CODES,
  redeemCoinCode,
  loadSaveSlots,
  resetSaveSlot,
  setActiveSaveSlotId,
  type SaveSlotId,
} from '@/lib/progression';

// localStorage polyfill mirroring progression-persistence.test.ts — including
// the window alias, without which loadSaveSlots short-circuits to defaults.
const MEMORY: Record<string, string> = {};
const localStorageStub = {
  getItem: (key: string): string | null => MEMORY[key] ?? null,
  setItem: (key: string, value: string): void => { MEMORY[key] = value; },
  removeItem: (key: string): void => { delete MEMORY[key]; },
  clear: (): void => { for (const k of Object.keys(MEMORY)) delete MEMORY[k]; },
};
const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.window) globalAny.window = globalAny;
globalAny.localStorage = localStorageStub;

const SLOT: SaveSlotId = 'slot1';

function stubSave(): void {
  localStorageStub.clear();
  const slots = loadSaveSlots();
  slots[0] = { ...slots[0], bankCoins: 50 };
  localStorageStub.setItem('iss-save-slots-v1', JSON.stringify(slots));
  localStorageStub.setItem('iss-active-save-slot-v1', SLOT);
}

describe('secret coin redeem codes', () => {
  it('ships exactly the cherry code granting 2000 coins', () => {
    assert.deepEqual(COIN_REDEEM_CODES, { CHERRYBOMB: 2000 });
  });

  it('grants coins case-insensitively and tolerates whitespace', () => {
    stubSave();
    setActiveSaveSlotId(SLOT);
    for (const input of ['cherrybomb', '  CherryBomb  ', 'CHERRYBOMB']) {
      const before = loadSaveSlots().find((s) => s.id === SLOT)!.bankCoins;
      const result = redeemCoinCode(SLOT, input);
      assert.equal(result.ok, true, JSON.stringify(input));
      assert.equal(result.coinsGranted, 2000);
      const after = result.slots.find((s) => s.id === SLOT)!.bankCoins;
      assert.equal(after, before + 2000);
      // Roll back for the next iteration.
      stubSave();
    }
  });

  it('rejects unknown, empty, and mutated codes without touching coins', () => {
    stubSave();
    const before = loadSaveSlots().find((s) => s.id === SLOT)!.bankCoins;
    for (const bad of ['', '   ', 'cherry', 'CHERRYBOMBB', 'cherry-bomb']) {
      const result = redeemCoinCode(SLOT, bad);
      assert.equal(result.ok, false, JSON.stringify(bad));
      assert.equal(result.reason, 'Unknown code');
    }
    assert.equal(loadSaveSlots().find((s) => s.id === SLOT)!.bankCoins, before);
  });

  it('credits only the named save slot', () => {
    stubSave();
    const result = redeemCoinCode(SLOT, 'CHERRYBOMB');
    const slots = result.slots;
    const credited = slots.find((s) => s.id === SLOT)!;
    const untouched = slots.find((s) => s.id !== SLOT)!;
    assert.equal(credited.bankCoins, 2050);
    assert.equal(untouched.bankCoins, 0, 'sibling slots keep their default bank');
  });

  it('is repeatable — no per-slot redemption ledger (the point is trying characters)', () => {
    stubSave();
    redeemCoinCode(SLOT, 'CHERRYBOMB');
    redeemCoinCode(SLOT, 'CHERRYBOMB');
    const coins = loadSaveSlots().find((s) => s.id === SLOT)!.bankCoins;
    assert.ok(coins >= 4050, `repeat redemptions must stack (got ${coins})`);
  });

  it('does not resurrect a reset slot', () => {
    stubSave();
    resetSaveSlot(SLOT);
    const fresh = loadSaveSlots().find((s) => s.id === SLOT)!;
    assert.equal(fresh.bankCoins, 0);
    const result = redeemCoinCode(SLOT, 'CHERRYBOMB');
    assert.equal(result.ok, true);
    assert.equal(result.slots.find((s) => s.id === SLOT)!.bankCoins, 2000);
  });
});

describe('secret reveal wiring (StartScreen source contract)', () => {
  const src = readFileSync(new URL('../src/components/StartScreen.tsx', import.meta.url), 'utf8');

  it('hides the code input behind five quick taps on the bank pill', () => {
    assert.match(src, /handleBankPillTap/);
    assert.match(src, /\.filter\(\(t\) => now - t < 3000\)/);
    assert.match(src, /recent\.length >= 5/);
    assert.match(src, /aria-label="Redeem coin code"/);
    assert.match(src, /redeemCoinCode\(activeSlotId, redeemCode\)/);
  });
});
