// LAST HUNT: KILLBOX — Weapon Crate Spawning & Management
import { TILE_SIZE, TILE } from './constants';
import { CRATES_CONFIG } from './config/crates.config';
import { WEAPON_CRATE_LOOT } from './config/weapons.config';
import { getTile, isSolid } from './worldGen';

export function spawnCrates(world, playerSpawnX, playerSpawnY) {
  const crates = [];
  let attempts = 0;
  const maxAttempts = CRATES_CONFIG.maxAttemptsToSpawn;

  while (crates.length < CRATES_CONFIG.spawnCount && attempts < maxAttempts) {
    attempts++;
    
    const tx = Math.floor(Math.random() * (world.tiles[0]?.length || 100));
    const ty = Math.floor(Math.random() * world.tiles.length);
    const x = tx * TILE_SIZE;
    const y = ty * TILE_SIZE;

    // Validation
    if (!isValidCrateSpawn(world, x, y, playerSpawnX, playerSpawnY, crates)) {
      continue;
    }

    // Create crate
    const crate = {
      id: Math.random().toString(36).slice(2, 9),
      x,
      y,
      w: CRATES_CONFIG.crateWidth,
      h: CRATES_CONFIG.crateHeight,
      health: CRATES_CONFIG.crateHealth,
      maxHealth: CRATES_CONFIG.crateHealth,
      opened: false,
      weapon: null,
    };

    crates.push(crate);
  }

  return crates;
}

function isValidCrateSpawn(world, x, y, playerSpawnX, playerSpawnY, existingCrates) {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);

  // Must be on solid ground
  const groundTile = getTile(world.tiles, tx, ty + 1);
  if (!isSolid(groundTile) && groundTile !== TILE.WATER) return false;

  // Can't be inside terrain
  const topTile = getTile(world.tiles, tx, ty);
  if (isSolid(topTile)) return false;

  // Distance from player spawn
  const distFromPlayer = Math.sqrt((x - playerSpawnX) ** 2 + (y - playerSpawnY) ** 2);
  if (distFromPlayer < CRATES_CONFIG.minDistanceFromPlayer) return false;

  // Distance from other crates
  for (const crate of existingCrates) {
    const dist = Math.sqrt((x - crate.x) ** 2 + (y - crate.y) ** 2);
    if (dist < CRATES_CONFIG.minDistanceFromOtherCrate) return false;
  }

  return true;
}

export function damageCrate(crate, damage) {
  if (crate.opened) return;
  crate.health -= damage;
  if (crate.health <= 0) {
    crate.opened = true;
    return true; // signals break
  }
  return false;
}

export function openCrate(crate) {
  if (!crate.opened) {
    crate.opened = true;
    // Select random weapon from loot table
    const totalWeight = WEAPON_CRATE_LOOT.reduce((sum, w) => sum + w.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const weapon of WEAPON_CRATE_LOOT) {
      roll -= weapon.weight;
      if (roll <= 0) {
        crate.weapon = weapon.id;
        return weapon.id;
      }
    }
    crate.weapon = WEAPON_CRATE_LOOT[0].id;
    return crate.weapon;
  }
  return null;
}

export function renderCrate(ctx, crate, camera) {
  const screenX = crate.x - camera.x;
  const screenY = crate.y - camera.y;

  ctx.save();
  ctx.translate(screenX + crate.w / 2, screenY + crate.h / 2);

  if (crate.opened) {
    // Broken crate — show damage
    ctx.fillStyle = '#5a4a2a';
    ctx.fillRect(-crate.w / 2, -crate.h / 2, crate.w, crate.h);
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 2;
    ctx.strokeRect(-crate.w / 2, -crate.h / 2, crate.w, crate.h);
    // Jagged break
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-5, -2, 3, 4);
    ctx.fillRect(2, 0, 4, 3);
  } else {
    // Intact wooden crate
    ctx.fillStyle = '#7a6a3a';
    ctx.fillRect(-crate.w / 2, -crate.h / 2, crate.w, crate.h);
    
    // Wooden plank detail
    ctx.strokeStyle = '#5a4a2a';
    ctx.lineWidth = 1;
    ctx.strokeRect(-crate.w / 2, -crate.h / 2, crate.w, crate.h);
    
    // Rope binding
    ctx.strokeStyle = '#8a7a4a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-crate.w / 2 + 2, 0);
    ctx.lineTo(crate.w / 2 - 2, 0);
    ctx.stroke();
    
    // Health indicator (visual bar)
    const healthPct = crate.health / crate.maxHealth;
    ctx.fillStyle = healthPct > 0.5 ? '#88ff88' : healthPct > 0.25 ? '#ffff88' : '#ff8888';
    ctx.fillRect(-crate.w / 2 + 1, crate.h / 2 + 1, (crate.w - 2) * healthPct, 2);
  }

  ctx.restore();
}