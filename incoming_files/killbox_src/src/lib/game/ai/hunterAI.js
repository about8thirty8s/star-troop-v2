// HUNTER AI BRAIN — LAST HUNT: KILLBOX
// Modular AI director that runs alongside hunter.js physics/combat.
// Adds: phased behavior, memory-driven adaptation, personality, cinematic moments.
// Does NOT replace hunter.js — it injects goal decisions into hunter.aiGoal.

import { TILE_SIZE } from '../constants';
import { raycast } from '../physics';
import {
  createMemory, tickMemory,
  hunterSawPlayer, hunterHeardSound, hunterSawFire, hunterKilledSquadmate,
  hunterNotedPlayerTunnel, hunterNotedPlayerTree,
  recall, recallAll, degradeConfidence, forget,
} from './aiMemory';

// ─── Hunter phases (macro arc) ───────────────────────────────────────────────
export const HUNTER_PHASE = {
  ARRIVAL:  'ARRIVAL',   // just spawned, entering map, heavy cloak
  STALK:    'STALK',     // observing, circling, waiting
  PROBE:    'PROBE',     // testing, taking out isolated squadmates, destroying traps
  PRESSURE: 'PRESSURE',  // active attacks, repositioning, unexpected angles
  KILL:     'KILL',      // player exposed/weak — commit to close
  RETREAT:  'RETREAT',   // hurt, disengage, re-cloak, relocate
};

// ─── Hunter goals (micro decisions) ─────────────────────────────────────────
export const HUNTER_GOAL = {
  STALK:                   'STALK',
  INVESTIGATE_SOUND:       'INVESTIGATE_SOUND',
  INVESTIGATE_LAST_SEEN:   'INVESTIGATE_LAST_SEEN',
  FLANK:                   'FLANK',
  TAKE_HIGH_GROUND:        'TAKE_HIGH_GROUND',
  DESTROY_TRAP:            'DESTROY_TRAP',
  FIRE_PLASMA:             'FIRE_PLASMA',
  CLOSE_MELEE:             'CLOSE_MELEE',
  RETREAT_RECLOAK:         'RETREAT_RECLOAK',
  AVOID_FIRE:              'AVOID_FIRE',
  USE_FIRE_BACKDROP:       'USE_FIRE_BACKDROP',
  TARGET_SQUADMATE:        'TARGET_SQUADMATE',
  BAIT_PLAYER:             'BAIT_PLAYER',
  WAIT_IN_CLOAK:           'WAIT_IN_CLOAK',
  REPOSITION:              'REPOSITION',
  INSPECT_TRAP:            'INSPECT_TRAP',
  CINEMATIC_IDLE:          'CINEMATIC_IDLE',
};

// ─── Cinematic micro-behaviors ───────────────────────────────────────────────
const CINEMATIC = {
  PERCH_AND_WATCH: 'PERCH_AND_WATCH',
  INSPECT_DEAD:    'INSPECT_DEAD',
  SHIMMER_RIPPLE:  'SHIMMER_RIPPLE',
  FIRE_SILHOUETTE: 'FIRE_SILHOUETTE',
  SLOW_HEAD_TURN:  'SLOW_HEAD_TURN',
};

export function createHunterAI() {
  return {
    phase: HUNTER_PHASE.ARRIVAL,
    goal:  HUNTER_GOAL.STALK,
    goalTimer: 0,
    phaseTimer: 0,
    decisionTimer: 0,
    fastDecisionTimer: 0,
    tacticalTimer: 0,

    memory: createMemory(),

    // Detection confidence (0..1)
    playerConfidence: 0.0,
    squadConfidence: {},     // squadmate.id → confidence

    // Cloak intelligence
    cloakVisibility: 1.0,    // 0=invisible, 1=fully visible
    prefersDark: true,

    // Cinematic
    cinematicTimer: 0,
    currentCinematic: null,
    cinematicCooldown: 0,

    // Tactical context
    isolatedSquadTarget: null,
    nearestTrapPos: null,
    highGroundTarget: null,
    flankDir: 1,

    // Adaptation flags
    playerUsesTunnels: false,
    playerUsesTrees: false,
    trapsDestroyed: 0,
    squadKills: 0,

    // Goal target position
    goalX: 0,
    goalY: 0,
  };
}

// ─── MAIN UPDATE ─────────────────────────────────────────────────────────────
// Call this from updateHunter() after existing physics/combat runs.
export function updateHunterAI(hunter, hAI, player, squad, tiles, particles, traps, firePatches, deltaTime) {
  if (!hunter.alive) return;

  const dt = deltaTime / 1000; // convert ms → seconds
  tickMemory(hAI.memory, dt);

  // ── Fast checks (every 0.15s) — threats, fire, danger ───────────────────
  hAI.fastDecisionTimer += dt;
  if (hAI.fastDecisionTimer >= 0.15) {
    hAI.fastDecisionTimer = 0;
    _senseEnvironment(hunter, hAI, player, squad, tiles, firePatches, traps);
    _updateCloakVisibility(hunter, hAI, firePatches, player);
  }

  // ── Tactical decisions (every 0.6s) — goal scoring ──────────────────────
  hAI.decisionTimer += dt;
  if (hAI.decisionTimer >= 0.6) {
    hAI.decisionTimer = 0;
    _updatePhase(hunter, hAI, player, squad);
    _scoreAndChooseGoal(hunter, hAI, player, squad, tiles, traps, firePatches);
  }

  // ── Long-range planning (every 3s) — pattern adaptation ─────────────────
  hAI.tacticalTimer += dt;
  if (hAI.tacticalTimer >= 3.0) {
    hAI.tacticalTimer = 0;
    _adaptToPlayerPatterns(hunter, hAI, player, squad);
    _tryCinematicMoment(hunter, hAI, player, firePatches, particles);
  }

  // ── Execute current goal ─────────────────────────────────────────────────
  hAI.goalTimer += dt;
  hAI.phaseTimer += dt;
  _executeGoal(hunter, hAI, player, squad, tiles, traps, firePatches, particles, dt);
}

// ─── SENSE ───────────────────────────────────────────────────────────────────
function _senseEnvironment(hunter, hAI, player, squad, tiles, firePatches, traps) {
  const dx = player.x - hunter.x;
  const dy = player.y - hunter.y;
  const dist = Math.hypot(dx, dy);

  // Line of sight check (raycast)
  const los = dist < 400 ? raycast(
    hunter.x + hunter.w / 2, hunter.y + hunter.h / 2,
    player.x + (player.w || 8) / 2, player.y + (player.h || 24) / 2,
    tiles, 420
  ) : { hit: true };

  // Mud reduces detectability significantly
  const mudPenalty = player.mudAmount > 0 ? Math.max(0, 1 - player.mudAmount * 1.2) : 1.0;

  if (!los.hit && dist < 350) {
    // Direct sight
    hAI.playerConfidence = Math.min(1.0, hAI.playerConfidence + 0.15 * mudPenalty);
    hunterSawPlayer(hAI.memory, player.x, player.y);
  } else if (!los.hit && dist < 600) {
    hAI.playerConfidence = Math.min(0.75, hAI.playerConfidence + 0.04 * mudPenalty);
  } else {
    // Lose confidence over time
    hAI.playerConfidence = Math.max(0, hAI.playerConfidence - 0.04);
    degradeConfidence(hAI.memory, 'LAST_SEEN_PLAYER', 0.08, 1/6);
  }

  // Squad detection
  if (squad && Array.isArray(squad)) {
    for (const m of squad) {
      if (!m.alive) continue;
      const sdist = Math.hypot(m.x - hunter.x, m.y - hunter.y);
      if (sdist < 300) {
        hAI.squadConfidence[m.id] = Math.min(1.0, (hAI.squadConfidence[m.id] || 0) + 0.1);
      } else {
        hAI.squadConfidence[m.id] = Math.max(0, (hAI.squadConfidence[m.id] || 0) - 0.05);
      }
    }
    // Find most isolated squadmate
    const alive = squad.filter(m => m.alive);
    if (alive.length > 0) {
      const isolated = alive.reduce((best, m) => {
        const distToPlayer = Math.hypot(m.x - player.x, m.y - player.y);
        const distToHunter = Math.hypot(m.x - hunter.x, m.y - hunter.y);
        const score = distToPlayer - distToHunter; // closer to hunter, farther from player = more isolated
        return score > (best.score || -Infinity) ? { m, score } : best;
      }, {});
      hAI.isolatedSquadTarget = isolated.m || null;
    }
  }

  // Nearest trap
  if (traps && traps.length > 0) {
    let minDist = Infinity, nearest = null;
    for (const t of traps) {
      if (t.triggered || t.destroyed) continue;
      const d = Math.hypot(t.x - hunter.x, t.y - hunter.y);
      if (d < minDist && d < 250) { minDist = d; nearest = t; }
    }
    hAI.nearestTrapPos = nearest ? { x: nearest.x, y: nearest.y, id: nearest.id } : null;
  }

  // Fire proximity
  if (firePatches && firePatches.length > 0) {
    for (const fp of firePatches) {
      const d = Math.hypot(fp.x - hunter.x, fp.y - hunter.y);
      if (d < 120) {
        hunterSawFire(hAI.memory, fp.x, fp.y);
        break;
      }
    }
  }
}

// ─── CLOAK VISIBILITY ────────────────────────────────────────────────────────
function _updateCloakVisibility(hunter, hAI, firePatches, player) {
  let vis = 0.12; // base: very faint shimmer
  const spd = Math.abs(hunter.vx) + Math.abs(hunter.vy);

  if (spd > 2.5) vis += 0.18;       // moving fast
  if (!hunter.onGround) vis += 0.1; // airborne
  if (hunter.hitFlash > 0) vis += 0.5;
  if (hunter.aiState === 'attack') vis += 0.35;

  // Fire backlighting
  if (firePatches) {
    for (const fp of firePatches) {
      const d = Math.hypot(fp.x - hunter.x, fp.y - hunter.y);
      if (d < 180) vis += Math.max(0, (180 - d) / 180) * 0.45;
    }
  }

  // Foliage cover — reduces visibility
  if (hunter.inFoliage) vis *= 0.5;

  // Thermal vision
  if (player.thermalActive) vis = Math.max(vis, 0.65);

  hAI.cloakVisibility = Math.min(1.0, Math.max(0, vis));
  hunter.cloakVisibility = hAI.cloakVisibility; // expose to renderer
}

// ─── PHASE TRANSITIONS ───────────────────────────────────────────────────────
function _updatePhase(hunter, hAI, player, squad) {
  const healthPct = hunter.health / hunter.maxHealth;
  const dist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
  const aliveSquad = squad ? squad.filter(m => m.alive).length : 0;

  // Retreat if critically wounded
  if (healthPct < 0.3 && hAI.phase !== HUNTER_PHASE.RETREAT) {
    hAI.phase = HUNTER_PHASE.RETREAT;
    hAI.phaseTimer = 0;
    return;
  }

  // Recover from retreat after 8s
  if (hAI.phase === HUNTER_PHASE.RETREAT && hAI.phaseTimer > 8.0) {
    hAI.phase = HUNTER_PHASE.STALK;
    hAI.phaseTimer = 0;
    return;
  }

  // Arrival → Stalk after 4s
  if (hAI.phase === HUNTER_PHASE.ARRIVAL && hAI.phaseTimer > 4.0) {
    hAI.phase = HUNTER_PHASE.STALK;
    hAI.phaseTimer = 0;
    return;
  }

  // Stalk → Probe after 6-12s
  if (hAI.phase === HUNTER_PHASE.STALK && hAI.phaseTimer > 6.0 + Math.random() * 6.0) {
    hAI.phase = HUNTER_PHASE.PROBE;
    hAI.phaseTimer = 0;
    return;
  }

  // Probe → Pressure when confident
  if (hAI.phase === HUNTER_PHASE.PROBE && hAI.phaseTimer > 8.0 && hAI.playerConfidence > 0.5) {
    hAI.phase = HUNTER_PHASE.PRESSURE;
    hAI.phaseTimer = 0;
    return;
  }

  // Kill mode: player exposed and close
  const playerWeak = player.health < player.maxHealth * 0.35;
  const playerExposed = dist < 200 && hAI.playerConfidence > 0.7;
  if ((playerWeak || playerExposed) && hAI.phase === HUNTER_PHASE.PRESSURE) {
    hAI.phase = HUNTER_PHASE.KILL;
    hAI.phaseTimer = 0;
    return;
  }

  // Exit kill mode if player escapes
  if (hAI.phase === HUNTER_PHASE.KILL && (dist > 300 || hAI.playerConfidence < 0.4)) {
    hAI.phase = HUNTER_PHASE.PRESSURE;
    hAI.phaseTimer = 0;
  }
}

// ─── GOAL SCORING ─────────────────────────────────────────────────────────────
function _scoreAndChooseGoal(hunter, hAI, player, squad, tiles, traps, firePatches) {
  const G = HUNTER_GOAL;
  const dist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
  const healthPct = hunter.health / hunter.maxHealth;
  const fireNearby = recall(hAI.memory, 'FIRE_ZONE');
  const lastSeen   = recall(hAI.memory, 'LAST_SEEN_PLAYER');
  const heardSound = recall(hAI.memory, 'HEARD_SOUND');
  const playerTunnels = recall(hAI.memory, 'PLAYER_TUNNELS');

  const scores = {};

  // Base scores by phase
  switch (hAI.phase) {
    case HUNTER_PHASE.ARRIVAL:
    case HUNTER_PHASE.STALK:
      scores[G.STALK]              = 0.8;
      scores[G.WAIT_IN_CLOAK]      = 0.6;
      scores[G.TAKE_HIGH_GROUND]   = 0.45;
      scores[G.CINEMATIC_IDLE]     = 0.3;
      break;
    case HUNTER_PHASE.PROBE:
      scores[G.TARGET_SQUADMATE]   = 0.7;
      scores[G.DESTROY_TRAP]       = 0.6;
      scores[G.FLANK]              = 0.55;
      scores[G.INVESTIGATE_SOUND]  = 0.5;
      scores[G.STALK]              = 0.3;
      break;
    case HUNTER_PHASE.PRESSURE:
      scores[G.FIRE_PLASMA]        = 0.7;
      scores[G.FLANK]              = 0.65;
      scores[G.TAKE_HIGH_GROUND]   = 0.5;
      scores[G.TARGET_SQUADMATE]   = 0.45;
      scores[G.REPOSITION]         = 0.5;
      scores[G.DESTROY_TRAP]       = 0.4;
      break;
    case HUNTER_PHASE.KILL:
      scores[G.CLOSE_MELEE]        = 0.9;
      scores[G.FIRE_PLASMA]        = 0.7;
      scores[G.FLANK]              = 0.5;
      break;
    case HUNTER_PHASE.RETREAT:
      scores[G.RETREAT_RECLOAK]    = 0.95;
      scores[G.AVOID_FIRE]         = 0.6;
      scores[G.REPOSITION]         = 0.4;
      break;
  }

  // Contextual modifiers
  if (hAI.nearestTrapPos) {
    scores[G.DESTROY_TRAP]  = (scores[G.DESTROY_TRAP] || 0) + 0.3;
    scores[G.INSPECT_TRAP]  = (scores[G.INSPECT_TRAP] || 0) + 0.2;
  }
  if (fireNearby && healthPct > 0.5) {
    scores[G.USE_FIRE_BACKDROP] = (scores[G.USE_FIRE_BACKDROP] || 0) + 0.35;
  }
  if (fireNearby && healthPct < 0.5) {
    scores[G.AVOID_FIRE]    = (scores[G.AVOID_FIRE] || 0) + 0.5;
  }
  if (heardSound) {
    scores[G.INVESTIGATE_SOUND] = (scores[G.INVESTIGATE_SOUND] || 0) + 0.4;
  }
  if (hAI.isolatedSquadTarget) {
    const sdist = Math.hypot(hAI.isolatedSquadTarget.x - hunter.x, hAI.isolatedSquadTarget.y - hunter.y);
    if (sdist < 350) scores[G.TARGET_SQUADMATE] = (scores[G.TARGET_SQUADMATE] || 0) + 0.35;
  }
  if (playerTunnels && playerTunnels.confidence > 0.5) {
    scores[G.FLANK] = (scores[G.FLANK] || 0) + 0.25;
  }
  if (dist < 120 && healthPct > 0.6) {
    scores[G.CLOSE_MELEE]   = (scores[G.CLOSE_MELEE] || 0) + 0.4;
  }
  if (hAI.cloakVisibility > 0.5) {
    // Hunter is visible — reposition or wait
    scores[G.REPOSITION]    = (scores[G.REPOSITION] || 0) + 0.25;
    scores[G.RETREAT_RECLOAK] = (scores[G.RETREAT_RECLOAK] || 0) + 0.15;
  }
  if (lastSeen && !hAI.playerConfidence) {
    scores[G.INVESTIGATE_LAST_SEEN] = (scores[G.INVESTIGATE_LAST_SEEN] || 0) + 0.5;
  }

  // Pick highest scoring goal
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (best && best[0] !== hAI.goal) {
    hAI.goal = best[0];
    hAI.goalTimer = 0;
  }

  hunter.aiGoal = hAI.goal;
  hunter.aiPhase = hAI.phase;
}

// ─── GOAL EXECUTION ──────────────────────────────────────────────────────────
function _executeGoal(hunter, hAI, player, squad, tiles, traps, firePatches, particles, dt) {
  const G = HUNTER_GOAL;

  switch (hAI.goal) {

    case G.STALK: {
      // Orbit the player at distance, cloaked
      const dist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
      const targetDist = 280 + Math.sin(hAI.phaseTimer * 0.3) * 60;
      if (dist > targetDist + 40) {
        hunter.vx = hunter.facing * 1.2;
      } else if (dist < targetDist - 40) {
        hunter.vx = -hunter.facing * 0.8;
      } else {
        // Strafe perpendicular
        hunter.vx = hunter.facing * 0.5 * Math.sin(hAI.goalTimer * 1.5);
      }
      hunter.cloaked = true;
      break;
    }

    case G.WAIT_IN_CLOAK: {
      hunter.vx *= 0.85; // slow drift to stop
      hunter.cloaked = true;
      // Occasional shimmer burst
      if (Math.random() < 0.01) {
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: hunter.x + Math.random() * hunter.w,
            y: hunter.y + Math.random() * hunter.h,
            vx: (Math.random() - 0.5), vy: -0.5,
            life: 16, color: 'rgba(120,220,255,0.35)', size: 2, type: 'shimmer',
          });
        }
      }
      break;
    }

    case G.INVESTIGATE_SOUND: {
      const snd = recall(hAI.memory, 'HEARD_SOUND');
      if (snd) {
        const d = Math.hypot(snd.x - hunter.x, snd.y - hunter.y);
        if (d > 40) {
          hunter.vx = hunter.facing * 1.8;
          hAI.goalX = snd.x; hAI.goalY = snd.y;
        } else {
          // Arrived — investigate complete, forget
          forget(hAI.memory, 'HEARD_SOUND');
          hAI.goal = G.STALK;
        }
      }
      break;
    }

    case G.INVESTIGATE_LAST_SEEN: {
      const ls = recall(hAI.memory, 'LAST_SEEN_PLAYER');
      if (ls) {
        const d = Math.hypot(ls.x - hunter.x, ls.y - hunter.y);
        if (d > 60) {
          hunter.vx = hunter.facing * 2.0;
        } else {
          forget(hAI.memory, 'LAST_SEEN_PLAYER');
          hAI.goal = G.STALK;
        }
      }
      break;
    }

    case G.FLANK: {
      // Move to opposite side of player from current position
      const targetX = player.x + hAI.flankDir * 220;
      const d = Math.abs(targetX - hunter.x);
      if (d > 50) {
        hunter.vx = hAI.flankDir * 2.4;
      } else {
        // Flip flank dir for next time
        hAI.flankDir *= -1;
        hAI.goal = G.FIRE_PLASMA;
      }
      // Jump if needed
      if (hunter.onGround && hunter.vx !== 0) {
        const frontTx = Math.floor((hunter.x + hunter.w / 2 + hunter.vx * 4) / TILE_SIZE);
        const frontTy = Math.floor((hunter.y + hunter.h * 0.8) / TILE_SIZE);
        const tile = tiles[frontTy]?.[frontTx];
        if (tile && tile !== 0) hunter.vy = -10;
      }
      break;
    }

    case G.TAKE_HIGH_GROUND: {
      // Move toward elevated terrain relative to player
      const targetY = player.y - 80;
      if (hunter.y > targetY + 20) {
        if (hunter.onGround) hunter.vy = -11;
      }
      hunter.vx = hunter.facing * 2.0;
      break;
    }

    case G.DESTROY_TRAP: {
      if (hAI.nearestTrapPos) {
        const d = Math.hypot(hAI.nearestTrapPos.x - hunter.x, hAI.nearestTrapPos.y - hunter.y);
        if (d > 50) {
          hunter.vx = (hAI.nearestTrapPos.x > hunter.x ? 1 : -1) * 2.2;
        } else {
          // Destroy it with a plasma shot or chop
          particles.push({
            x: hAI.nearestTrapPos.x, y: hAI.nearestTrapPos.y,
            vx: 0, vy: -1, life: 20, color: '#00ffaa', size: 5, type: 'glow',
          });
          hAI.nearestTrapPos = null;
          hAI.trapsDestroyed++;
          hAI.goal = G.STALK;
        }
      }
      break;
    }

    case G.TARGET_SQUADMATE: {
      const target = hAI.isolatedSquadTarget;
      if (target && target.alive) {
        const d = Math.hypot(target.x - hunter.x, target.y - hunter.y);
        hunter.vx = (target.x > hunter.x ? 1 : -1) * 2.8;
        if (d < 60) {
          // Blade strike on squadmate
          target.health -= 35;
          if (target.health <= 0) {
            target.alive = false;
            hAI.squadKills++;
            hunterKilledSquadmate(hAI.memory, target.x, target.y);
            // Bark: "Contact!" type event
          }
          hAI.goal = G.RETREAT_RECLOAK;
        }
      } else {
        hAI.goal = G.STALK;
      }
      break;
    }

    case G.FIRE_PLASMA: {
      // Let existing hunter.js plasma system handle firing
      // We just position the hunter at ideal plasma range
      const dist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
      const idealDist = 240;
      if (dist > idealDist + 40) hunter.vx = hunter.facing * 1.5;
      else if (dist < idealDist - 40) hunter.vx = -hunter.facing * 1.2;
      else hunter.vx = 0;
      break;
    }

    case G.CLOSE_MELEE: {
      const dist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
      hunter.vx = hunter.facing * (dist > 60 ? 3.2 : 0);
      if (hunter.onGround && dist > 80) hunter.vy = -9; // leap
      hunter.cloaked = false;
      break;
    }

    case G.RETREAT_RECLOAK: {
      // Run opposite to player
      const dir = hunter.x > player.x ? 1 : -1;
      hunter.vx = dir * 3.0;
      if (hunter.onGround) hunter.vy = -10;
      hunter.cloaked = true;
      hunter.cloakCooldown = 0;
      break;
    }

    case G.AVOID_FIRE: {
      const fire = recall(hAI.memory, 'FIRE_ZONE');
      if (fire) {
        const dir = hunter.x > fire.x ? 1 : -1;
        hunter.vx = dir * 2.5;
      }
      break;
    }

    case G.USE_FIRE_BACKDROP: {
      // Stand near fire for dramatic silhouette — brief
      const fire = recall(hAI.memory, 'FIRE_ZONE');
      if (fire) {
        const targetX = fire.x + (hunter.x > fire.x ? 60 : -60);
        const d = Math.abs(targetX - hunter.x);
        if (d > 30) hunter.vx = (targetX > hunter.x ? 1 : -1) * 1.5;
        else {
          hunter.vx = 0;
          // Dramatic pause — spawn faint outline particles
          if (Math.random() < 0.06) {
            particles.push({
              x: hunter.x + hunter.w / 2, y: hunter.y - 5,
              vx: (Math.random() - 0.5), vy: -0.3,
              life: 25, color: 'rgba(255,140,40,0.2)', size: 3, type: 'shimmer',
            });
          }
        }
      }
      if (hAI.goalTimer > 3.0) hAI.goal = G.STALK;
      break;
    }

    case G.REPOSITION: {
      // Move perpendicular to player, find better angle
      hunter.vx = hunter.facing * 2.2;
      if (hunter.onGround && Math.random() < 0.02) hunter.vy = -9;
      if (hAI.goalTimer > 2.5) {
        hAI.flankDir *= -1;
        hAI.goal = G.STALK;
      }
      break;
    }

    case G.INSPECT_TRAP: {
      if (hAI.nearestTrapPos) {
        const d = Math.hypot(hAI.nearestTrapPos.x - hunter.x, hAI.nearestTrapPos.y - hunter.y);
        hunter.vx = (hAI.nearestTrapPos.x > hunter.x ? 1 : -1) * 1.5;
        if (d < 40 || hAI.goalTimer > 3.0) hAI.goal = G.DESTROY_TRAP;
      }
      break;
    }

    case G.CINEMATIC_IDLE: {
      hunter.vx *= 0.9;
      // Emit slow shimmer
      if (Math.random() < 0.03) {
        particles.push({
          x: hunter.x + Math.random() * hunter.w,
          y: hunter.y + Math.random() * hunter.h,
          vx: (Math.random() - 0.5) * 0.5, vy: -0.3,
          life: 20, color: 'rgba(100,220,255,0.2)', size: 2, type: 'shimmer',
        });
      }
      if (hAI.goalTimer > 2.0 + Math.random() * 2.0) hAI.goal = G.STALK;
      break;
    }
  }
}

// ─── PATTERN ADAPTATION ──────────────────────────────────────────────────────
function _adaptToPlayerPatterns(hunter, hAI, player, squad) {
  // Detect if player has been digging tunnels recently
  const tunnelMem = recall(hAI.memory, 'PLAYER_TUNNELS');
  if (tunnelMem && tunnelMem.count > 2) {
    hAI.playerUsesTunnels = true;
    // Add tunnel-counter preference when scoring next time
  }
  // Detect tree usage
  const treeMem = recall(hAI.memory, 'PLAYER_USES_TREES');
  if (treeMem) hAI.playerUsesTrees = true;

  // If squad is mostly dead, hunter becomes more aggressive
  if (squad) {
    const alive = squad.filter(m => m.alive).length;
    if (alive === 0 && hAI.phase === HUNTER_PHASE.STALK) {
      hAI.phase = HUNTER_PHASE.PRESSURE;
    }
  }
}

// ─── CINEMATIC MOMENTS ───────────────────────────────────────────────────────
function _tryCinematicMoment(hunter, hAI, player, firePatches, particles) {
  if (hAI.cinematicCooldown > 0) { hAI.cinematicCooldown--; return; }
  if (hAI.phase === HUNTER_PHASE.KILL || hAI.phase === HUNTER_PHASE.RETREAT) return;
  if (Math.random() > 0.35) return; // only 35% chance per 3s window

  const options = [CINEMATIC.SHIMMER_RIPPLE, CINEMATIC.SLOW_HEAD_TURN, CINEMATIC.PERCH_AND_WATCH];
  if (firePatches && firePatches.length > 0) options.push(CINEMATIC.FIRE_SILHOUETTE);

  const choice = options[Math.floor(Math.random() * options.length)];
  hAI.currentCinematic = choice;
  hAI.cinematicCooldown = 600; // 10s minimum between cinematics

  switch (choice) {
    case CINEMATIC.SHIMMER_RIPPLE:
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: hunter.x + Math.random() * hunter.w,
          y: hunter.y + Math.random() * hunter.h,
          vx: (Math.random() - 0.5) * 2, vy: -1,
          life: 20 + Math.random() * 15,
          color: 'rgba(120,220,255,0.4)', size: 2, type: 'shimmer',
        });
      }
      break;
    case CINEMATIC.SLOW_HEAD_TURN:
      // Just a state flag — renderer can use hunter.cinematicHead
      hunter.cinematicHead = true;
      setTimeout(() => { if (hunter) hunter.cinematicHead = false; }, 1500);
      break;
    case CINEMATIC.PERCH_AND_WATCH:
      hunter.cinematicPerching = true;
      setTimeout(() => { if (hunter) hunter.cinematicPerching = false; }, 2500);
      break;
  }
}

// ─── BARK TRIGGERS (squad reacts to Hunter events) ──────────────────────────
export function hunterEventBark(eventType, squad, player) {
  if (!squad) return;
  const alive = squad.filter(m => m.alive);
  if (alive.length === 0) return;
  const speaker = alive[Math.floor(Math.random() * alive.length)];

  const barkMap = {
    HUNTER_SPOTTED:    ['Movement!', "I saw something!", "He's here!", "Contact!"],
    HUNTER_IN_TREES:   ["He's in the trees!", "Up top!", "Tree line — watch it!"],
    SQUADMATE_DOWN:    ["Man down!", "We lost one!", "Stay tight!"],
    PLASMA_WARNING:    ["Incoming plasma!", "Move! Move!", "SCATTER!"],
    FIRE_SPREADING:    ["Fire's spreading!", "Stay out of it!"],
    HUNTER_RETREATING: ["He's pulling back!", "Regroup now!", "Hold this ground!"],
  };

  const barks = barkMap[eventType] || ["Stay sharp."];
  const text = barks[Math.floor(Math.random() * barks.length)];

  if (speaker.currentBark || (speaker.lastBarkTime && Date.now() - speaker.lastBarkTime < 4000)) return;
  speaker.currentBark = { text, life: 100 };
  speaker.lastBarkTime = Date.now();
}