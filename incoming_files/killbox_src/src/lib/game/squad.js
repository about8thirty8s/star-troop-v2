// LAST HUNT: KILLBOX — AI Squad System
import { SQUAD_CONFIG } from './config/squad.config';
import { TILE_SIZE } from './constants';
import { applyGravity, moveEntity, checkCollision } from './physics';
import { getTile, isSolid } from './worldGen';
import { emit } from './core/eventBus';
import { updateSquadMemberBehavior } from './squadBehaviors.js';
import { clearInitiativeRegistry } from './ai/squadInitiative.js';
import { updateBarks, createBark, triggerBark } from './barksSystem.js';
import { createSquadCoordinationState } from './ai/squadCoordination.js';

export function createSquadMember(archetypeKey, x, y, ropeIndex) {
  const arch = SQUAD_CONFIG.archetypes[archetypeKey];
  if (!arch) return null;

  return {
    id: Math.random().toString(36).slice(2, 9),
    archetype: archetypeKey,
    name: arch.name,
    role: arch.role,
    x, y,
    vx: 0, vy: 0,
    w: 14, h: 22,
    facing: 1,

    health: arch.health,
    maxHealth: arch.maxHealth,
    alive: true,

    // Movement and physics
    onGround: false,
    speed: arch.speed,

    // Weapon
    weapon: arch.weapon,
    weaponDamage: arch.weaponDamage,
    weaponCooldown: arch.weaponCooldown,
    weaponTimer: 0,

    // AI state machine
    state: 'SCOUT',
    stateTimer: 0,
    insertionZone: null,

    // Behavior
    hunterDetected: false,
    hunterLastX: 0,
    hunterLastY: 0,
    panicLevel: 0,

    // Animation
    frame: 0,
    frameTimer: 0,

    // Traits from archetype
    ...arch.traits,
    color: arch.color,
    skinColor: arch.skinColor,
    
    // Bark system
    currentBark: null,
    lastBarkTime: 0,

    // Rope insertion
    isOnRope: true,
    ropeIndex: ropeIndex,
    insertionState: 'DESCENDING',
    behaviorStyle: null,  // assigned on landing

    // Stuck detection (mobility helper)
    lastX: x,
    lastY: y,
    stuckFrames: 0,
    chopTargetTree: null,
    chopProgress: 0,
    
    // Movement refinement — anti-bunny-hop
    jumpCooldown: 0,
    postLandingPause: 0,
    decisionPause: 0,
    stuckJumpAttempted: false,

    // TREE_AMBUSH perch system
    perchTarget: null,            // current target perch
    perchRoute: [],               // waypoints to reach perch
    jumpsUsedInAir: 0,            // count of jumps used (reset on landing)
    lastJumpTime: 0,              // timestamp of last jump
    failedPerchAttempts: 0,       // retry counter
    isAmbushing: false,           // true when settled in perch
  };
}

// Character ID pool — assign the 3 that aren't the player's selection
const ALL_CHAR_IDS = ['mac', 'ponchi', 'annie', 'blaze'];

export function createSquad(heliX, heliY) {
  const squad = [];
  const archetypes = ['BILLIE', 'PONCHO', 'MAC'];
  const ropeOffsets = [-24, -8, 8, 24];

  // Determine which character the player selected so squad gets the other 3
  const selectedChar = (typeof window !== 'undefined' && sessionStorage.getItem('selectedCharacter')) || 'annie';
  const squadCharIds = ALL_CHAR_IDS.filter(id => id !== selectedChar);

  for (let i = 0; i < SQUAD_CONFIG.squadSize; i++) {
    const arch = archetypes[i];
    const ropeIndex = i + 1;
    const member = createSquadMember(arch, heliX + ropeOffsets[ropeIndex], heliY, ropeIndex);
    if (member) {
      member.characterId = squadCharIds[i] || squadCharIds[0];
      squad.push(member);
    }
  }

  // Initialize coordination state for slot/target management
  squad.coordState = createSquadCoordinationState();

  return squad;
}

export function updateSquad(squad, player, hunter, tiles, projectiles, particles, firePatches, treeEntities) {
  // Registry is managed entirely by squadInitiative.js — entries self-expire via
  // RESERVATION_TIMEOUT. We only hard-clear when ALL squad members are dead.
  // NEVER clear during prep — doing so wipes reservations before CHOP_TREE_MOVE
  // members arrive at their tree, causing an infinite startup race.
  const anyAlive = squad.some(m => m.alive);
  if (!anyAlive) clearInitiativeRegistry();

  // Get or create coordination state
  const coordState = squad.coordState || createSquadCoordinationState();
  squad.coordState = coordState;

  for (let i = squad.length - 1; i >= 0; i--) {
    const member = squad[i];
    if (!member.alive) continue;

    updateSquadMember(member, player, hunter, tiles, projectiles, particles, firePatches, treeEntities, squad, coordState);

    // Remove dead members after effects
    if (member.health <= 0 && member.alive) {
      member.alive = false;
      onSquadMemberDeath(member, particles, firePatches);
    }
  }
}

function updateSquadMember(member, player, hunter, tiles, projectiles, particles, firePatches, treeEntities, squad, coordState) {
  // --- Skip update during rope descent (helicopter controls position) ---
  if (member.insertionState === 'DESCENDING') {
    return;
  }

  // --- After landing, assign behavior and dispersal ---
  if (member.insertionState === 'LANDED' && !member.insertionZone) {
    member.insertionZone = SQUAD_CONFIG.insertionZones[
      Math.floor(Math.random() * SQUAD_CONFIG.insertionZones.length)
    ];
    member.stateTimer = SQUAD_CONFIG.states.SCOUT.duration;
    // Random walk direction for dispersal (-1 left, +1 right)
    member.walkDir = Math.random() > 0.5 ? 1 : -1;
    emit('SQUAD_MEMBER_LANDED', { member: member.name, zone: member.insertionZone.label, behavior: member.behaviorStyle });
    triggerBark('LANDING', [member]);
    member.insertionState = 'ACTIVE';
  }

  // --- Behavior-driven AI (only after fully landed) ---
  if (member.insertionState === 'ACTIVE') {
    updateSquadMemberBehavior(member, player, hunter, tiles, projectiles, particles, treeEntities, squad, coordState);
  }

  // --- Physics ---
  if (member.insertionState === 'ACTIVE') {
    applyGravity(member);
    moveEntity(member, tiles);
  }

  // --- Stuck detection using phase-based recovery ---
  if (member.insertionState === 'ACTIVE') {
    const movedDist = Math.sqrt((member.x - member.lastX) ** 2 + (member.y - member.lastY) ** 2);
    
    if (movedDist < 0.5) {
      // Apply stuck recovery phase logic
      // (imported from squadNavigation, not implemented here to avoid circular deps)
      // Stuck detection is now handled in updateSquadMemberBehavior via perception
      if (!member.stuckDetectionActive) {
        member.stuckDetectionActive = true;
        member.stuckStartTime = Date.now();
      }
    } else {
      member.stuckDetectionActive = false;
      member.stuckStartTime = null;
    }
    
    member.lastX = member.x;
    member.lastY = member.y;
  }

  // NOTE: jumpCooldown, postLandingPause, decisionPause are decremented
  // inside updateSquadMemberAI (orchestrator). Do NOT decrement here — double-decrement
  // caused bunny-hopping by expiring jump cooldown twice as fast. (BUG 7 fix)

  // --- Animation ---
  member.frameTimer++;
  if (member.frameTimer > 8) {
    member.frame = (member.frame + 1) % 4;
    member.frameTimer = 0;
  }

  // --- Bark lifecycle ---
  if (member.currentBark) {
    member.currentBark.life--;
    if (member.currentBark.life <= 0) {
      member.currentBark = null;
    }
  }
}



function onSquadMemberDeath(member, particles, firePatches) {
  // Brutal death variants (pixel-art gore, not realistic)
  const killType = Math.floor(Math.random() * 5);
  
  // Scream
  if (Math.random() > SQUAD_CONFIG.panicScreenProb) {
    emit('SQUAD_DEATH_SCREAM', { member: member.name });
  }

  // Gore spray pattern
  const goreCount = 18 + Math.floor(Math.random() * 12);
  const goreAngles = killType % 2 === 0 ? 'spray' : 'directional';
  
  if (goreAngles === 'spray') {
    // Omnidirectional blood burst
    for (let i = 0; i < goreCount; i++) {
      const ang = (i / goreCount) * Math.PI * 2;
      particles.push({
        x: member.x + member.w / 2,
        y: member.y + member.h / 2,
        vx: Math.cos(ang) * (3 + Math.random() * 5),
        vy: Math.sin(ang) * (3 + Math.random() * 5),
        life: 35 + Math.random() * 15,
        color: '#dd0000',
        size: 2 + Math.random() * 3,
        type: 'blood',
      });
    }
  } else {
    // Directional spray (blade/impact trauma)
    for (let i = 0; i < goreCount; i++) {
      const ang = (Math.random() - 0.5) * 0.6 + (member.facing > 0 ? 0 : Math.PI);
      particles.push({
        x: member.x + member.w / 2,
        y: member.y + member.h * 0.3,
        vx: Math.cos(ang) * (4 + Math.random() * 6),
        vy: Math.sin(ang) * (2 + Math.random() * 4),
        life: 40 + Math.random() * 20,
        color: Math.random() > 0.6 ? '#aa0000' : '#dd0000',
        size: 2 + Math.random() * 4,
        type: 'blood',
      });
    }
  }

  // Body remnant (grim silhouette effect)
  const bodyParticles = 3 + Math.floor(Math.random() * 2);
  for (let i = 0; i < bodyParticles; i++) {
    particles.push({
      x: member.x + (Math.random() - 0.5) * 10,
      y: member.y + member.h + (Math.random() - 0.5) * 5,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 0.2,
      life: 50,
      color: '#330000',
      size: 6 + Math.random() * 4,
      type: 'corpse_chunk',
    });
  }

  // Weapon/gear drops
  const gearX = member.x + (Math.random() - 0.5) * 15;
  const gearY = member.y + member.h;
  particles.push({
    x: gearX,
    y: gearY,
    vx: (Math.random() - 0.5) * 2,
    vy: -1,
    life: 999,  // persistent
    color: '#4a4a3a',
    size: 5,
    type: 'weapon_drop',
  });

  // Chance to drop loot
  const loot = generateSquadLoot();
  if (loot) {
    emit('SQUAD_LOOT_DROP', { member: member.name, loot });
  }

  emit('SQUAD_MEMBER_DEAD', { member: member.name });
}

function generateSquadLoot() {
  const loot = {};
  for (const [itemType, config] of Object.entries(SQUAD_CONFIG.lootDropTable)) {
    if (Math.random() < config.chance) {
      loot[itemType] = config.amount;
    }
  }
  return Object.keys(loot).length > 0 ? loot : null;
}

export function renderSquad(ctx, squad) {
  // Per-character squad body data (mirrors renderer CHAR_BODY)
  const SQUAD_BODY = {
    mac:    { bw: 14, bh: 26, hw: 9,  hh: 9,  hatColor: '#4a3a18', bodyColor: '#5a3a2a', vestColor: '#7a4a1a' },
    ponchi: { bw: 13, bh: 22, hw: 8,  hh: 8,  hatColor: '#5a5a5a', bodyColor: '#2a4a5a', vestColor: '#3a5a6a' },
    annie:  { bw: 10, bh: 24, hw: 7,  hh: 8,  hatColor: '#cc3333', bodyColor: '#3a5a2a', vestColor: '#5a7a4a' },
    blaze:  { bw: 17, bh: 28, hw: 10, hh: 9,  hatColor: '#3a2a18', bodyColor: '#6a3a18', vestColor: '#8a5a2a' },
  };

  for (const member of squad) {
    if (!member.alive) continue;

    const charId = member.characterId;
    const sb = (charId && SQUAD_BODY[charId]) ? SQUAD_BODY[charId] : { bw: 12, bh: 24, hw: 8, hh: 8, hatColor: '#4a3a18', bodyColor: '#4a4a3a', vestColor: '#5a5a4a' };

    ctx.save();
    ctx.translate(member.x + member.w / 2, member.y + member.h);
    if (member.facing < 0) ctx.scale(-1, 1);

    // Body — character-specific size
    ctx.fillStyle = sb.bodyColor;
    ctx.fillRect(-sb.bw/2, -sb.bh, sb.bw, sb.bh - 6);
    // Shoulder/vest highlight
    ctx.fillStyle = sb.vestColor;
    ctx.fillRect(-sb.bw/2, -sb.bh, sb.bw, 5);

    // Head
    ctx.fillStyle = member.skinColor || '#c9a876';
    ctx.fillRect(-sb.hw/2, -sb.bh - sb.hh, sb.hw, sb.hh);
    // Character head gear colour
    ctx.fillStyle = sb.hatColor;
    ctx.fillRect(-sb.hw/2 - 1, -sb.bh - sb.hh, sb.hw + 2, 3);
    // Eye
    ctx.fillStyle = '#222';
    ctx.fillRect(sb.hw/2 - 3, -sb.bh - sb.hh + 3, 2, 2);

    // Weapon indicator (character-appropriate)
    const weapY = -sb.bh + 8;
    if (charId === 'mac' || member.weapon === 'rifle') {
      ctx.fillStyle = '#4a4a3a';
      ctx.fillRect(sb.bw/2 - 2, weapY, 20, 3);    // M60 long barrel
      ctx.fillStyle = '#3a3a2a';
      ctx.fillRect(sb.bw/2 + 16, weapY - 1, 2, 5);
    } else if (charId === 'ponchi') {
      ctx.fillStyle = '#4a4a3a';
      ctx.fillRect(sb.bw/2 - 2, weapY, 12, 5);    // grenade launcher short fat
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(sb.bw/2 + 8, weapY - 1, 4, 7);
    } else if (charId === 'annie') {
      ctx.fillStyle = '#4a4a3a';
      ctx.fillRect(sb.bw/2 - 2, weapY, 16, 2);    // M16 slim
      ctx.fillStyle = '#3a5a3a';
      ctx.fillRect(sb.bw/2 + 2, weapY + 2, 8, 3); // M203 tube
    } else if (charId === 'blaze' || member.weapon === 'minigun') {
      ctx.fillStyle = '#5a5a4a';
      ctx.fillRect(sb.bw/2 - 2, weapY - 3, 14, 7); // minigun wide
      ctx.fillStyle = '#3a3a2a';
      for (let b = 0; b < 3; b++) ctx.fillRect(sb.bw/2 + b * 4, weapY - 2, 2, 5);
    } else if (member.weapon === 'bow') {
      ctx.strokeStyle = '#8a6a3a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sb.bw/2 + 2, weapY + 2, 6, -1, 1);
      ctx.stroke();
    }

    // Behavior indicator above head
    if (member.behaviorStyle) {
      const behaviorIcon = member.behaviorStyle === 'gung_ho' ? '!' :
                           member.behaviorStyle === 'low_profile' ? '•' : '↑';
      const behaviorColor = member.behaviorStyle === 'gung_ho' ? '#ff6633' :
                            member.behaviorStyle === 'low_profile' ? '#88dd88' : '#88ccff';
      ctx.fillStyle = behaviorColor;
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillText(behaviorIcon, -2, -sb.bh - sb.hh - 4);

      // DEBUG: Show last jump reason if available
      if (member.lastJumpReason) {
        ctx.fillStyle = '#ffaa00';
        ctx.font = '5px "Press Start 2P", monospace';
        ctx.fillText(member.lastJumpReason, -8, -sb.bh - sb.hh - 10);
      }
    }

    ctx.restore();

    // Render bark above member (world space)
    if (member.currentBark) {
      const alpha = Math.min(1, member.currentBark.life / 30);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const barkX = member.x + member.w / 2;
      const barkY = member.y - 20;
      // Black outline
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          if (ox !== 0 || oy !== 0) {
            ctx.fillText(member.currentBark.text, barkX + ox, barkY + oy);
          }
        }
      }
      // White text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(member.currentBark.text, barkX, barkY);
      ctx.globalAlpha = 1;
    }
  }
}