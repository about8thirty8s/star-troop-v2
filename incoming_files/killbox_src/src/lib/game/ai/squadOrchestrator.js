// SQUAD AI ORCHESTRATOR — V2
// Wires perception → navigation → decisions → execution.
// V2: Teleport leash, personality-driven speeds, double-jump mid-air wiring.
// VULCAN P1 — Squad AI V2.
import { SQUAD_CONFIG } from '../config/squad.config';
import { scanTerrainAhead, detectThreats } from './squadPerception';
import {
  decideJump, checkDoubleJump, handleStuckRecovery,
  navigateTowardTarget, evasiveNavigate,
  executeTreeAmbushMovement, validatePerchRoute,
} from './squadNavigation';
import { scoreActions } from './squadDecision';
import { canAttemptUnstuck, checkAllyInFront, getRandomStuckBark } from './squadCoordination';
import { createBark } from '../barksSystem';
import { tryInitiativeTask, clearInitiativeRegistry } from './squadInitiative';
import { enforceWorldLeash, runPrepBehavior } from './squadPrepBehaviors';

// Personality speed table — movement is now archetype-flavoured
const PERSONALITY_SPEED = {
  gung_ho:     3.2,   // MAC — aggressive, fast
  low_profile: 2.0,   // PONCHO — slower, careful
  tree_ambush: 2.0,   // BILLIE — deliberate climber
};

export function updateSquadMemberAI(
  member, player, hunter, tiles,
  projectiles, particles, firePatches, treeEntities, squad = [], coordState = null, gamePhase = 'PREP'
) {
  if (!member.alive || member.insertionState !== 'ACTIVE') return;

  // ── World leash — ALWAYS runs first, before any movement logic ────────────
  // Prevents members from running off the edge of the level.
  // If being pulled back, skip the rest of this frame's movement.
  if (enforceWorldLeash(member, player, tiles)) {
    // Still run physics-dependent updates (jumpCooldown etc) but skip AI
    if (member.jumpCooldown > 0) member.jumpCooldown -= 1/60;
    return;
  }

  // ── Init AI state ──────────────────────────────────────────────────────────
  if (!member.aiState) {
    member.aiState = {
      currentAction: 'INITIATIVE_TASK',  // never HOLD on spawn
      targetX: member.x,
      targetY: member.y,
      decisionTimer: 999,  // fire decision engine on very first frame
      lastJumpReason: null,
      threats: [],
      actionScores: [],
    };
  }
  if (member.lastX === undefined) { member.lastX = member.x; member.lastY = member.y; }
  if (member.jumpCooldown === undefined) member.jumpCooldown = 0;

  // ── Decrement cooldowns ────────────────────────────────────────────────────
  if (member.jumpCooldown > 0)        member.jumpCooldown        -= 1 / 60;
  if (member.postLandingPause > 0)    member.postLandingPause    -= 1 / 60;
  if (member.decisionPause > 0)       member.decisionPause       -= 1 / 60;

  // ── Validate perch route (tree ambush) ────────────────────────────────────
  if (member.behaviorStyle === 'tree_ambush' && member.perchTarget) {
    if (!validatePerchRoute(member)) member.aiState.currentAction = 'INITIATIVE_TASK';
  }

  // ── Mid-air double jump wiring ─────────────────────────────────────────────
  // This is the only place double-jump fires for non-perch members.
  if (!member.onGround && member._pendingDoubleJump && member.jumpCooldown <= 0) {
    if (checkDoubleJump(member)) {
      member.vy = -5.8;
      member.jumpsUsedInAir = 2;
      member.jumpCooldown = 1.0;
    }
  }

  // Reset jump counter on landing
  if (member.onGround) {
    member.jumpsUsedInAir = 0;
    if (member._pendingDoubleJump && member.jumpsUsedInAir === 0) {
      member._pendingDoubleJump = false; // failed to double-jump before landing, clear it
    }
  }

  // ── Stuck detection ────────────────────────────────────────────────────────
  const movedDist = Math.hypot(member.x - member.lastX, member.y - member.lastY);

  // During active chop work, the member is SUPPOSED to be stationary.
  // Don't trigger stuck recovery or jump loops when standing still to chop.
  const _isActivelyChopping = member.initiativeState === 'CHOP_TREE_WORK';

  // Stuck check: either stationary on ground OR airborne too long without progress
  // (catches pit-ceiling bouncing and corner trapping)
  if (!member._airStuckTimer) member._airStuckTimer = 0;
  if (!member.onGround) {
    member._airStuckTimer += 1/60;
  } else {
    member._airStuckTimer = 0;
  }
  const _airStuck = member._airStuckTimer > 2.5; // airborne >2.5s without landing = stuck

  if ((movedDist < 0.5 && member.onGround && !_isActivelyChopping) || _airStuck) {
    if (!member.stuckTimer) member.stuckTimer = 0;
    member.stuckTimer += _airStuck ? (2/60) : (1/60); // escalate faster if air-stuck

    // Only attempt recovery if squad coordination allows it
    if (!coordState || canAttemptUnstuck(member, coordState, 1 / 60)) {
      const recovery = handleStuckRecovery(member, tiles, 1 / 60);

      if (recovery.active) {
        // ── Stage 5: Silent teleport leash ────────────────────────────────
        if (recovery.phase === 'TELEPORT_LEASH' && player) {
          // ALWAYS teleport — pits keep them onscreen but totally stuck.
          // Find safe ground near player — not just player.y which might be mid-air.
          const side = player.x > member.x ? -1 : 1; // appear on player's near side
          const spawnOffsetX = side * (48 + Math.random() * 64);
          // Snap to ground: scan downward from player.y
          let spawnY = player.y;
          const spawnTX = Math.floor((player.x + spawnOffsetX) / TILE_SIZE);
          if (tiles) {
            for (let ty = Math.floor(player.y / TILE_SIZE); ty < Math.floor(player.y / TILE_SIZE) + 10; ty++) {
              const t = tiles[ty] && tiles[ty][spawnTX];
              const solid = t && t !== 'air' && t !== 'empty' && t !== 'bridge';
              if (solid) { spawnY = ty * TILE_SIZE - (member.h || 20); break; }
            }
          }
          member.x = player.x + spawnOffsetX;
          member.y = spawnY;
          member.vx = 0;
          member.vy = 0;
          member.stuckTimer = 0;
          member._pitEscapeDir = null;
          member._pendingDoubleJump = false;
          // After teleport, immediately seek initiative task — not hold sink
          member.aiState.currentAction = 'INITIATIVE_TASK';
          member._holdReason = null;
            member.initiativeState = null; // reset so fresh scan occurs
            member._pendingDoubleJump = false;
            return; // skip rest of frame
          }
        }

        member.aiState.currentAction = `UNSTUCK_${recovery.phase}`;
        member.lastJumpReason = recovery.reason || null;

        if (!member.currentBark && recovery.phase !== 'ASSESS') {
          member.currentBark = createBark(getRandomStuckBark(), 70);
        }
      }
    }

    if (member.stuckTimer >= 4.0) {
      member.stuckTimer = 0;
    }
  } else {
    member.stuckTimer = 0;
    member._needsAlternatePath = false;
  }

  member.lastX = member.x;
  member.lastY = member.y;

  // ── Soft ally avoidance ────────────────────────────────────────────────────
  const allyInFront = checkAllyInFront(member, squad);
  if (allyInFront) {
    if (allyInFront.distance < 18) {
      member.vx = 0;
      // During prep, use SIDESTEP not HOLD so initiative can still win next frame
      const isPrepPhase = gamePhase === 'prep' || gamePhase === 'PREP';
      member.aiState.currentAction = isPrepPhase ? 'SIDESTEP' : 'HOLD_POSITION';
      if (!isPrepPhase) return;
    } else if (allyInFront.distance < 36) {
      member.aiState.currentAction = 'SIDESTEP';
    }
  }

  // ── Periodic decision re-scoring ──────────────────────────────────────────
  member.aiState.decisionTimer += 1 / 60;
  const interval = SQUAD_CONFIG.ai?.decisionInterval || 0.4;
  if (member.aiState.decisionTimer >= interval) {
    member.aiState.decisionTimer = 0;
    const { actions, topThreat, threats } = scoreActions(member, hunter, player, tiles, firePatches || []);
    member.aiState.threats = threats;
    member.aiState.topThreat = topThreat;
    if (actions.length > 0 && actions[0].score > 0) {
      const newAction = actions[0].action;
      // BUG 8 FIX: reset stuckTimer when switching tasks — prevents phantom TELEPORT_LEASH
      if (newAction !== member.aiState.currentAction) {
        member.stuckTimer = 0;
      }
      member.aiState.currentAction = newAction;
      member.aiState.actionScores = actions.slice(0, 3).map(a => `${a.action}:${(a.score * 100).toFixed(0)}%`);
    }
  }

  // Reset stuckTimer when entering active chop — member is stationary by design
  if (member.initiativeState === 'CHOP_TREE_WORK') {
    member.stuckTimer = 0;
    member._pendingDoubleJump = false;
  }

  // ── Execute action ────────────────────────────────────────────────────────
  // ── ANTI-HOLD GUARD — prep phase override ────────────────────────────────
  // If decision engine chose HOLD during prep without explicit player order,
  // override to INITIATIVE_TASK. This is the final failsafe.
  const _isPrep = gamePhase === 'prep' || gamePhase === 'PREP';
  if (_isPrep && member.aiState.currentAction === 'HOLD_POSITION' && member._holdReason !== 'PLAYER_ORDER') {
    member.aiState.currentAction = 'INITIATIVE_TASK';
    if (!member.initiativeTree) member.initiativeState = null; // fresh scan
  }
  executeAction(member, member.aiState.currentAction, hunter, tiles, projectiles, particles, firePatches, treeEntities, player, gamePhase);
}

function executeAction(member, action, hunter, tiles, projectiles, particles, firePatches, treeEntities, player, gamePhase) {
  const spd = PERSONALITY_SPEED[member.behaviorStyle] || 2.5;

  switch (action) {

    // ── ENGAGE ──────────────────────────────────────────────────────────────
    case 'ENGAGE_HUNTER':
      if (hunter && hunter.alive) {
        navigateTowardTarget(member, hunter.x, hunter.y, tiles, spd);
        tryFire(member, hunter, projectiles);
      }
      break;

    // ── RETREAT ─────────────────────────────────────────────────────────────
    case 'RETREAT':
      if (hunter && hunter.alive) {
        evasiveNavigate(member, { x: hunter.x, y: hunter.y }, tiles, spd * 1.1);
      }
      break;

    // ── EVADE ───────────────────────────────────────────────────────────────
    case 'EVADE':
      if (member.aiState?.topThreat) {
        evasiveNavigate(member, member.aiState.topThreat.position, tiles, spd * 1.2);
      }
      break;

    // ── COVER ───────────────────────────────────────────────────────────────
    case 'MOVE_TO_COVER': {
      const threat = member.aiState?.topThreat;
      if (threat) {
        const awayDir = member.x > threat.position.x ? 1 : -1;
        member.facing = awayDir;
        member.vx = awayDir * spd * 0.65;
        if (member.onGround && member.jumpCooldown <= 0) {
          const jd = decideJump(member, tiles, awayDir);
          if (jd.shouldJump) {
            member.vy = jd.jumpVelocity;
            member.jumpCooldown = SQUAD_CONFIG.movement?.jumpCooldown || 1.0;
          }
        }
      }
      break;
    }

    // ── SIDESTEP ────────────────────────────────────────────────────────────
    case 'SIDESTEP':
      member.vx = member.facing * spd * 0.35;
      break;

    // ── TREE AMBUSH ─────────────────────────────────────────────────────────
    case 'CLIMB_TO_AMBUSH':
      if (member.behaviorStyle === 'tree_ambush') {
        const world = { treeEntities, tiles };
        const handled = executeTreeAmbushMovement(member, world, hunter, 1 / 60);
        if (handled) break;
      }
      // Fallback: walk + natural terrain jump
      member.vx = member.facing * spd * 0.8;
      if (member.onGround && member.jumpCooldown <= 0) {
        const terrain = scanTerrainAhead(member, member.facing, tiles);
        if (terrain.climbableNearby || terrain.ledgeAbove) {
          member.vy = -8.0;
          member.jumpCooldown = 1.0;
        }
      }
      break;

    // ── UNSTUCK STAGES ──────────────────────────────────────────────────────
    case 'UNSTUCK_ASSESS':
      // BUG 9 FIX: timeout after 2s — don't let members reverse-walk forever
      if (!member._unstuckTimer) member._unstuckTimer = 0;
      member._unstuckTimer += 1 / 60;
      if (member._unstuckTimer > 2.0) {
        member._unstuckTimer = 0;
        // After unstuck — kick back to initiative, not hold sink
        member.aiState.currentAction = 'INITIATIVE_TASK';
        member._holdReason = null;
        member.stuckTimer = 0;
      } else {
        member.vx = -member.facing * 1.5;
      }
      break;
    case 'UNSTUCK_PATH_ADJUST':
      member.vx = member.facing * spd;
      break;
    case 'UNSTUCK_VAULT':
      member.vx = member.facing * spd;
      break;
    case 'UNSTUCK_EMERGENCY':
      member.vx = member.facing * spd * 0.5;
      break;

    // ── INITIATIVE TASK (prep-phase autonomous behavior) ────────────────────
    case 'INITIATIVE_TASK': {
      // Delegate entirely to initiative system
      // It handles its own state machine (CHOP_TREE_MOVE, CHOP_TREE_WORK etc)
      const handled = tryInitiativeTask(member, player, treeEntities, tiles, particles, gamePhase);
      if (!handled) {
        // Initiative returned false — no tree task available.
        // Determine WHY: are there no trees left, or just none in range?
        const treesExist = treeEntities && treeEntities.some(t =>
          t.state === 0 || t.state === 'STANDING' || t.state === 1 || t.state === 'STUMP'
        );
        const treesInRange = treesExist && treeEntities.some(t => {
          const trunkX = (t.rootTileX || 0) * 16 + 8;
          return Math.abs(trunkX - member.x) < 640;
        });

        if (!treesInRange) {
          // Trees are either all chopped or out of range.
          // Switch to archetype-specific prep behaviors (traps, tunnels, chokepoints).
          // Pass gs.traps via member._trapsRef (set by engine each frame)
          const gs = (typeof window !== 'undefined') ? window.__KILLBOX_GS__ : null;
          const trapsArr = gs ? gs.traps : (member._trapsRef || []);
          runPrepBehavior(member, player, tiles, trapsArr, gs);
        } else {
          // Trees exist but out of range — wander toward them
          if (player) {
            const dir  = player.x > member.x ? 1 : -1;
            const dist = Math.abs(player.x - member.x);
            if (dist > 100) {
              member.vx = dir * spd * 0.6;
              member.facing = dir;
              if (member.onGround && member.jumpCooldown <= 0) {
                const moved = Math.abs(member.x - (member._wanderPX || member.x));
                if (moved < 3) { member.vy = -6.5; member.jumpCooldown = 0.85; }
                member._wanderPX = member.x;
              }
            } else {
              member.vx = 0;
            }
          }
        }
      }
      break;
    }

    // ── HOLD ────────────────────────────────────────────────────────────────
    case 'HOLD_POSITION': {
      // Anti-idle-sink: during prep, HOLD is only valid with an explicit reason.
      // Without PLAYER_ORDER holdReason, immediately route to initiative.
      const isPrep = gamePhase === 'prep' || gamePhase === 'PREP';
      const hasReason = member._holdReason === 'PLAYER_ORDER';
      if (isPrep && !hasReason) {
        // Clear any stale tree data so fresh scan happens
        if (!member.initiativeTree) member.initiativeState = null;
        member.aiState.currentAction = 'INITIATIVE_TASK';
        // Debug label
        member._debugState = `→INITIATIVE (was HOLD)`;
        break;
      }
      member.vx = 0;
      break;
    }
    default:
      member.vx = 0;
      break;
  }
}

function tryFire(member, hunter, projectiles) {
  const arch = SQUAD_CONFIG.archetypes[member.archetype];
  const dist = Math.hypot(hunter.x - member.x, hunter.y - member.y);
  if (dist > 260) return;
  if (!member.weaponTimer) member.weaponTimer = 0;
  if (member.weaponTimer > 0) { member.weaponTimer--; return; }
  if (Math.random() > 0.48) return;

  const angle = Math.atan2(hunter.y - member.y, hunter.x - member.x);
  projectiles.push({
    x: member.x + member.w / 2,
    y: member.y + member.h / 3,
    vx: Math.cos(angle) * 5.5,
    vy: Math.sin(angle) * 5.5,
    angle,
    damage: (arch?.weaponDamage || 8) * 0.35,
    type: 'arrow',
    owner: 'squad',
    stuck: false,
    life: 300,
  });
  member.weaponTimer = arch?.weaponCooldown || 40;
}
