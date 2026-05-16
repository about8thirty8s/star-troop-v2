// HUNTER ENTRY DIRECTION SYSTEM
// Hunter can enter from LEFT or RIGHT side, adding directional variance to gameplay.

import { HUNTER_ENTRY_CONFIG } from '../config/traps.config.js';
import { TILE, TILE_SIZE, WORLD_WIDTH, WORLD_HEIGHT } from '../constants.js';
import { getTile } from '../worldGen.js';

/**
 * Determine which side hunter enters from
 * Weighted random selection (can be improved to consider trap density later)
 */
export function chooseEntrySide() {
  const rand = Math.random();
  return rand < HUNTER_ENTRY_CONFIG.leftWeight ? 'LEFT' : 'RIGHT';
}

/**
 * Calculate spawn position for hunter based on entry side
 * Must find valid ground position within world bounds
 */
export function calculateHunterSpawnPosition(entrySide, world, player) {
  const padding = HUNTER_ENTRY_CONFIG.spawnPadding;
  const avoidRadius = HUNTER_ENTRY_CONFIG.avoidPlayerRadius;

  let spawnX, spawnY;

  if (entrySide === 'LEFT') {
    // Spawn on left side, outside world bounds, will enter from left
    spawnX = -padding;
    spawnY = 100 + Math.random() * (WORLD_HEIGHT - 200);

    // Find valid ground within bounds after entry
    return findValidSpawnInLane(spawnX, spawnY, 'LEFT', world, player, avoidRadius);
  } else {
    // Spawn on right side, outside world bounds, will enter from right
    spawnX = WORLD_WIDTH + padding;
    spawnY = 100 + Math.random() * (WORLD_HEIGHT - 200);

    return findValidSpawnInLane(spawnX, spawnY, 'RIGHT', world, player, avoidRadius);
  }
}

/**
 * Find a valid spawn lane by scanning for solid ground
 */
function findValidSpawnInLane(initialX, initialY, side, world, player, avoidRadius) {
  const SCAN_STEP = 40;
  const MAX_ATTEMPTS = 20;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const offset = attempt * SCAN_STEP;
    let x, y;

    if (side === 'LEFT') {
      x = 80 + offset;  // Scan rightward from left edge
    } else {
      x = WORLD_WIDTH - 80 - offset;  // Scan leftward from right edge
    }

    // Scan vertical lanes for ground
    for (let scanY = 100; scanY < WORLD_HEIGHT - 100; scanY += SCAN_STEP) {
      const tx = Math.floor(x / TILE_SIZE);
      const ty = Math.floor(scanY / TILE_SIZE);

      // Check if valid ground
      const tile = getTile(world.tiles, tx, ty);
      const belowTile = getTile(world.tiles, tx, ty + 1);

      // Must be on solid ground
      if ((tile === TILE.GRASS || tile === TILE.DIRT || tile === TILE.STONE) &&
          belowTile !== TILE.AIR) {
        
        y = scanY;

        // Check player avoidance
        const pdx = player.x - x;
        const pdy = player.y - y;
        const playerDist = Math.sqrt(pdx * pdx + pdy * pdy);

        if (playerDist > avoidRadius) {
          return { x, y };
        }
      }
    }
  }

  // Fallback: use initial position
  return { x: side === 'LEFT' ? 80 : WORLD_WIDTH - 80, y: 200 };
}

/**
 * Set hunter approach direction based on entry side
 */
export function setHunterApproachDirection(hunter, entrySide) {
  hunter.entrySide = entrySide;
  
  if (entrySide === 'LEFT') {
    hunter.facing = 1;  // Face right, approaching from left
  } else {
    hunter.facing = -1; // Face left, approaching from right
  }
}

/**
 * Get squad reaction to flare trigger direction
 */
export function getFlareDirection(flareX, mapWidth) {
  const centerX = mapWidth / 2;
  return flareX < centerX ? 'LEFT' : 'RIGHT';
}