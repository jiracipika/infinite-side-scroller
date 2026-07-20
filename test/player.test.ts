import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Player, DEFAULT_PLAYER_CONFIG } from '@/game/entities/player';
import type { InputManager } from '@/game/input/input';
import { getCharacterById } from '@/game/data/characters';

// ────────────────────────────────────────────────────────────
// Mock input — satisfies the subset of InputManager that
// Player.update actually calls (isDown for continuous actions,
// isPressed for edge-triggered actions). In Node there is no
// window so a real InputManager has no listeners; the mock gives
// us deterministic per-frame control.
// ────────────────────────────────────────────────────────────
class MockInput {
  private down = new Set<string>();
  private pressed = new Set<string>();

  hold(code: string): void { this.down.add(code); }
  release(code: string): void { this.down.delete(code); }
  press(code: string): void { this.pressed.add(code); }
  clearPressed(): void { this.pressed.clear(); }

  isDown(code: string): boolean { return this.down.has(code); }
  isPressed(code: string): boolean { return this.pressed.has(code); }
}

function makeInput(): InputManager {
  return new MockInput() as unknown as InputManager;
}

const DT = 1 / 60; // simulate 60fps

describe('Player construction & defaults', () => {
  it('starts at config position with default health and lives', () => {
    const p = new Player();
    assert.equal(p.x, DEFAULT_PLAYER_CONFIG.startX);
    assert.equal(p.y, DEFAULT_PLAYER_CONFIG.startY);
    assert.equal(p.health, 3);
    assert.equal(p.maxHealth, 3);
    assert.equal(p.alive, true);
    assert.equal(p.coins, 0);
    assert.equal(p.score, 0);
    assert.equal(p.lives, 2);
  });

  it('centerX / centerY / bottom getters are correct', () => {
    const p = new Player({ ...DEFAULT_PLAYER_CONFIG, startX: 100, startY: 200, width: 20, height: 40 });
    assert.equal(p.centerX, 110);
    assert.equal(p.centerY, 220);
    assert.equal(p.bottom, 240);
  });

  it('getBounds returns the AABB', () => {
    const p = new Player();
    const b = p.getBounds();
    assert.deepEqual(b, { x: p.x, y: p.y, width: p.width, height: p.height });
  });
});

describe('Player takeDamage & invulnerability', () => {
  it('reduces health and returns true on a clean hit', () => {
    const p = new Player();
    assert.equal(p.takeDamage(1), true);
    assert.equal(p.health, 2);
    assert.equal(p.invulnerable, true);
  });

  it('grants 1.5s invulnerability after a hit', () => {
    const p = new Player();
    p.takeDamage(1);
    assert.equal(p.invulnerable, true);
    assert.ok(p.invulnerableTimer > 1.4 && p.invulnerableTimer <= 1.5);
  });

  it('blocks damage during invulnerability frames (returns false)', () => {
    const p = new Player();
    p.takeDamage(1); // health 2, invulnerable
    assert.equal(p.takeDamage(1), false); // blocked by i-frames
    assert.equal(p.health, 2); // unchanged
  });

  it('dies when health reaches zero', () => {
    const p = new Player();
    p.takeDamage(3);
    assert.equal(p.health, 0);
    assert.equal(p.alive, false);
  });

  it('does not process damage when already dead', () => {
    const p = new Player();
    p.takeDamage(3);
    assert.equal(p.alive, false);
    assert.equal(p.takeDamage(1), false);
  });

  it('invulnerability expires after the timer', () => {
    const p = new Player();
    p.takeDamage(1);
    // Tick past invulnerability window (1.5s)
    const input = makeInput();
    for (let i = 0; i < 120; i++) p.update(DT, input, p.y + p.height);
    assert.equal(p.invulnerable, false);
  });
});

describe('Player shield', () => {
  it('shield absorbs one hit without losing health', () => {
    const p = new Player();
    p.applyShield(8);
    assert.equal(p.shieldActive, true);
    assert.equal(p.takeDamage(1), false); // absorbed
    assert.equal(p.shieldActive, false); // consumed
    assert.equal(p.health, 3); // no damage
  });

  it('shield does not set invulnerability after absorption', () => {
    const p = new Player();
    p.applyShield(8);
    p.takeDamage(1);
    assert.equal(p.invulnerable, false);
  });

  it('shield expires after its duration', () => {
    const p = new Player();
    p.applyShield(2);
    const input = makeInput();
    for (let i = 0; i < 150; i++) p.update(DT, input, p.y + p.height);
    assert.equal(p.shieldActive, false);
  });
});

describe('Player heal & onHeal callback', () => {
  it('heals up to maxHealth but no further', () => {
    const p = new Player();
    p.takeDamage(2); // health 1
    p.heal(5);
    assert.equal(p.health, 3); // capped at maxHealth
  });

  it('onHeal fires only when health actually increases', () => {
    const p = new Player();
    let calls = 0;
    p.onHeal = () => calls++;
    p.heal(1); // 3→3, no gain (already full)
    assert.equal(calls, 0);
    p.takeDamage(2); // health 1
    p.heal(1); // 1→2, gain
    assert.equal(calls, 1);
    p.heal(10); // 2→3, gain
    assert.equal(calls, 2);
    p.heal(1); // 3→3, no gain
    assert.equal(calls, 2);
  });
});

describe('Player coin economy & extra lives', () => {
  it('awards 10 score per coin', () => {
    const p = new Player();
    p.addCoins(5);
    assert.equal(p.coins, 5);
    assert.equal(p.score, 50);
  });

  it('awards an extra life at 100 coins', () => {
    const p = new Player();
    assert.equal(p.lives, 2);
    for (let i = 0; i < 100; i++) p.addCoins(1);
    assert.equal(p.coins, 100);
    assert.equal(p.lives, 3);
  });

  it('does not double-award the 100-coin life', () => {
    const p = new Player();
    for (let i = 0; i < 100; i++) p.addCoins(1);
    assert.equal(p.lives, 3);
    p.addCoins(1); // 101 coins
    assert.equal(p.lives, 3); // still 3
  });

  it('awards a second life at 200 coins', () => {
    const p = new Player();
    for (let i = 0; i < 200; i++) p.addCoins(1);
    assert.equal(p.lives, 4);
  });

  it('grantLife unconditionally increments', () => {
    const p = new Player();
    p.grantLife();
    assert.equal(p.lives, 3);
  });

  it('coin multiplier scales coins and score', () => {
    const p = new Player();
    p.applyProgressionBonuses({
      speedMultiplier: 1, jumpMultiplier: 1, extraMaxHealth: 0,
      coinMultiplier: 2, magnetRadiusBonus: 0, magnetDurationMultiplier: 1,
      shieldDurationMultiplier: 1, dashCooldownMultiplier: 1,
      projectileDamageBonus: 0, projectileSpeedMultiplier: 1,
      autoReviveOnce: false, healOnCoinChance: 0,
    });
    p.addCoins(10);
    assert.equal(p.coins, 20);
    assert.equal(p.score, 200);
  });
});

describe('Player dash attack', () => {
  it('triggers dash on KeyX press and sets invulnerability', () => {
    const p = new Player();
    const input = makeInput();
    input.press('KeyX');
    p.update(DT, input, p.y + p.height);
    assert.equal(p.dashing, true);
    assert.equal(p.invulnerable, true);
    input.clearPressed();
  });

  it('dash moves player horizontally in facing direction', () => {
    const p = new Player();
    const startX = p.x;
    const input = makeInput();
    input.hold('ArrowRight'); // face right
    p.update(DT, input, p.y + p.height);
    input.clearPressed();
    input.press('KeyX');
    p.update(DT, input, p.y + p.height); // dash starts
    input.clearPressed();
    p.update(DT, input, p.y + p.height); // dash moves
    assert.ok(p.x > startX, `expected x > ${startX}, got ${p.x}`);
  });

  it('dash has a cooldown preventing immediate re-trigger', () => {
    const p = new Player();
    const input = makeInput();
    input.press('KeyX');
    p.update(DT, input, p.y + p.height); // dash 1
    input.clearPressed();
    // Wait for dash to end
    for (let i = 0; i < 10; i++) p.update(DT, input, p.y + p.height);
    assert.equal(p.dashing, false);
    // Immediately try to dash again — should be on cooldown
    input.press('KeyX');
    p.update(DT, input, p.y + p.height);
    assert.equal(p.dashing, false); // cooldown active
    input.clearPressed();
  });
});

describe('Player auto-revive & coin revive', () => {
  it('auto-revive fires once when progression grants it', () => {
    const p = new Player();
    p.applyProgressionBonuses({
      speedMultiplier: 1, jumpMultiplier: 1, extraMaxHealth: 0,
      coinMultiplier: 1, magnetRadiusBonus: 0, magnetDurationMultiplier: 1,
      shieldDurationMultiplier: 1, dashCooldownMultiplier: 1,
      projectileDamageBonus: 0, projectileSpeedMultiplier: 1,
      autoReviveOnce: true, healOnCoinChance: 0,
    });
    p.takeDamage(p.maxHealth); // die
    assert.equal(p.alive, false);
    assert.equal(p.tryAutoRevive(), true);
    assert.equal(p.alive, true);
    assert.ok(p.health >= 1);
  });

  it('auto-revive can only be used once', () => {
    const p = new Player();
    p.applyProgressionBonuses({
      speedMultiplier: 1, jumpMultiplier: 1, extraMaxHealth: 0,
      coinMultiplier: 1, magnetRadiusBonus: 0, magnetDurationMultiplier: 1,
      shieldDurationMultiplier: 1, dashCooldownMultiplier: 1,
      projectileDamageBonus: 0, projectileSpeedMultiplier: 1,
      autoReviveOnce: true, healOnCoinChance: 0,
    });
    p.takeDamage(p.maxHealth);
    p.tryAutoRevive(); // first use
    p.takeDamage(p.maxHealth); // die again
    assert.equal(p.tryAutoRevive(), false); // already used
  });

  it('coin revive deducts coins and restores to full health', () => {
    const p = new Player();
    p.addCoins(50);
    const coinsBefore = p.coins;
    p.takeDamage(p.maxHealth); // die
    assert.equal(p.tryCoinRevive(25), true);
    assert.equal(p.coins, coinsBefore - 25);
    assert.equal(p.health, p.maxHealth);
    assert.equal(p.alive, true);
  });

  it('coin revive fails when not enough coins', () => {
    const p = new Player();
    p.addCoins(10);
    p.takeDamage(p.maxHealth);
    assert.equal(p.tryCoinRevive(25), false);
    assert.equal(p.alive, false);
  });

  it('coin revive fails when still alive', () => {
    const p = new Player();
    p.addCoins(50);
    assert.equal(p.tryCoinRevive(25), false);
  });
});

describe('Player double jump', () => {
  it('knight has no innate double jump', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('knight'));
    assert.equal(p.canDoubleJump, false);
  });

  it('ninja, mage, and spirit have innate double jump', () => {
    for (const id of ['ninja', 'mage', 'spirit']) {
      const p = new Player();
      p.applyCharacter(getCharacterById(id));
      assert.equal(p.canDoubleJump, true, `${id} should have innate double jump`);
    }
  });

  it('restoreDoubleJump re-enables a used double jump', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('ninja'));
    p.useDoubleJump();
    assert.equal(p.canDoubleJump, false);
    p.restoreDoubleJump();
    assert.equal(p.canDoubleJump, true);
  });

  it('setDoubleJump grants a one-time air jump', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('knight'));
    assert.equal(p.canDoubleJump, false);
    p.setDoubleJump(true);
    assert.equal(p.canDoubleJump, true);
    p.useDoubleJump();
    assert.equal(p.canDoubleJump, false);
  });
});

describe('Player character application', () => {
  it('applyCharacter sets health to character maxHealth', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('tank'));
    assert.equal(p.maxHealth, 5);
    assert.equal(p.health, 5);
  });

  it('applyCharacter scales speed (ninja is faster than knight)', () => {
    const knight = new Player();
    knight.applyCharacter(getCharacterById('knight'));
    const ninja = new Player();
    ninja.applyCharacter(getCharacterById('ninja'));
    assert.ok(
      ninja.getMovementTuning().speed > knight.getMovementTuning().speed,
      'ninja should be faster than knight',
    );
  });

  it('ranger starts with bow weapon, others with orb', () => {
    const ranger = new Player();
    ranger.applyCharacter(getCharacterById('ranger'));
    assert.equal(ranger.currentWeapon, 'bow');

    const knight = new Player();
    knight.applyCharacter(getCharacterById('knight'));
    assert.equal(knight.currentWeapon, 'orb');
  });

  it('knockbackScale reflects character resistance', () => {
    const knight = new Player();
    knight.applyCharacter(getCharacterById('knight'));
    assert.equal(knight.knockbackScale, 1);

    const cyborg = new Player();
    cyborg.applyCharacter(getCharacterById('cyborg'));
    assert.equal(cyborg.knockbackScale, 0.5);
  });
});

describe('Player movement — coyote time', () => {
  // COYOTE_TIME = 0.1s. Player can still jump shortly after walking off a ledge.
  it('can jump within 0.1s after leaving the ground', () => {
    const p = new Player();
    const groundY = p.y + p.height;
    const input = makeInput();

    // Settle on ground for a few frames
    for (let i = 0; i < 5; i++) {
      input.clearPressed();
      p.update(DT, input, groundY);
    }
    assert.equal(p.onGround, true);

    // Remove the ground — player starts falling
    const noGround = Infinity;
    for (let i = 0; i < 3; i++) { // ~0.05s — within coyote window
      input.clearPressed();
      p.update(DT, input, noGround);
    }
    assert.equal(p.onGround, false);

    // Press jump — should succeed via coyote time
    input.press('Space');
    const vyBefore = p.vy;
    p.update(DT, input, noGround);
    assert.ok(
      p.vy < vyBefore,
      `coyote jump should set upward velocity: vyBefore=${vyBefore}, vyAfter=${p.vy}`,
    );
  });

  it('cannot jump after coyote window expires (~0.1s)', () => {
    const p = new Player();
    const groundY = p.y + p.height;
    const input = makeInput();

    // Settle on ground
    for (let i = 0; i < 5; i++) {
      input.clearPressed();
      p.update(DT, input, groundY);
    }

    // Remove ground and fall past coyote window
    const noGround = Infinity;
    for (let i = 0; i < 10; i++) { // ~0.167s — past 0.1s coyote
      input.clearPressed();
      p.update(DT, input, noGround);
    }

    // Press jump — should NOT jump (coyote expired, no double jump for knight)
    input.press('Space');
    const vyBefore = p.vy;
    p.update(DT, input, noGround);
    assert.equal(
      p.vy >= vyBefore,
      true,
      `coyote expired: vy should not decrease. vyBefore=${vyBefore}, vyAfter=${p.vy}`,
    );
  });
});

describe('Player movement — jump buffering', () => {
  // JUMP_BUFFER_TIME = 0.12s. If jump is pressed slightly before landing,
  // the jump fires on the landing frame.
  it('buffered jump fires when landing on the same frame', () => {
    const p = new Player();
    const groundY = p.y + p.height;
    const input = makeInput();

    // Lift off: jump once to get airborne
    input.press('Space');
    p.update(DT, input, groundY);
    input.clearPressed();

    // Fall long enough for coyote time to expire AND for the player to
    // descend well past the original ground level. The jump arc (≈44 frames
    // to return to launch height with jumpVelocity=-520, gravity=1400)
    // means we need >44 frames of unobstructed fall before the player is
    // below groundY again. 60 frames (1s) is safely past that.
    const noGround = Infinity;
    for (let i = 0; i < 60; i++) {
      input.clearPressed();
      p.update(DT, input, noGround);
    }
    assert.equal(p.onGround, false);
    assert.ok(p.vy > 0, `player should be descending, vy=${p.vy}`);

    // Press jump while still airborne (buffer it). Coyote has expired and
    // the knight has no double jump, so the press must be buffered, not
    // consumed immediately.
    input.press('Space');
    p.update(DT, input, noGround);
    input.clearPressed();
    assert.ok(p.jumpBufferTimer > 0, 'jump should be buffered');

    // Now provide ground again. Player lands this frame (onGround = true),
    // and the buffered jump should consume on the landing frame.
    const vyJustBeforeLanding = p.vy;
    p.update(DT, input, groundY);
    // If the buffered jump fired, the player immediately launches upward
    // again: vy becomes negative (jumpVelocity) and onGround flips to false.
    assert.ok(
      p.vy < vyJustBeforeLanding,
      `buffered jump should fire on landing: vyBefore=${vyJustBeforeLanding}, vyAfter=${p.vy}`,
    );
  });
});

describe('Player projectiles', () => {
  it('shoots a projectile on KeyZ press', () => {
    const p = new Player();
    const groundY = p.y + p.height;
    const input = makeInput();

    // Set fire direction (face right)
    input.hold('ArrowRight');
    p.update(DT, input, groundY);
    input.clearPressed();

    // Shoot
    input.press('KeyZ');
    const before = p.projectiles.length;
    p.update(DT, input, groundY);
    input.clearPressed();
    assert.equal(p.projectiles.length, before + 1);
  });

  it('projectile travels in facing direction', () => {
    const p = new Player();
    const groundY = p.y + p.height;
    const input = makeInput();

    input.hold('ArrowRight');
    p.update(DT, input, groundY);
    input.clearPressed();
    input.press('KeyZ');
    p.update(DT, input, groundY);
    input.clearPressed();
    assert.equal(p.projectiles.length, 1);
    assert.ok(p.projectiles[0].vx > 0, 'facing right → positive vx');
  });

  it('projectile expires after its lifetime', () => {
    const p = new Player();
    const groundY = p.y + p.height;
    const input = makeInput();
    input.hold('ArrowRight');
    p.update(DT, input, groundY);
    input.clearPressed();
    input.press('KeyZ');
    p.update(DT, input, groundY);
    input.clearPressed();
    assert.equal(p.projectiles.length, 1);
    const life = p.projectiles[0].life;
    // Advance well past projectile lifetime
    for (let i = 0; i < Math.ceil(life / DT) + 5; i++) {
      p.update(DT, input, groundY);
    }
    assert.equal(p.projectiles.length, 0, 'projectile should expire');
  });
});

describe('Player power-up application', () => {
  it('applyMagnet sets magnetActive and timer', () => {
    const p = new Player();
    p.applyMagnet(5);
    assert.equal(p.magnetActive, true);
    assert.ok(p.magnetTimer > 0);
  });

  it('applySpeedBoost temporarily increases speed', () => {
    const p = new Player();
    const baseSpeed = p.getMovementTuning().speed;
    p.applySpeedBoost(1.5, 3);
    assert.ok(p.getMovementTuning().speed > baseSpeed);
  });

  it('equipWeapon sets a temporary weapon override', () => {
    const p = new Player();
    p.applyCharacter(getCharacterById('knight'));
    assert.equal(p.currentWeapon, 'orb');
    p.equipWeapon('bow', 5);
    assert.equal(p.currentWeapon, 'bow');
    assert.equal(p.hasWeaponPickup, true);
  });

  it('applyHealingAura grants periodic healing', () => {
    const p = new Player();
    p.takeDamage(2); // health 1
    p.applyHealingAura(10);
    assert.equal(p.healingAuraActive, true);
  });
});
