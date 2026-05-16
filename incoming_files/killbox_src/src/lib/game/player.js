// LAST HUNT: KILLBOX - Player System
import { PLAYER_SPEED, PLAYER_JUMP, PLAYER_WIDTH, PLAYER_HEIGHT, TILE_SIZE, TILE, RESOURCES, TOOLS, PIXEL_WORLD_W } from './constants';
import { PLAYER_CONFIG } from './config/player.config';
import { WORLD_CONFIG } from './config/world.config';
import { MUD_CONFIG } from './config/mud.config';
import { applyGravity, moveEntity, updateProjectile, checkCollision } from './physics';
import { getTile, isSolid, destroyTile } from './worldGen';
import { emit } from './core/eventBus';
import { createPlayerWeaponState, equipWeapon, fireWeapon, fireSecondary, updateReload } from './weapons';
import { hitTree, TREE_STATE, getFallenLogInMacheteRange, LOG_MAX_CHOP_HITS } from './trees';

const CROUCH_HEIGHT = PLAYER_CONFIG.crouchHeight;
const WORLD_HEIGHT_PX = WORLD_CONFIG.worldHeight * TILE_SIZE;

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    onGround: false,
    facing: 1, // 1 right, -1 left
    health: 100,
    maxHealth: 100,
    alive: true,
    
    // Animation
    frame: 0,
    frameTimer: 0,
    state: 'idle', // idle, run, jump, crouch, attack, bow
    
    // Combat
    attacking: false,
    attackTimer: 0,
    bowDrawn: false,
    bowPower: 0,
    bowAngle: -0.5,
    bowAmmoType: 'arrow',  // arrow | explosive_arrow
    explosiveArrowCount: 0,
    
    // Resources
    resources: {
      [RESOURCES.WOOD]: 0,
      [RESOURCES.ROPE]: 0,
      [RESOURCES.STONE]: 0,
      [RESOURCES.MUD]: 0,
      [RESOURCES.EXPLOSIVES]: 0,
      [RESOURCES.METAL]: 0,
    },
    
    // Inventory
    selectedTrap: 0,
    score: 0,

    // Active tool
    activeTool: TOOLS.SHOVEL,  // Start with shovel

    // Climb state
    isClimbing: false,

    // Jump reliability
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpsUsed: 0,

    // Mud camouflage (0.0–1.0 normalized amount, decays over time)
    mudAmount: 0,
    mudTimer: 0,  // frames remaining until clean

    // Last safe grounded position (for embed recovery)
    lastSafeX: x,
    lastSafeY: y,

    // Firearm system
    weaponState: createPlayerWeaponState(),

    // Water state (tile-based, not height-based)
    isInWater: false,
  };
}

export function updatePlayer(player, keys, tiles, projectiles, particles, currentTime, treeEntities) {
  if (!player.alive) return;

  // Update reload system
  updateReload(player.weaponState, 0.016); // ~60fps

  // --- Vine / Ladder climb detection ---
  const tx = Math.floor((player.x + player.w / 2) / TILE_SIZE);
  const ty = Math.floor((player.y + player.h / 2) / TILE_SIZE);
  const currentTile = getTile(tiles, tx, ty);
  const overlapVine = currentTile === TILE.VINE;
  const overlapLadder = currentTile === TILE.TIMBER_LADDER;
  const isClimbable = overlapVine || overlapLadder;

  // Enter climbing when overlapping vine/ladder AND pressing W or S,
  // but NOT when standing on solid ground (avoids accidental grab).
  if (isClimbable && !player.onGround && (keys.climbUp || keys.climbDown)) {
    player.isClimbing = true;
  }
  // Leave climbing when no longer over climbable tile, or player jumps
  if (!isClimbable || keys.jump) {
    player.isClimbing = false;
  }

  // --- Horizontal movement ---
  player.vx = 0;
  if (keys.left)  { player.vx = -PLAYER_SPEED; player.facing = -1; }
  if (keys.right) { player.vx =  PLAYER_SPEED; player.facing =  1; }

  // --- Crouch (feet-anchored, only on ground, only when NOT climbing) ---
  if (keys.crouch && player.onGround && !player.isClimbing) {
    player.vx *= 0.5;
    if (player.h !== CROUCH_HEIGHT) {
      // Anchor feet position when crouching
      const feetY = player.y + player.h;
      player.h = CROUCH_HEIGHT;
      player.y = feetY - CROUCH_HEIGHT;
    }
    player.state = 'crouch';
  } else if (player.h !== PLAYER_HEIGHT) {
    // Try to stand up — only if there's head clearance
    const feetY = player.y + player.h;
    const standY = feetY - PLAYER_HEIGHT;
    if (!checkCollision(player.x, standY, player.w, PLAYER_HEIGHT, tiles)) {
      player.h = PLAYER_HEIGHT;
      player.y = standY;
    }
    // If blocked overhead, stay crouched until clearance exists
  }

  if (player.onGround) {
    player.coyoteTimer = PLAYER_CONFIG.coyoteFrames;
    player.jumpsUsed = 0;
  } else if (player.coyoteTimer > 0) {
    player.coyoteTimer--;
  }
  if (player.isClimbing) {
    player.jumpsUsed = 0;
  }

  // Jump buffer: only register a new press (not held) for double jump
  if (keys.jump && !player._jumpHeld) {
    player.jumpBufferTimer = PLAYER_CONFIG.jumpBufferFrames;
  } else if (player.jumpBufferTimer > 0) {
    player.jumpBufferTimer--;
  }
  player._jumpHeld = keys.jump;

  // --- Jump: first jump (coyote) OR double jump ---
  if (player.jumpBufferTimer > 0 && !player.isClimbing) {
    if (player.coyoteTimer > 0) {
      // Ground / coyote jump
      player.vy = PLAYER_JUMP;
      player.onGround = false;
      player.isClimbing = false;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
      player.jumpsUsed = 1;
    } else if (player.jumpsUsed < 2) {
      // Double jump — slightly weaker
      player.vy = PLAYER_JUMP * 0.88;
      player.jumpBufferTimer = 0;
      player.jumpsUsed = 2;
      // Dust/leaf burst particles
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: player.x + Math.random() * player.w,
          y: player.y + player.h,
          vx: (Math.random() - 0.5) * 3,
          vy: -Math.random() * 2,
          life: 18, color: '#a0c878', size: 2, type: 'debris',
        });
      }
    }
  }

  // --- Physics: climbing vs gravity ---
  if (player.isClimbing) {
    // No gravity while gripping vine
    if (keys.climbUp)   { player.vy = -2; player.onGround = false; }
    else if (keys.climbDown) { player.vy = 2; }
    else                { player.vy = 0; }
  } else {
    applyGravity(player);
  }

  moveEntity(player, tiles);

  // --- World boundary clamp (hard walls at map edges) ---
  if (player.x < 0) { player.x = 0; player.vx = 0; }
  if (player.x + player.w > PIXEL_WORLD_W) { player.x = PIXEL_WORLD_W - player.w; player.vx = 0; }
  if (player.y < 0) { player.y = 0; player.vy = 0; }

  // --- Last safe position (grounded, not embedded) ---
  if (player.onGround && !checkCollision(player.x, player.y, player.w, player.h, tiles)) {
    player.lastSafeX = player.x;
    player.lastSafeY = player.y;
  }

  // --- Mud state tick & decay ---
  if (player.mudTimer > 0) {
    player.mudTimer--;
    player.mudAmount = Math.max(0, player.mudAmount - MUD_CONFIG.mudDecayPerFrame);
  } else {
    player.mudAmount = 0;
  }

  // Apply mud when standing on muddy tiles or muddy water edges
  const playerTileX = Math.floor((player.x + player.w / 2) / TILE_SIZE);
  const playerFeetTileY = Math.floor((player.y + player.h) / TILE_SIZE);
  const mudTile = getTile(tiles, playerTileX, playerFeetTileY);

  if ((mudTile === TILE.MUD || mudTile === TILE.MUD_EDGE) && player.onGround) {
    // Gradually coat in mud rather than snapping to full coverage instantly
    if (player.mudAmount < 1.0) {
      player.mudAmount = Math.min(1.0, player.mudAmount + MUD_CONFIG.mudCoatRate);
      player.mudTimer = MUD_CONFIG.durationFrames;
      if (player.mudAmount >= 0.5) emit('MUD_COAT', { mudAmount: player.mudAmount });
    }
  }

  // --- Water state: actual tile overlap, not height-based ---
  player.isInWater = checkPlayerInWater(player, tiles);

  // Mud washes off in water
  if (player.isInWater && player.mudAmount > 0) {
    player.mudAmount = Math.max(0, player.mudAmount - PLAYER_CONFIG.mudWashRate);
    if (player.mudAmount <= 0) player.mudTimer = 0;
  }

  // --- World-bottom safety clamp ---
  if (player.y + player.h > WORLD_HEIGHT_PX) {
    player.y = WORLD_HEIGHT_PX - player.h;
    player.vy = 0;
    player.onGround = true;
  }

  // Animation state
  if (!player.onGround && !player.isClimbing) {
    player.state = 'jump';
  } else if (Math.abs(player.vx) > 0 && player.state !== 'crouch') {
    player.state = 'run';
    player.frameTimer++;
    if (player.frameTimer > 6) {
      player.frame = (player.frame + 1) % 4;
      player.frameTimer = 0;
    }
  } else if (player.state !== 'crouch') {
    player.state = 'idle';
    player.frame = 0;
  }

  if (player.attacking && player.activeTool === TOOLS.MACHETE) {
    player.attackTimer--;
    player.state = 'attack';
    if (player.attackTimer <= 0) {
      player.attacking = false;
    }

    if (player.attackTimer === PLAYER_CONFIG.attackDamageFrame) {
      const atkX = Math.floor((player.x + player.w / 2 + player.facing * PLAYER_CONFIG.macheteTileRange) / TILE_SIZE);
      const atkY = Math.floor((player.y + player.h * 0.35) / TILE_SIZE);
      const hitTile = getTile(tiles, atkX, atkY);
      const feetTileY = Math.floor((player.y + player.h) / TILE_SIZE);
      const isFootTile = (atkY >= feetTileY);

      if (!isFootTile && (hitTile === TILE.WOOD || hitTile === TILE.LEAVES || hitTile === TILE.CRATE)) {
        destroyTile(tiles, atkX, atkY);
        resolvePlayerAfterTerrainEdit(player, tiles);
        _applyResourceYield(player, hitTile);
        emit('TILE_DESTROYED', { tx: atkX, ty: atkY, tileType: hitTile });
        for (let i = 0; i < 5; i++) {
          particles.push({
            x: atkX * TILE_SIZE + 8,
            y: atkY * TILE_SIZE + 8,
            vx: (Math.random() - 0.5) * 4,
            vy: -Math.random() * 3,
            life: 20 + Math.random() * 15,
            color: hitTile === TILE.WOOD ? '#8a6a3a' : '#2e6a2e',
            size: 2 + Math.random() * 3,
            type: 'debris',
          });
        }
        player.score += 10;
      } else {
        // Prefer fallen logs within interaction bounds (side-on chopping)
        const fallenLog = getFallenLogInMacheteRange(treeEntities, player.x, player.w, player.y, player.h);
        if (fallenLog) {
          // Damage the closest log at interaction point
          const logCenterX = fallenLog.isFracturedOnly
            ? fallenLog.fracturedUpper.logX + fallenLog.fracturedUpper.logW / 2
            : fallenLog.logX + fallenLog.logW / 2;
          const logCenterY = fallenLog.isFracturedOnly ? fallenLog.fracturedUpper.logY : fallenLog.logY;
          
          // Hit the log — reduce durability
          fallenLog.logDurability = Math.max(0, (fallenLog.logDurability || 6) - 1);
          fallenLog.logChopHits   = (fallenLog.logChopHits || 0) + 1;
          fallenLog.chopHits      = fallenLog.logChopHits; // back-compat

          // Wood chip particles
          for (let i = 0; i < 8; i++) {
            particles.push({
              x: logCenterX + (Math.random() - 0.5) * 20,
              y: logCenterY + (Math.random() - 0.5) * 15,
              vx: (Math.random() - 0.5) * 5,
              vy: -1 - Math.random() * 3,
              life: 16 + Math.random() * 12,
              color: '#8a6a3a',
              size: 2 + Math.random() * 2,
              type: 'debris',
            });
          }

          // Grant wood every 2 hits
          if (fallenLog.logChopHits % 2 === 0) {
            player.resources.wood = (player.resources.wood || 0) + 1;
            console.log('[HARVEST_LOG]', { actor: 'player_machete', logId: fallenLog.id,
              remainingDurability: fallenLog.logDurability, woodSpawned: 1 });
          }

          player.score += 12;
        } else {
          const tree = getTreeInMeleeRange(player, treeEntities);
          if (tree) {
            hitTree(tree, player.x + player.w / 2, atkY, tiles, particles);
            emit('TREE_HIT', { tree: tree.rootTileX });
            for (let i = 0; i < 8; i++) {
              particles.push({
                x: tree.rootTileX * TILE_SIZE + (Math.random() - 0.5) * 20,
                y: (tree.rootTileY - tree.height / 2) * TILE_SIZE + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 5,
                vy: -Math.random() * 4,
                life: 18 + Math.random() * 12,
                color: '#8a6a3a',
                size: 2 + Math.random() * 2,
                type: 'debris',
              });
            }
            player.score += 15;
          }
        }
      }
    }
  }



  if (player.bowDrawn) {
    player.bowPower = Math.min(player.bowPower + PLAYER_CONFIG.bowChargeRate, PLAYER_CONFIG.bowMaxPower);
    player.state = 'bow';
    // Aim with W/S while bow is drawn (reuse climbUp/climbDown which are W/S)
    if (keys.climbUp)   player.bowAngle = Math.max(player.bowAngle - 0.03, -1.2);
    if (keys.climbDown) player.bowAngle = Math.min(player.bowAngle + 0.03, 0.8);
  }

  // ── Dig — requires Shovel tool (shovel cannot chop trees) ─────────────────────
  const usingShovel = player.activeTool === TOOLS.SHOVEL;
  if ((keys.dig || keys.shovel) && usingShovel && !player.attacking) {
    const DIGGABLE_SHOVEL = [TILE.DIRT, TILE.MUD, TILE.GRASS, TILE.WOOD, TILE.BRIDGE];

    const cx    = Math.floor((player.x + player.w / 2) / TILE_SIZE);
    // Tile rows: feet = bottom of player, torso = one tile up, head = two up
    const feetTileY  = Math.floor((player.y + player.h - 1) / TILE_SIZE);
    const torsoTileY = Math.floor((player.y + player.h * 0.5)  / TILE_SIZE);
    const headTileY  = Math.floor(player.y / TILE_SIZE);

    // Tile column directly to each side (just outside hitbox)
    const leftTileX  = Math.floor((player.x - 1) / TILE_SIZE);
    const rightTileX = Math.floor((player.x + player.w) / TILE_SIZE);

    let tilesToDig = []; // array of {x,y} pairs to remove
    let digDirection = null;

    if (keys.climbDown) {
      // Dig DOWN: one tile below feet, centred on player
      tilesToDig = [{ x: cx, y: feetTileY + 1 }];
      // Also clear adjacent tile for width
      tilesToDig.push({ x: cx - 1, y: feetTileY + 1 });
      digDirection = 'DOWN';
    } else if (keys.climbUp && !player.onGround) {
      tilesToDig = [{ x: cx, y: headTileY - 1 }];
      digDirection = 'UP';
    } else if (keys.left) {
      // Side tunnel: remove torso-height (feet + torso) to left of hitbox
      tilesToDig = [
        { x: leftTileX, y: feetTileY  },
        { x: leftTileX, y: torsoTileY },
      ];
      // Also clear head row if torso and head differ (tall gap)
      if (headTileY !== torsoTileY) tilesToDig.push({ x: leftTileX, y: headTileY });
      digDirection = 'LEFT';
    } else if (keys.right) {
      // Side tunnel: remove torso-height to right of hitbox
      tilesToDig = [
        { x: rightTileX, y: feetTileY  },
        { x: rightTileX, y: torsoTileY },
      ];
      if (headTileY !== torsoTileY) tilesToDig.push({ x: rightTileX, y: headTileY });
      digDirection = 'RIGHT';
    } else {
      // No direction key — dig in facing direction
      const sideX = player.facing > 0 ? rightTileX : leftTileX;
      tilesToDig = [
        { x: sideX, y: feetTileY  },
        { x: sideX, y: torsoTileY },
      ];
      if (headTileY !== torsoTileY) tilesToDig.push({ x: sideX, y: headTileY });
      digDirection = player.facing > 0 ? 'RIGHT' : 'LEFT';
    }

    let diggedAny = false;
    for (const { x: dgx, y: dgy } of tilesToDig) {
      const digTile = getTile(tiles, dgx, dgy);
      if (DIGGABLE_SHOVEL.includes(digTile)) {
        destroyTile(tiles, dgx, dgy);
        _applyResourceYield(player, digTile);
        emit('TILE_DESTROYED', { tx: dgx, ty: dgy, tileType: digTile });
        if (digTile === TILE.MUD) {
          player.mudTimer = Math.min(player.mudTimer + PLAYER_CONFIG.mudCoatDuration,
                                     PLAYER_CONFIG.mudCoatMax);
        }
        const debrisColor = digTile === TILE.MUD ? '#3a2a15' : '#4a3728';
        for (let i = 0; i < 4; i++) {
          particles.push({
            x: dgx * TILE_SIZE + 8, y: dgy * TILE_SIZE + 8,
            vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 4,
            life: 22, color: debrisColor, size: 3, type: 'debris',
          });
        }
        diggedAny = true;
      }
    }

    if (diggedAny) {
      // Place timber ladder on the wall when digging down (for escape)
      if (digDirection === 'DOWN') {
        const ladderX = cx - 1;
        const ladderY = feetTileY + 1;
        if (getTile(tiles, ladderX, ladderY) === TILE.AIR) {
          tiles[ladderY][ladderX] = TILE.TIMBER_LADDER;
        }
      }
      resolvePlayerAfterTerrainEdit(player, tiles);
    }
  }
}

// ── Post-terrain-edit collision recovery ────────────────────────────────────
// Call after any tile is destroyed. Pushes player out of solid tiles and
// snaps their feet cleanly to the tile surface.
export function resolvePlayerAfterTerrainEdit(player, tiles) {
  // Step 1: push upward 1px at a time until the hitbox is clear (max 3 tiles)
  const MAX_NUDGE = TILE_SIZE * 3;
  for (let nudge = 0; nudge <= MAX_NUDGE; nudge++) {
    if (!checkCollision(player.x, player.y - nudge, player.w, player.h, tiles)) {
      player.y -= nudge;
      break;
    }
  }
  if (player.y < 0) player.y = 0;

  // Step 2: snap feet to tile surface so player rests ON top, not inside
  // Scan downward from current position to find first solid tile below feet
  const feetY = player.y + player.h;
  const tileBelow = Math.floor(feetY / TILE_SIZE);
  if (isSolid(getTile(tiles, Math.floor((player.x + player.w / 2) / TILE_SIZE), tileBelow))) {
    // Feet are sitting exactly on the tile top edge — snap cleanly
    player.y = tileBelow * TILE_SIZE - player.h;
  }

  // Step 3: refresh ground state + jump timers
  const onGnd = checkCollision(player.x, player.y + 1, player.w, player.h + 1, tiles);
  player.onGround = onGnd;
  if (onGnd) {
    player.coyoteTimer = 6;
    player.jumpBufferTimer = 0;
  }
}

// ── Resource yield helper (config-driven) ───────────────────────────────────
function _applyResourceYield(player, tileType) {
  const TILE_NAME_MAP = { 4: 'wood', 5: 'leaves', 9: 'mud', 1: 'dirt', 2: 'grass', 11: 'crate' };
  const { resourceYield } = WORLD_CONFIG;
  const name = TILE_NAME_MAP[tileType];
  if (!name || !resourceYield[name]) return;
  for (const [res, amt] of Object.entries(resourceYield[name])) {
    player.resources[res] = (player.resources[res] || 0) + amt;
  }
  player.score += 10;
}

export function playerAttack(player) {
  if (!player.attacking && !player.bowDrawn) {
    player.attacking = true;
    player.attackTimer = PLAYER_CONFIG.attackDuration;
  }
}

export function playerStartBow(player) {
  if (!player.attacking) {
    player.bowDrawn = true;
    player.bowPower = 0;
  }
}

export function playerReleaseBow(player, projectiles) {
  if (player.bowDrawn && player.bowPower > 2) {
    const angle = player.bowAngle * player.facing < 0 ? player.bowAngle : player.bowAngle;
    const actualAngle = player.facing === 1 ? player.bowAngle : Math.PI - player.bowAngle;
    
    if (player.bowAmmoType === 'explosive_arrow' && player.explosiveArrowCount > 0) {
      // Fire explosive arrow
      projectiles.push({
        x: player.x + player.w / 2 + player.facing * 10,
        y: player.y + 6,
        vx: Math.cos(actualAngle) * player.bowPower * 0.8,  // slightly slower
        vy: Math.sin(actualAngle) * player.bowPower * 0.8,
        angle: actualAngle,
        damage: 55,
        type: 'explosive_arrow',
        owner: 'player',
        stuck: false,
        life: 300,
        gravityScale: 0.5,
        fuseTime: 0.4,
        explosionRadius: 48,
        terrainRadius: 28,
      });
      player.explosiveArrowCount--;
      player.score += 15;
    } else {
      // Fire standard arrow
      projectiles.push({
        x: player.x + player.w / 2 + player.facing * 10,
        y: player.y + 6,
        vx: Math.cos(actualAngle) * player.bowPower,
        vy: Math.sin(actualAngle) * player.bowPower,
        angle: actualAngle,
        damage: 5 + player.bowPower * 2,
        type: 'arrow',
        owner: 'player',
        stuck: false,
        life: 300,
        gravityScale: 0.4,
      });
      player.score += 5;
    }
  }
  player.bowDrawn = false;
  player.bowPower = 0;
}


// ── performContextTreeChop ────────────────────────────────────────────────────
// Called by the F key handler — BYPASSES activeTool gate.
// Uses IDENTICAL detection logic to squad AI (horizontal trunk distance).
// Returns true if a chop was performed.
export function performContextTreeChop(player, treeEntities, tiles, particles) {
  // ── Fresh immediate scan — same algorithm as squadInitiative._findBestTree ──
  const CHOP_RANGE = 56;  // px — generous range so player doesn't need to pixel-hug trunk

  let nearest = null;
  let nearestLog = null;  // fallen/harvestable log
  let nearestDist = Infinity;
  let closestRaw = null;
  let closestRawDist = Infinity;

  const playerCX = player.x + (player.w || 8) / 2;
  const playerFeetY = player.y + (player.h || 24);

  const count = treeEntities ? treeEntities.length : 0;

  if (treeEntities) {
    for (const tree of treeEntities) {
      // Trunk base pixel coords — same as Poncho uses
      const trunkX = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
      const trunkBaseY = tree.rootTileY * TILE_SIZE;  // ground-level tile bottom

      // Horizontal distance to trunk centre (Poncho's method — NOT Euclidean)
      const horizDist = Math.abs(playerCX - trunkX);

      // Track closest raw tree (for debug) regardless of state
      if (horizDist < closestRawDist) {
        closestRawDist = horizDist;
        closestRaw = tree;
      }

      // State filter — standing/stump choppable, fallen log also harvestable
      const isChoppable    = tree.state === TREE_STATE.STANDING || tree.state === TREE_STATE.STUMP;
      const isHarvestable  = tree.state === TREE_STATE.HARVESTABLE_LOG;
      if (!isChoppable && !isHarvestable) continue;

      if (isHarvestable) {
        // For fallen logs: check interaction box directly
        const logCX = tree.logX + tree.logW / 2;
        const logDist = Math.abs(playerCX - logCX);
        if (logDist < 80 && Math.abs((player.y + player.h / 2) - tree.logY) < 40) {
          if (logDist < nearestDist) {
            nearestLog  = tree;
            nearestDist = logDist;
          }
        }
        continue;
      }

      // Horizontal range check (standing trees)
      if (horizDist > CHOP_RANGE) continue;

      // Vertical gate — only reject if player is deeply buried BELOW the trunk base
      // (e.g. underground). Do NOT reject if player is above trunk (on a platform) —
      // horizontal range is sufficient for tree chopping from elevated positions.
      if (player.y > trunkBaseY + TILE_SIZE * 3) continue;  // player buried below tree root

      if (horizDist < nearestDist) {
        nearest = tree;
        nearestDist = horizDist;
      }
    }
  }

  // ── Enhanced debug — matches the full spec ──────────────────────────────
  const dbg = {
    currentTool:         player.activeTool,
    playerWorldX:        Math.round(playerCX),
    playerWorldY:        Math.round(playerFeetY),
    treeCollectionCount: count,
    closestTreeRawId:    closestRaw ? closestRaw.id : null,
    closestTreeRawDist:  closestRaw ? Math.round(closestRawDist) : null,
    closestTreeRawX:     closestRaw ? closestRaw.rootTileX * TILE_SIZE : null,
    closestTreeRawY:     closestRaw ? closestRaw.rootTileY * TILE_SIZE : null,
    closestTreeRawState: closestRaw ? closestRaw.state : null,
    nearestTreeId:       nearest ? nearest.id : null,
    nearestTreeDist:     nearest ? Math.round(nearestDist) : null,
    nearestTreeValid:    !!nearest,
    invalidReason:       !nearest
      ? (count === 0 ? 'NO_TREES_IN_COLLECTION'
        : closestRaw && (closestRaw.state !== TREE_STATE.STANDING && closestRaw.state !== TREE_STATE.STUMP)
          ? `TREE_WRONG_STATE:${closestRaw.state}`
          : closestRaw ? `HORIZ_DIST_${Math.round(closestRawDist)}_EXCEEDS_RANGE_${CHOP_RANGE}` : 'UNKNOWN')
      : null,
    actionChosen: nearest ? 'CONTEXT_CHOP_TREE' : 'USE_SELECTED_TOOL',
  };
  console.log('[F_ACTION_DEBUG]', JSON.stringify(dbg));

  // ── Handle fallen log F-action ─────────────────────────────────────────
  if (nearestLog) {
    nearestLog.logDurability = Math.max(0, (nearestLog.logDurability || 6) - 1);
    nearestLog.logChopHits   = (nearestLog.logChopHits || 0) + 1;
    nearestLog.chopHits      = nearestLog.logChopHits;

    const logCX = nearestLog.logX + nearestLog.logW / 2;
    for (let i = 0; i < 6; i++) {
      particles.push({ x: logCX + (Math.random() - 0.5) * 20, y: nearestLog.logY,
        vx: (Math.random() - 0.5) * 4, vy: -1 - Math.random() * 2,
        life: 14, color: '#8a6a3a', size: 2 + Math.random() * 2, type: 'debris' });
    }
    if (nearestLog.logChopHits % 2 === 0) {
      player.resources.wood = (player.resources.wood || 0) + 1;
      console.log('[HARVEST_LOG]', { actor: 'player_F', logId: nearestLog.id,
        remainingDurability: nearestLog.logDurability, woodSpawned: 1 });
    }
    player.attacking = true;
    player.attackTimer = PLAYER_CONFIG.attackDuration;
    player.state = 'attack';
    player.score += 10;
    return true;
  }

  if (!nearest) return false;

  // ── Apply chop — same damage path as machete + squad AI ─────────────────
  const attackTileY = nearest.rootTileY - 1;  // base of trunk, matches squadInitiative line 164

  // Bark/splinter particles
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: nearest.rootTileX * TILE_SIZE + (Math.random() - 0.5) * 20,
      y: (nearest.rootTileY - nearest.height / 2) * TILE_SIZE + (Math.random() - 0.5) * 30,
      vx: (Math.random() - 0.5) * 5,
      vy: -Math.random() * 4,
      life: 18 + Math.random() * 12,
      color: '#8a6a3a',
      size: 2 + Math.random() * 2,
      type: 'debris',
    });
  }

  // Fire attack animation
  player.attacking = true;
  player.attackTimer = PLAYER_CONFIG.attackDuration;
  player.state = 'attack';

  // Apply tree damage — exact same call as squadInitiative.js line 165
  hitTree(nearest, playerCX, attackTileY, tiles, particles);
  emit('TREE_HIT', { tree: nearest.rootTileX, source: 'context_f' });
  player.score += 15;

  // Face the tree
  const trunkCX = nearest.rootTileX * TILE_SIZE + TILE_SIZE / 2;
  player.facing = trunkCX > playerCX ? 1 : -1;

  return true;
}

export function getTreeInMeleeRange(player, treeEntities) {
  if (!treeEntities) return null;
  const melee_dist = TILE_SIZE * 2.5;
  for (const tree of treeEntities) {
    if (tree.state === TREE_STATE.STANDING || tree.state === TREE_STATE.STUMP) {
      const treeCenterX = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
      const treeCenterY = (tree.rootTileY - tree.height / 2) * TILE_SIZE;
      const dx = player.x + player.w / 2 - treeCenterX;
      const dy = player.y + player.h / 2 - treeCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < melee_dist) return tree;
    }
  }
  return null;
}

export function getFallenLogInRange(player, treeEntities) {
  if (!treeEntities) return null;
  const melee_dist = TILE_SIZE * 3;  // Larger range for fallen logs
  for (const tree of treeEntities) {
    if (tree.state === TREE_STATE.FALLING || tree.state === TREE_STATE.FALLEN) {
      const treeCenterX = tree.x || tree.rootTileX * TILE_SIZE;
      const treeCenterY = tree.y || (tree.rootTileY - tree.height / 2) * TILE_SIZE;
      const dx = player.x + player.w / 2 - treeCenterX;
      const dy = player.y + player.h / 2 - treeCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < melee_dist) return tree;
    }
  }
  return null;
}

function damageTreeEntity(tree, hitX, hitY, particles) {
  if (!tree.health) tree.health = 40;
  tree.health -= 8;
  if (tree.health <= 0) {
    tree.health = 0;
  }
}

// ── Water detection: tile-based, not height-based ───────────────────────────
function checkPlayerInWater(player, tiles) {
  // Sample multiple points in player hitbox: head, torso, feet, center
  const points = [
    { x: player.x + player.w / 2, y: player.y + 2 },       // head
    { x: player.x + player.w / 2, y: player.y + player.h / 2 }, // torso
    { x: player.x + player.w / 2, y: player.y + player.h - 2 }, // feet
  ];

  let waterTiles = 0;
  for (const pt of points) {
    const tx = Math.floor(pt.x / TILE_SIZE);
    const ty = Math.floor(pt.y / TILE_SIZE);
    if (getTile(tiles, tx, ty) === TILE.WATER) {
      waterTiles++;
    }
  }

  // Only consider underwater if at least 2 of 3 points overlap water
  return waterTiles >= 2;
}

export function harvestResource(player, resourceNodes) {
  for (const node of resourceNodes) {
    if (node.looted) continue;
    const dist = Math.sqrt((player.x - node.x) ** 2 + (player.y - node.y) ** 2);
    if (dist < 40) {
      node.looted = true;
      if (node.type === 'helicopter') {
        player.resources.metal += 5;
        player.resources.explosives += 3;
        player.score += 50;
      } else if (node.type === 'compound') {
        player.resources.explosives += 4;
        player.resources.metal += 3;
        player.resources.rope += 3;
        player.score += 75;
      }
      return node.type;
    }
  }
  return null;
}