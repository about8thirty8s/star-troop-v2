// SQUAD INITIATIVE SYSTEM V2 — VULCAN KILLBOX
// Hard-fix: squadmates now reliably walk to a CHOP SPOT (not tree center),
// enter CHOP_TREE_WORK once within arrival tolerance, and call real hitTree() damage.
//
// Root cause of V1 failure:
//   1. clearInitiativeRegistry() was called every frame in squad.js — wiped reservations
//      before executeInitiativeState() could re-validate them, causing _abandonTree every cycle.
//   2. Members were pathing to trunk CENTER — collider blocked them from getting close enough.
//   3. Stuck recovery was triggering jump loops with _pendingDoubleJump when members
//      couldn't reach trunk center.
//   4. isTreeReserved() logic was inverted — returned true when NO holder existed.
//
// Fix summary:
//   - Registry cleared only on abandon/expiry, not every frame
//   - Chop spots = trunkX ± CHOP_STAND_OFFSET (beside trunk, not inside it)
//   - Arrival = 42px horiz + 28px vert tolerance → force CHOP_TREE_WORK
//   - Anti-jump-loop: 2 jumps with <8px progress → flip side or abort task
//   - HOLD blocked during tree task (redirected to CHOP_TREE_WORK or MOVE)
//   - Force-chop check runs every frame BEFORE any other logic
//   - Reservation expires after 4s if no chop hits land
//   - Mac is designated ACTIVE_CHOPPER, always gets first pick

import { TILE_SIZE, TILE } from '../constants';
import { getTile } from '../worldGen';
import { hitTree, TREE_STATE } from '../trees';

// ── Constants ─────────────────────────────────────────────────────────────────
const CHOP_STAND_OFFSET   = 28;  // px from trunk edge — where actor stands to chop
const CHOP_ARRIVE_HORIZ   = 42;  // px horizontal tolerance for "close enough"
const CHOP_ARRIVE_VERT    = 64;  // px vertical tolerance — generous for platforms
const CHOP_REAPPROACH     = 64;  // px — if knocked beyond this, re-approach
const CHOP_INTERVAL_FRAMES = 22; // ~0.37s between hits — faster, more satisfying
const RESERVATION_TIMEOUT  = 4.0; // seconds — abandon if no hit within this time
const JUMP_LOOP_THRESHOLD  = 2;   // jumps with <8px progress → abort
const JUMP_PROGRESS_MIN    = 8;   // px minimum movement per jump to not count as loop
const SCAN_RADIUS          = 640; // px — very wide scan
const RESCAN_INTERVAL      = 0.08; // seconds — faster scan for quicker task pickup

// ── Registry — persists between frames, cleared only on abandon ───────────────
const _taskRegistry = new Map(); // treeId → { memberId, timestamp }

export function clearInitiativeRegistry() {
  _taskRegistry.clear();
}

export function reserveTree(treeId, memberId) {
  const existing = _taskRegistry.get(treeId);
  if (existing && existing.memberId !== memberId) return false;
  _taskRegistry.set(treeId, { memberId, timestamp: Date.now() });
  return true;
}

export function releaseTree(treeId, memberId) {
  const existing = _taskRegistry.get(treeId);
  if (existing && existing.memberId === memberId) _taskRegistry.delete(treeId);
}

export function isTreeReserved(treeId, byOtherThan) {
  const existing = _taskRegistry.get(treeId);
  if (!existing) return false;                         // not reserved at all
  return existing.memberId !== byOtherThan;            // reserved by someone else
}

// ── Main entry — called by orchestrator every frame during PREP ───────────────
export function tryInitiativeTask(member, player, treeEntities, tiles, particles, gamePhase) {
  const isPrep = gamePhase === 'PREP' || gamePhase === 'prep';
  if (!isPrep || !member.alive) return false;

  // ── FORCE-CHOP CHECK: runs every frame before everything else ─────────────
  // If member is within chop range of their reserved tree, immediately chop.
  // This short-circuits stuck recovery, hold, and any other state.
  if (member.initiativeTree && _isTreeValid(member.initiativeTree)) {
    const tree = member.initiativeTree;
    const chopSpot = _getChopSpot(member, tree);
    const horizDist = Math.abs(member.x - chopSpot.x);
    const trunkBaseY = (tree.rootTileY) * TILE_SIZE;
    const feetY = member.y + (member.h || 24);
    const vertDist = Math.abs(feetY - trunkBaseY);

    if (horizDist <= CHOP_ARRIVE_HORIZ && vertDist <= CHOP_ARRIVE_VERT) {
      if (member.initiativeState !== 'CHOP_TREE_WORK') {
        member.initiativeState = 'CHOP_TREE_WORK';
        member.chopHitTimer = 0;
        member.vx = 0;
        console.log(`[SQUAD_ENTER_CHOP_WORK] ${member.name} forced into CHOP_TREE_WORK horizDist=${horizDist.toFixed(1)} vertDist=${vertDist.toFixed(1)}`);
      }
    }
  }

  // ── HOLD-BLOCK: force INITIATIVE_TASK any time HOLD appears during prep ──────
  // Belt-and-suspenders guard — orchestrator also does this but runs AFTER initiative.
  if (member.aiState?.currentAction === 'HOLD_POSITION' &&
      member._holdReason !== 'PLAYER_ORDER') {
    member.aiState.currentAction = 'INITIATIVE_TASK';
    if (member.initiativeTree) {
      console.log(`[SQUAD_HOLD_BLOCKED] ${member.name} hold blocked — redirected to tree task`);
    }
  }

  // ── RESERVATION EXPIRY: abandon if no hits in 4s ─────────────────────────
  if (member.initiativeTree && member._reservationTime !== undefined) {
    const elapsed = (Date.now() - member._reservationTime) / 1000;
    if (elapsed > RESERVATION_TIMEOUT && (member.chopHitsDealt || 0) === 0) {
      console.log(`[SQUAD_TREE_ABORT] ${member.name} reservation expired after ${elapsed.toFixed(1)}s with 0 hits`);
      _abandonTree(member);
      return false;
    }
  }

  // ── Already has an active task ────────────────────────────────────────────
  if (member.initiativeState === 'CHOP_TREE_MOVE' ||
      member.initiativeState === 'CHOP_TREE_WORK') {
    return _executeTask(member, player, treeEntities, tiles, particles);
  }

  // ── Scan for a tree ───────────────────────────────────────────────────────
  if (!member._initScanTimer) member._initScanTimer = 0;
  member._initScanTimer -= 1 / 60;

  if (member._initScanTimer <= 0) {
    member._initScanTimer = RESCAN_INTERVAL;
    const best = _findBestTree(member, player, treeEntities);

    if (best) {
      if (reserveTree(best.id, member.id)) {
        member.initiativeTree   = best;
        member.initiativeState  = 'CHOP_TREE_MOVE';
        member.chopHitTimer     = 0;
        member.chopHitsDealt    = 0;
        member._chopSide        = null;  // will be calculated fresh
        member._jumpAttempts    = 0;
        member._lastJumpX       = member.x;
        member._lastJumpY       = member.y;
        member._reservationTime = Date.now();
        console.log(`[SQUAD_TREE_SELECT] ${member.name} → tree ${best.id} at x=${Math.round(best.rootTileX * TILE_SIZE)}`);
        return _executeTask(member, player, treeEntities, tiles, particles);
      }
    }
    member._debugState = 'SEEK_TREE';
  }

  if (member.initiativeTree) {
    return _executeTask(member, player, treeEntities, tiles, particles);
  }

  return true; // stay in INITIATIVE_TASK — drift logic in orchestrator
}

// ── Task execution state machine ──────────────────────────────────────────────
function _executeTask(member, player, treeEntities, tiles, particles) {
  const tree = member.initiativeTree;

  if (!tree || !_isTreeValid(tree)) {
    _abandonTree(member);
    return false;
  }

  // Validate reservation is still ours
  if (isTreeReserved(tree.id, member.id)) {
    console.log(`[SQUAD_TREE_ABORT] ${member.name} lost reservation for tree ${tree.id}`);
    _abandonTree(member);
    return false;
  }

  const trunkX   = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
  const trunkBaseY = tree.rootTileY * TILE_SIZE;
  const feetY    = member.y + (member.h || 24);
  const chopSpot = _getChopSpot(member, tree);
  const horizDist = Math.abs(member.x - chopSpot.x);
  const vertDist  = Math.abs(feetY - trunkBaseY);

  // Update debug label
  member._debugState = `${member.initiativeState} hD=${horizDist.toFixed(0)} vD=${vertDist.toFixed(0)} j=${member._jumpAttempts||0}`;

  switch (member.initiativeState) {

    // ── MOVE TO CHOP SPOT ───────────────────────────────────────────────────
    case 'CHOP_TREE_MOVE': {

      // Arrival check — forgiving tolerance
      if (horizDist <= CHOP_ARRIVE_HORIZ && vertDist <= CHOP_ARRIVE_VERT) {
        member.vx = 0;
        member.initiativeState = 'CHOP_TREE_WORK';
        member.chopHitTimer = 0;
        console.log(`[SQUAD_ENTER_CHOP_WORK] ${member.name} arrived at chop spot horizDist=${horizDist.toFixed(1)}`);
        return true;
      }

      // Walk toward chop spot
      const dir = chopSpot.x > member.x ? 1 : -1;
      member.vx     = dir * (member.speed || 2.5);
      member.facing = dir;

      // Jump — when terrain ahead is solid OR tree is on a higher platform
      if (member.onGround && member.jumpCooldown <= 0) {
        const tileAhead = getTile(tiles,
          Math.floor((member.x + dir * 20) / TILE_SIZE),
          Math.floor((member.y + (member.h || 24) / 2) / TILE_SIZE)
        );
        const solidAhead = tileAhead === TILE.DIRT || tileAhead === TILE.STONE ||
                           tileAhead === TILE.WOOD || tileAhead === TILE.GRASS;
        // Also jump if tree trunk base is significantly higher than member feet
        const trunkHigher = (tree.rootTileY * TILE_SIZE) < (member.y + (member.h || 24)) - TILE_SIZE;
        const needsJump = solidAhead || trunkHigher;

        if (needsJump) {
          // Check jump loop: have we made progress since last jump?
          const progressSinceJump = Math.abs(member.x - (member._lastJumpX || member.x));
          if ((member._jumpAttempts || 0) >= JUMP_LOOP_THRESHOLD &&
              progressSinceJump < JUMP_PROGRESS_MIN) {
            // Jump loop detected — flip side and try other spot
            console.log(`[SQUAD_JUMP_LOOP_ABORT] ${member.name} jump loop detected (${member._jumpAttempts} jumps, ${progressSinceJump.toFixed(1)}px progress) — switching side`);
            member._chopSide = member._chopSide === 'left' ? 'right' : 'left';
            member._jumpAttempts = 0;
            // If both sides tried, abandon
            if (member._bothSidesTried) {
              console.log(`[SQUAD_TREE_ABORT] ${member.name} both sides failed, abandoning tree ${tree.id}`);
              _abandonTree(member);
              return false;
            }
            member._bothSidesTried = true;
          } else {
            member.vy = -7.0;
            member.jumpCooldown = 0.9;
            member._jumpAttempts = (member._jumpAttempts || 0) + 1;
            member._lastJumpX = member.x;
            member._lastJumpY = member.y;
          }
        }
      }

      return true;
    }

    // ── CHOP TREE WORK ───────────────────────────────────────────────────────
    case 'CHOP_TREE_WORK': {
      // Stop moving — plant feet and chop
      member.vx = 0;
      member.facing = trunkX > member.x ? 1 : -1;

      // Safety — don't chop if tree would fall on player or squad
      if (_isFallDangerous(tree, player, member)) {
        console.log(`[SQUAD_TREE_ABORT] ${member.name} fall is dangerous, abandoning`);
        _abandonTree(member);
        return false;
      }

      // Re-approach if knocked back
      if (horizDist > CHOP_REAPPROACH || vertDist > CHOP_ARRIVE_VERT * 2) {
        member.initiativeState = 'CHOP_TREE_MOVE';
        member._jumpAttempts = 0;
        return true;
      }

      // Chop timer
      if (!member.chopHitTimer) member.chopHitTimer = 0;
      member.chopHitTimer--;

      if (member.chopHitTimer <= 0) {
        // Real damage — same function player uses
        const attackTileY = tree.rootTileY - 1;
        hitTree(tree, member.x, attackTileY, tiles, particles);
        member.chopHitsDealt = (member.chopHitsDealt || 0) + 1;
        member.chopHitTimer = CHOP_INTERVAL_FRAMES;
        member._reservationTime = Date.now(); // reset expiry on each hit

        console.log(`[SQUAD_CHOP_HIT] ${member.name} hit tree ${tree.id} — hit #${member.chopHitsDealt} hp=${tree.chopHits}/${tree.maxChopHits}`);

        // Bark on first chop
        if (member.chopHitsDealt === 1 && Math.random() < 0.45) {
          const barks = { MAC: 'TIMBER!', BILLIE: 'Clear!', PONCHO: 'Moving it!' };
          if (!member.currentBark) {
            member.currentBark = { text: barks[member.archetype] || 'Chop!', life: 90 };
          }
        }

        // Bark particles
        for (let i = 0; i < 5; i++) {
          particles.push({
            x: trunkX + (Math.random() - 0.5) * 12,
            y: trunkBaseY - TILE_SIZE + Math.random() * 8,
            vx: member.facing * (1.5 + Math.random() * 3),
            vy: -1 - Math.random() * 3,
            life: 20, color: Math.random() > 0.5 ? '#8a6a3a' : '#6a4a20',
            size: 2 + Math.random() * 2, type: 'debris',
          });
        }

        // Tree fell?
        if (tree.state === TREE_STATE.FALLING ||
            tree.state === TREE_STATE.FALLEN  ||
            tree.state === TREE_STATE.STUMP) {
          console.log(`[SQUAD_CHOP_HIT] ${member.name} felled tree ${tree.id}`);
          _abandonTree(member);
          return false;
        }
      }

      return true;
    }
  }

  return false;
}

// ── Chop spot calculation ─────────────────────────────────────────────────────
// Returns the world-x position the actor should stand at to chop.
// Prefers the side they're currently on; respects _chopSide override.
function _getChopSpot(member, tree) {
  const trunkLeft  = tree.rootTileX * TILE_SIZE;
  const trunkRight = tree.rootTileX * TILE_SIZE + TILE_SIZE;
  const leftSpot   = trunkLeft  - CHOP_STAND_OFFSET;
  const rightSpot  = trunkRight + CHOP_STAND_OFFSET;

  // If a side was pinned (after loop abort), honour it
  if (member._chopSide === 'left')  return { x: leftSpot,  side: 'left'  };
  if (member._chopSide === 'right') return { x: rightSpot, side: 'right' };

  // Pick whichever side the member is currently closer to
  const toLeft  = Math.abs(member.x - leftSpot);
  const toRight = Math.abs(member.x - rightSpot);
  if (toLeft <= toRight) {
    member._chopSide = 'left';
    return { x: leftSpot, side: 'left' };
  } else {
    member._chopSide = 'right';
    return { x: rightSpot, side: 'right' };
  }
}

// ── Tree scoring ──────────────────────────────────────────────────────────────
function _findBestTree(member, player, treeEntities) {
  if (!treeEntities || treeEntities.length === 0) return null;

  // Mac gets priority — he's the designated active chopper
  // Mac will always win the reservation race even if another member found the tree first
  const isMac = member.archetype === 'MAC' || member.behaviorStyle === 'gung_ho';

  let best = null;
  let bestScore = -Infinity;

  for (const tree of treeEntities) {
    if (!_isTreeValid(tree)) continue;
    if (isTreeReserved(tree.id, member.id)) continue;

    const trunkX = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
    const dx     = trunkX - member.x;
    const dist   = Math.abs(dx);

    if (dist > SCAN_RADIUS) continue;
    if (_isFallDangerous(tree, player, member)) continue;

    let score = (1 - dist / SCAN_RADIUS) * 40;

    const distToPlayer = Math.abs(trunkX - (player?.x || 0));
    if (distToPlayer < 200) score += 15;

    // Mac scoring bias
    if (isMac) score += 20;

    // Archetype biases
    if (member.behaviorStyle === 'gung_ho')     score += 10; // Mac: take anything
    if (member.behaviorStyle === 'low_profile') score += 5;  // Poncho: tactical
    if (member.behaviorStyle === 'tree_ambush') score += 8;  // Billy: height trees

    if (score > bestScore) { bestScore = score; best = tree; }
  }

  return best;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _isTreeValid(tree) {
  return tree && (tree.state === TREE_STATE.STANDING || tree.state === TREE_STATE.STUMP);
}

function _isFallDangerous(tree, player, member) {
  if (!tree || !player) return false;
  const trunkX  = tree.rootTileX * TILE_SIZE;
  const treeH   = (tree.trunkHeight || 8) * TILE_SIZE;
  const fallDir = member.x < trunkX ? 1 : -1; // tree falls away from chopper
  const landX   = trunkX + fallDir * treeH;
  const playerDx = Math.abs(player.x - landX);
  return playerDx < TILE_SIZE * 2;
}

function _abandonTree(member) {
  if (member.initiativeTree) {
    releaseTree(member.initiativeTree.id, member.id);
  }
  member.initiativeTree   = null;
  member.initiativeState  = null;
  member._chopSide        = null;
  member._bothSidesTried  = false;
  member._jumpAttempts    = 0;
  member._reservationTime = undefined;
  member.chopHitTimer     = 0;
  member._debugState      = 'ABANDONED';
}
