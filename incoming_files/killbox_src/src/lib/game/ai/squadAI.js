// SQUAD AI BRAIN — LAST HUNT: KILLBOX
// Modular squad AI director. Runs alongside existing squadOrchestrator.
// Adds: group tactics, combat reactions, rich prep behaviour, bark triggers.
// Injects supplementary goals — does NOT replace existing state machine.

import { TILE_SIZE } from '../constants';
import { raycast } from '../physics';
import {
  createMemory, tickMemory,
  squadSawHunter, squadHeardHunter, squadNotesDanger,
  recall, remember, forget,
} from './aiMemory';
// hunterEventBark removed — squad barks handled by local _bark/_pickBark

// ─── Squad roles ─────────────────────────────────────────────────────────────
export const SQUAD_ROLE = {
  AGGRESSIVE: 'AGGRESSIVE',   // MAC
  AMBUSH:     'AMBUSH',       // BILLIE
  DEFENSIVE:  'DEFENSIVE',    // PONCHO
};

// Combat role map by archetype (separate from squad.config 'role' field)
const ARCHETYPE_ROLE = {
  MAC:    SQUAD_ROLE.AGGRESSIVE,
  BILLIE: SQUAD_ROLE.AMBUSH,
  PONCHO: SQUAD_ROLE.DEFENSIVE,
};

// ─── Shared group state (one per squad array) ─────────────────────────────────
export function createSquadGroupState() {
  return {
    memory:          createMemory(),
    hunterConfidence: 0.0,
    lastHunterPos:   null,
    groupAlert:      false,   // true when any member has seen hunter recently
    groupAlertTimer: 0,
    tacticalRole:    {},      // memberId → assigned group role
    groupTimer:      0,
    barkCooldown:    0,
  };
}

// ─── Per-member AI state ──────────────────────────────────────────────────────
export function initMemberAIState(member) {
  if (member._aiInit) return;
  member._aiInit = true;
  member.memory = createMemory();
  // Use combatRole to avoid clobbering squad.config's 'role' field (gung_ho etc.)
  member.combatRole = ARCHETYPE_ROLE[member.archetype] || SQUAD_ROLE.AGGRESSIVE;
  member.combatAlertTimer = 0;
  member.suppressTimer = 0;
  member.lastBarkTime = 0;
  member.flanking = false;
  member.guardingDir = 1;
}

// ─── MAIN UPDATE ─────────────────────────────────────────────────────────────
// Call once per frame for each living squad member.
export function updateSquadAI(member, player, hunter, squad, tiles, particles, firePatches, gs, groupState, dt) {
  initMemberAIState(member);
  if (!member.alive) return;

  tickMemory(member.memory, dt);
  tickMemory(groupState.memory, dt);  // expire stale group memories
  groupState.groupTimer += dt;
  if (groupState.barkCooldown > 0) groupState.barkCooldown -= dt;

  // ── Sense ────────────────────────────────────────────────────────────────
  _memberSense(member, hunter, player, squad, tiles, firePatches, groupState, dt);

  // ── Group tactics (every 1.5s) ───────────────────────────────────────────
  if (groupState.groupTimer > 1.5) {
    groupState.groupTimer = 0;
    _assignGroupRoles(squad, player, hunter, groupState);
    _groupBarkCheck(squad, hunter, player, groupState);
  }

  // ── Inject rich combat state ─────────────────────────────────────────────
  _injectCombatGoal(member, hunter, player, squad, tiles, firePatches, groupState, particles, dt, gs);
}

// ─── SENSE ───────────────────────────────────────────────────────────────────
function _memberSense(member, hunter, player, squad, tiles, firePatches, groupState, dt) {
  if (!hunter || !hunter.alive) {
    groupState.hunterConfidence = Math.max(0, groupState.hunterConfidence - 0.03 * dt * 60);
    return;
  }

  const dist = Math.hypot(hunter.x - member.x, hunter.y - member.y);
  const los = dist < 380 ? raycast(
    member.x + 7, member.y + 11,
    hunter.x + hunter.w / 2, hunter.y + hunter.h / 2,
    tiles, 400
  ) : { hit: true };

  // Visibility — BILLIE spots shimmer better (ambush specialist)
  const shimmerBonus = member.combatRole === SQUAD_ROLE.AMBUSH ? 0.25 : 0.0;
  const cloakPenalty = hunter.cloaked ? Math.max(0, 1 - (hunter.cloakVisibility || 0.1) - shimmerBonus) : 0;

  if (!los.hit && dist < 320 && Math.random() > cloakPenalty) {
    const conf = Math.min(1.0, (dist < 150 ? 1.0 : 0.75));
    groupState.hunterConfidence = Math.min(1.0, groupState.hunterConfidence + 0.12);
    squadSawHunter(member.memory, hunter.x, hunter.y);
    squadSawHunter(groupState.memory, hunter.x, hunter.y); // shared
    groupState.lastHunterPos = { x: hunter.x, y: hunter.y };
    groupState.groupAlert = true;
    groupState.groupAlertTimer = 6.0; // 6 seconds of group alert
    member.combatAlertTimer = 5.0;

    // Bark: hunter spotted
    if (groupState.barkCooldown <= 0) {
      _bark(member, _pickBark(member, 'HUNTER_SPOTTED'), 90);
      groupState.barkCooldown = 5.0;
    }
  } else {
    groupState.hunterConfidence = Math.max(0, groupState.hunterConfidence - 0.02 * dt * 60);
  }

  // Tick group alert
  if (groupState.groupAlertTimer > 0) {
    groupState.groupAlertTimer -= dt;
    if (groupState.groupAlertTimer <= 0) groupState.groupAlert = false;
  }
  if (member.combatAlertTimer > 0) member.combatAlertTimer -= dt;

  // Fire avoidance sense
  if (firePatches) {
    for (const fp of firePatches) {
      const fd = Math.hypot(fp.x - member.x, fp.y - member.y);
      if (fd < 80) {
        squadNotesDanger(member.memory, fp.x, fp.y, 'FIRE');
        if (groupState.barkCooldown <= 0 && Math.random() < 0.3) {
          _bark(member, "Fire's spreading!", 70);
          groupState.barkCooldown = 8.0;
        }
        break;
      }
    }
  }
}

// ─── GROUP ROLE ASSIGNMENT ────────────────────────────────────────────────────
function _assignGroupRoles(squad, player, hunter, groupState) {
  const alive = squad ? squad.filter(m => m.alive) : [];
  if (alive.length === 0) return;

  // Only reassign during active alert
  if (!groupState.groupAlert) return;

  // Default role assignments — personality-driven
  for (const m of alive) {
    if (!m.combatRole) m.combatRole = ARCHETYPE_ROLE[m.archetype] || SQUAD_ROLE.AGGRESSIVE;
    groupState.tacticalRole[m.id] = m.combatRole;
  }

  // If Hunter is above (tree mode) — BILLIE tracks, MAC suppresses, PONCHO falls back
  if (hunter && hunter.mode === 'tree') {
    for (const m of alive) {
      if (m.archetype === 'BILLIE') groupState.tacticalRole[m.id] = 'TRACK_HIGH';
      if (m.archetype === 'MAC')    groupState.tacticalRole[m.id] = 'SUPPRESS';
      if (m.archetype === 'PONCHO') groupState.tacticalRole[m.id] = 'FALL_BACK';
    }
  }

  // If player isolated — nearest member moves close
  if (player) {
    const closestToPlayer = alive.reduce((best, m) => {
      const d = Math.hypot(m.x - player.x, m.y - player.y);
      return d < (best.d || Infinity) ? { m, d } : best;
    }, {});
    if (closestToPlayer.d > 180) {
      groupState.tacticalRole[closestToPlayer.m?.id] = 'GUARD_PLAYER';
    }
  }
}

// ─── COMBAT GOAL INJECTION ────────────────────────────────────────────────────
function _injectCombatGoal(member, hunter, player, squad, tiles, firePatches, groupState, particles, dt, gs) {
  if (!hunter || !hunter.alive) return;

  const role = groupState.tacticalRole[member.id] || member.combatRole;
  const dist = Math.hypot(hunter.x - member.x, hunter.y - member.y);
  const playerDist = Math.hypot(player.x - member.x, player.y - member.y);
  const fireDanger = recall(member.memory, 'DANGER_FIRE');

  // ── Fire avoidance overrides everything ──────────────────────────────────
  if (fireDanger) {
    const dir = member.x > fireDanger.x ? 1 : -1;
    member.vx = dir * (member.speed || 2.5);
    member.facing = dir;
    forget(member.memory, 'DANGER_FIRE');
    return;
  }

  // ── During alert: combat behaviour ───────────────────────────────────────
  // Don't override vx during prep-phase initiative tasks (let orchestrator drive)
  const inInitiative = member.aiState?.currentAction?.startsWith('CHOP_TREE') ||
                       member.aiState?.currentAction === 'INITIATIVE_TASK';
  if (groupState.groupAlert && member.combatAlertTimer > 0 && !inInitiative) {
    switch (role) {
      case SQUAD_ROLE.AGGRESSIVE:
      case 'SUPPRESS': {
        // MAC: advance and suppress
        if (dist > 200 && hunter.alive) {
          member.vx = (hunter.x > member.x ? 1 : -1) * (member.speed || 3.2);
          member.facing = hunter.x > member.x ? 1 : -1;
          // Suppress fire bark
          if (member.suppressTimer <= 0 && Math.random() < 0.05) {
            _bark(member, _pickBark(member, 'SUPPRESSING'), 60);
            member.suppressTimer = 4.0;
          }
        } else if (dist < 80) {
          // Too close — back off slightly
          member.vx = -(hunter.x > member.x ? 1 : -1) * 1.5;
        }
        if (member.suppressTimer > 0) member.suppressTimer -= dt;
        break;
      }

      case SQUAD_ROLE.AMBUSH:
      case 'TRACK_HIGH': {
        // BILLIE: find high ground, hold it, watch
        if (!member.isAmbushing) {
          // Move toward slight elevation
          const upDir = member.y > (player.y - 60) ? -1 : 0;
          if (upDir !== 0 && member.onGround && member.jumpCooldown <= 0) {
            member.vy = -8.0;
            member.jumpCooldown = 1.2;
          }
          member.vx = (hunter.x > member.x ? 1 : -1) * 1.5;
        } else {
          member.vx = 0; // Hold ambush position
        }
        break;
      }

      case SQUAD_ROLE.DEFENSIVE:
      case 'FALL_BACK': {
        // PONCHO: stay near player, guard rear — and lob GL rounds at the Hunter
        if (playerDist > 120) {
          member.vx = (player.x > member.x ? 1 : -1) * (member.speed || 2.0);
          member.facing = player.x > member.x ? 1 : -1;
        } else {
          member.vx = 0;
          // Watch rear — face away from hunter
          member.facing = hunter.x > member.x ? -1 : 1;
        }

        // ── Grenade Launcher fire at Hunter ──────────────────────────────
        // Lob a GL round on a physics-arc every ~3s when Hunter is visible
        if (!member.glCooldown) member.glCooldown = 0;
        member.glCooldown -= dt;
        const hunterVisible = groupState.hunterConfidence > 0.4 && dist < 500;
        if (hunterVisible && member.glCooldown <= 0 && gs && gs.projectiles) {
          member.glCooldown = 3.0 + Math.random() * 1.5; // 3-4.5s between shots

          // Aim: arc from Poncho chest toward Hunter with physics trajectory
          const muzzleX = member.x + member.w / 2;
          const muzzleY = member.y + member.h * 0.35; // chest height
          const targetX  = hunter.x + hunter.w / 2;
          const targetY  = hunter.y + hunter.h / 2;

          const dx2 = targetX - muzzleX;
          const dy2 = targetY - muzzleY;
          const dist2D = Math.hypot(dx2, dy2);

          // Physics arc: solve for launch angle to hit (targetX, targetY)
          // Use a fixed launch speed, compute angle analytically
          const speed = 9.0;
          const g = 0.35; // matches physics.js GRAVITY
          // Simple low-arc: aim slightly above direct line, let gravity do rest
          const arcBoost = Math.max(-3.5, Math.min(0.5, -dist2D * 0.012)); // upward bias for distance
          const aimAngle = Math.atan2(dy2, dx2) + arcBoost;

          const vx = Math.cos(aimAngle) * speed;
          const vy = Math.sin(aimAngle) * speed;

          gs.projectiles.push({
            x: muzzleX,
            y: muzzleY,
            vx,
            vy,
            type: 'gl_round',          // handled in engine.js update loop
            damage: 45,
            explosionRadius: 70,
            fireRadius: 50,
            gravityScale: 1.0,         // full arc gravity
            owner: 'squad',
            life: 220,
            detonateOnContact: true,   // contact detonation
            weaponId: 'grenade_launcher',
          });

          // Bark on fire
          if (groupState.barkCooldown <= 0) {
            _bark(member, "Grenade out!", 70);
            groupState.barkCooldown = 4.0;
          }

          // Muzzle smoke puff particles
          if (gs.particles) {
            gs.particles.push({
              x: muzzleX + dx2 / dist2D * 10,
              y: muzzleY + dy2 / dist2D * 10,
              vx: vx * 0.15 + (Math.random() - 0.5),
              vy: vy * 0.15 - 0.8,
              life: 40, color: '#998866', size: 5, type: 'smoke',
            });
          }

          // Camera shake for squad GL shot
          if (gs.screenShake) {
            gs.screenShake.intensity = Math.max(gs.screenShake.intensity, 4);
          }
        }
        break;
      }

      case 'GUARD_PLAYER': {
        if (playerDist > 80) {
          member.vx = (player.x > member.x ? 1 : -1) * (member.speed || 2.5);
        } else {
          member.vx = 0;
          member.facing = hunter.x > member.x ? 1 : -1;
        }
        break;
      }
    }

    // Jump when blocked
    if (member.onGround && member.jumpCooldown <= 0 && Math.abs(member.vx) > 0.5) {
      const checkX = member.x + member.vx * 5;
      const checkTx = Math.floor(checkX / TILE_SIZE);
      const checkTy = Math.floor((member.y + (member.h || 22) - 2) / TILE_SIZE);
      const tile = tiles[checkTy]?.[checkTx];
      if (tile && tile !== 0) {
        member.vy = -7.5;
        member.jumpCooldown = 1.0;
      }
    }

    // Plasma dodge — scatter when hunter is charging
    if (hunter.plasmaLockTimer > 45) {
      const dist2 = Math.hypot(hunter.plasmaReticleX - member.x, hunter.plasmaReticleY - member.y);
      if (dist2 < 60) {
        member.vx = (member.x > hunter.plasmaReticleX ? 1 : -1) * 4.0;
        if (member.onGround) { member.vy = -7; member.jumpCooldown = 0.8; }
        if (groupState.barkCooldown <= 0) {
          _bark(member, "SCATTER!", 60);
          groupState.barkCooldown = 3.0;
        }
      }
    }
  }
}

// ─── GROUP BARK CHECKS ────────────────────────────────────────────────────────
function _groupBarkCheck(squad, hunter, player, groupState) {
  if (!squad || groupState.barkCooldown > 0) return;
  const alive = squad.filter(m => m.alive);
  if (alive.length === 0) return;

  // Bark when hunter retreats
  if (hunter && hunter.aiState === 'retreat') {
    const speaker = alive[Math.floor(Math.random() * alive.length)];
    _bark(speaker, "He's pulling back!", 80);
    groupState.barkCooldown = 6.0;
    return;
  }

  // Bark when in trees
  if (hunter && hunter.mode === 'tree' && groupState.groupAlert) {
    const speaker = alive.find(m => m.archetype === 'BILLIE') || alive[0];
    _bark(speaker, "He's in the trees!", 90);
    groupState.barkCooldown = 5.0;
  }
}

// ─── BARK HELPER ─────────────────────────────────────────────────────────────
function _bark(member, text, life = 80) {
  if (!member) return;
  if (member.currentBark) return; // don't interrupt
  const now = Date.now();
  if (now - (member.lastBarkTime || 0) < 3500) return; // cooldown
  member.currentBark = { text, life };
  member.lastBarkTime = now;
}

const BARK_TABLE = {
  MAC: {
    HUNTER_SPOTTED: ['Contact right!', 'I see the bastard!', 'There he is — FIRE!', 'Movement!'],
    SUPPRESSING:    ['Suppressing!', 'Keep his head down!', 'Go go go!'],
    CHOP:           ['TIMBER!', 'Clear this out!', 'Coming down!'],
  },
  BILLIE: {
    HUNTER_SPOTTED: ['I saw something.', "He's here.", 'Movement in the trees.', 'Contact!'],
    SUPPRESSING:    ['Flanking left.', 'Clear!', 'Got him.'],
    CHOP:           ['Clear!', 'Timber.', 'Opening it up.'],
  },
  PONCHO: {
    HUNTER_SPOTTED: ["He's flanking us!", 'Watch the rear!', 'Contact!', 'Moving!'],
    SUPPRESSING:    ['Moving it!', 'Watch the lane!', 'Hold position!'],
    CHOP:           ['Moving it!', 'Clearing trap lane.', 'Got it.'],
  },
};

function _pickBark(member, event) {
  const table = BARK_TABLE[member.archetype] || BARK_TABLE.MAC;
  const barks = table[event] || ['Stay sharp.'];
  return barks[Math.floor(Math.random() * barks.length)];
}

export { _bark, _pickBark };
