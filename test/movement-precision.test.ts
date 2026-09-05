import { it } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '@/game/entities/player';
import { getCharacterById } from '@/game/data/characters';
import type { InputManager } from '@/game/input/input';

const DT = 1 / 60;
function input(pressed: string[] = [], axis = 0): InputManager {
  return { isPressed: (key: string) => pressed.includes(key), isDown: () => false,
    getHorizontalAxis: () => axis } as unknown as InputManager;
}
function airborneNinja() {
  const p = new Player();
  p.applyCharacter(getCharacterById('ninja'));
  for (let i = 0; i < 12; i++) p.update(DT, input(), Infinity);
  p.x = 200; p.y = 300; p.vy = 300;
  return p;
}
it('dash follows newly pressed movement instead of stale facing direction', () => {
  const p = new Player();
  p.x = 300;
  p.facingRight = true;
  p.update(DT, input(['KeyX'], -1), Infinity);
  assert.ok(p.vx < 0, 'left plus dash on the same tick must dash left');
  assert.equal(p.facingRight, false);
});
it('neutral dash keeps facing and cannot reverse partway through', () => {
  const p = new Player(); p.x = 300; p.facingRight = false;
  p.update(DT, input(['KeyX']), Infinity);
  assert.ok(p.vx < 0);
  p.update(DT, input(['KeyX'], 1), Infinity);
  assert.ok(p.vx < 0, 'active dash keeps its committed direction');
});
it('platform touchdown preserves the ninja double jump', () => {
  const p = airborneNinja();
  const top = p.y + p.height + 6;
  p.update(DT, input(['Space']), Infinity, [{ x: 180, y: top, width: 100, height: 12 }]);
  assert.ok(p.vy < 0);
  assert.equal(p.canDoubleJump, true);
});
it('moving away from a platform edge does not suppress double jump', () => {
  const p = airborneNinja();
  p.x = 279; p.vx = 300;
  p.update(DT, input(['Space'], 1), Infinity, [{ x: 180, y: p.y + p.height + 4, width: 100, height: 12 }]);
  assert.ok(p.vy < 0);
  assert.equal(p.canDoubleJump, false);
});
it('double jump remains available underneath a one-way platform', () => {
  const p = airborneNinja();
  p.update(DT, input(['Space']), Infinity, [{ x: 180, y: 250, width: 100, height: 12 }]);
  assert.ok(p.vy < 0, 'overhead platform must not swallow double jump');
  assert.equal(p.canDoubleJump, false);
});
