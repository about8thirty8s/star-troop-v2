// LAST HUNT: KILLBOX - Trap System
import { TILE_SIZE, TILE } from './constants';
import { TRAPS_CONFIG, TRAP_SYSTEM_CONFIG } from './config/traps.config';
import { createExplosion } from './physics';
import { setTile } from './worldGen';
import { emit } from './core/eventBus';

// Re-export unified trap type map (keeps renderer/engine imports working)
export const TRAP_TYPES = TRAPS_CONFIG;
export const TRAP_LIST  = Object.keys(TRAPS_CONFIG);

export function createTrap(type, x, y) {
  const def = TRAPS_CONFIG[type];
  if (!def) throw new Error(`Unknown trap type: ${type}`);
  return {
    type,
    x, y,
    w: TILE_SIZE * 2,
    h: TILE_SIZE * (type === 'TREE_CRUSH' || type === 'FALLING_LOG' ? 3 : 2),
    armed: true,
    triggered: false,
    destroyed: false,
    damage: def.damage,
    stun: def.stun || 0,
    tier: def.tier,
    name: def.name,
    triggerTimer: 0,
    animFrame: 0,
    chainDelay: 0,
  };
}

export function canPlaceTrap(type, player) {
  const def = TRAPS_CONFIG[type];
  if (!def) return false;
  for (const [resource, amount] of Object.entries(def.cost)) {
    if ((player.resources[resource] || 0) < amount) return false;
  }
  return true;
}

export function placeTrap(type, x, y, player, traps, tiles) {
  const def = TRAPS_CONFIG[type];
  for (const [resource, amount] of Object.entries(def.cost)) {
    player.resources[resource] -= amount;
  }

  const trap = createTrap(type, x, y);

  if (def.digPit) {
    const tx = Math.floor(x / TILE_SIZE);
    const ty = Math.floor(y / TILE_SIZE);
    for (let dx = 0; dx < 2; dx++) {
      setTile(tiles, tx + dx, ty,     TILE.AIR);
      setTile(tiles, tx + dx, ty + 1, TILE.AIR);
    }
  }

  traps.push(trap);
  return trap;
}

export function updateTraps(traps, hunter, particles, tiles, firePatches) {
  const triggeredTraps = [];
  const { damageDealFrame, destroyAfterFrames } = TRAP_SYSTEM_CONFIG;

  for (const trap of traps) {
    if (trap.destroyed || !trap.armed) continue;

    if (trap.triggered) {
      trap.triggerTimer++;
      trap.animFrame++;

      if (trap.triggerTimer > trap.chainDelay + damageDealFrame) {
        if (!trap.damageDealt) {
          trap.damageDealt = true;
          triggeredTraps.push(trap);
          emit('TRAP_TRIGGERED', { trap, hunter });

          const def = TRAPS_CONFIG[trap.type];
          if (def?.isExplosive) {
            createExplosion(trap.x + trap.w / 2, trap.y + trap.h / 2,
              def.explosionRadius, tiles, particles, firePatches);
          } else {
            for (let i = 0; i < 8; i++) {
              particles.push({
                x: trap.x + trap.w / 2, y: trap.y + trap.h / 2,
                vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 5,
                life: 25, color: '#8a6a3a', size: 3, type: 'debris',
              });
            }
          }
        }
      }

      if (trap.triggerTimer > destroyAfterFrames) trap.destroyed = true;
      continue;
    }

    // Proximity check
    if (hunter && hunter.alive) {
      const overlap =
        hunter.x < trap.x + trap.w &&
        hunter.x + hunter.w > trap.x &&
        hunter.y < trap.y + trap.h &&
        hunter.y + hunter.h > trap.y;

      if (overlap) {
        const def = TRAPS_CONFIG[trap.type];
        const { alertTrapAvoidThreshold, alertLightTrapAvoidChance } = 
          // inline — avoids circular import
          { alertTrapAvoidThreshold: 0.7, alertLightTrapAvoidChance: 0.4 };

        if (hunter.alertLevel > alertTrapAvoidThreshold &&
            def?.tier === 'light' &&
            Math.random() > alertLightTrapAvoidChance) {
          continue;
        }
        trap.triggered = true;
        trap.triggerTimer = 0;
      }
    }
  }

  return triggeredTraps;
}

export function checkTrapChains(traps, triggeredTrap) {
  const { chainRadius, chainDelay } = TRAP_SYSTEM_CONFIG;
  for (const trap of traps) {
    if (trap === triggeredTrap || trap.triggered || trap.destroyed || !trap.armed) continue;
    const dist = Math.sqrt(
      (trap.x - triggeredTrap.x) ** 2 + (trap.y - triggeredTrap.y) ** 2
    );
    if (dist < chainRadius) {
      trap.triggered = true;
      trap.chainDelay = chainDelay;
      trap.triggerTimer = 0;
      emit('TRAP_CHAIN', { trap });
    }
  }
}