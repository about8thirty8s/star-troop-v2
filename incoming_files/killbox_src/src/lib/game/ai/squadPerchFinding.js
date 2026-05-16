// TREE AMBUSH PERCH FINDING — V2
// Finds, scores, and builds step-by-step routes to elevated ambush positions.
// Fixed: route building no longer checks member-origin reachability for every node.
// VULCAN P1 — Squad AI V2.
import { TILE_SIZE, TILE } from '../constants';
import { getTile, isSolid } from '../worldGen';
import { SQUAD_CONFIG } from '../config/squad.config';

const SEARCH_TILE_RADIUS = 10; // tiles to scan for perches
const MAX_STAGING_NODES  = 3;  // max intermediate stepping stones

/**
 * Find nearby elevated ambush positions.
 * Scans: tree canopy tops, terrain ledges, raised platforms.
 * Returns array sorted best-first by score.
 */
export function findNearbyPerches(member, world, hunter) {
  const perches = [];
  const cfg = SQUAD_CONFIG.treeAmbush || {};
  const searchRadius = (cfg.stagingSearchRadius || 300) + 100;

  // ── Standing tree canopy tops ─────────────────────────────────────────────
  if (world.treeEntities && Array.isArray(world.treeEntities)) {
    for (const tree of world.treeEntities) {
      if (tree.state !== 'standing') continue;
      const perchX = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
      const perchY = (tree.rootTileY - tree.height) * TILE_SIZE - 20;
      const dist = Math.hypot(perchX - member.x, perchY - member.y);
      if (dist > searchRadius) continue;
      perches.push({
        id: `tree_${tree.rootTileX}_${tree.rootTileY}`,
        type: 'tree',
        x: perchX,
        y: perchY,
        score: scorePerch(perchX, perchY, member, hunter),
        treeRef: tree,
      });
    }
  }

  // ── Terrain ledges (solid tile, open above, open below) ───────────────────
  if (world.tiles) {
    const mtx = Math.floor(member.x / TILE_SIZE);
    const mty = Math.floor(member.y / TILE_SIZE);
    for (let tx = mtx - SEARCH_TILE_RADIUS; tx <= mtx + SEARCH_TILE_RADIUS; tx++) {
      for (let ty = mty - SEARCH_TILE_RADIUS; ty <= mty - 2; ty++) {
        const tile      = getTile(world.tiles, tx, ty);
        const above     = getTile(world.tiles, tx, ty - 1);
        const below     = getTile(world.tiles, tx, ty + 1);
        // Surface: solid with walkable space above it and open air below
        if (isSolid(tile) && !isSolid(above) && !isSolid(below)) {
          const px = tx * TILE_SIZE + TILE_SIZE / 2;
          const py = ty * TILE_SIZE;
          const dist = Math.hypot(px - member.x, py - member.y);
          if (dist > searchRadius) continue;
          const score = scorePerch(px, py, member, hunter);
          if (score > 0.25) {
            perches.push({
              id: `ledge_${tx}_${ty}`,
              type: 'ledge',
              x: px, y: py,
              score,
            });
          }
        }
      }
    }
  }

  return perches.sort((a, b) => b.score - a.score);
}

function scorePerch(px, py, member, hunter) {
  const cfg = SQUAD_CONFIG.treeAmbush || {};

  // Height advantage (higher = better)
  const heightDiff = member.y - py; // positive if perch above member
  const heightScore = Math.max(0, Math.min(1, heightDiff / 250)) * (cfg.heightAdvantageWeight || 0.45);

  // Hunter proximity (some distance = better shooting lane, too close = danger)
  let hunterScore = 0.3;
  if (hunter && hunter.alive) {
    const hd = Math.hypot(px - hunter.x, py - hunter.y);
    hunterScore = Math.min(1, hd / 350) * (cfg.distanceToHunterWeight || 0.3);
  }

  // Reachability bonus
  const reachScore = _roughlyReachable(member, px, py) ? (cfg.reachabilityWeight || 0.25) : 0;

  return Math.min(1, heightScore + hunterScore + reachScore);
}

/**
 * Rough reachability — double-jump envelope check.
 * Does NOT trace full route; just gates obviously unreachable perches.
 */
function _roughlyReachable(member, px, py) {
  const cfg = SQUAD_CONFIG.treeAmbush || {};
  const dx = Math.abs(px - member.x);
  const dy = member.y - py; // positive if above
  const maxH = cfg.doubleJumpMaxHeight || 160;
  const maxW = cfg.maxHorizontalJumpDistance || 100;
  return dy >= -20 && dy <= maxH && dx <= maxW * 3; // wider horizontal allowance for multi-step routes
}

/**
 * Per-position reachability for individual route nodes.
 */
export function isPerchReachable(member, tx, ty) {
  const cfg = SQUAD_CONFIG.treeAmbush || {};
  const dx = Math.abs(tx - member.x);
  const dy = member.y - ty;
  return (
    dx <= (cfg.maxHorizontalJumpDistance || 100) &&
    dy >= -10 &&
    dy <= (cfg.doubleJumpMaxHeight || 160) + 30
  );
}

export function canReachPositionWithDoubleJump(member, tx, ty) {
  return isPerchReachable(member, tx, ty);
}

/**
 * Find intermediate stepping-stone platforms between member and perch.
 * Returns up to MAX_STAGING_NODES platforms ordered closest-to-member first.
 */
export function findStagingPointsToPerch(member, perch, world) {
  if (!world.tiles) return [];
  const staging = [];
  const mtx = Math.floor(member.x / TILE_SIZE);
  const mty = Math.floor(member.y / TILE_SIZE);

  for (let tx = mtx - 8; tx <= mtx + 8; tx++) {
    for (let ty = mty - 10; ty <= mty + 1; ty++) {
      const tile  = getTile(world.tiles, tx, ty);
      const below = getTile(world.tiles, tx, ty + 1);
      // Walkable surface: open air with solid below
      if (!isSolid(tile) && isSolid(below)) {
        const sx = tx * TILE_SIZE + TILE_SIZE / 2;
        const sy = ty * TILE_SIZE - 2;
        // Must be between member height and perch height
        if (sy >= perch.y - 10 && sy <= member.y + 10) continue; // not useful
        if (sy < perch.y - 10) continue; // too high (above perch)
        const dtp = Math.hypot(sx - perch.x, sy - perch.y);
        const dtm = Math.hypot(sx - member.x, sy - member.y);
        if (dtm > 400) continue; // too far from member
        staging.push({ x: sx, y: sy, dtp, dtm });
      }
    }
  }

  return staging
    .sort((a, b) => a.dtp - b.dtp)
    .slice(0, MAX_STAGING_NODES);
}

/**
 * Build a route from member to perch via staging nodes.
 * V2 fix: each node's reachability is checked from the PREVIOUS node,
 * not always from member origin (that was the old bug).
 */
export function buildPerchRoute(member, perch, world) {
  const cfg = SQUAD_CONFIG.treeAmbush || {};

  // Direct reach — one-hop route
  if (isPerchReachable(member, perch.x, perch.y)) {
    return [{ pos: { x: perch.x, y: perch.y }, type: 'perch_target', id: perch.id }];
  }

  const staging = findStagingPointsToPerch(member, perch, world);
  const route = [];

  // Build chain: check each staging node from the previous position
  let prevPos = { x: member.x, y: member.y };
  for (const stage of staging) {
    // Check reachability from prev position (not member origin)
    const dx = Math.abs(stage.x - prevPos.x);
    const dy = prevPos.y - stage.y;
    const maxH = (cfg.doubleJumpMaxHeight || 160) + 30;
    const maxW = cfg.maxHorizontalJumpDistance || 100;
    if (dx <= maxW && dy >= -10 && dy <= maxH) {
      route.push({ pos: { x: stage.x, y: stage.y }, type: 'staging_platform', id: `s_${stage.x}_${stage.y}` });
      prevPos = { x: stage.x, y: stage.y };
    }
  }

  // Add final perch if reachable from last node
  const dx = Math.abs(perch.x - prevPos.x);
  const dy = prevPos.y - perch.y;
  if (dx <= (cfg.maxHorizontalJumpDistance || 100) && dy >= -10 && dy <= (cfg.doubleJumpMaxHeight || 160) + 30) {
    route.push({ pos: { x: perch.x, y: perch.y }, type: 'perch_target', id: perch.id });
  }

  return route.length > 0 ? route : null;
}
