import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildProgressionBonuses,
  purchaseUpgrade,
  purchaseCharacter,
  addRunRewards,
  resetSaveSlot,
  renameSaveSlot,
  loadSaveSlots,
  saveSaveSlots,
  type SaveSlotId,
} from '@/lib/progression';

// ── localStorage polyfill for Node test environment ──────────────────

const MEMORY: Record<string, string> = {};

const localStorageStub = {
  getItem: (key: string): string | null => MEMORY[key] ?? null,
  setItem: (key: string, value: string): void => { MEMORY[key] = value; },
  removeItem: (key: string): void => { delete MEMORY[key]; },
  clear: (): void => { for (const k of Object.keys(MEMORY)) delete MEMORY[k]; },
};

// Make it available on globalThis so source modules see it.
const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.window) globalAny.window = globalAny;
globalAny.localStorage = localStorageStub;

function freshStorage(): void {
  localStorageStub.clear();
}

// ── Tests ────────────────────────────────────────────────────────────

describe('buildProgressionBonuses', () => {
  it('returns safe defaults for empty upgrade list', () => {
    const b = buildProgressionBonuses([]);
    assert.equal(b.speedMultiplier, 1.0);
    assert.equal(b.jumpMultiplier, 1.0);
    assert.equal(b.extraMaxHealth, 0);
    assert.equal(b.coinMultiplier, 1.0);
    assert.equal(b.magnetRadiusBonus, 0);
    assert.equal(b.autoReviveOnce, false);
  });

  it('applies swift_boots speed bonus', () => {
    const b = buildProgressionBonuses(['swift_boots']);
    assert.equal(b.speedMultiplier, 1.1);
  });

  it('applies iron_heart extra health', () => {
    const b = buildProgressionBonuses(['iron_heart']);
    assert.equal(b.extraMaxHealth, 1);
  });

  it('applies coin_charm multiplier', () => {
    const b = buildProgressionBonuses(['coin_charm']);
    assert.equal(b.coinMultiplier, 1.2);
  });

  it('applies magnet_core radius + duration bonuses together', () => {
    const b = buildProgressionBonuses(['magnet_core']);
    assert.ok(b.magnetRadiusBonus > 0, 'magnet radius should be positive');
    assert.ok(b.magnetDurationMultiplier > 1.0, 'magnet duration multiplier should be > 1');
  });

  it('applies dash_servos cooldown reduction (multiplier < 1)', () => {
    const b = buildProgressionBonuses(['dash_servos']);
    assert.ok(b.dashCooldownMultiplier < 1.0, 'dash cooldown should be reduced');
  });

  it('applies phoenix_chip auto-revive flag', () => {
    const b = buildProgressionBonuses(['phoenix_chip']);
    assert.equal(b.autoReviveOnce, true);
  });

  it('stacks multiple upgrades without interference', () => {
    const b = buildProgressionBonuses([
      'swift_boots', 'spring_anklet', 'iron_heart', 'coin_charm',
    ]);
    assert.equal(b.speedMultiplier, 1.1);
    assert.equal(b.jumpMultiplier, 1.12);
    assert.equal(b.extraMaxHealth, 1);
    assert.equal(b.coinMultiplier, 1.2);
  });

  it('ignores unknown upgrade ids gracefully', () => {
    const b = buildProgressionBonuses(['nonexistent_upgrade']);
    assert.equal(b.speedMultiplier, 1.0, 'unknown upgrade should have no effect');
  });
});

describe('addRunRewards', () => {
  beforeEach(freshStorage);

  it('adds coins to slot bank and increments run count', () => {
    const slotId: SaveSlotId = 'slot1';
    const slots1 = addRunRewards(slotId, { coins: 50, score: 1200, distance: 3400 });
    const slot1 = slots1.find((s) => s.id === slotId)!;

    assert.equal(slot1.bankCoins, 50);
    assert.equal(slot1.lifetimeCoinsCollected, 50);
    assert.equal(slot1.totalRuns, 1);
    assert.equal(slot1.bestScore, 1200);
    assert.equal(slot1.bestDistance, 3400);
    assert.equal(slot1.checkpoint, null, 'checkpoint should be cleared after run');
  });

  it('accumulates across multiple runs', () => {
    const slotId: SaveSlotId = 'slot2';
    addRunRewards(slotId, { coins: 30, score: 500, distance: 1000 });
    const slots2 = addRunRewards(slotId, { coins: 70, score: 800, distance: 2000 });
    const slot = slots2.find((s) => s.id === slotId)!;

    assert.equal(slot.bankCoins, 100, 'bank coins should accumulate');
    assert.equal(slot.totalRuns, 2);
    assert.equal(slot.bestScore, 800, 'best score should track max');
    assert.equal(slot.bestDistance, 2000, 'best distance should track max');
  });

  it('handles zero-coin runs without going negative', () => {
    const slotId: SaveSlotId = 'slot1';
    const slots = addRunRewards(slotId, { coins: 0, score: 0, distance: 0 });
    const slot = slots.find((s) => s.id === slotId)!;
    assert.equal(slot.bankCoins, 0);
    assert.equal(slot.totalRuns, 1);
  });

  it('rejects negative coins defensively', () => {
    const slotId: SaveSlotId = 'slot1';
    const slots = addRunRewards(slotId, { coins: -50, score: 0, distance: 0 });
    const slot = slots.find((s) => s.id === slotId)!;
    assert.equal(slot.bankCoins, 0, 'negative coins should be clamped to 0');
  });
});

describe('purchaseUpgrade', () => {
  beforeEach(freshStorage);

  it('succeeds when slot has enough coins', () => {
    const slotId: SaveSlotId = 'slot1';
    addRunRewards(slotId, { coins: 200, score: 0, distance: 0 });
    const result = purchaseUpgrade(slotId, 'swift_boots');
    assert.equal(result.ok, true);
    assert.equal(result.reason, undefined);
    const slot = result.slots.find((s) => s.id === slotId)!;
    assert.ok(slot.unlockedUpgradeIds.includes('swift_boots'));
  });

  it('fails when not enough coins', () => {
    const slotId: SaveSlotId = 'slot1';
    addRunRewards(slotId, { coins: 5, score: 0, distance: 0 });
    const result = purchaseUpgrade(slotId, 'swift_boots');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'Not enough coins');
  });

  it('fails when already purchased', () => {
    const slotId: SaveSlotId = 'slot1';
    addRunRewards(slotId, { coins: 500, score: 0, distance: 0 });
    purchaseUpgrade(slotId, 'swift_boots');
    const result2 = purchaseUpgrade(slotId, 'swift_boots');
    assert.equal(result2.ok, false);
    assert.equal(result2.reason, 'Already purchased');
  });

  it('fails for unknown upgrade id', () => {
    const slotId: SaveSlotId = 'slot1';
    addRunRewards(slotId, { coins: 9999, score: 0, distance: 0 });
    const result = purchaseUpgrade(slotId, 'fake_upgrade');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'Unknown upgrade');
  });

  it('deducts the upgrade cost from bank coins', () => {
    const slotId: SaveSlotId = 'slot1';
    addRunRewards(slotId, { coins: 500, score: 0, distance: 0 });
    const result = purchaseUpgrade(slotId, 'swift_boots');
    const slot = result.slots.find((s) => s.id === slotId)!;
    // swift_boots has a defined cost in SHOP_UPGRADES; verify deduction happened
    assert.ok(slot.bankCoins < 500, 'cost should have been deducted');
    assert.ok(slot.spentCoins > 0, 'spentCoins should track total spent');
  });
});

describe('save slot management', () => {
  beforeEach(freshStorage);

  it('loads default 3 slots on fresh storage', () => {
    const slots = loadSaveSlots();
    assert.equal(slots.length, 3);
    assert.ok(slots.some((s) => s.id === 'slot1'));
    assert.ok(slots.some((s) => s.id === 'slot2'));
    assert.ok(slots.some((s) => s.id === 'slot3'));
  });

  it('renameSaveSlot updates name and persists', () => {
    const slots = renameSaveSlot('slot1', 'My Save');
    const slot = slots.find((s) => s.id === 'slot1')!;
    assert.equal(slot.name, 'My Save');
    // Verify persistence
    const reloaded = loadSaveSlots();
    const reloadedSlot = reloaded.find((s) => s.id === 'slot1')!;
    assert.equal(reloadedSlot.name, 'My Save');
  });

  it('renameSaveSlot clamps long names to 18 chars', () => {
    const longName = 'A'.repeat(50);
    const slots = renameSaveSlot('slot1', longName);
    const slot = slots.find((s) => s.id === 'slot1')!;
    assert.equal(slot.name.length, 18);
  });

  it('renameSaveSlot falls back to default for empty/whitespace names', () => {
    const slots = renameSaveSlot('slot2', '   ');
    const slot = slots.find((s) => s.id === 'slot2')!;
    assert.ok(slot.name.length > 0);
    assert.equal(slot.name, 'Save 2');
  });

  it('resetSaveSlot clears coins, upgrades, and checkpoint', () => {
    const slotId: SaveSlotId = 'slot1';
    addRunRewards(slotId, { coins: 500, score: 1000, distance: 5000 });
    purchaseUpgrade(slotId, 'swift_boots');

    const resetSlots = resetSaveSlot(slotId);
    const slot = resetSlots.find((s) => s.id === slotId)!;
    assert.equal(slot.bankCoins, 0);
    assert.equal(slot.unlockedUpgradeIds.length, 0);
    assert.equal(slot.checkpoint, null);
    assert.equal(slot.totalRuns, 0);
  });

  it('saveSaveSlots round-trips through localStorage', () => {
    const slots = loadSaveSlots();
    renameSaveSlot('slot3', 'Round Trip');
    const reloaded = loadSaveSlots();
    const slot3 = reloaded.find((s) => s.id === 'slot3')!;
    assert.equal(slot3.name, 'Round Trip');
  });
});
