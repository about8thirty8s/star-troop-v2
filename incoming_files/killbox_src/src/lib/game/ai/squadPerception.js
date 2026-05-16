// SQUAD PERCEPTION SYSTEM — V2
// Full terrain scanning: gaps, obstacle height, climbables, cover, ledges.
// VULCAN P1 — Squad AI V2: smart navigation hardening.
import { TILE_SIZE, TILE } from '../constants';
import { getTile, isSolid } from '../worldGen';
import { SQUAD_CONFIG } from '../config/squad.config';

/**
 * Scans terrain ahead of a squad member and returns a rich info object
 * that navigation and jump-decision systems use to make intelligent choices.
 *
 * Key outputs:
 *   obstacleHeight      — tiles above feet level the obstacle rises (0 = clear)
 *   gapAhead            — true if next ground tile is missing (gap/cliff)
 *   gapWidth            — number of air tiles before ground resumes
 *   climbableNearby     — vine / ladder adjacent
 *   ledgeAbove          — elevated platform directly above reachable by jump
 *   landingSafe         — landing zone on far side of gap is solid
 *   requiresSingleJump  — obstacle/gap solvable with single jump
 *   requiresDoubleJump  — obstacle requires double jump
 *   impassable          — no jump will clear this; needs alternate route
 *   lowerRouteExists    — there is a path below/around the obstacle
 */
export function scanTerrainAhead(member, direction, tiles) {
  if (!tiles) return _emptyTerrain();

  const SCAN_DIST = 3; // tiles ahead to scan
  const memberTileX = Math.floor((member.x + member.w / 2) / TILE_SIZE);
  const memberTileY = Math.floor((member.y + member.h - 2) / TILE_SIZE); // feet tile

  // ── Obstacle height scan ──────────────────────────────────────────────────
  let obstacleHeight = 0;
  let blockingTile = null;
  for (let ahead = 1; ahead <= SCAN_DIST; ahead++) {
    const tx = memberTileX + direction * ahead;
    // Count solid tiles above feet level
    for (let up = 0; up <= 4; up++) {
      const tile = getTile(tiles, tx, memberTileY - up);
      if (isSolid(tile)) {
        obstacleHeight = Math.max(obstacleHeight, up + 1);
        blockingTile = tile;
        break;
      }
    }
    // Stop scanning further if we found a blocker in first tile
    if (ahead === 1 && obstacleHeight > 0) break;
  }

  // ── Gap / cliff detection ─────────────────────────────────────────────────
  let gapAhead = false;
  let gapWidth = 0;
  let landingSafe = false;

  const groundCheck = getTile(tiles, memberTileX + direction, memberTileY + 1);
  if (!isSolid(groundCheck)) {
    gapAhead = true;
    // Count gap width
    for (let g = 1; g <= 6; g++) {
      const gTile = getTile(tiles, memberTileX + direction * g, memberTileY + 1);
      if (isSolid(gTile)) {
        gapWidth = g - 1;
        landingSafe = true;
        break;
      }
    }
    if (gapWidth === 0) gapWidth = 6; // cliff / very wide gap
  }

  // ── Climbable check ───────────────────────────────────────────────────────
  const aheadTile = getTile(tiles, memberTileX + direction, memberTileY - 1);
  const climbableNearby = (
    aheadTile === TILE.VINE ||
    aheadTile === TILE.TIMBER_LADDER ||
    getTile(tiles, memberTileX, memberTileY - 1) === TILE.VINE
  );

  // ── Ledge above detection ─────────────────────────────────────────────────
  let ledgeAbove = false;
  for (let up = 2; up <= 5; up++) {
    const aboveTile = getTile(tiles, memberTileX + direction, memberTileY - up);
    const aboveFloor = getTile(tiles, memberTileX + direction, memberTileY - up + 1);
    if (!isSolid(aboveTile) && isSolid(aboveFloor)) {
      ledgeAbove = true;
      break;
    }
  }

  // ── Jump requirement analysis ─────────────────────────────────────────────
  // Single jump clears ~3 tiles height, double jump ~5 tiles
  const SINGLE_JUMP_TILES = 3;
  const DOUBLE_JUMP_TILES = 5;
  const MAX_GAP_SINGLE = 4;  // tiles wide
  const MAX_GAP_DOUBLE = 7;

  let requiresSingleJump = false;
  let requiresDoubleJump = false;
  let impassable = false;

  if (gapAhead) {
    if (gapWidth <= MAX_GAP_SINGLE && landingSafe) requiresSingleJump = true;
    else if (gapWidth <= MAX_GAP_DOUBLE && landingSafe) requiresDoubleJump = true;
    else impassable = true;
  } else if (obstacleHeight > 0) {
    if (obstacleHeight <= SINGLE_JUMP_TILES) requiresSingleJump = true;
    else if (obstacleHeight <= DOUBLE_JUMP_TILES) requiresDoubleJump = true;
    else impassable = true;
  }

  // ── Lower route check ─────────────────────────────────────────────────────
  let lowerRouteExists = false;
  if (impassable) {
    // Check if there's an opening 1 tile below
    const lowerTile = getTile(tiles, memberTileX + direction, memberTileY + 1);
    if (!isSolid(lowerTile)) lowerRouteExists = true;
  }

  // ── requiresJump (legacy compat) ──────────────────────────────────────────
  const requiresJump = requiresSingleJump || requiresDoubleJump;

  return {
    obstacleHeight,
    blockingTile,
    gapAhead,
    gapWidth,
    landingSafe,
    climbableNearby,
    ledgeAbove,
    requiresJump,
    requiresSingleJump,
    requiresDoubleJump,
    impassable,
    lowerRouteExists,
  };
}

function _emptyTerrain() {
  return {
    obstacleHeight: 0, blockingTile: null,
    gapAhead: false, gapWidth: 0, landingSafe: false,
    climbableNearby: false, ledgeAbove: false,
    requiresJump: false, requiresSingleJump: false, requiresDoubleJump: false,
    impassable: false, lowerRouteExists: false,
  };
}

export function detectThreats(member, hunter, player, tiles, firePatches) {
  const threats = [];

  if (hunter && hunter.alive) {
    const dist = Math.hypot(hunter.x - member.x, hunter.y - member.y);
    threats.push({
      type: dist < 120 ? 'melee_danger' : dist < 220 ? 'plasma_lock' : 'hunter',
      position: { x: hunter.x, y: hunter.y },
      distance: dist,
      severity: dist < 120 ? 1.0 : dist < 220 ? 0.75 : dist < 350 ? 0.4 : 0.15,
    });
  }

  if (firePatches && Array.isArray(firePatches)) {
    for (const fire of firePatches) {
      const dist = Math.hypot(fire.x - member.x, fire.y - member.y);
      if (dist < TILE_SIZE * 4) {
        threats.push({
          type: 'fire',
          position: { x: fire.x, y: fire.y },
          distance: dist,
          severity: Math.max(0.3, 1 - dist / (TILE_SIZE * 4)),
        });
      }
    }
  }

  threats.sort((a, b) => b.severity - a.severity);
  const topThreat = threats[0] || null;
  return { threats, topThreat };
}
