import type { PlayerProjectile } from "../entities/player";

/** Register one distinct impact; pierce counts additional targets after this one. */
export function registerProjectileHit(projectile: PlayerProjectile, target: object): boolean {
  if (projectile.life <= 0 || projectile.hitTargets?.has(target)) return false;
  (projectile.hitTargets ??= new Set()).add(target);
  if ((projectile.pierce ?? 0) > 0) projectile.pierce = (projectile.pierce ?? 0) - 1;
  else projectile.life = 0;
  return true;
}
