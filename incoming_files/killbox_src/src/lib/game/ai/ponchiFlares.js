// PONCHI TRIPWIRE FLARE SYSTEM
// Ponchi places up to 2 cheap early-warning flare tripwires at choke points.

import { TRIPWIRE_FLARE_CONFIG } from '../config/traps.config.js';
import { TILE, TILE_SIZE } from '../constants.js';
import { getTile } from '../worldGen.js';

/**
 * Score candidate flare locations
 * Evaluates choke points, approach paths, distance from player, and trap overlap
 */
export function scoreFlareLocation(candidate, world, player, existingFlares, hunter) {
  const { x, y } = candidate;
  
  let score = 0;

  // ─── Chokepoint scoring: narrow terrain favors detection ───
  // Bridges, tunnel mouths, ravines are naturally chokey
  const chokepointScore = evaluateChokepoint(x, y, world.tiles);
  score += chokepointScore * TRIPWIRE_FLARE_CONFIG.chokepointScoreWeight;

  // ─── Approach path scoring: likely hunter entry lanes ───
  // Flares near left/right edges and approach vectors
  const approachScore = evaluateApproachPath(x, y, hunter, world);
  score += approachScore * TRIPWIRE_FLARE_CONFIG.approachPathScoreWeight;

  // ─── Distance from player: not too close, not too far ───
  // Ideal range: 200-400px from player
  const dx = player.x - x;
  const dy = player.y - y;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy);
  const distScore = Math.max(0, 1.0 - Math.abs(distToPlayer - 300) / 300);
  score += distScore * TRIPWIRE_FLARE_CONFIG.distanceFromPlayerScoreWeight;

  // ─── Overlap penalty: existing flares nearby ───
  for (const flare of existingFlares) {
    const fdx = flare.x - x;
    const fdy = flare.y - y;
    const fDist = Math.sqrt(fdx * fdx + fdy * fdy);
    if (fDist < TRIPWIRE_FLARE_CONFIG.placementMinDistance) {
      score -= TRIPWIRE_FLARE_CONFIG.overlapTrapPenaltyWeight;
    }
  }

  // ─── Danger penalty: avoid placing in immediate threat zone ───
  // If hunter is very close and alert, penalize placements
  if (hunter && hunter.alive && hunter.alertLevel > 0.5) {
    const hx = hunter.x - x;
    const hy = hunter.y - y;
    const hunterDist = Math.sqrt(hx * hx + hy * hy);
    if (hunterDist < 150) {
      score -= TRIPWIRE_FLARE_CONFIG.dangerPenaltyWeight;
    }
  }

  return score;
}

/**
 * Evaluate if a location is naturally chokey
 */
function evaluateChokepoint(x, y, tiles) {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);

  // Count solid tiles in nearby area
  let solidCount = 0;
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const t = getTile(tiles, tx + dx, ty + dy);
      if (t !== TILE.AIR && t !== TILE.WATER) solidCount++;
    }
  }

  // High solid density = chokepoint
  return Math.min(1.0, solidCount / 15);
}

/**
 * Evaluate likelihood of hunter approach from this position
 */
function evaluateApproachPath(x, y, hunter, world) {
  // Favor positions near expected entry directions
  let score = 0;

  // If hunter entered from LEFT, favor right-side flares for early warning
  if (hunter && hunter.entrySide === 'LEFT') {
    // Score increases toward right side of map
    score = (x / world.width) * 0.5;
  } else {
    // If hunter entered from RIGHT, favor left-side flares
    score = (1.0 - x / world.width) * 0.5;
  }

  return score;
}

/**
 * Find candidate locations for flare placement
 * Scans perimeter and chokepoint areas
 */
export function findFlareLocations(world, player, hunter, searchRadius = 520) {
  const candidates = [];
  const GRID_STEP = 40;  // Sample every ~40px

  // Scan perimeter — left, right, top, bottom edges
  const width = world.width || (world.tiles[0].length * TILE_SIZE);
  const height = world.height || (world.tiles.length * TILE_SIZE);

  // Left edge
  for (let y = 100; y < height - 100; y += GRID_STEP) {
    if (isValidFlareSpot(100, y, world)) {
      candidates.push({ x: 100, y, zone: 'left' });
    }
  }

  // Right edge
  for (let y = 100; y < height - 100; y += GRID_STEP) {
    if (isValidFlareSpot(width - 100, y, world)) {
      candidates.push({ x: width - 100, y, zone: 'right' });
    }
  }

  // Bridges and narrow passages (manually scored)
  const bridgeSpots = scanForBridges(world);
  candidates.push(...bridgeSpots);

  return candidates;
}

/**
 * Check if a spot is valid for flare placement
 * Must be walkable, not inside terrain, not too close to player
 */
function isValidFlareSpot(x, y, world) {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);

  // Must be on solid ground or walkable
  const tile = getTile(world.tiles, tx, ty);
  const belowTile = getTile(world.tiles, tx, ty + 1);

  // Should be on walkable terrain
  if (tile === TILE.SOLID || tile === TILE.CRATE) return false;

  // Below should be support
  if (belowTile === TILE.AIR || belowTile === TILE.WATER) return false;

  return true;
}

/**
 * Scan for natural choke points like bridges
 */
function scanForBridges(world) {
  const spots = [];
  const GRID_STEP = 80;

  for (let y = 0; y < world.tiles.length; y += GRID_STEP) {
    for (let x = 0; x < world.tiles[0].length; x += GRID_STEP) {
      const tx = x * TILE_SIZE;
      const ty = y * TILE_SIZE;
      const tile = getTile(world.tiles, x, y);

      if (tile === TILE.BRIDGE || tile === TILE.TIMBER_LADDER) {
        spots.push({ x: tx, y: ty, zone: 'bridge' });
      }
    }
  }

  return spots;
}

/**
 * Check if Ponchi should place a flare now
 */
export function shouldPonchiPlaceFlare(member, gamePhase, activeFlareCount) {
  // Must be alive
  if (!member.alive) return false;

  // Must be in appropriate phase
  const appropriatePhase = gamePhase === 'PREP' || (gamePhase === 'HUNT' && member.stateTimer < 60);
  if (!appropriatePhase) return false;

  // Must not exceed max
  if (activeFlareCount >= TRIPWIRE_FLARE_CONFIG.maxPerPonchi) return false;

  // Behavior check: only if LOW_PROFILE or early in engagement
  return true;
}

/**
 * Create a flare trap object
 */
export function createFlare(x, y) {
  return {
    type: 'TRIPWIRE_FLARE',
    x, y,
    w: 12, h: 12,
    active: false,
    triggered: false,
    triggerTimer: 0,
    duration: TRIPWIRE_FLARE_CONFIG.flareDuration,
    wireLength: TRIPWIRE_FLARE_CONFIG.wireLength,
    triggerRadius: TRIPWIRE_FLARE_CONFIG.triggerRadius,
    lightRadius: TRIPWIRE_FLARE_CONFIG.lightRadius,
    revealDuration: TRIPWIRE_FLARE_CONFIG.revealDuration,
    noiseRadius: TRIPWIRE_FLARE_CONFIG.noiseRadius,
  };
}

/**
 * Check if hunter has crossed flare
 */
export function checkFlareHit(flare, hunter) {
  const dx = hunter.x - flare.x;
  const dy = hunter.y - flare.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist < flare.triggerRadius + hunter.w / 2;
}

/**
 * Trigger flare effects
 */
export function triggerFlare(flare, particles, events) {
  flare.triggered = true;
  flare.triggerTimer = flare.duration;

  // Bright red/orange flare particle burst
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    particles.push({
      x: flare.x,
      y: flare.y - 20,
      vx: Math.cos(angle) * speed,
      vy: -2 - Math.random() * 2,
      life: 20 + Math.random() * 10,
      color: i % 2 === 0 ? '#ff3300' : '#ffaa00',
      size: 2 + Math.random() * 2,
      type: 'glow',
    });
  }

  // Smoke trail
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: flare.x + (Math.random() - 0.5) * 10,
      y: flare.y - 15,
      vx: (Math.random() - 0.5) * 1.5,
      vy: -1 - Math.random() * 1.5,
      life: 30 + Math.random() * 20,
      color: 'rgba(200,100,50,0.6)',
      size: 4 + Math.random() * 4,
      type: 'smoke',
    });
  }

  // Emit events
  events.push({
    type: 'TRIPWIRE_FLARE_TRIGGERED',
    x: flare.x,
    y: flare.y,
    noiseRadius: flare.noiseRadius,
  });

  events.push({
    type: 'HUNTER_REVEALED_BY_FLARE',
    revealDuration: flare.revealDuration,
  });
}

/**
 * Update flare state
 */
export function updateFlare(flare) {
  if (flare.triggered && flare.triggerTimer > 0) {
    flare.triggerTimer--;
  }
}