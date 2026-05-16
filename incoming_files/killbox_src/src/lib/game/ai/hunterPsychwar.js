// HUNTER PSYCHOLOGICAL WARFARE + TERRAIN ABUSE + TROPHY SYSTEM
// LAST HUNT: KILLBOX
//
// Prompts 1, 3, 5, 7, 8 — all Hunter-side systems.
// Layered ON TOP of hunterAI.js. Does not replace combat.
//
// Systems included:
//   - Psychological deception (fake retreats, mimicry, body display, observation)
//   - Terrain abuse (cut ropes, collapse tunnels, ignite forest, destroy cover)
//   - Trophy evaluation (worthy prey scoring)
//   - Adaptation (tracks player patterns, changes strategy)
//   - Cinematic micro-moments (shoulder charge pose, branch silhouette, etc.)

import { TILE_SIZE, TILE } from '../constants';
import { getTile, setTile, isSolid } from '../worldGen';
import { createExplosion } from '../physics';
import { remember, recall, recallAll } from './aiMemory';

// ─── PSYCH WAR ACTIONS ───────────────────────────────────────────────────────
export const PSYCH_ACTION = {
  FAKE_RETREAT:          'FAKE_RETREAT',
  OBSERVATION_PERCH:     'OBSERVATION_PERCH',
  TRIGGER_DISTANT_TRAP:  'TRIGGER_DISTANT_TRAP',
  KILL_WILDLIFE:         'KILL_WILDLIFE',
  BREAK_TREE_NO_ATTACK:  'BREAK_TREE_NO_ATTACK',
  PLASMA_DISTRACTION:    'PLASMA_DISTRACTION',
  SHIMMER_REVEAL:        'SHIMMER_REVEAL',
  BODY_DISPLAY:          'BODY_DISPLAY',
  CIRCLE_BACK:           'CIRCLE_BACK',
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function createPsychState() {
  return {
    currentAction:      null,
    actionTimer:        0,
    cooldown:           0,
    _terrainCooldown:   0,    // explicit init — avoids falsy re-init bug
    _cinematicCooldown: 0,    // explicit init — avoids falsy re-init bug
    _trophyTimer:       0,    // explicit init
    observationPerchX:  0,
    observationPerchY:  0,
    fakeRetreatPhase:   0, // 0=leap, 1=cloak, 2=circle back
    fakeRetreatDir:     1,
    trophyScore:        0,
    cinematicTimer:     0,
    cinematicAction:    null,
    // Adaptation counters (persist per run)
    playerUndergroundCount:  0,
    playerTreeCount:         0,
    playerTrapStackCount:    0,
    playerFireHideCount:     0,
    adaptationThreshold:     3, // events before adapting
    adaptations: {
      collapseTunnels:   false,
      attackVertical:    false,
      destroyTraps:      false,
      rangeOnFireHide:   false,
    },
    // Body display
    displayedBodies:    [],
  };
}

// ─── MAIN UPDATE ─────────────────────────────────────────────────────────────
export function updateHunterPsych(
  hunter, psychState, player, squad, tiles, particles,
  traps, firePatches, wildlife, treeEntities, deltaTime
) {
  if (!hunter.alive) return;
  const dt = deltaTime / 1000;

  // Tick cooldown
  if (psychState.cooldown > 0) { psychState.cooldown -= dt; return; }

  // Tick active action
  if (psychState.currentAction) {
    _tickPsychAction(hunter, psychState, player, squad, tiles, particles,
                     traps, wildlife, treeEntities, dt);
    return;
  }

  // Evaluate: should we do a psych action?
  _evaluatePsychAction(hunter, psychState, player, squad, tiles, particles,
                       traps, firePatches, wildlife, treeEntities, dt);
}

// ─── EVALUATION ──────────────────────────────────────────────────────────────
function _evaluatePsychAction(
  hunter, ps, player, squad, tiles, particles,
  traps, firePatches, wildlife, treeEntities, dt
) {
  const dist       = Math.hypot(player.x - hunter.x, player.y - hunter.y);
  const healthPct  = hunter.health / hunter.maxHealth;
  const aiPhase    = hunter.aiPhase || 'STALK';
  const aliveSquad = squad ? squad.filter(m => m.alive) : [];

  // Don't do psych actions while actively attacking
  if (hunter.aiState === 'attack') return;

  // Score each action
  const candidates = [];

  // FAKE RETREAT — mid-to-late probe/pressure
  if (['PROBE','PRESSURE'].includes(aiPhase) && healthPct > 0.5 && dist < 300 && Math.random() < 0.008) {
    candidates.push({ action: PSYCH_ACTION.FAKE_RETREAT, score: 0.7 });
  }

  // OBSERVATION PERCH — early stalk
  if (aiPhase === 'STALK' && dist > 200 && Math.random() < 0.01) {
    candidates.push({ action: PSYCH_ACTION.OBSERVATION_PERCH, score: 0.8 });
  }

  // KILL WILDLIFE — nearby animal, any phase, rare
  if (wildlife && wildlife.rats && Math.random() < 0.005) {
    const nearRat = wildlife.rats.find(r =>
      r.alive && Math.hypot(r.x - hunter.x, r.y - hunter.y) < 180
    );
    if (nearRat) candidates.push({ action: PSYCH_ACTION.KILL_WILDLIFE, score: 0.6, target: nearRat });
  }

  // BREAK TREE (scare tactic) — probe phase
  if (aiPhase === 'PROBE' && Math.random() < 0.006) {
    candidates.push({ action: PSYCH_ACTION.BREAK_TREE_NO_ATTACK, score: 0.55 });
  }

  // SHIMMER REVEAL (intentional) — pressure phase, bait
  if (aiPhase === 'PRESSURE' && hunter.cloaked && dist < 350 && Math.random() < 0.007) {
    candidates.push({ action: PSYCH_ACTION.SHIMMER_REVEAL, score: 0.5 });
  }

  // BODY DISPLAY — after killing a squadmate, rare and impactful
  const recentKill = recall(hunter.hAI?.memory, 'KILLED_SQUADMATE');
  if (recentKill && ps.displayedBodies.length === 0 && Math.random() < 0.015) {
    candidates.push({ action: PSYCH_ACTION.BODY_DISPLAY, score: 0.9, killPos: recentKill });
  }

  // PLASMA DISTRACTION — fire into distant terrain while cloaked
  if (hunter.cloaked && aiPhase !== 'RETREAT' && Math.random() < 0.006) {
    candidates.push({ action: PSYCH_ACTION.PLASMA_DISTRACTION, score: 0.45 });
  }

  if (candidates.length === 0) return;

  // Pick highest score
  candidates.sort((a, b) => b.score - a.score);
  const chosen = candidates[0];

  _startPsychAction(hunter, ps, chosen.action, player, squad, tiles, particles,
                    traps, wildlife, chosen, dt);
}

// ─── START ACTION ─────────────────────────────────────────────────────────────
function _startPsychAction(hunter, ps, action, player, squad, tiles, particles,
                            traps, wildlife, opts, dt) {
  ps.currentAction = action;
  ps.actionTimer   = 0;

  switch (action) {
    case PSYCH_ACTION.FAKE_RETREAT:
      ps.fakeRetreatPhase = 0;
      ps.fakeRetreatDir   = hunter.x > player.x ? 1 : -1; // run away from player
      hunter.cloaked = false; // brief decloak so player SEES the retreat
      _hunterBark(hunter, "click-click"); // mandible click
      break;

    case PSYCH_ACTION.OBSERVATION_PERCH:
      // Pick a high position near current location
      ps.observationPerchX = hunter.x + (Math.random() - 0.5) * 80;
      ps.observationPerchY = hunter.y - 64;
      break;

    case PSYCH_ACTION.KILL_WILDLIFE:
      if (opts.target) {
        opts.target.alive = false;
        // Splatter particles
        for (let i = 0; i < 8; i++) {
          particles.push({
            x: opts.target.x, y: opts.target.y,
            vx: (Math.random() - 0.5) * 5,
            vy: -1 - Math.random() * 3,
            life: 20, color: '#aa2200', size: 2, type: 'debris',
          });
        }
        // Leave corpse near player's camp
        ps.displayedBodies.push({ x: opts.target.x, y: opts.target.y, type: 'animal', timer: 600 });
        _squadBarkFromEvent(squad, 'ANIMAL_KILLED');
      }
      ps.currentAction = null; // instant
      ps.cooldown = 12.0;
      return;

    case PSYCH_ACTION.BODY_DISPLAY:
      if (opts.killPos) {
        // Drag body toward camp (simulate by placing a display marker near player)
        const bodyX = player.x + (Math.random() - 0.5) * 120;
        const bodyY = player.y - 30;
        ps.displayedBodies.push({ x: bodyX, y: bodyY, type: 'squadmate', timer: 1200 });
        // Broadcast horror to squad
        if (squad) {
          for (const m of squad) {
            if (m.alive) {
              m._moraleEvent = 'BODY_DISPLAYED'; // picked up by morale system
            }
          }
        }
        _squadBarkFromEvent(squad, 'BODY_DISPLAYED');
      }
      ps.currentAction = null;
      ps.cooldown = 30.0;
      return;

    case PSYCH_ACTION.SHIMMER_REVEAL:
      hunter.cloakFlicker = 0.85; // very visible for a moment
      break;

    case PSYCH_ACTION.PLASMA_DISTRACTION:
      // Aim far from player
      ps.distractionX = player.x + (Math.random() > 0.5 ? 300 : -300);
      ps.distractionY = player.y;
      break;
  }
}

// ─── TICK ACTIVE ACTION ───────────────────────────────────────────────────────
function _tickPsychAction(hunter, ps, player, squad, tiles, particles,
                           traps, wildlife, treeEntities, dt) {
  ps.actionTimer += dt;
  const action = ps.currentAction;

  switch (action) {
    case PSYCH_ACTION.FAKE_RETREAT: {
      switch (ps.fakeRetreatPhase) {
        case 0: // Phase 0 — Leap visibly away (player sees the "retreat")
          hunter.vx = ps.fakeRetreatDir * 3.5;
          if (hunter.onGround && ps.actionTimer < 0.3) hunter.vy = -10;
          if (ps.actionTimer > 1.2) { ps.fakeRetreatPhase = 1; ps.actionTimer = 0; }
          break;
        case 1: // Phase 1 — Cloak mid-air, appear to vanish
          hunter.cloaked = true;
          hunter.cloakFlicker = 0.6; // visible flicker so player tracks it disappearing
          hunter.vx *= 0.85;
          if (ps.actionTimer > 0.8) { hunter.cloakFlicker = 0.08; } // gone
          if (ps.actionTimer > 1.5) { ps.fakeRetreatPhase = 2; ps.actionTimer = 0; }
          break;
        case 2: // Phase 2 — Lurk in cover (brief pause before circle-back)
          hunter.vx = 0;
          hunter.cloaked = true;
          // Emit faint shimmer — attentive players may notice
          if (Math.random() < 0.03) {
            particles.push({
              x: hunter.x + Math.random() * hunter.w,
              y: hunter.y + Math.random() * hunter.h,
              vx: 0, vy: -0.3, life: 14,
              color: 'rgba(100,210,255,0.2)', size: 2, type: 'shimmer',
            });
          }
          if (ps.actionTimer > 1.2) { ps.fakeRetreatPhase = 3; ps.actionTimer = 0; }
          break;
        case 3: // Phase 3 — Circle back from OPPOSITE side — the reveal
          hunter.vx = -ps.fakeRetreatDir * 2.8;
          if (ps.actionTimer > 2.5) {
            ps.currentAction = null;
            ps.cooldown = 20.0;
            hunter.cloaked = true;
          }
          break;
      }
      break;
    }

    case PSYCH_ACTION.OBSERVATION_PERCH: {
      // Move toward perch position
      const dx = ps.observationPerchX - hunter.x;
      const dy = ps.observationPerchY - hunter.y;
      hunter.vx = Math.sign(dx) * 1.5;
      if (Math.abs(dy) > 20 && hunter.onGround) hunter.vy = -9;
      hunter.cloaked = true;
      // After 5-8 seconds, just watching
      if (ps.actionTimer > 5.0 + Math.random() * 3.0) {
        // Emit faint shimmer so attentive player might notice
        if (Math.random() < 0.04) {
          particles.push({
            x: hunter.x + Math.random() * hunter.w,
            y: hunter.y + Math.random() * hunter.h,
            vx: 0, vy: -0.3,
            life: 18, color: 'rgba(100,210,255,0.25)', size: 2, type: 'shimmer',
          });
        }
      }
      if (ps.actionTimer > 10.0) {
        ps.currentAction = null;
        ps.cooldown = 15.0;
      }
      break;
    }

    case PSYCH_ACTION.BREAK_TREE_NO_ATTACK: {
      // Walk up to a nearby tree and destroy it — then walk away without attacking
      if (ps.actionTimer < 2.0) {
        hunter.vx = hunter.facing * 2.2;
        // Chop tiles
        if (ps.actionTimer > 0.8 && Math.floor(ps.actionTimer * 10) % 5 === 0) {
          const tx = Math.floor((hunter.x + hunter.w / 2 + hunter.facing * TILE_SIZE) / TILE_SIZE);
          const ty = Math.floor((hunter.y + hunter.h / 2) / TILE_SIZE);
          const t = getTile(tiles, tx, ty);
          if (t === TILE.WOOD || t === TILE.LEAVES) {
            setTile(tiles, tx, ty, TILE.AIR);
            for (let i = 0; i < 5; i++) {
              particles.push({
                x: tx * TILE_SIZE, y: ty * TILE_SIZE,
                vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3,
                life: 20, color: '#8a6a3a', size: 3, type: 'debris',
              });
            }
          }
        }
      } else if (ps.actionTimer < 4.0) {
        // Walk away — unconcerned
        hunter.vx = -hunter.facing * 1.5;
        hunter.cloaked = true;
      } else {
        ps.currentAction = null;
        ps.cooldown = 18.0;
      }
      break;
    }

    case PSYCH_ACTION.SHIMMER_REVEAL: {
      // Pulse visible then vanish
      if (ps.actionTimer < 0.8) {
        hunter.cloakFlicker = 0.7 + Math.sin(ps.actionTimer * 12) * 0.25;
      } else {
        hunter.cloaked = true;
        hunter.cloakFlicker = 0.08;
        ps.currentAction = null;
        ps.cooldown = 25.0;
      }
      break;
    }

    case PSYCH_ACTION.PLASMA_DISTRACTION: {
      // Fire plasma toward distant terrain (not player)
      hunter.vx = 0;
      if (ps.actionTimer > 1.0) {
        // Spawn a plasma projectile aimed at distraction point
        const angle = Math.atan2(
          ps.distractionY - hunter.y,
          ps.distractionX - hunter.x
        );
        // We signal via hunter._psychPlasmaShot for engine to handle
        hunter._psychPlasmaShot = {
          x: hunter.x + hunter.w / 2,
          y: hunter.y + 10,
          angle,
        };
        ps.currentAction = null;
        ps.cooldown = 20.0;
      }
      break;
    }

    case PSYCH_ACTION.OBSERVATION_PERCH:
      // handled above
      break;
  }
}

// ─── TERRAIN ABUSE (Prompt 5) ─────────────────────────────────────────────────
export function updateHunterTerrainAbuse(
  hunter, psychState, player, squad, tiles, particles, traps, treeEntities, firePatches, dt
) {
  if (!hunter.alive) return;
  psychState._terrainCooldown -= dt;
  if (psychState._terrainCooldown > 0) return;

  const phase = hunter.aiPhase || 'STALK';
  if (!['PRESSURE','KILL','PROBE'].includes(phase)) return;

  const roll = Math.random();

  // IGNITE FOREST — shoot plasma into dry foliage near player
  if (roll < 0.004 && firePatches && traps) {
    const targetX = player.x + (Math.random() - 0.5) * 160;
    const targetY = player.y - 20;
    const tx = Math.floor(targetX / TILE_SIZE);
    const ty = Math.floor(targetY / TILE_SIZE);
    const tile = getTile(tiles, tx, ty);
    if (tile === TILE.LEAVES || tile === TILE.GRASS || tile === TILE.WOOD) {
      firePatches.push({ x: targetX, y: targetY, life: 180, spreadTimer: 30 });
      _squadBarkFromEvent(squad, 'FIRE_SPREADING');
      psychState._terrainCooldown = 25.0;
      return;
    }
  }

  // COLLAPSE TUNNEL — cave in tiles above a dug shaft
  if (roll < 0.003 && psychState.adaptations?.collapseTunnels) {
    const tunnelMem = recall(hunter.hAI?.memory, 'PLAYER_TUNNELS');
    if (tunnelMem) {
      const tx = Math.floor(tunnelMem.x / TILE_SIZE);
      const ty = Math.floor(tunnelMem.y / TILE_SIZE) - 2;
      for (let i = 0; i < 3; i++) {
        const t = getTile(tiles, tx, ty + i);
        if (t === TILE.AIR) {
          setTile(tiles, tx, ty + i, TILE.DIRT);
          particles.push({
            x: tx * TILE_SIZE, y: (ty + i) * TILE_SIZE,
            vx: 0, vy: 0, life: 30, color: '#4a3728', size: 4, type: 'debris',
          });
        }
      }
      psychState._terrainCooldown = 30.0;
      _squadBarkFromEvent(squad, 'TUNNEL_COLLAPSED');
      return;
    }
  }

  // DESTROY COVER — blast a tile cluster the player uses for cover
  if (roll < 0.003) {
    const distToPlayer = Math.hypot(player.x - hunter.x, player.y - hunter.y);
    if (distToPlayer < 300) {
      const coverX = player.x + player.facing * 40;
      const coverY = player.y;
      createExplosion(coverX, coverY, 32, tiles, particles);
      psychState._terrainCooldown = 20.0;
      return;
    }
  }

  psychState._terrainCooldown = 5.0;
}

// ─── TROPHY SYSTEM (Prompt 3) ─────────────────────────────────────────────────
export function evaluateTrophyWorth(hunter, psychState, player) {
  let score = 0;

  // Heavy weapon
  if (player.weaponState?.current === 'm60' || player.weaponState?.current === 'minigun') score += 40;
  // Trap master (more than 3 traps placed)
  if ((player.trapsPlaced || 0) >= 3) score += 30;
  // Stealth player (mud coat active)
  if ((player.mudAmount || 0) > 0.5) score += 25;
  // Low health (weak/fleeing) — LESS interesting
  if (player.health < player.maxHealth * 0.2) score -= 20;
  // Combat veteran (took damage but still fighting)
  if (player.health < player.maxHealth * 0.6 && player.health > player.maxHealth * 0.2) score += 15;

  psychState.trophyScore = score;
  return score;
}

export function tryTrophyMoment(hunter, psychState, player, squad, particles, dt) {
  if (!psychState._trophyPending) return;
  const score = evaluateTrophyWorth(hunter, psychState, player);

  if (score >= 40) {
    // Worthy prey — perform trophy
    if (!psychState._trophyTimer) psychState._trophyTimer = 0;
    psychState._trophyTimer += dt;

    // Phase 1: Roar (shimmer burst)
    if (psychState._trophyTimer < 1.0) {
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: hunter.x + hunter.w / 2 + (Math.random() - 0.5) * 40,
          y: hunter.y - 10,
          vx: (Math.random() - 0.5) * 4, vy: -2 - Math.random() * 3,
          life: 25, color: 'rgba(0,255,170,0.6)', size: 3, type: 'glow',
        });
      }
      hunter.cloaked = false;
    }
    // Phase 2: Stand over kill
    if (psychState._trophyTimer > 1.0 && psychState._trophyTimer < 3.5) {
      hunter.vx = 0;
    }
    // Phase 3: Retreat
    if (psychState._trophyTimer > 3.5) {
      psychState._trophyPending  = false;
      psychState._trophyTimer    = 0;
      hunter.cloaked = true;
      if (squad) _squadBarkFromEvent(squad, 'HUNTER_TROPHY');
    }
  } else {
    // Unworthy — just leave
    psychState._trophyPending = false;
  }
}

// ─── HUNTER ADAPTATION (Prompt 7) ────────────────────────────────────────────
export function recordPlayerBehavior(psychState, behaviorType) {
  switch (behaviorType) {
    case 'UNDERGROUND': psychState.playerUndergroundCount++; break;
    case 'TREE':        psychState.playerTreeCount++;        break;
    case 'TRAP_STACK':  psychState.playerTrapStackCount++;   break;
    case 'FIRE_HIDE':   psychState.playerFireHideCount++;    break;
  }
  _checkAdaptations(psychState);
}

function _checkAdaptations(ps) {
  const T = ps.adaptationThreshold;
  if (ps.playerUndergroundCount >= T) ps.adaptations.collapseTunnels  = true;
  if (ps.playerTreeCount        >= T) ps.adaptations.attackVertical    = true;
  if (ps.playerTrapStackCount   >= T) ps.adaptations.destroyTraps      = true;
  if (ps.playerFireHideCount    >= T) ps.adaptations.rangeOnFireHide   = true;
}

// ─── CINEMATIC MOMENTS (Prompt 8) ────────────────────────────────────────────
export const HUNTER_CINEMATIC = {
  SHOULDER_CHARGE_POSE: 'SHOULDER_CHARGE_POSE',
  BRANCH_SILHOUETTE:    'BRANCH_SILHOUETTE',
  CLOAK_SHIMMER_PAUSE:  'CLOAK_SHIMMER_PAUSE',
};

export function tryCinematicMoment(hunter, psychState, player, particles, dt) {
  psychState._cinematicCooldown -= dt;
  if (psychState._cinematicCooldown > 0) return;
  if (Math.random() > 0.12) return; // ~12% per check cycle

  const dist = Math.hypot(player.x - hunter.x, player.y - hunter.y);
  const options = [HUNTER_CINEMATIC.CLOAK_SHIMMER_PAUSE];
  if (dist > 200) options.push(HUNTER_CINEMATIC.BRANCH_SILHOUETTE);
  if (hunter.mode === 'plasma') options.push(HUNTER_CINEMATIC.SHOULDER_CHARGE_POSE);

  const choice = options[Math.floor(Math.random() * options.length)];
  psychState.cinematicAction = choice;
  psychState._cinematicCooldown = 18.0;

  switch (choice) {
    case HUNTER_CINEMATIC.SHOULDER_CHARGE_POSE:
      // Raise shoulder cannon — slow, deliberate
      hunter._shoulderRaise = true;
      hunter.vx = 0;
      setTimeout(() => { if (hunter) hunter._shoulderRaise = false; }, 1800);
      break;

    case HUNTER_CINEMATIC.BRANCH_SILHOUETTE:
      // Move to elevated position, stand still
      hunter.cinematicPerching = true;
      if (hunter.onGround) hunter.vy = -10;
      setTimeout(() => { if (hunter) hunter.cinematicPerching = false; }, 2500);
      break;

    case HUNTER_CINEMATIC.CLOAK_SHIMMER_PAUSE:
      // Brief full stop + shimmer pulse
      hunter.vx = 0;
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: hunter.x + Math.random() * hunter.w,
          y: hunter.y + Math.random() * hunter.h,
          vx: (Math.random() - 0.5) * 2, vy: -0.5,
          life: 22, color: 'rgba(120,220,255,0.45)', size: 2, type: 'shimmer',
        });
      }
      break;
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function _hunterBark(hunter, text) {
  hunter._psychBark = { text, timer: 80 };
}

function _squadBarkFromEvent(squad, event) {
  if (!squad) return;
  const alive = squad.filter(m => m.alive);
  if (alive.length === 0) return;
  const speaker = alive[Math.floor(Math.random() * alive.length)];
  const barkMap = {
    ANIMAL_KILLED:      ['What was that?!', 'Something\'s out there...', 'You hear that?'],
    BODY_DISPLAYED:     ['OH GOD—', 'They\'re GONE.', '...Dios mio.'],
    FIRE_SPREADING:     ['Fire! Stay out of it!', 'The jungle\'s burning!'],
    TUNNEL_COLLAPSED:   ['He collapsed the tunnel!', 'We\'re cut off!'],
    HUNTER_TROPHY:      ['Run. RUN!', 'He\'s not done.', '...oh no.'],
  };
  const barks = barkMap[event] || ['Stay sharp.'];
  const text = barks[Math.floor(Math.random() * barks.length)];
  const now = Date.now();
  if (now - (speaker.lastBarkTime || 0) > 3000) {
    speaker.currentBark = { text, life: 120 };
    speaker.lastBarkTime = now;
  }
}

// Squad cinematic moments (Prompt 8)
export const SQUAD_CINEMATIC = {
  RELOAD_UNDER_PRESSURE: 'RELOAD_UNDER_PRESSURE',
  DRAG_WOUNDED:          'DRAG_WOUNDED',
  PANIC_RELOAD:          'PANIC_RELOAD',
  HAND_SIGNAL:           'HAND_SIGNAL',
};

export function trySquadCinematic(member, squad, hunter, player, dt) {
  if (member._sqCinCooldown === undefined) member._sqCinCooldown = 0;
  member._sqCinCooldown -= dt;
  if (member._sqCinCooldown > 0) return;
  if (Math.random() > 0.06) return;

  const options = [];
  const morale = member.morale;
  const dist = hunter ? Math.hypot(hunter.x - member.x, hunter.y - member.y) : 9999;

  if (dist < 200 && morale?.fear > 0.5) options.push(SQUAD_CINEMATIC.PANIC_RELOAD);
  if (dist < 300 && !morale?.isPanicking) options.push(SQUAD_CINEMATIC.RELOAD_UNDER_PRESSURE);
  if (squad?.some(m => m.id !== member.id && m.alive && m.health < m.maxHealth * 0.3)) {
    options.push(SQUAD_CINEMATIC.DRAG_WOUNDED);
  }
  if (dist > 200 && morale?.isSilent) options.push(SQUAD_CINEMATIC.HAND_SIGNAL);

  if (options.length === 0) return;
  const choice = options[Math.floor(Math.random() * options.length)];
  member.cinematicAction = choice;
  member._sqCinCooldown = 12.0;

  switch (choice) {
    case SQUAD_CINEMATIC.PANIC_RELOAD:
      member.vx = 0;
      member._cinematicAnim = { type: 'PANIC_RELOAD', timer: 1.5 };
      break;
    case SQUAD_CINEMATIC.RELOAD_UNDER_PRESSURE:
      member.vx = 0;
      member._cinematicAnim = { type: 'RELOAD', timer: 1.2 };
      break;
    case SQUAD_CINEMATIC.HAND_SIGNAL:
      member.vx = 0;
      member._cinematicAnim = { type: 'HAND_SIGNAL', timer: 0.8 };
      break;
  }
}
