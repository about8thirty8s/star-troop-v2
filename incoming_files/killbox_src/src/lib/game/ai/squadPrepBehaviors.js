// SQUAD PREP BEHAVIORS — Post-tree-chopping autonomous tactical setup
// After trees are cleared, each squaddie pursues archetype-specific prep work:
//   MAC     → offensive trap placement (punji fields, tripwires)
//   BILLIE  → dig tunnel escape routes + elevated ambush spots
//   PONCHO  → defensive trap setups (snares, boulders, chokepoints)
//
// All members are LEASHED to the level — they never leave LEASH_MARGIN of world edges.

import { PIXEL_WORLD_W, TILE_SIZE } from '../constants';
import { getTile, setTile } from '../worldGen';
import { TILE } from '../constants';
import { createTrap } from '../traps';

// ── LEASH CONSTANTS ────────────────────────────────────────────────────────────
const LEASH_MARGIN      = 120;  // px from world edge — hard stop
const PLAYER_LEASH_DIST = 680;  // px — max distance from player before pulling back
const LEASH_PULL_SPEED  = 2.8;  // px/frame walk speed when being pulled back

// ── PREP TASK CONSTANTS ────────────────────────────────────────────────────────
const TRAP_PLACE_COOLDOWN  = 4.0;   // seconds between trap placements per member
const TRAP_SEARCH_RADIUS   = 320;   // px — search radius for good trap spots
const DIG_COOLDOWN         = 2.5;   // seconds between dig actions
const MIN_TRAP_SPACING     = 80;    // px — traps must be this far apart
const CHOKEPOINT_LOOK_DIST = 240;   // px — how far ahead to find chokepoints
const WANDER_BAND_HALF     = 300;   // px — wander stays within ±this of player

// ── RESOURCE MOCK (squad uses wood/rope from what was chopped) ─────────────────
// Squad members have their own resource pools (not player's)
// They accumulate from chopping trees. We grant them enough to work.
function ensureSquadResources(member) {
  if (!member.squadResources) {
    member.squadResources = { wood: 12, rope: 6, stone: 4, explosives: 0, mud: 0, metal: 0 };
  }
  // Passively accumulate resources over time (simulates collecting from fallen trees)
  if (!member._resourceTick) member._resourceTick = 0;
  member._resourceTick += 1/60;
  if (member._resourceTick > 8.0) {
    member._resourceTick = 0;
    member.squadResources.wood  = Math.min(20, member.squadResources.wood  + 2);
    member.squadResources.rope  = Math.min(10, member.squadResources.rope  + 1);
    member.squadResources.stone = Math.min(8,  member.squadResources.stone + 1);
  }
}

// ── WORLD LEASH ────────────────────────────────────────────────────────────────
// Call at the start of each member's update. Returns true if member is being
// pulled back to bounds (caller should skip normal movement logic).
export function enforceWorldLeash(member, player, tiles) {
  const minX = LEASH_MARGIN;
  const maxX = PIXEL_WORLD_W - LEASH_MARGIN - (member.w || 12);

  let pulling = false;

  // Hard boundary wall
  if (member.x < minX) {
    member.x  = minX;
    member.vx = Math.abs(member.vx) * 0.3;
    member.facing = 1;
    pulling = true;
  }
  if (member.x > maxX) {
    member.x  = maxX;
    member.vx = -Math.abs(member.vx) * 0.3;
    member.facing = -1;
    pulling = true;
  }

  // Soft player leash — if too far, walk back
  if (player) {
    const dx   = player.x - member.x;
    const dist = Math.abs(dx);
    if (dist > PLAYER_LEASH_DIST) {
      const dir  = dx > 0 ? 1 : -1;
      member.vx  = dir * LEASH_PULL_SPEED;
      member.facing = dir;
      member._debugState = `LEASH_RETURN dx=${Math.round(dx)}`;
      pulling = true;
    }
  }

  return pulling;
}

// ── MAIN PREP BEHAVIOR DISPATCHER ─────────────────────────────────────────────
// Called from squadOrchestrator when gamePhase=prep AND no trees remain in scan.
export function runPrepBehavior(member, player, tiles, traps, gameState) {
  if (!member.alive) return;
  ensureSquadResources(member);

  // Init prep state
  if (!member._prepPhase) member._prepPhase = 'SEEK';
  if (!member._prepCooldown) member._prepCooldown = 0;
  member._prepCooldown -= 1/60;

  const style = member.behaviorStyle || 'gung_ho';

  if (style === 'gung_ho') {
    _runMacPrep(member, player, tiles, traps);
  } else if (style === 'low_profile') {
    _runPonchoPrep(member, player, tiles, traps);
  } else if (style === 'tree_ambush') {
    _runBilliePrep(member, player, tiles, traps, gameState);
  }
}

// ── MAC — OFFENSIVE TRAP FIELDS ───────────────────────────────────────────────
// Mac plants Punji spike fields and tripwires along the Hunter's likely entry path.
// Targets: open ground near world edges (Hunter spawn zones), spacing them tactically.
function _runMacPrep(member, player, tiles, traps) {
  member._debugState = 'MAC_TRAP_PREP';

  if (member._prepCooldown > 0) {
    // Walk patrol pattern while waiting
    _patrolBand(member, player, 0.55);
    return;
  }

  // Find a good spot: open ground, near world edge, far from existing traps
  const hunterSide = _guessHunterSide(player);  // which edge Hunter likely enters from
  const targetX    = hunterSide === 'left'
    ? LEASH_MARGIN + 60 + Math.random() * 200
    : PIXEL_WORLD_W - LEASH_MARGIN - 260 + Math.random() * 200;

  const spot = _findGroundSpot(tiles, targetX, member.y);
  if (!spot) { _patrolBand(member, player, 0.5); return; }

  // Check spacing from existing traps
  const tooClose = (traps || []).some(t => Math.abs(t.x - spot.x) < MIN_TRAP_SPACING);
  if (tooClose) { member._prepCooldown = 1.5; _patrolBand(member, player, 0.4); return; }

  // Walk to spot
  const dist = Math.abs(member.x - spot.x);
  if (dist > 20) {
    const dir = spot.x > member.x ? 1 : -1;
    member.vx = dir * 2.8;
    member.facing = dir;
    member._prepPhase = 'MOVING';
    return;
  }

  // Arrived — place trap
  member.vx = 0;
  const trapType = member.squadResources.wood >= 3 ? 'PUNJI' : 'TRIPWIRE';
  const cost = { PUNJI: { wood:3, stone:2 }, TRIPWIRE: { rope:2 } };
  const c = cost[trapType];
  const canAfford = Object.entries(c).every(([r,a]) => (member.squadResources[r]||0) >= a);

  if (canAfford) {
    // Deduct resources
    for (const [r,a] of Object.entries(c)) member.squadResources[r] -= a;
    // Place trap in the world
    if (traps) {
      traps.push(createTrap(trapType, spot.x, spot.y));
    }
    // Bark
    member.currentBark = { text: _macBark(), life: 90 };
    member._prepCooldown = TRAP_PLACE_COOLDOWN;
    member._debugState = `MAC_PLACED ${trapType}`;
  } else {
    member._prepCooldown = 3.0;
  }
}

// ── PONCHO — CHOKEPOINT DEFENSE ───────────────────────────────────────────────
// Poncho identifies chokepoints (narrow terrain passages) and places snares/boulders.
// Also lays tripwire flares to give early warning.
function _runPonchoPrep(member, player, tiles, traps) {
  member._debugState = 'PONCHO_TRAP_PREP';

  if (member._prepCooldown > 0) {
    _patrolBand(member, player, 0.45);
    return;
  }

  // Find a chokepoint: a column of tiles where horizontal space is narrow
  const chokeX = _findChokepoint(tiles, member, player);
  if (!chokeX) { _patrolBand(member, player, 0.4); return; }

  const spot = _findGroundSpot(tiles, chokeX, member.y);
  if (!spot) { member._prepCooldown = 2.0; return; }

  const dist = Math.abs(member.x - spot.x);
  if (dist > 20) {
    const dir = spot.x > member.x ? 1 : -1;
    member.vx = dir * 2.2;
    member.facing = dir;
    return;
  }

  member.vx = 0;
  // Poncho prefers: SNARE (stops Hunter) > BOULDER (damage) > TRIPWIRE (cheap)
  let trapType = null;
  if ((member.squadResources.rope||0) >= 4 && (member.squadResources.wood||0) >= 2) trapType = 'SNARE';
  else if ((member.squadResources.stone||0) >= 6) trapType = 'BOULDER';
  else if ((member.squadResources.rope||0) >= 2) trapType = 'TRIPWIRE';

  const tooClose = (traps||[]).some(t => Math.abs(t.x - spot.x) < MIN_TRAP_SPACING);
  if (!trapType || tooClose) { member._prepCooldown = 2.5; return; }

  const cost = { SNARE:{rope:4,wood:2}, BOULDER:{stone:6,rope:2}, TRIPWIRE:{rope:2} };
  const c = cost[trapType];
  for (const [r,a] of Object.entries(c)) member.squadResources[r] -= a;
  if (traps) traps.push(createTrap(trapType, spot.x, spot.y));

  member.currentBark = { text: _ponchoBark(), life: 90 };
  member._prepCooldown = TRAP_PLACE_COOLDOWN;
  member._debugState = `PONCHO_PLACED ${trapType}`;
}

// ── BILLIE — TUNNEL NETWORK + ELEVATED AMBUSH ─────────────────────────────────
// Billie digs escape tunnels through dirt and creates elevated firing platforms.
// She uses the shovel to carve passages at strategic points.
function _runBilliePrep(member, player, tiles, traps, gameState) {
  member._debugState = 'BILLIE_DIG_PREP';

  if (member._prepCooldown > 0) {
    // Seek elevated positions while waiting
    _seekElevation(member, player, tiles);
    return;
  }

  // Billie digs tunnels: short horizontal passages through dirt/mud walls
  // Target: dig through solid terrain segments to create escape routes
  const digTarget = _findDigTarget(tiles, member, player);

  if (!digTarget) {
    // No good dig spot — place a SNARE instead from elevated position
    if ((member.squadResources.rope||0) >= 4) {
      const spot = _findGroundSpot(tiles, member.x + member.facing * 80, member.y);
      if (spot && traps) {
        const tooClose = traps.some(t => Math.abs(t.x - spot.x) < MIN_TRAP_SPACING);
        if (!tooClose) {
          member.squadResources.rope -= 4;
          member.squadResources.wood = Math.max(0, (member.squadResources.wood||0)-2);
          traps.push(createTrap('SNARE', spot.x, spot.y));
          member.currentBark = { text: 'Set.', life: 70 };
        }
      }
    }
    member._prepCooldown = 3.0;
    return;
  }

  // Move to dig position
  const dist = Math.abs(member.x - digTarget.x);
  if (dist > 16) {
    const dir = digTarget.x > member.x ? 1 : -1;
    member.vx = dir * 2.0;
    member.facing = dir;
    return;
  }

  // Dig the tile
  member.vx = 0;
  const tileX = Math.floor(digTarget.x / TILE_SIZE);
  const tileY = Math.floor(digTarget.y / TILE_SIZE);
  const current = getTile(tiles, tileX, tileY);

  const diggable = current === TILE.DIRT || current === TILE.GRASS || current === TILE.MUD;
  if (diggable && setTile) {
    setTile(tiles, tileX, tileY, TILE.EMPTY);
    // Also dig one above for head clearance
    const above = getTile(tiles, tileX, tileY - 1);
    if (above === TILE.DIRT || above === TILE.GRASS || above === TILE.MUD) {
      setTile(tiles, tileX, tileY - 1, TILE.EMPTY);
    }
    member.currentBark = { text: _billieBark(), life: 80 };
  }

  member._prepCooldown = DIG_COOLDOWN;
  member._debugState = 'BILLIE_DUG';
}

// ── HELPERS ────────────────────────────────────────────────────────────────────

function _patrolBand(member, player, speedFrac) {
  // Walk back and forth within the wander band around player
  const spd = 2.5 * speedFrac;
  const pX  = player ? player.x : PIXEL_WORLD_W / 2;
  const bandMin = Math.max(LEASH_MARGIN, pX - WANDER_BAND_HALF);
  const bandMax = Math.min(PIXEL_WORLD_W - LEASH_MARGIN, pX + WANDER_BAND_HALF);

  if (!member._patrolDir) member._patrolDir = 1;
  if (member.x >= bandMax - 20) member._patrolDir = -1;
  if (member.x <= bandMin + 20) member._patrolDir =  1;

  member.vx = member._patrolDir * spd;
  member.facing = member._patrolDir;
}

function _guessHunterSide(player) {
  // Hunter tends to enter from the edge furthest from the player
  if (!player) return 'left';
  return player.x < PIXEL_WORLD_W / 2 ? 'right' : 'left';
}

function _findGroundSpot(tiles, targetX, nearY) {
  if (!tiles) return null;
  const tileX = Math.max(1, Math.min(Math.floor(targetX / TILE_SIZE), 198));
  // Scan down from nearY to find solid ground
  for (let dy = 0; dy < 12; dy++) {
    const tY = Math.floor(nearY / TILE_SIZE) + dy;
    const above = getTile(tiles, tileX, tY - 1);
    const here  = getTile(tiles, tileX, tY);
    const isSolid = here === TILE.DIRT || here === TILE.GRASS || here === TILE.STONE ||
                    here === TILE.WOOD || here === TILE.MUD;
    const isOpen  = above === TILE.EMPTY || above === undefined || above === TILE.GRASS;
    if (isSolid && isOpen) {
      return { x: tileX * TILE_SIZE + TILE_SIZE/2, y: tY * TILE_SIZE };
    }
  }
  return null;
}

function _findChokepoint(tiles, member, player) {
  if (!tiles) return null;
  const startX = member.x - CHOKEPOINT_LOOK_DIST;
  const endX   = member.x + CHOKEPOINT_LOOK_DIST;
  let bestX = null, bestScore = 0;

  for (let px = startX; px < endX; px += TILE_SIZE * 2) {
    const tx = Math.floor(px / TILE_SIZE);
    // Count solid tiles in a vertical column — narrow columns are chokepoints
    let solidCount = 0;
    const groundY = Math.floor(member.y / TILE_SIZE);
    for (let dy = -3; dy <= 3; dy++) {
      const t = getTile(tiles, tx, groundY + dy);
      if (t === TILE.DIRT || t === TILE.STONE || t === TILE.WOOD) solidCount++;
    }
    // Score: moderate solid count = chokepoint (2-4 tiles), not 0 or 7
    const score = solidCount >= 2 && solidCount <= 4 ? (4 - Math.abs(solidCount - 3)) : 0;
    if (score > bestScore) { bestScore = score; bestX = px; }
  }
  return bestX;
}

function _findDigTarget(tiles, member, player) {
  if (!tiles) return null;
  // Look for a solid wall ahead in the direction of travel
  const dir   = member.facing || 1;
  const startX = member.x + dir * TILE_SIZE;
  const endX   = member.x + dir * 160;

  for (let px = startX; px < endX && px > 0 && px < PIXEL_WORLD_W; px += TILE_SIZE) {
    if (dir < 0 && px <= startX && px < member.x - 160) break;
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor((member.y + 8) / TILE_SIZE);
    const t  = getTile(tiles, tx, ty);
    const diggable = t === TILE.DIRT || t === TILE.GRASS || t === TILE.MUD;
    if (diggable) return { x: px, y: member.y + 8 };
  }
  return null;
}

function _seekElevation(member, player, tiles) {
  // Move toward nearest elevated platform
  member.vx = member.facing * 1.8;
  if (member.onGround && member.jumpCooldown <= 0) {
    const tX = Math.floor((member.x + member.facing * 20) / TILE_SIZE);
    const tY = Math.floor(member.y / TILE_SIZE);
    const tAbove = getTile(tiles, tX, tY - 2);
    // If there's ground two tiles above, it's an elevated platform — jump
    if (tAbove === TILE.DIRT || tAbove === TILE.GRASS || tAbove === TILE.WOOD || tAbove === TILE.STONE) {
      member.vy = -8.2;
      member.jumpCooldown = 1.0;
    }
  }
}

// Barks
function _macBark()    { return ['Trap set!','Cover this!','Punji field — don\'t step there!','Set.'][Math.floor(Math.random()*4)]; }
function _ponchoBark() { return ['Choke it off.','Set the line.','Hunter walks into this.','Covered.'][Math.floor(Math.random()*4)]; }
function _billieBark() { return ['Tunnel\'s open.','Dug through.','Escape route.','Clear.'][Math.floor(Math.random()*4)]; }
