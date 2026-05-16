// SQUAD COORDINATION SYSTEM
// Fixes clustering, target thrashing, and unstuck spam through reservation & cooldown gating

import { TILE_SIZE } from '../constants.js';

/**
 * Global squad coordination state (shared across all members)
 * Tracks objective claims, slot assignments, and timers
 */
export function createSquadCoordinationState() {
  return {
    // Objective → claimed member ID
    targetClaims: {},

    // Objective → available slots with reservation status
    objectiveSlots: {},

    // Member unstuck cooldowns (member.id → cooldown timer)
    unstuckCooldowns: {},

    // Member route failures (member.id → count)
    routeFailures: {},
  };
}

/**
 * Check if a member can attempt unstuck recovery
 * Enforces 4s cooldown between unstuck attempts to prevent spam
 */
export function canAttemptUnstuck(member, coordState, deltaTime = 1/60) {
  const UNSTUCK_COOLDOWN = 4.0; // seconds

  if (!coordState.unstuckCooldowns[member.id]) {
    coordState.unstuckCooldowns[member.id] = 0;
  }

  const cd = coordState.unstuckCooldowns[member.id];

  // BUG 10 FIX: only decrement when cooldown is active (> 0), not after
  if (cd > 0) {
    coordState.unstuckCooldowns[member.id] -= deltaTime;
    return false; // still cooling down
  }

  // Cooldown expired — allow attempt and start new cooldown
  coordState.unstuckCooldowns[member.id] = UNSTUCK_COOLDOWN;
  return true;
}

/**
 * Try to reserve a slot for a member at a target objective
 * Returns {slotX, slotY} if successful, null if unavailable
 */
export function reserveSlot(member, targetId, coordState, world) {
  // Check if target already has slot data
  if (!coordState.objectiveSlots[targetId]) {
    // Create default slots around objective
    const { objectiveX, objectiveY } = getObjectivePosition(targetId, world);
    coordState.objectiveSlots[targetId] = [
      { x: objectiveX - 24, y: objectiveY, reserved: false, reservedBy: null },
      { x: objectiveX,      y: objectiveY, reserved: false, reservedBy: null },
      { x: objectiveX + 24, y: objectiveY, reserved: false, reservedBy: null },
    ];
  }

  // Find unreserved slot
  const slots = coordState.objectiveSlots[targetId];
  for (const slot of slots) {
    if (!slot.reserved) {
      slot.reserved = true;
      slot.reservedBy = member.id;
      return { x: slot.x, y: slot.y };
    }
  }

  return null; // No slots available
}

/**
 * Release a member's slot reservation
 */
export function releaseSlot(member, targetId, coordState) {
  if (!coordState.objectiveSlots[targetId]) return;

  const slots = coordState.objectiveSlots[targetId];
  for (const slot of slots) {
    if (slot.reservedBy === member.id) {
      slot.reserved = false;
      slot.reservedBy = null;
    }
  }
}

/**
 * Try to claim an objective (tree, trap zone, etc.)
 * Returns true if claimed by this member, false if already claimed
 */
export function claimTarget(member, targetId, coordState) {
  // Already claimed by someone else?
  if (coordState.targetClaims[targetId] && coordState.targetClaims[targetId] !== member.id) {
    return false;
  }

  // Claim it
  coordState.targetClaims[targetId] = member.id;
  return true;
}

/**
 * Release target claim
 */
export function releaseTarget(member, targetId, coordState) {
  if (coordState.targetClaims[targetId] === member.id) {
    delete coordState.targetClaims[targetId];
  }
}

/**
 * Check if target is available for this member
 */
export function isTargetAvailable(member, targetId, coordState) {
  const claimed = coordState.targetClaims[targetId];
  return !claimed || claimed === member.id;
}

/**
 * Track a failed navigation attempt
 * Return true if we should abandon this target after 3 failures
 */
export function trackRouteFailure(member, targetId, coordState) {
  const key = `${member.id}_${targetId}`;
  if (!coordState.routeFailures[key]) {
    coordState.routeFailures[key] = 0;
  }
  coordState.routeFailures[key]++;

  // Abandon after 3 failures
  if (coordState.routeFailures[key] >= 3) {
    delete coordState.routeFailures[key];
    return true; // Should abandon
  }

  return false;
}

/**
 * Clear failure count for a target (success or on-target)
 */
export function clearRouteFailure(member, targetId, coordState) {
  const key = `${member.id}_${targetId}`;
  delete coordState.routeFailures[key];
}

/**
 * Soft avoidance: if ally directly in front, slow/sidestep instead of panicking
 */
export function checkAllyInFront(member, squad) {
  const CHECK_DIST = 30; // pixels ahead
  const CHECK_HEIGHT = 40; // vertical tolerance

  for (const ally of squad) {
    if (ally.id === member.id || !ally.alive) continue;

    // Is ally directly ahead?
    const dx = ally.x - member.x;
    const dy = Math.abs(ally.y - member.y);

    // Ahead in facing direction?
    const isAhead = (member.facing > 0 && dx > 0 && dx < CHECK_DIST) ||
                    (member.facing < 0 && dx < 0 && dx > -CHECK_DIST);

    // At same height?
    const isSameHeight = dy < CHECK_HEIGHT;

    if (isAhead && isSameHeight) {
      return {
        allyId: ally.id,
        distance: Math.abs(dx),
        verticalOffset: dy,
      };
    }
  }

  return null;
}

/**
 * Get objective position (helper for slot creation)
 */
function getObjectivePosition(targetId, world) {
  // Parse targetId to find actual world position
  // For now: simple heuristic based on string
  // TODO: pass explicit world coords from call site

  // Default: center of map-ish
  let objectiveX = (world.width || 2000) / 2;
  let objectiveY = (world.height || 1500) / 2;

  // Trees: indexed, use rough grid
  if (targetId.startsWith('tree_')) {
    const treeIdx = parseInt(targetId.split('_')[1]);
    if (world.trees && world.trees[treeIdx]) {
      const tree = world.trees[treeIdx];
      objectiveX = tree.x * TILE_SIZE + TILE_SIZE / 2;
      objectiveY = tree.y * TILE_SIZE;
    }
  }

  return { objectiveX, objectiveY };
}

/**
 * Micro bark when stuck (optional, fun)
 */
export const STUCK_BARKS = [
  'Move!',
  'Clear the lane!',
  'Come ON!',
  'Go around!',
  'Blocked!',
  'Move it!',
  'Out of the way!',
  'Go GO GO!',
];

export function getRandomStuckBark() {
  return STUCK_BARKS[Math.floor(Math.random() * STUCK_BARKS.length)];
}