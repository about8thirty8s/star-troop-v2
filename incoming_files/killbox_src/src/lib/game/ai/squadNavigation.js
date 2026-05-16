// SQUAD NAVIGATION — V2
// Smart movement decision tree. No more blind jumping.
// VULCAN P1 — Squad AI V2.
import { TILE_SIZE, TILE } from '../constants';
import { getTile, isSolid } from '../worldGen';
import { scanTerrainAhead } from './squadPerception';
import { SQUAD_CONFIG } from '../config/squad.config';
import {
  findNearbyPerches, buildPerchRoute, canReachPositionWithDoubleJump,
} from './squadPerchFinding';

const SINGLE_JUMP_VEL  = -6.5;
const DOUBLE_JUMP_VEL  = -5.8;
const LEDGE_JUMP_VEL   = -8.2;
const EVASION_JUMP_VEL = -7.0;

/**
 * DECISION TREE — before jumping, evaluate all options in order.
 * Returns { shouldJump, jumpVelocity, reason } or { shouldJump: false }.
 */
export function decideJump(member, tiles, direction, context = {}) {
  // Hard gate: cooldown or airborne
  if (member.jumpCooldown > 0) return _noJump();
  if (!member.onGround)        return _noJump();

  const terrain = scanTerrainAhead(member, direction, tiles);

  // ── Emergency evasion (plasma/melee danger) ───────────────────────────────
  if (context.emergency) {
    if (terrain.landingSafe || (!terrain.gapAhead && !terrain.impassable)) {
      return { shouldJump: true, jumpVelocity: EVASION_JUMP_VEL, reason: 'EMERGENCY_EVADE' };
    }
    return _noJump();
  }

  // ── Nothing blocking → don't jump ────────────────────────────────────────
  if (!terrain.requiresJump && !terrain.ledgeAbove) return _noJump();

  // ── Impassable: find alternate route instead ──────────────────────────────
  if (terrain.impassable) {
    if (!terrain.lowerRouteExists) {
      // Mark member so orchestrator can search alternate path
      member._needsAlternatePath = true;
    }
    return _noJump();
  }

  // ── Gap crossing ──────────────────────────────────────────────────────────
  if (terrain.gapAhead && terrain.landingSafe) {
    if (terrain.requiresDoubleJump) {
      // Signal that second jump will be needed mid-air
      member._pendingDoubleJump = true;
      return { shouldJump: true, jumpVelocity: SINGLE_JUMP_VEL, reason: 'GAP_DOUBLE' };
    }
    return { shouldJump: true, jumpVelocity: SINGLE_JUMP_VEL, reason: 'GAP_SINGLE' };
  }

  // ── Obstacle clear ────────────────────────────────────────────────────────
  if (terrain.obstacleHeight > 0) {
    if (terrain.requiresSingleJump) {
      return { shouldJump: true, jumpVelocity: SINGLE_JUMP_VEL, reason: 'OBSTACLE_SINGLE' };
    }
    if (terrain.requiresDoubleJump) {
      member._pendingDoubleJump = true;
      return { shouldJump: true, jumpVelocity: SINGLE_JUMP_VEL, reason: 'OBSTACLE_DOUBLE' };
    }
  }

  // ── Ledge / elevated platform within reach ────────────────────────────────
  if (terrain.ledgeAbove && !terrain.impassable) {
    return { shouldJump: true, jumpVelocity: LEDGE_JUMP_VEL, reason: 'LEDGE_UP' };
  }

  return _noJump();
}

/**
 * Second jump trigger — called every frame when member is airborne.
 * Only fires if the first jump set _pendingDoubleJump.
 */
export function checkDoubleJump(member) {
  if (!member._pendingDoubleJump) return false;
  if (member.onGround) {
    // Landed already, clear flag
    member._pendingDoubleJump = false;
    return false;
  }
  // Fire second jump at apex (vy approaching 0 from negative)
  if (member.vy >= -1.5 && member.vy <= 2.0) {
    member._pendingDoubleJump = false;
    member.jumpsUsedInAir = 2;
    return true;
  }
  return false;
}

/**
 * MULTI-STAGE STUCK RECOVERY — V3
 * Tighter timers, pit-aware escape, always-on teleport (not just offscreen).
 *
 * Stages:
 *   0-0.4s  ASSESS       → reverse-walk, scan for pit
 *   0.4-1.0s VAULT       → high jump toward open side (pit escape)
 *   1.0-1.8s AGGRESSIVE  → repeated jump + run toward player
 *   1.8s+   TELEPORT     → always teleport near player (not just offscreen)
 */
export function handleStuckRecovery(member, tiles, dt) {
  if (!member.stuckTimer) member.stuckTimer = 0;
  member.stuckTimer += dt;
  const t = member.stuckTimer;

  // ── PIT DETECTION ──────────────────────────────────────────────────────────
  // Scan left and right: count open tiles above to determine which side of the
  // pit is more escapable. Jump hard toward that side.
  function detectPitEscape() {
    if (!tiles || !member.onGround) return { inPit: false, escapeDir: member.facing };
    const tX  = Math.floor(member.x / TILE_SIZE);
    const tY  = Math.floor(member.y / TILE_SIZE);
    let leftOpen = 0, rightOpen = 0;
    // Scan 4 tiles up on each side
    for (let dy = 1; dy <= 5; dy++) {
      const tL = getTile(tiles, tX - 1, tY - dy);
      const tR = getTile(tiles, tX + 1, tY - dy);
      const isSolidL = tL && tL !== 'air' && tL !== 'empty' && tL !== 'bridge';
      const isSolidR = tR && tR !== 'air' && tR !== 'empty' && tR !== 'bridge';
      if (!isSolidL) leftOpen++;
      if (!isSolidR) rightOpen++;
    }
    const inPit = leftOpen < 3 || rightOpen < 3; // at least one side walled
    const escapeDir = rightOpen >= leftOpen ? 1 : -1; // jump toward more open side
    return { inPit, escapeDir, leftOpen, rightOpen };
  }

  // Stage 1: micro-reposition + pit scan
  if (t < 0.4) {
    const pit = detectPitEscape();
    member.vx = pit.inPit ? pit.escapeDir * 2.0 : -member.facing * 1.5;
    member._pitEscapeDir = pit.escapeDir;
    return { active: true, phase: 'ASSESS', action: 'reverse_walk', reason: null };
  }

  // Stage 2: aggressive jump toward open side (pit escape)
  if (t < 1.0) {
    const escDir = member._pitEscapeDir || member.facing;
    member.vx = escDir * 3.5; // strong horizontal push
    member.facing = escDir;
    if (member.onGround && member.jumpCooldown <= 0) {
      member.vy = -9.5;  // very high jump — enough to clear most pits
      member.jumpCooldown = 0.5;
      member._pendingDoubleJump = true;
    }
    return { active: true, phase: 'VAULT', action: 'pit_jump', reason: 'STUCK_PIT_ESCAPE' };
  }

  // Stage 3: run hard toward player + repeated jumps
  if (t < 1.8) {
    member._needsAlternatePath = true;
    member.facing *= -1; // flip and try other direction
    if (member.onGround && member.jumpCooldown <= 0) {
      member.vy = LEDGE_JUMP_VEL;
      member.jumpCooldown = 0.6;
      member._pendingDoubleJump = true;
    }
    return { active: true, phase: 'AGGRESSIVE', action: 'run_jump', reason: 'STUCK_AGGRESSIVE' };
  }

  // Stage 4: ALWAYS teleport near player — pit recovery can't wait for offscreen check
  return { active: true, phase: 'TELEPORT_LEASH', action: 'teleport', reason: 'STUCK_LEASH' };
}

/**
 * Standard navigation toward a target position.
 * Personality speeds are applied via archetype config.
 */
export function navigateTowardTarget(member, targetX, targetY, tiles, speed) {
  const spd = speed || 2.5;
  const direction = targetX > member.x ? 1 : -1;
  member.facing = direction;

  // Clear alternate path flag if we've moved
  if (Math.abs(member.vx) > 0.3) member._needsAlternatePath = false;

  // Check pending double jump mid-air
  if (!member.onGround && member._pendingDoubleJump) {
    if (checkDoubleJump(member)) {
      member.vy = DOUBLE_JUMP_VEL;
    }
  }

  // Walk
  member.vx = direction * spd;

  // Jump decision only when grounded
  if (member.onGround) {
    const jumpDecision = decideJump(member, tiles, direction);
    if (jumpDecision.shouldJump) {
      member.vy = jumpDecision.jumpVelocity;
      member.jumpCooldown = SQUAD_CONFIG.movement?.jumpCooldown || 1.0;
      member.lastJumpReason = jumpDecision.reason;
      member.jumpsUsedInAir = 1;
    }
  }
}

/**
 * Evasive navigation — move away from threat, jump only if terrain demands it.
 */
export function evasiveNavigate(member, threatPos, tiles, speed) {
  const spd = speed || 3.2;
  const direction = member.x > threatPos.x ? 1 : -1;
  member.facing = direction;
  member.vx = direction * spd;

  if (member.onGround && member.jumpCooldown <= 0) {
    const terrain = scanTerrainAhead(member, direction, tiles);
    if (terrain.requiresJump && terrain.landingSafe) {
      member.vy = EVASION_JUMP_VEL;
      member.jumpCooldown = 0.7;
      member.lastJumpReason = 'EVASION';
    }
  }
}

/**
 * TREE AMBUSH MOVEMENT — personality: BILLIE / tree_ambush
 * Seeks elevated perch via staged pathfinding + smart double jump.
 */
export function executeTreeAmbushMovement(member, world, hunter, dt) {
  if (member.behaviorStyle !== 'tree_ambush') return false;

  const cfg = SQUAD_CONFIG.treeAmbush;
  const now = Date.now() / 1000;

  // Refresh perch target periodically
  if (!member.perchTarget || (now - (member.lastPerchScanTime || 0) > 2.5)) {
    const perches = findNearbyPerches(member, world, hunter);
    if (perches.length > 0) {
      const best = perches[0];
      // Don't re-pick same unstable perch too quickly
      if (!member.perchTarget || member.perchTarget.id !== best.id) {
        member.perchTarget = best;
        member.perchRoute = buildPerchRoute(member, best, world) || [];
        member.failedPerchAttempts = 0;
        member.isAmbushing = false;
      }
    }
    member.lastPerchScanTime = now;
  }

  // Settled into ambush — hold position and shoot
  if (member.isAmbushing) {
    member.vx = 0;
    return true;
  }

  // No route? Let default AI handle
  if (!member.perchRoute || member.perchRoute.length === 0) return false;

  // Work through route nodes
  const node = member.perchRoute[0];
  if (!node) { member.isAmbushing = true; return true; }

  const dx = node.pos.x - member.x;
  const dy = member.y - node.pos.y; // positive if node is above

  // Node reached
  if (Math.abs(dx) < 14 && Math.abs(dy) < 14) {
    member.perchRoute.shift();
    if (member.perchRoute.length === 0) member.isAmbushing = true;
    return true;
  }

  // Walk toward node
  const dir = dx > 0 ? 1 : -1;
  member.vx = dir * 2.0;
  member.facing = dir;

  const timeSinceLast = now - (member.lastJumpTime || 0);

  // First jump: from ground
  if (member.onGround && timeSinceLast > (cfg.jumpCooldown || 1.1)) {
    if (dy > 10 && canReachPositionWithDoubleJump(member, node.pos.x, node.pos.y)) {
      member.vy = cfg.firstJumpVelocity || -8.5;
      member.jumpsUsedInAir = 1;
      member.lastJumpTime = now;
      member.lastJumpReason = 'PERCH_JUMP_1';
      member.jumpCooldown = 0.2; // brief cooldown before checking double
    }
  }

  // Second jump: in air, at apex, target still above
  if (!member.onGround &&
      (member.jumpsUsedInAir || 0) === 1 &&
      member.vy >= -1.8 && member.vy <= 3.0 &&
      timeSinceLast > (cfg.doubleJumpMinDelay || 0.25)) {
    if (dy > 20) {
      member.vy = cfg.secondJumpVelocity || -6.0;
      member.jumpsUsedInAir = 2;
      member.lastJumpTime = now;
      member.lastJumpReason = 'PERCH_DOUBLE_JUMP';
    }
  }

  // Reset on landing
  if (member.onGround) {
    member.jumpsUsedInAir = 0;
  }

  return true;
}

export function validatePerchRoute(member) {
  if (!member.perchRoute || member.perchRoute.length === 0) {
    if (member.failedPerchAttempts > 3) {
      member.perchTarget = null;
      member.perchRoute = [];
      member.failedPerchAttempts = 0;
      member.isAmbushing = false;
    }
    return false;
  }
  return true;
}

function _noJump() {
  return { shouldJump: false, jumpVelocity: 0, reason: null };
}
