// LAST HUNT: KILLBOX - Hunter AI Boss
import { HUNTER_MODES, TILE_SIZE, TILE } from './constants';
import { HUNTER_CONFIG } from './config/hunter.config';
import { applyGravity, moveEntity, checkCollision, createExplosion } from './physics';
import { getTile, isSolid, setTile } from './worldGen';
import { emit } from './core/eventBus';
import { createHunterAI, updateHunterAI } from './ai/hunterAI';
import {
  createPsychState, updateHunterPsych, updateHunterTerrainAbuse,
  tryTrophyMoment, tryCinematicMoment, recordPlayerBehavior,
} from './ai/hunterPsychwar';

const HC = HUNTER_CONFIG; // alias for brevity

// Tiles the hunter can pass through (foliage / non-structural)
// Tiles the hunter ALWAYS passes through
const ALWAYS_PASSABLE = new Set([TILE.AIR, TILE.WATER, TILE.VINE]);
// Tiles the hunter passes through when moving UP (jumping into canopy)
const PASSABLE_ASCENDING = new Set([TILE.LEAVES]);
// Tiles the hunter can chop through when blocked horizontally
const CHOPPABLE = new Set([TILE.WOOD, TILE.LEAVES, TILE.BRIDGE]);

function hunterSolid(tileType, vy = 0) {
  if (ALWAYS_PASSABLE.has(tileType)) return false;
  // Leaves: pass through when jumping up, land on when falling
  if (PASSABLE_ASCENDING.has(tileType)) return vy >= 0; // solid when falling/level
  return true; // WOOD, DIRT, STONE, GRASS, etc.
}

function checkHunterCollision(x, y, w, h, tiles, vy = 0) {
  const left   = Math.floor(x / TILE_SIZE);
  const right  = Math.floor((x + w - 1) / TILE_SIZE);
  const top    = Math.floor(y / TILE_SIZE);
  const bottom = Math.floor((y + h - 1) / TILE_SIZE);
  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (hunterSolid(getTile(tiles, tx, ty), vy)) return true;
    }
  }
  return false;
}

// Scan upward for the nearest open air above current position (used for jump targeting)
function findClearHeightAbove(hunter, tiles, maxTiles = 6) {
  const cx = Math.floor((hunter.x + hunter.w / 2) / TILE_SIZE);
  const startTy = Math.floor(hunter.y / TILE_SIZE);
  for (let i = 1; i <= maxTiles; i++) {
    const t = getTile(tiles, cx, startTy - i);
    if (t === TILE.AIR || t === TILE.LEAVES) return i * TILE_SIZE;
  }
  return 0;
}

// Detect whether there's a tree canopy (LEAVES) within horizontal reach above hunter
function findNearbyCanopy(hunter, tiles, searchDir, maxDist = 5) {
  const startTx = Math.floor((hunter.x + hunter.w / 2) / TILE_SIZE);
  const startTy = Math.floor(hunter.y / TILE_SIZE);
  for (let dx = 1; dx <= maxDist; dx++) {
    const tx = startTx + dx * searchDir;
    // Scan up to 10 tiles above current position — covers tall trees
    for (let dy = -10; dy <= 1; dy++) {
      const t = getTile(tiles, tx, startTy + dy);
      if (t === TILE.LEAVES || t === TILE.WOOD) {
        return { tx, ty: startTy + dy, px: tx * TILE_SIZE, py: (startTy + dy) * TILE_SIZE };
      }
    }
  }
  return null;
}

function moveHunter(hunter, tiles) {
  // Horizontal — with step-up (up to 1.5 tiles for tree trunks)
  const newX = hunter.x + hunter.vx;
  if (!checkHunterCollision(newX, hunter.y, hunter.w, hunter.h, tiles, hunter.vy)) {
    hunter.x = newX;
  } else {
    // Try step up — 1 tile
    if (!checkHunterCollision(newX, hunter.y - TILE_SIZE, hunter.w, hunter.h, tiles, -1)) {
      hunter.x = newX;
      hunter.y -= TILE_SIZE;
    // Try step up — 1.5 tiles (for thick trunk bases)
    } else if (!checkHunterCollision(newX, hunter.y - TILE_SIZE * 1.5, hunter.w, hunter.h, tiles, -1)) {
      hunter.x = newX;
      hunter.y -= Math.round(TILE_SIZE * 1.5);
    } else {
      hunter.blockedTimer = (hunter.blockedTimer || 0) + 1;
    }
  }
  // Vertical — pass through leaves when ascending
  const newY = hunter.y + hunter.vy;
  if (!checkHunterCollision(hunter.x, newY, hunter.w, hunter.h, tiles, hunter.vy)) {
    hunter.y = newY;
    hunter.onGround = false;
  } else {
    if (hunter.vy > 0) {
      // Snap to top of blocking tile
      const bottomTile = Math.floor((newY + hunter.h - 1) / TILE_SIZE);
      hunter.y = bottomTile * TILE_SIZE - hunter.h;
      hunter.onGround = true;
    } else {
      // Hit ceiling — stop rising
      hunter.y = Math.floor(newY / TILE_SIZE) * TILE_SIZE + TILE_SIZE;
    }
    hunter.vy = 0;
  }
}

// Destroy a destructible tile in front of the hunter (tree chop)
function chopTileAhead(hunter, tiles, particles) {
  // Check at mid-body and knee height to handle thick trunks
  for (const heightFrac of [0.3, 0.6]) {
    const atkX = Math.floor((hunter.x + hunter.w / 2 + hunter.facing * TILE_SIZE * 1.5) / TILE_SIZE);
    const atkY = Math.floor((hunter.y + hunter.h * heightFrac) / TILE_SIZE);
    const t = getTile(tiles, atkX, atkY);
    if (t === TILE.WOOD || t === TILE.LEAVES || t === TILE.BRIDGE || t === TILE.DIRT) {
      setTile(tiles, atkX, atkY, TILE.AIR);
      // Splinter particles — colour by tile type
      const col = t === TILE.WOOD ? '#8a6a3a' : t === TILE.DIRT ? '#5a3e28' : '#44aa44';
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: atkX * TILE_SIZE + 8, y: atkY * TILE_SIZE + 8,
          vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 4,
          life: 25, color: col, size: 3, type: 'debris',
        });
      }
      return true;
    }
  }
  return false;
}

export function createHunter(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    w: HC.width, h: HC.height,
    onGround: false,
    facing: -1,

    health: HC.baseHealth,
    maxHealth: HC.baseHealth,
    alive: true,

    // AI
    mode: null,
    aiState: 'stalk',
    stalkTimer: 0,
    attackCooldown: 0,
    stunTimer: 0,
    alertLevel: 0,

    // Blocked / pathfinding
    blockedTimer: 0,
    lastX: x,
    stuckCheck: 0,

    // Double jump + tree traversal
    jumpsUsed: 0,           // 0 = can jump, 1 = used first, 2 = used both
    jumpCooldown: 0,        // frames before next jump allowed
    inAir: false,
    airTime: 0,             // frames spent airborne
    treeLeapCooldown: 0,    // frames before another tree-to-tree leap
    treeLeapTarget: null,   // { px, py } of target canopy
    onLeaves: false,        // standing on leaf canopy
    climbPhase: 0,          // 0=none, 1=ascending trunk, 2=perching

    // Entry direction
    entrySide: 'LEFT',  // LEFT or RIGHT — determines approach direction

    // Wrist blade combo
    bladePhase: 0,       // 0=none, 1=slash1, 2=pause, 3=slash2
    bladeTimer: 0,
    bladeDamageDealt: false,

    // Cloaking
    cloaked: true,
    cloakFlicker: 0,
    cloakCooldown: 0,
    decloak: false,

    // Plasma targeting
    plasmaCharge: 0,
    plasmaLockTimer: 0,  // 0..90 = tracking → fire
    plasmaReticleX: 0,
    plasmaReticleY: 0,

    // Animation
    frame: 0,
    frameTimer: 0,
    hitFlash: 0,

    // Self destruct
    selfDestruct: false,
    selfDestructTimer: 0,

    targetX: 0,
    targetY: 0,
    lastSawPlayer: 0,

    // AI brain state (hunterAI.js)
    hAI: createHunterAI(),
    aiGoal: 'STALK',
    aiPhase: 'ARRIVAL',
    cloakVisibility: 0.12,
    cinematicHead: false,
    cinematicPerching: false,
    // Psychological warfare + terrain abuse
    psychState: createPsychState(),
    _psychPlasmaShot: null,
    _psychBark: null,
    _shoulderRaise: false,
  };
}

export function chooseHunterMode(hunter) {
  const modes = [HUNTER_MODES.GROUND, HUNTER_MODES.TREE, HUNTER_MODES.PLASMA];
  hunter.mode = modes[Math.floor(Math.random() * 3)];
  hunter.aiState = 'approach';
  hunter.cloaked = false;
  return hunter.mode;
}

export function updateHunter(hunter, player, tiles, projectiles, particles, deltaTime) {
  if (!hunter.alive) return;

  // --- Hit flash ---
  if (hunter.hitFlash > 0) hunter.hitFlash--;

  // --- Stun ---
  if (hunter.stunTimer > 0) {
    hunter.stunTimer--;
    hunter.aiState = 'stunned';
    applyGravity(hunter);
    moveHunter(hunter, tiles);
    return;
  }

  // --- Self destruct ---
  if (hunter.selfDestruct) {
    hunter.selfDestructTimer++;
    if (hunter.selfDestructTimer % 10 < 5) hunter.hitFlash = 1;
    if (hunter.selfDestructTimer % 15 === 0) {
      particles.push({ x: hunter.x + hunter.w / 2, y: hunter.y + 5,
        vx: 0, vy: -1, life: 15, color: '#ff0000', size: 4, type: 'glow' });
    }
    return;
  }

  // --- Tracking ---
  const dx = player.x - hunter.x;
  const dy = player.y - hunter.y;
  const distToPlayer = Math.sqrt(dx * dx + dy * dy);
  hunter.facing = dx > 0 ? 1 : -1;

  // --- Cloak shimmer ---
  if (hunter.cloaked) {
    hunter.cloakFlicker = 0.08 + Math.abs(Math.sin(Date.now() * 0.008)) * 0.12;
    // Shimmer distortion particles (sparse)
    if (Math.random() > 0.93) {
      particles.push({
        x: hunter.x + Math.random() * hunter.w,
        y: hunter.y + Math.random() * hunter.h,
        vx: (Math.random() - 0.5) * 1.5, vy: -0.5 - Math.random(),
        life: 12, color: 'rgba(140,220,255,0.4)', size: 2, type: 'shimmer',
      });
    }
  }
  if (hunter.cloakCooldown > 0) hunter.cloakCooldown--;
  if (!hunter.cloaked && hunter.cloakCooldown <= 0 &&
      hunter.aiState === 'approach' && distToPlayer > HC.cloakRecloakRange) {
    // Re-cloak when not actively attacking
    hunter.cloaked = true;
  }

  // --- Stuck / vertical trap detection → escape priority ──────────────────
  hunter.stuckCheck++;
  if (hunter.leapGrace > 0) hunter.leapGrace--;  // suppress stuck during active leap
  if (hunter.stuckCheck >= 60) {
    hunter.stuckCheck = 0;
    const xDelta = Math.abs(hunter.x - hunter.lastX);
    // Not stuck if: moving, stunned, or within leap grace period
    const isStuck = xDelta < 4 && hunter.aiState !== 'stunned' && (hunter.leapGrace || 0) <= 0;

    if (isStuck) {
      hunter.consecutiveStuck = (hunter.consecutiveStuck || 0) + 1;
    } else {
      hunter.consecutiveStuck = 0;
    }

    if (isStuck) {
      // Priority 1: jump escape
      if (hunter.onGround || hunter.onLeaves) {
        const jumpPower = hunter.consecutiveStuck >= 2 ? -16 : -12;
        hunter.vy = jumpPower;
        hunter.vx = hunter.facing * 6;
        hunter.jumpsUsed = 1;     // first jump consumed
        hunter.inAir = true;
        hunter.jumpCooldown = 15;
      } else if (hunter.inAir && hunter.jumpsUsed === 1 && hunter.consecutiveStuck >= 2) {
        // Double jump escape — still airborne, can't get up
        hunter.vy = -10;
        hunter.vx = -hunter.facing * 5; // change direction
        hunter.facing *= -1;
        hunter.jumpsUsed = 2;
        hunter.jumpCooldown = 15;
      } else if (hunter.inAir && hunter.consecutiveStuck >= 3) {
        // Truly stuck in air — give up, drop and try ground approach
        hunter.vy = 4;
        hunter.vx = -hunter.facing * 3;
        hunter.facing *= -1;
        hunter.jumpsUsed = 0;
      }

      // Priority 2: chop blocking tile (trunk in the way)
      chopTileAhead(hunter, tiles, particles);

      // Priority 3: plasma terrain destruction (stuck 3+ cycles)
      if (hunter.consecutiveStuck >= 3 &&
          hunter.mode === HUNTER_MODES.PLASMA && hunter.plasmaCharge >= 20) {
        const ax = hunter.x + hunter.w / 2 + hunter.facing * TILE_SIZE * 2;
        const ay = hunter.y + hunter.h / 2;
        createExplosion(ax, ay, 40, tiles, particles);
        hunter.plasmaCharge = 0;
        hunter.consecutiveStuck = 0;
      }
    }
    hunter.lastX = hunter.x;
  }

  // ========================
  // STATE MACHINE
  // ========================
  switch (hunter.aiState) {

    case 'stalk':
      hunter.stalkTimer++;
      if (distToPlayer > 300)      hunter.vx = hunter.facing * 1;
      else if (distToPlayer < 200) hunter.vx = -hunter.facing * 0.5;
      else                         hunter.vx = 0;
      if (hunter.stalkTimer % 120 === 0) {
        particles.push({ x: hunter.x + hunter.w / 2 + (Math.random() - 0.5) * 40,
          y: hunter.y - 10, vx: 0, vy: -0.5,
          life: 40, color: 'rgba(100,200,255,0.25)', size: 2, type: 'shimmer' });
      }
      break;

    case 'approach':
      hunter.attackCooldown = Math.max(0, hunter.attackCooldown - 1);

      if (hunter.mode === HUNTER_MODES.GROUND) {
        const mudCamo = player.mudTimer > 0 ? 0.6 : 1.0;
        const effectiveDist = distToPlayer / mudCamo;
        const speed = effectiveDist > HC.groundSlowRange ? HC.groundSpeed : HC.groundSlowSpeed;
        hunter.vx = hunter.facing * speed;
        const frontTx = Math.floor((hunter.x + hunter.w / 2 + hunter.facing * 20) / TILE_SIZE);
        const frontTy = Math.floor((hunter.y + hunter.h) / TILE_SIZE);
        // Jump over obstacle — single jump on ground, double jump if still blocked mid-air
        if (hunterSolid(getTile(tiles, frontTx, frontTy - 1), 0) && hunter.onGround) {
          // Check if this is a 2-tile obstacle — use bigger jump
          const topBlocked = hunterSolid(getTile(tiles, frontTx, frontTy - 3), -1);
          hunter.vy = topBlocked ? HC.treeJumpPower : HC.obstacleJumpPower;
          hunter.jumpsUsed = 1;
          hunter.inAir = true;
          hunter.jumpCooldown = 18;
        } else if (hunter.inAir && hunter.jumpsUsed === 1 && hunter.jumpCooldown <= 0 &&
                   hunterSolid(getTile(tiles, frontTx, frontTy - 1), -1)) {
          // Still blocked while airborne — double jump
          hunter.vy = -9;
          hunter.jumpsUsed = 2;
          hunter.jumpCooldown = 15;
        }
        // jumpCooldown decremented once globally below (tree-mode block)
        // Reset on landing
        if (hunter.onGround) { hunter.jumpsUsed = 0; hunter.inAir = false; }
        if (hunter.blockedTimer > HC.obstacleBlockThreshold) {
          chopTileAhead(hunter, tiles, particles);
          hunter.blockedTimer = 0;
        }
        if (distToPlayer < HC.bladeRange2 && hunter.attackCooldown <= 0) {
          hunter.aiState = 'attack';
          hunter.bladePhase = 1;
          hunter.bladeTimer = 0;
          hunter.bladeDamageDealt = false;
          hunter.cloaked = false;
          hunter.cloakCooldown = 90;
        }
      }
      else if (hunter.mode === HUNTER_MODES.TREE) {
        // ── TREE TRAVERSAL AI ────────────────────────────────────────────────
        // Goal: stay elevated, use canopy platforms, leap tree to tree, occasionally drop on player.

        if (hunter.jumpCooldown > 0) hunter.jumpCooldown--;
        if (hunter.treeLeapCooldown > 0) hunter.treeLeapCooldown--;

        // Track airborne state + reset double jump on landing
        if (hunter.onGround || hunter.onLeaves) {
          if (hunter.inAir) {
            hunter.jumpsUsed = 0;     // landed — reset double jump
            hunter.airTime = 0;
            hunter.treeLeapTarget = null; // clear stale leap target on landing
          }
          hunter.inAir = false;
        } else {
          hunter.inAir = true;
          // Cap airTime to prevent overflow on long falls
          hunter.airTime = Math.min((hunter.airTime || 0) + 1, 999);
        }

        // Detect if standing ON leaf canopy (slight downward check)
        const leafCheckTx = Math.floor((hunter.x + hunter.w / 2) / TILE_SIZE);
        const leafCheckTy = Math.floor((hunter.y + hunter.h + 2) / TILE_SIZE);
        hunter.onLeaves = getTile(tiles, leafCheckTx, leafCheckTy) === TILE.LEAVES;

        // ── TREE-TO-TREE LEAP ────────────────────────────────────────────────
        // Look ahead for a nearby canopy — leap toward it if found
        if ((hunter.onGround || hunter.onLeaves) &&
             hunter.treeLeapCooldown <= 0 && hunter.jumpsUsed === 0) {
          const canopy = findNearbyCanopy(hunter, tiles, hunter.facing, 7);
          if (canopy) {
            const heightDiff = hunter.y - canopy.py;
            const horizDist  = Math.abs(canopy.px - hunter.x);
            // Only leap if canopy is reachable (not too far, not already above)
            if (horizDist < 7 * TILE_SIZE && heightDiff > -TILE_SIZE * 2) {
              // Calculate jump needed: reach canopy height
              const jumpNeeded = heightDiff > TILE_SIZE
                ? HC.treeJumpPower                    // normal jump for same-height or lower
                : HC.treeJumpPower * 1.25;            // boost for higher canopy
              hunter.vy = Math.min(jumpNeeded, -8);   // floor: always meaningful
              hunter.vx = hunter.facing * HC.treeSpeed * 1.4; // slight speed boost mid-leap
              hunter.jumpsUsed = 1;
              hunter.inAir = true;
              hunter.treeLeapTarget = canopy;
              hunter.treeLeapCooldown = 90; // 1.5s before next tree leap
              hunter.jumpCooldown = 25;
              hunter.leapGrace = 50;     // ~0.8s grace — suppress stuck check during leap
            }
          }
        }

        // ── DOUBLE JUMP — used mid-air to reach higher platforms ─────────────
        if (hunter.inAir && hunter.airTime > 8 &&
            hunter.jumpsUsed === 1 && hunter.jumpCooldown <= 0) {
          // Only double-jump if we're heading toward something above us
          const aboveCheck = getTile(tiles, leafCheckTx, leafCheckTy - 4);
          const highCanopy  = aboveCheck === TILE.LEAVES || aboveCheck === TILE.WOOD;
          // Or if we're losing altitude and target is above
          const fallingShort = hunter.vy > -2 && hunter.treeLeapTarget &&
                               hunter.y > hunter.treeLeapTarget.py;
          if (highCanopy || fallingShort) {
            hunter.vy = -9;  // double jump — slightly weaker than first
            hunter.jumpsUsed = 2;
            hunter.jumpCooldown = 20;
            // Shimmer burst — cinematic flourish on double jump
            for (let i = 0; i < 5; i++) {
              particles.push({
                x: hunter.x + Math.random() * hunter.w,
                y: hunter.y + hunter.h,
                vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2,
                life: 12, color: 'rgba(0,255,170,0.5)', size: 2, type: 'shimmer',
              });
            }
          }
        }

        // ── OBSTACLE JUMP — basic terrain clearance ──────────────────────────
        if ((hunter.onGround || hunter.onLeaves) &&
             hunter.jumpsUsed === 0 && hunter.jumpCooldown <= 0) {
          // Check for solid tile at chest height in movement direction
          const frontTx = Math.floor((hunter.x + hunter.w / 2 + hunter.facing * TILE_SIZE) / TILE_SIZE);
          const chestTy = Math.floor((hunter.y + hunter.h * 0.4) / TILE_SIZE);
          const frontTile = getTile(tiles, frontTx, chestTy);
          const wallAhead = frontTile === TILE.WOOD || frontTile === TILE.DIRT ||
                            frontTile === TILE.STONE || frontTile === TILE.GRASS;
          // Also jump proactively when approaching trees (canopy overhead)
          const overheadLeaf = getTile(tiles, leafCheckTx, Math.floor(hunter.y / TILE_SIZE) - 2) === TILE.LEAVES;
          if (wallAhead || overheadLeaf) {
            const clearHeight = findClearHeightAbove(hunter, tiles, 5);
            // Scale jump to needed height (min -9, max treeJumpPower)
            const jumpV = clearHeight > TILE_SIZE * 3
              ? HC.treeJumpPower
              : Math.max(-9, HC.treeJumpPower * 0.75);
            hunter.vy = jumpV;
            hunter.jumpsUsed = 1;
            hunter.inAir = true;
            hunter.jumpCooldown = 20;
          }
        }

        // ── OCCASIONAL RANDOM JUMP for feel ──────────────────────────────────
        // Replaces the old 5%-per-frame jump (way too rare)
        // Now: on ground, not recently jumped, 20% chance per second ≈ 0.33% per frame
        if ((hunter.onGround || hunter.onLeaves) &&
             hunter.jumpsUsed === 0 && hunter.jumpCooldown <= 0 &&
             Math.random() < 0.0033) {
          hunter.vy = HC.treeJumpPower * 0.85;
          hunter.jumpsUsed = 1;
          hunter.inAir = true;
          hunter.jumpCooldown = 30;
        }

        // ── PREFERRED MOVEMENT: stay above player ────────────────────────────
        // If hunter is below player height by more than 2 tiles, urgently seek elevation
        const belowPlayer = hunter.y > player.y + TILE_SIZE * 2;
        const baseSpeed = belowPlayer ? HC.treeSpeed * 1.3 : HC.treeSpeed;
        hunter.vx = hunter.facing * baseSpeed;

        // ── ATTACK: drop onto player from above ──────────────────────────────
        if (distToPlayer < HC.treeAttackRange && hunter.y < player.y + TILE_SIZE &&
            hunter.attackCooldown <= 0) {
          hunter.aiState = 'attack';
          hunter.attackCooldown = HC.treeAttackCooldown;
          hunter.cloaked = false;
          hunter.cloakCooldown = HC.cloakCooldownOnAttack;
          hunter.jumpsUsed = 2; // no more jumping during divebomb
        }
      }
      else if (hunter.mode === HUNTER_MODES.PLASMA) {
        if (distToPlayer < HC.plasmaKiteNearRange)      hunter.vx = -hunter.facing * HC.plasmaKiteSpeed;
        else if (distToPlayer > HC.plasmaKiteFarRange)  hunter.vx =  hunter.facing * HC.plasmaApproachSpeed;
        else {
          hunter.vx = 0;
          hunter.plasmaCharge = Math.min(hunter.plasmaCharge + 1, HC.plasmaChargeMax);
          if (hunter.plasmaCharge >= HC.plasmaChargeMax && hunter.attackCooldown <= 0) {
            hunter.aiState = 'attack';
            hunter.attackCooldown = HC.plasmaCooldown;
            hunter.plasmaLockTimer = 0;
            hunter.cloaked = false;
            hunter.cloakCooldown = HC.cloakCooldownOnPlasma;
          }
        }
        // Mud coating slows plasma charge
        if (player.mudAmount > 0.3) {
          hunter.plasmaCharge *= (1.0 - player.mudAmount * 0.5);
        }
        // Plasma charge glow
        if (hunter.plasmaCharge > 20) {
          particles.push({
            x: hunter.x + hunter.w / 2 + hunter.facing * 15, y: hunter.y + 10,
            vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
            life: 10, color: '#00ffaa', size: 2 + hunter.plasmaCharge / 18, type: 'glow',
          });
        }
      }
      break;

    case 'attack':
      hunter.attackCooldown = Math.max(0, hunter.attackCooldown - 1);

      if (hunter.mode === HUNTER_MODES.GROUND) {
        hunter.bladeTimer++;
        switch (hunter.bladePhase) {
          case 1:
            hunter.vx = hunter.facing * HC.bladeLunge1Speed;
            if (hunter.bladeTimer >= HC.bladeLunge1Duration) {
              if (!hunter.bladeDamageDealt && distToPlayer < HC.bladeRange1) {
                player.health -= HC.bladeDamage1;
                player.vx = hunter.facing * HC.bladeKnockbackX1;
                player.vy = HC.bladeKnockbackY1;
                spawnBlood(particles, player);
                emit('PLAYER_HIT', { damage: HC.bladeDamage1, source: 'blade' });
                hunter.bladeDamageDealt = true;
              }
              hunter.bladePhase = 2;
              hunter.bladeTimer = 0;
            }
            break;
          case 2:
            hunter.vx = -hunter.facing * 1;
            if (hunter.bladeTimer >= HC.bladePauseDuration) {
              hunter.bladePhase = 3;
              hunter.bladeTimer = 0;
              hunter.bladeDamageDealt = false;
            }
            break;
          case 3:
            hunter.vx = hunter.facing * HC.bladeLunge2Speed;
            if (hunter.bladeTimer >= HC.bladeLunge2Duration) {
              if (!hunter.bladeDamageDealt && distToPlayer < HC.bladeRange2) {
                player.health -= HC.bladeDamage2;
                player.vx = hunter.facing * HC.bladeKnockbackX2;
                player.vy = HC.bladeKnockbackY2;
                spawnBlood(particles, player);
                emit('PLAYER_HIT', { damage: HC.bladeDamage2, source: 'blade' });
                hunter.bladeDamageDealt = true;
              }
              hunter.bladePhase = 0;
              hunter.attackCooldown = HC.bladeCooldown;
              hunter.aiState = 'approach';
            }
            break;
        }
      }
      else if (hunter.mode === HUNTER_MODES.TREE) {
        hunter.vy = HC.diveBombSpeed;
        hunter.vx = hunter.facing * HC.diveBombVX;
        if (hunter.onGround) {
          if (distToPlayer < HC.diveBombRange) {
            player.health -= HC.diveBombDamage;
            player.vy = HC.diveBombKnockback;
            spawnBlood(particles, player);
            emit('PLAYER_HIT', { damage: HC.diveBombDamage, source: 'divebomb' });
          }
          // Shockwave particles on landing
          for (let i = 0; i < 10; i++) {
            particles.push({
              x: hunter.x + hunter.w / 2 + (Math.random() - 0.5) * 40,
              y: hunter.y + hunter.h,
              vx: (Math.random() - 0.5) * 5, vy: -2 - Math.random() * 3,
              life: 20, color: '#8a6a3a', size: 3, type: 'debris',
            });
          }
          hunter.aiState = 'approach';
        }
      }
      else if (hunter.mode === HUNTER_MODES.PLASMA) {
        hunter.vx = 0;

        // Full mud (>= 0.85) breaks plasma lock completely — reticle drifts randomly
        const mud = player.mudAmount || 0;
        const thermalVis = Math.max(0, 1.0 - mud * 1.18);

        if (thermalVis <= 0) {
          // Player invisible to thermal — reticle drifts/searches, no lock progress
          hunter.plasmaReticleX += (Math.random() - 0.5) * 12;
          hunter.plasmaReticleY += (Math.random() - 0.5) * 8;
          // Don't advance lock timer — lock resets slowly
          hunter.plasmaLockTimer = Math.max(0, hunter.plasmaLockTimer - 2);
          // Search particles (confused)
          if (hunter.plasmaLockTimer % 6 === 0) {
            particles.push({
              x: hunter.plasmaReticleX + (Math.random() - 0.5) * 40,
              y: hunter.plasmaReticleY + (Math.random() - 0.5) * 40,
              vx: 0, vy: 0, life: 8, color: '#446644', size: 2, type: 'glow',
            });
          }
          // Break out of plasma attack — fall back to searching
          if (hunter.plasmaLockTimer <= 0) {
            hunter.aiState = 'approach';
            hunter.plasmaCharge = 0;
          }
          applyGravity(hunter);
          moveHunter(hunter, tiles);
          break;
        }

        hunter.plasmaLockTimer++;

        const predX = player.x + player.vx * HC.plasmaPredictFrames;
        const predY = player.y + player.vy * HC.plasmaPredictFrames;
        // Mud slows lock speed scaled to thermalVisibility
        const mudPenalty = 1.0 + ((1.0 - thermalVis) * (HC.mudTrackPenalty - 1.0));
        const trackSpeed = (HC.plasmaTrackBase + hunter.plasmaLockTimer * HC.plasmaTrackAccel) / mudPenalty;
        hunter.plasmaReticleX += (predX - hunter.plasmaReticleX) * trackSpeed;
        hunter.plasmaReticleY += (predY - hunter.plasmaReticleY) * trackSpeed;

        // Reticle charge particles
        if (hunter.plasmaLockTimer % 4 === 0) {
          particles.push({
            x: hunter.plasmaReticleX + (Math.random() - 0.5) * 16,
            y: hunter.plasmaReticleY + (Math.random() - 0.5) * 16,
            vx: 0, vy: 0, life: 8, color: '#ff3300', size: 3, type: 'glow',
          });
        }

        if (hunter.plasmaLockTimer >= HC.plasmaLockFrames) {
          const tx = hunter.plasmaReticleX;
          const ty = hunter.plasmaReticleY;
          const angle = Math.atan2(ty - hunter.y, tx - hunter.x);
          projectiles.push({
            x: hunter.x + hunter.w / 2 + hunter.facing * 12,
            y: hunter.y + 8,
            vx: Math.cos(angle) * HC.plasmaSpeed,
            vy: Math.sin(angle) * HC.plasmaSpeed,
            angle,
            damage: HC.plasmaDamage,
            type: 'plasma',
            owner: 'hunter',
            stuck: false,
            life: HC.plasmaLife,
            gravityScale: 0,
            radius: HC.plasmaRadius,
          });
          // Muzzle flash
          for (let i = 0; i < 12; i++) {
            const a = angle + (Math.random() - 0.5) * 0.8;
            particles.push({
              x: hunter.x + hunter.w / 2 + hunter.facing * 12, y: hunter.y + 8,
              vx: Math.cos(a) * (3 + Math.random() * 4), vy: Math.sin(a) * (3 + Math.random() * 4),
              life: 12, color: '#00ffaa', size: 3, type: 'glow',
            });
          }
          hunter.plasmaCharge = 0;
          hunter.plasmaLockTimer = 0;
          hunter.aiState = 'approach';
        }
      }
      break;

    case 'retreat':
      hunter.vx = -hunter.facing * 2;
      if (distToPlayer > 320) hunter.aiState = 'approach';
      break;

    case 'stunned':
      hunter.vx = 0;
      break;
  }

  // ── AI Brain (hunterAI.js — phased goal director) ──────────────────────────
  if (hunter.hAI) {
    updateHunterAI(
      hunter, hunter.hAI, player,
      hunter._squadRef || [],
      tiles, particles,
      hunter._trapsRef || [],
      hunter._fireRef || [],
      16
    );
  }

  // ── Psychological Warfare ────────────────────────────────────────────────────
  if (hunter.psychState) {
    updateHunterPsych(
      hunter, hunter.psychState, player,
      hunter._squadRef || [],
      tiles, particles,
      hunter._trapsRef || [],
      hunter._fireRef || [],
      hunter._wildlifeRef || null,
      hunter._treeEntitiesRef || [],
      16
    );
    updateHunterTerrainAbuse(
      hunter, hunter.psychState, player,
      hunter._squadRef || [],
      tiles, particles,
      hunter._trapsRef || [],
      hunter._treeEntitiesRef || [],
      hunter._fireRef || [],
      16 / 1000
    );
    tryTrophyMoment(hunter, hunter.psychState, player, hunter._squadRef || [], particles, 16 / 1000);
    tryCinematicMoment(hunter, hunter.psychState, player, particles, 16 / 1000);
  }

  // --- Physics ---
  applyGravity(hunter);
  moveHunter(hunter, tiles);

  // --- Alert escalation ---
  hunter.alertLevel = Math.min(1, hunter.alertLevel + HC.alertRateIdle);

  // --- Animation ---
  hunter.frameTimer++;
  if (hunter.frameTimer > 8) {
    hunter.frame = (hunter.frame + 1) % 4;
    hunter.frameTimer = 0;
  }

  // --- Low health retreat ---
  if (hunter.health < hunter.maxHealth * HC.retreatHealthPct && hunter.aiState === 'approach') {
    if (Math.random() > (1 - HC.retreatChancePerFrame)) {
      hunter.aiState = 'retreat';
      hunter.cloaked = true;
    }
  }

  // --- Death → self destruct ---
  if (hunter.health <= 0) {
    hunter.alive = false;
    hunter.selfDestruct = true;
    hunter.selfDestructTimer = 0;
    emit('HUNTER_DEAD', {});
  }
}

function spawnBlood(particles, target) {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: target.x + target.w / 2, y: target.y + target.h / 3,
      vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 5,
      life: 22, color: '#cc0000', size: 2 + Math.random() * 2, type: 'blood',
    });
  }
}

export function damageHunter(hunter, damage, particles, stun = 0) {
  hunter.health -= damage;
  hunter.hitFlash = 10;
  hunter.alertLevel = Math.min(1, hunter.alertLevel + HC.alertRateHit);
  hunter.cloaked = false;
  hunter.cloakCooldown = HC.cloakCooldownOnDamage;
  emit('HUNTER_HIT', { damage, stun });

  if (stun > 0) {
    hunter.stunTimer = stun * 30;
    hunter.aiState = 'stunned';
  }

  for (let i = 0; i < HC.bloodParticleCount; i++) {
    particles.push({
      x: hunter.x + hunter.w / 2, y: hunter.y + hunter.h / 2,
      vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 6,
      life: HC.bloodLife, color: HC.bloodColor, size: 3, type: 'blood',
    });
  }
}