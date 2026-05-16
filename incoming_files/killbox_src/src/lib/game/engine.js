// LAST HUNT: KILLBOX - Game Engine
import { GAME_STATES, PREP_TIME, HUNTER_STALK_TIME, TILE_SIZE, TRAP_TYPES, PIXEL_WORLD_W, PIXEL_WORLD_H } from './constants';
import { setAudioPhase, destroyAudio, initAudio } from './audio'; // initAudio re-exported for GameCanvas
import { GAME_CONFIG } from './config/game.config';
import { CHARACTERS } from './data/characters.config';
import { HUNTER_CONFIG } from './config/hunter.config';
import { createCamera, updateCamera, startInsertionCamera, handleZoomInput } from './core/cameraSystem';
import { emit } from './core/eventBus';
import { generateWorld } from './worldGen';
import { updateFoliage, createFoliageParticles, damageFoliage, chopFoliage, findNearestChoppableFoliage } from './foliage/foliageSystem';
import { damageProp, createPropParticles } from './foliage/propSystem';
import { createPlayer, updatePlayer, playerAttack, playerStartBow, playerReleaseBow, harvestResource, resolvePlayerAfterTerrainEdit, performContextTreeChop } from './player';
import { createHunter, updateHunter, chooseHunterMode, damageHunter } from './hunter';
import { chooseEntrySide, calculateHunterSpawnPosition, setHunterApproachDirection } from './ai/hunterEntry';
import { updateSquad } from './squad';
import { createSquadGroupState, updateSquadAI } from './ai/squadAI';
import {
  initMorale, tickMorale, applyMoraleEvent, broadcastMoraleEvent,
  applyPrepPersonality, MORALE_EVENT,
} from './ai/squadMorale';
import { trySquadCinematic, recordPlayerBehavior } from './ai/hunterPsychwar';
import { updateProjectile, createExplosion, updateFire, checkFireDamage, updateMovingProp, checkPropEntityCollision } from './physics';
import { updateTraps, checkTrapChains, placeTrap, canPlaceTrap, TRAP_LIST } from './traps';
import { renderGame } from './renderer';
import { createHelicopter, updateHelicopter, HELI_STATE } from './helicopter';
import { triggerBark } from './barksSystem.js';
import { buildTreeEntities, updateTrees, getTreeAtTile, hitTree } from './trees';
import { createWildlife, updateWildlife } from './wildlife';
import { createResearchState, earnResearchPoints, finalizeRunResearch, hasUpgrade } from './research';
import { TOOLS } from './constants';
import { spawnCrates, damageCrate, openCrate } from './crates';
import { equipWeapon, updateReload } from './weapons';
import { updateWeaponFiring, handleMouseMove } from './input';
import {
  createGrenadeThrowState, startGrenadeCharge, updateGrenadeCharge,
  releaseGrenade, updateHandGrenade, createGrenadeCrater,
  getGrenadeTrajectoryPoints,
} from './grenadeSystem';

export function createGameState() {
  const world = generateWorld();
  const player = createPlayer(world.spawnPoint.x, world.spawnPoint.y);
  const camera = createCamera(0, 0);
  const leafPiles = [];  // Persistent leaf resource nodes

  // Check if coming from character select
  const selectedCharacterId = typeof window !== 'undefined' 
    ? sessionStorage.getItem('selectedCharacter')
    : null;
  
  if (selectedCharacterId && CHARACTERS[selectedCharacterId]) {
    const charConfig = CHARACTERS[selectedCharacterId];

    // ── Stats ──
    player.maxHealth = Math.floor(100 * charConfig.stats.health / 100);
    player.health    = player.maxHealth;
    player.speed     = player.speed * (charConfig.stats.speed || 1);
    player.characterId     = selectedCharacterId;
    player.characterConfig = charConfig;

    // ── Body dimensions — use character-specific proportions ──
    if (charConfig.body) {
      player.w = charConfig.body.w  || player.w;
      player.h = charConfig.body.h  || player.h;
    }

    // ── Primary weapon — equip immediately so the weapon is drawn + has ammo ──
    if (charConfig.weaponId) {
      equipWeapon(player.weaponState, charConfig.weaponId);
    }
  }
  
  // Start player with some explosive arrows
  player.explosiveArrowCount = 3;

  // If a character was selected, skip title and begin insertion
  const startPhase = selectedCharacterId ? GAME_STATES.INSERTION : GAME_STATES.TITLE;

  const groundY = selectedCharacterId ? findSafeGroundBelow(world, world.spawnPoint.x, world.spawnPoint.y) : null;
  const helicopter = selectedCharacterId ? createHelicopter(world.spawnPoint.x, groundY) : null;
  if (selectedCharacterId) {
    player.inInsertion = true;
    player.x = -9999;
    player.y = -9999;
    startInsertionCamera(camera);
  }

  return {
    world,
    player,
    hunter: null,
    traps: [],
    projectiles: [],
    particles: [],
    firePatches: [],
    leafPiles,
    leafTiles: [],  // Persistent fallen canopy leaf resource tiles
    woodPickups: [],  // Scattered wood chunks from fallen trees
    camera,
    gamePhase: startPhase,
    helicopter,
    prepTimer: PREP_TIME,
    stalkTimer: HUNTER_STALK_TIME,
    squadGroupState: null,  // created lazily on first squad update
    score: 0,
    trapSelect: 0,
    keys: {},
    hunterModeChosen: false,
    escapeTimer: 0,
    grenadeThrow: createGrenadeThrowState(),
    // Tree entities
    treeEntities: buildTreeEntities(world.trees, world.tiles),
    // Tree variant sprites
    treeVariants: world.treeVariants || [],
    // Screen shake
    screenShake: { intensity: 0 },
    // Wildlife
    wildlife: createWildlife(world),
    // Meta progression (persists across runs)
    research: createResearchState(),
    // Thermal vision toggle
    thermalMode: false,
    // Research screen toggle
    showResearch: false,
    // Weapon crates
    crates: selectedCharacterId ? spawnCrates(world, world.spawnPoint.x, world.spawnPoint.y) : [],
    // Time tracking
    gameTime: 0,
  };
}

export function resetGame(gs) {
  const world = generateWorld();
  // Player starts WAY off-screen — helicopter owns the position until landing
  const player = createPlayer(-9999, -9999);
  player.inInsertion = true;
  const camera = createCamera(world.spawnPoint.x, world.spawnPoint.y);
  gs.world = world;
  gs.player = player;
  gs.camera = camera;
  gs.hunter = null;
  gs.traps = [];
  gs.projectiles = [];
  gs.particles = [];
  gs.firePatches = [];
  gs.gamePhase = GAME_STATES.INSERTION;
  gs.prepTimer = PREP_TIME;
  gs.stalkTimer = HUNTER_STALK_TIME;
  gs.score = 0;
  gs.trapSelect = 0;
  gs.hunterModeChosen = false;
  gs.escapeTimer = 0;
  gs.grenadeThrow = createGrenadeThrowState();
  gs.treeEntities = buildTreeEntities(world.trees, world.tiles);
  gs.treeVariants = world.treeVariants || [];
  gs.leafPiles = [];
  gs.leafTiles = [];
  gs.woodPickups = [];
  gs.screenShake = { intensity: 0 };
  gs.wildlife = createWildlife(world);
  gs.thermalMode = false;
  gs.showResearch = false;
  gs.gameTime = 0;
  // Reset run-specific AI state
  gs.squadGroupState = null;          // fresh group memory per run
  gs.player.trapsPlaced = 0;          // reset trophy system counter
  gs.player._justPlacedTrap = false;  // reset trap-stack flag
  // Finalize previous run research (if any)
  if (gs.research) {
    finalizeRunResearch(gs.research);
  } else {
    gs.research = createResearchState();
  }

  // Ground reference: scan downward from spawnPoint to find the first solid tile top
  const groundY = findSafeGroundBelow(world, world.spawnPoint.x, world.spawnPoint.y);
  gs.helicopter = createHelicopter(world.spawnPoint.x, groundY);

  // Start insertion cinematic camera
  startInsertionCamera(camera);

  // Spawn weapon crates
  gs.crates = spawnCrates(world, world.spawnPoint.x, world.spawnPoint.y);
}

// Find the Y pixel of the top of the first solid tile below (worldX, startY)
function findSafeGroundBelow(world, worldX, startY) {
  const tx = Math.floor(worldX / TILE_SIZE);
  const startTY = Math.floor(startY / TILE_SIZE);
  for (let ty = startTY; ty < world.tiles.length; ty++) {
    const row = world.tiles[ty];
    if (!row) continue;
    const tile = row[tx] ?? 0;
    if (tile !== 0) return ty * TILE_SIZE; // top of this tile in world-px
  }
  return startY + 200; // fallback
}

export function updateGame(gs, deltaTime) {
  if (gs.gamePhase === GAME_STATES.TITLE) return;
  if (gs.gamePhase === GAME_STATES.VICTORY || gs.gamePhase === GAME_STATES.DEFEAT) return;

  const { player, world, keys } = gs;

  // ── INSERTION PHASE ──────────────────────────────────────────────────────
  if (gs.gamePhase === GAME_STATES.INSERTION) {
    if (gs.helicopter) {
      const heli = gs.helicopter;
      updateHelicopter(heli, player, gs.particles, heli._groundY);

      // Update cinematic camera during insertion
      const squad = heli.squad || [];
      updateCamera(gs.camera, player, deltaTime, heli, squad);

      // Transition to PREP — one-shot: only fires once when all conditions first met
      if (gs.gamePhase === GAME_STATES.INSERTION &&
          heli.done && player.onGround && !player.inInsertion && gs.camera.insertionComplete) {
        gs.gamePhase = GAME_STATES.PREP;
        if (typeof window !== 'undefined') window.__KILLBOX_PHASE__ = 'PREP';
        setAudioPhase('prep');
        gs.camera.mode = 'FOLLOW_PLAYER';
      }
    }

    // Update particles only during insertion
    for (let i = gs.particles.length - 1; i >= 0; i--) {
      const p = gs.particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.type !== 'smoke' && p.type !== 'shimmer' && p.type !== 'glow') p.vy += 0.1;
      if (p.type === 'smoke') { p.size *= 1.02; p.vx *= 0.98; }
      p.life--;
      if (p.life <= 0) gs.particles.splice(i, 1);
    }
    return;
  }

  // Track game time
  gs.gameTime += deltaTime / 1000;

  // Update player
  updatePlayer(player, keys, world.tiles, gs.projectiles, gs.particles, gs.gameTime, gs.treeEntities);

  // Update weapon firing + recoil bloom decay
  updateWeaponFiring(gs, deltaTime);
  if (player.weaponState) updateReload(player.weaponState, deltaTime);

  // Grenade charge update
  if (gs.grenadeThrow) updateGrenadeCharge(gs.grenadeThrow, deltaTime);

  // Tree-fall intercept: route through tree physics instead of instant destroy.
  // Fired on attackTimer === 8 to match the single-frame tile-hit window in player.js.
  if (player.attacking && player.attackTimer === 8) {
    const atkX = Math.floor((player.x + player.w / 2 + player.facing * 22) / TILE_SIZE);
    const atkY = Math.floor((player.y + player.h * 0.35) / TILE_SIZE);
    const feetTileY = Math.floor((player.y + player.h) / TILE_SIZE);
    // Only route to tree system if not targeting floor level
      if (atkY < feetTileY) {
        const tree = getTreeAtTile(gs.treeEntities, atkX, atkY);
        if (tree) {
          hitTree(tree, player.x + player.w / 2, atkY, world.tiles, gs.particles);
        player.resources.wood += 1;
        resolvePlayerAfterTerrainEdit(player, world.tiles);
      }
    }
  }

  // Try harvest on interact
  if (keys.interact) {
    const harvested = harvestResource(player, world.resourceNodes);
    if (harvested) {
      keys.interact = false;
      // Notification particle
      gs.particles.push({
        x: player.x, y: player.y - 20,
        vx: 0, vy: -1, life: 40,
        color: '#ffaa00', size: 3, type: 'glow',
      });
    }
  }

  // Auto-collect nearby leaf piles (36 pixel radius)
  const LEAF_PICKUP_RADIUS = 36;
  for (let i = gs.leafPiles.length - 1; i >= 0; i--) {
    const pile = gs.leafPiles[i];
    const dx = player.x + player.w / 2 - pile.x;
    const dy = player.y + player.h / 2 - pile.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < LEAF_PICKUP_RADIUS) {
      player.resources.leaves = (player.resources.leaves || 0) + pile.amount;
      gs.particles.push({
        x: pile.x, y: pile.y,
        vx: (Math.random() - 0.5) * 2, vy: -2,
        life: 20, color: '#2a6a2a', size: 2, type: 'glow',
      });
      gs.leafPiles.splice(i, 1);
    }
  }

  // Auto-collect leaf resource tiles (player overlap via hitbox)
  for (let i = gs.leafTiles.length - 1; i >= 0; i--) {
    const leafTile = gs.leafTiles[i];
    if (leafTile.collected) continue;
    
    // Simple AABB overlap: player hitbox vs tile hitbox
    if (player.x < leafTile.x + leafTile.w &&
        player.x + player.w > leafTile.x &&
        player.y < leafTile.y + leafTile.h &&
        player.y + player.h > leafTile.y) {
      
      player.resources.leaves = (player.resources.leaves || 0) + leafTile.amount;
      leafTile.collected = true;
      
      // Collection feedback
      gs.particles.push({
        x: leafTile.x + leafTile.w / 2, y: leafTile.y + leafTile.h / 2,
        vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random(),
        life: 18, color: '#3a8a2a', size: 2, type: 'glow',
      });
      
      gs.leafTiles.splice(i, 1);
    }
  }

  // Auto-collect wood pickups (walk-through)
  if (gs.woodPickups) {
    for (let i = gs.woodPickups.length - 1; i >= 0; i--) {
      const wp = gs.woodPickups[i];
      if (wp.collected) { gs.woodPickups.splice(i, 1); continue; }

      // Apply gravity/bounce to flying chunks
      if (!wp.landed) {
        wp.vy += 0.35;
        wp.x  += wp.vx;
        wp.y  += wp.vy;

        // Terrain-snapped ground landing — find real tile ground at this X column
        if (wp.vy > 0) {
          const tileX   = Math.floor(wp.x / TILE_SIZE);
          const startTY = Math.floor(wp.y / TILE_SIZE);
          let groundY   = world.groundY || 520;
          // Scan downward from current position to find first solid tile
          for (let ty = startTY; ty < startTY + 8; ty++) {
            const t = world.tiles && world.tiles[ty] && world.tiles[ty][tileX];
            const isSolid = t && t !== 'air' && t !== 'empty' && t !== 'bridge';
            if (isSolid) { groundY = ty * TILE_SIZE; break; }
          }
          // Also check pickups already landed at this X — stack on top
          const CHUNK_H = 10; // visual height of one log chunk
          const stackedY = gs.woodPickups
            .filter((other, oi) => oi !== i && other.landed &&
              Math.abs(other.x - wp.x) < 14)
            .reduce((topY, other) => Math.min(topY, other.y - CHUNK_H), groundY);
          const snapY = stackedY - 2;

          if (wp.y >= snapY) {
            wp.y      = snapY;
            wp.vx    *= 0.5;
            wp.vy     = 0;
            wp.landed = true;
          }
        }
      }

      // Lifetime decay
      wp.lifetime = (wp.lifetime || 1800) - 1;
      if (wp.lifetime <= 0) { gs.woodPickups.splice(i, 1); continue; }

      // Player AABB collect
      const dx = (player.x + player.w / 2) - wp.x;
      const dy = (player.y + player.h / 2) - wp.y;
      if (Math.abs(dx) < (wp.collectRadius || 20) && Math.abs(dy) < (wp.collectRadius || 20)) {
        player.resources.wood = (player.resources.wood || 0) + (wp.amount || 1);
        gs.particles.push({ x: wp.x, y: wp.y, vx: 0, vy: -2, life: 14,
          color: '#c8a060', size: 3, type: 'glow' });
        console.log('[COLLECT_RESOURCE]', { actor: 'player', type: 'wood', amount: wp.amount, sourceTreeId: wp.sourceTreeId });
        gs.woodPickups.splice(i, 1);
      }
    }
  }

  // PREP PHASE
  if (gs.gamePhase === GAME_STATES.PREP) {
    gs.prepTimer -= deltaTime / 1000;
    
    // Ambient jungle particles
    if (Math.random() > 0.95) {
      gs.particles.push({
        x: gs.camera.x + Math.random() * 800,
        y: gs.camera.y + Math.random() * 200,
        vx: -0.3, vy: 0.1,
        life: 60, color: '#2a4a1a', size: 2, type: 'debris',
      });
    }

    if (gs.prepTimer <= 0 && gs.gamePhase === GAME_STATES.PREP) {
      gs.gamePhase = GAME_STATES.HUNT;
      if (typeof window !== 'undefined') window.__KILLBOX_PHASE__ = 'HUNT';
      setAudioPhase('hunt');
      
      // Determine hunter entry direction
      const entrySide = chooseEntrySide();
      const spawnPos = calculateHunterSpawnPosition(entrySide, world, player);
      
      gs.hunter = createHunter(spawnPos.x, spawnPos.y);
      setHunterApproachDirection(gs.hunter, entrySide);
      gs.stalkTimer = HUNTER_STALK_TIME;
    }
  }

  // HUNT PHASE
  if (gs.gamePhase === GAME_STATES.HUNT && gs.hunter) {
    // Stalk phase
    if (gs.hunter.aiState === 'stalk') {
      gs.stalkTimer -= deltaTime / 1000;
      if (gs.stalkTimer <= 0 && !gs.hunterModeChosen) {
        const mode = chooseHunterMode(gs.hunter);
        gs.hunterModeChosen = true;
        // Mode announcement
        gs.particles.push({
          x: gs.hunter.x, y: gs.hunter.y - 30,
          vx: 0, vy: -0.5, life: 90,
          color: '#ff3300', size: 5, type: 'glow',
        });
      }
    }

    // Pass context refs so hunterAI + psychwar can sense everything
    gs.hunter._squadRef        = gs.helicopter?.squad || [];
    gs.hunter._trapsRef        = gs.traps || [];
    gs.hunter._fireRef         = gs.firePatches || [];
    gs.hunter._wildlifeRef     = gs.wildlife || null;
    gs.hunter._treeEntitiesRef = gs.treeEntities || [];
    updateHunter(gs.hunter, player, world.tiles, gs.projectiles, gs.particles, deltaTime);

    // Handle psychwar plasma distraction shots
    if (gs.hunter._psychPlasmaShot) {
      const ps = gs.hunter._psychPlasmaShot;
      gs.projectiles.push({
        x: ps.x, y: ps.y,
        vx: Math.cos(ps.angle) * 7, vy: Math.sin(ps.angle) * 7,
        angle: ps.angle, damage: 0, type: 'plasma',
        owner: 'hunter', stuck: false, life: 200, gravityScale: 0, radius: 30,
      });
      gs.hunter._psychPlasmaShot = null;
    }

    // Record player behavior for Hunter adaptation
    if (gs.hunter.psychState) {
      const ps = gs.hunter.psychState;
      if (player.digging)                                     recordPlayerBehavior(ps, 'UNDERGROUND');
      if ((player.mudAmount || 0) > 0.5)                      recordPlayerBehavior(ps, 'FIRE_HIDE');
      if (player.activeTool === 'machete' && player.attacking) recordPlayerBehavior(ps, 'TREE');
      // TRAP_STACK: player places trap while at least 2 others already exist nearby
      if (player._justPlacedTrap) {
        const nearbyTraps = gs.traps.filter(t =>
          !t.triggered && Math.hypot(t.x - player.x, t.y - player.y) < 200
        ).length;
        if (nearbyTraps >= 2) recordPlayerBehavior(ps, 'TRAP_STACK');
        player._justPlacedTrap = false;
      }
    }

    // Track survival time for research
    if (gs.research) gs.research.runStats.survivalSeconds += deltaTime / 1000;

    // Check trap triggers
    const triggered = updateTraps(gs.traps, gs.hunter, gs.particles, world.tiles, gs.firePatches);
    for (const trap of triggered) {
      damageHunter(gs.hunter, trap.damage, gs.particles, trap.stun);
      checkTrapChains(gs.traps, trap);
      gs.score += trap.damage * GAME_CONFIG.trapDamageScoreMulti;
      // Research: trap kill credit
      if (gs.research) {
        gs.research.runStats.trapKills++;
        if (triggered.length >= 2) gs.research.runStats.chainKills++;
      }
    }

    // Self destruct sequence — one-shot: detonated flag prevents repeat
    if (gs.hunter.selfDestruct && !gs.hunter._detonated) {
      gs.escapeTimer++;
      if (gs.escapeTimer > HUNTER_CONFIG.selfDestructDelay) {
        gs.hunter._detonated = true;  // one-shot guard
        gs.screenShake.intensity = Math.max(gs.screenShake.intensity, 22);  // Hunter self-destruct — maximum shake
        createExplosion(gs.hunter.x, gs.hunter.y,
          HUNTER_CONFIG.selfDestructRadius, world.tiles, gs.particles, gs.firePatches);
        const distToPlayer = Math.sqrt(
          (player.x - gs.hunter.x) ** 2 + (player.y - gs.hunter.y) ** 2
        );
        if (distToPlayer < HUNTER_CONFIG.selfDestructPlayerKillRange) {
          player.health = 0;
          player.alive = false;
          gs.gamePhase = GAME_STATES.DEFEAT;
          setAudioPhase('defeat');
        } else {
          gs.gamePhase = GAME_STATES.VICTORY;
          setAudioPhase('victory');
          gs.score += HUNTER_CONFIG.selfDestructScoreBonus;
          emit('PHASE_CHANGE', { from: GAME_STATES.HUNT, to: GAME_STATES.VICTORY });
        }
      }
    }

    // Player death (with brutal feedback) — one-shot guard via player.alive
    if (player.health <= 0 && player.alive) {
      player.alive = false;
      gs.gamePhase = GAME_STATES.DEFEAT;
      setAudioPhase('defeat');
      
      // Hyper-violent death burst
      const deathGoreCount = 30 + Math.floor(Math.random() * 20);
      for (let i = 0; i < deathGoreCount; i++) {
        const ang = (i / deathGoreCount) * Math.PI * 2;
        gs.particles.push({
          x: player.x + player.w / 2,
          y: player.y + player.h / 2,
          vx: Math.cos(ang) * (5 + Math.random() * 8),
          vy: Math.sin(ang) * (5 + Math.random() * 8),
          life: 50 + Math.random() * 30,
          color: Math.random() > 0.5 ? '#dd0000' : '#aa0000',
          size: 3 + Math.random() * 5,
          type: 'blood',
        });
      }
      
      // Screen flash effect (handled in renderer)
      emit('PLAYER_DEAD', { killType: 'brutal' });
      emit('PHASE_CHANGE', { from: GAME_STATES.HUNT, to: GAME_STATES.DEFEAT });
    }
  }

  // Update projectiles
  for (let i = gs.projectiles.length - 1; i >= 0; i--) {
    const proj = gs.projectiles[i];
    if (proj.stuck) {
      proj.life--;
      if (proj.life <= 0) gs.projectiles.splice(i, 1);
      continue;
    }

    // ── Hand grenade physics ────────────────────────────────────────────────
    if (proj.type === 'hand_grenade') {
      const result = updateHandGrenade(proj, world.tiles, deltaTime);
      if (result && result.smokeAt) {
        gs.particles.push({
          x: result.smokeAt.x, y: result.smokeAt.y,
          vx: (Math.random() - 0.5) * 0.8, vy: -0.8 - Math.random(),
          life: 30, color: '#555555', size: 3, type: 'smoke',
        });
      }
      proj.life--;

      // Fuse detonation or out-of-life
      if (proj.fuseTimer <= 0 || proj.life <= 0) {
        createGrenadeCrater(proj.x, proj.y, world.tiles, gs.particles, gs.firePatches, world.props);
        resolvePlayerAfterTerrainEdit(player, world.tiles);
        emit('NOISE_EVENT', { x: proj.x, y: proj.y, radius: proj.noiseRadius });

        // Damage player
        const pDist = Math.sqrt((proj.x - player.x - player.w/2)**2 + (proj.y - player.y - player.h/2)**2);
        if (pDist < proj.explosionRadius) {
          // Hand grenade shake — massive
          gs.screenShake.intensity = Math.max(gs.screenShake.intensity, Math.min(20, proj.explosionRadius * 0.28));
          player.health -= proj.damage * (1 - pDist / proj.explosionRadius);
          player.vy = -6;
        }

        // Damage hunter
        if (gs.hunter && gs.hunter.alive) {
          const hDist = Math.sqrt((proj.x - gs.hunter.x - gs.hunter.w/2)**2 + (proj.y - gs.hunter.y - gs.hunter.h/2)**2);
          if (hDist < proj.explosionRadius) {
            damageHunter(gs.hunter, proj.damage * (1 - hDist / proj.explosionRadius), gs.particles);
            gs.score += 150;
          }
        }

        // Damage squad
        if (gs.helicopter && gs.helicopter.squad) {
          for (const member of gs.helicopter.squad) {
            const mDist = Math.sqrt((proj.x - member.x)**2 + (proj.y - member.y)**2);
            if (mDist < proj.explosionRadius) member.health -= proj.damage * 0.3;
          }
        }

        gs.projectiles.splice(i, 1);
      }
      continue;
    }

    const hit = updateProjectile(proj, world.tiles);
    proj.life--;

    // Bullet impact sparks / dust on terrain hit
    if (hit && (proj.type === 'bullet' || proj.type === 'pellet') && proj.owner === 'player') {
      const sparkColor = proj.weaponId === 'shotgun' ? '#ffcc44' : '#ffdd88';
      const sparkCount = proj.type === 'pellet' ? 3 : 5;
      for (let s = 0; s < sparkCount; s++) {
        gs.particles.push({
          x: proj.x, y: proj.y,
          vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4 - 1,
          life: 12 + Math.random() * 8,
          color: Math.random() > 0.4 ? sparkColor : '#ffffff',
          size: 1 + Math.random(),
          type: 'spark',
        });
      }
    }

    // Check crate hits (bullets + grenades)
    if (proj.owner === 'player' && (proj.type === 'bullet' || proj.type === 'pellet')) {
      for (const crate of gs.crates) {
        if (!crate.opened) {
          const dx = proj.x - crate.x - crate.w / 2;
          const dy = proj.y - crate.y - crate.h / 2;
          if (Math.abs(dx) < crate.w / 2 && Math.abs(dy) < crate.h / 2) {
            if (damageCrate(crate, proj.damage)) {
              openCrate(crate);
              // Break FX
              for (let j = 0; j < 8; j++) {
                gs.particles.push({
                  x: crate.x, y: crate.y,
                  vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4,
                  life: 25, color: '#8a6a3a', size: 2, type: 'debris',
                });
              }
              gs.score += 25;
            }
            gs.projectiles.splice(i, 1);
            continue;
          }
        }
      }
    }

    // Check entity hits
    if (proj.owner === 'player' && gs.hunter && gs.hunter.alive) {
      const hDist = Math.sqrt((proj.x - gs.hunter.x - gs.hunter.w / 2) ** 2 + (proj.y - gs.hunter.y - gs.hunter.h / 2) ** 2);
      if (hDist < 20) {
        damageHunter(gs.hunter, proj.damage * (proj.hunterDamage || 1), gs.particles);
        gs.score += 100;
        if (gs.research) gs.research.runStats.damageDealt += proj.damage;
        gs.projectiles.splice(i, 1);
        continue;
      }
    }

    if (proj.owner === 'hunter' && player.alive) {
      const pDist = Math.sqrt((proj.x - player.x - player.w / 2) ** 2 + (proj.y - player.y - player.h / 2) ** 2);
      if (pDist < 15) {
        player.health -= proj.damage;
        // Knockback
        player.vx = (proj.vx > 0 ? 1 : -1) * 8;
        player.vy = -5;
        gs.projectiles.splice(i, 1);
        // Blood
        for (let j = 0; j < 6; j++) {
          gs.particles.push({
            x: player.x + player.w / 2, y: player.y + player.h / 2,
            vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4,
            life: 20, color: '#aa0000', size: 2, type: 'blood',
          });
        }
        continue;
      }
    }

    // Explosive arrow detonation
    if (proj.type === 'explosive_arrow') {
      proj.fuseTime -= deltaTime / 1000;
      if (hit || proj.fuseTime <= 0) {
        // Detonate
        createExplosion(proj.x, proj.y, proj.explosionRadius, world.tiles, gs.particles, gs.firePatches, world.props);
        // BIG explosion shake — scales with radius
        gs.screenShake.intensity = Math.max(gs.screenShake.intensity, Math.min(18, proj.explosionRadius * 0.25));
        resolvePlayerAfterTerrainEdit(player, world.tiles);
        
        // Emit noise for hunter
        emit('NOISE_EVENT', { x: proj.x, y: proj.y, radius: 220 });
        
        // Damage nearby hunter
        if (gs.hunter && gs.hunter.alive) {
          const hDist = Math.sqrt((proj.x - gs.hunter.x) ** 2 + (proj.y - gs.hunter.y) ** 2);
          if (hDist < proj.explosionRadius) {
            damageHunter(gs.hunter, proj.damage, gs.particles);
          }
        }
        
        // Damage nearby squad
        if (gs.helicopter && gs.helicopter.squad) {
          for (const member of gs.helicopter.squad) {
            const mDist = Math.sqrt((proj.x - member.x) ** 2 + (proj.y - member.y) ** 2);
            if (mDist < proj.explosionRadius) {
              member.health -= proj.damage * 0.5;
            }
          }
        }
        
        gs.projectiles.splice(i, 1);
        continue;
      }
    }

    // ── Poncho Grenade Launcher round — arc physics, contact detonation ────────
    if (proj.type === 'gl_round') {
      // Terrain contact — detonate on first solid tile hit
      if (hit || proj.life <= 0) {
        // Big boom
        createExplosion(proj.x, proj.y, proj.explosionRadius || 70, world.tiles, gs.particles, gs.firePatches, world.props);
        gs.screenShake.intensity = Math.max(gs.screenShake.intensity, Math.min(16, (proj.explosionRadius || 70) * 0.22));
        resolvePlayerAfterTerrainEdit(player, world.tiles);
        emit('NOISE_EVENT', { x: proj.x, y: proj.y, radius: 450 });

        // Damage player if nearby
        const pDist2 = Math.sqrt((proj.x - player.x - player.w/2)**2 + (proj.y - player.y - player.h/2)**2);
        if (pDist2 < (proj.explosionRadius || 70)) {
          player.health -= proj.damage * (1 - pDist2 / (proj.explosionRadius || 70));
          player.vy = -5;
        }

        // Damage Hunter
        if (gs.hunter && gs.hunter.alive) {
          const hDist2 = Math.sqrt((proj.x - gs.hunter.x - gs.hunter.w/2)**2 + (proj.y - gs.hunter.y - gs.hunter.h/2)**2);
          if (hDist2 < (proj.explosionRadius || 70)) {
            damageHunter(gs.hunter, proj.damage * (1 - hDist2 / (proj.explosionRadius || 70)), gs.particles);
            gs.score += 200;
          }
        }

        // Explosion smoke + debris particles
        for (let p = 0; p < 10; p++) {
          const ang = Math.random() * Math.PI * 2;
          const spd2 = 2 + Math.random() * 5;
          gs.particles.push({
            x: proj.x, y: proj.y,
            vx: Math.cos(ang) * spd2, vy: Math.sin(ang) * spd2 - 2,
            life: 35 + Math.random() * 20,
            color: p < 5 ? '#ff8822' : '#888866',
            size: 3 + Math.random() * 4,
            type: p < 5 ? 'fire' : 'smoke',
          });
        }

        gs.projectiles.splice(i, 1);
        continue;
      }

      // Spawn trailing smoke while in flight
      if (proj.life % 4 === 0) {
        gs.particles.push({
          x: proj.x, y: proj.y,
          vx: (Math.random() - 0.5) * 0.5, vy: -0.3,
          life: 20, color: '#887755', size: 3, type: 'smoke',
        });
      }
      continue;
    }

    // Plasma explosion on hit
    if (hit && proj.type === 'plasma') {
      createExplosion(proj.x, proj.y, proj.radius || 50, world.tiles, gs.particles, gs.firePatches, world.props);
      gs.screenShake.intensity = Math.max(gs.screenShake.intensity, 10);  // plasma impact shake
      resolvePlayerAfterTerrainEdit(player, world.tiles);
      // Damage nearby player
      const pDist = Math.sqrt((proj.x - player.x) ** 2 + (proj.y - player.y) ** 2);
      if (pDist < (proj.radius || 40)) {
        player.health -= 20;
        player.vy = -6;
      }
      gs.projectiles.splice(i, 1);
      continue;
    }

    if (hit || proj.life <= 0) {
      if (!proj.stuck) gs.projectiles.splice(i, 1);
    }
  }

  // Update squad
  if (gs.helicopter && gs.helicopter.squad) {
    // Init group state lazily
    if (!gs.squadGroupState) gs.squadGroupState = createSquadGroupState();

    // Sync phase to window BEFORE updateSquad so behaviours.js reads correct value
    if (typeof window !== 'undefined') {
      window.__KILLBOX_PHASE__ = gs.gamePhase;
      window.__KILLBOX_GS__ = gs;
    }

    updateSquad(gs.helicopter.squad, player, gs.hunter, world.tiles, gs.projectiles, gs.particles, gs.firePatches, gs.treeEntities);

    // Sense/memory/morale pass — separate from orchestrator (no double-AI)
    if (gs.helicopter?.squad) {
      const sqDt = deltaTime / 1000;
      for (const m of gs.helicopter.squad) {
        if (!m.alive) continue;
        if (m.insertionState === 'ACTIVE') {
          // updateSquadAI = sense + memory + group tactics only (NOT the orchestrator)
          updateSquadAI(m, player, gs.hunter, gs.helicopter.squad, world.tiles, gs.particles, gs.firePatches, gs, gs.squadGroupState, sqDt);
        }
        // Morale tick
        initMorale(m);
        tickMorale(m, player, gs.helicopter.squad, gs.hunter, sqDt);
        // Prep personality — markers only, does NOT override aiState.currentAction
        if (gs.gamePhase === 'prep' || gs.gamePhase === 'PREP') {
          applyPrepPersonality(m, player, world.tiles, gs.treeEntities, sqDt);
        }
        // Squad cinematic moments
        trySquadCinematic(m, gs.helicopter.squad, gs.hunter, player, sqDt);
        // Pick up morale events flagged by psychwar
        if (m._moraleEvent) {
          applyMoraleEvent(m, m._moraleEvent, gs.helicopter.squad);
          m._moraleEvent = null;
        }
        // Hero grenade: spawn an actual grenade projectile (alive check critical)
        if (m.alive && m.heroGrenade) {
          const hg = m.heroGrenade;
          hg.timer += sqDt;
          if (hg.timer > 0.5) {
            gs.projectiles.push({
              x: m.x, y: m.y - 10,
              vx: Math.sign(hg.x - m.x) * 5,
              vy: -6, damage: 30, type: 'grenade',
              owner: 'squad', stuck: false, life: 80, gravityScale: 0.5, radius: 50,
            });
            m.heroGrenade = null;
          }
        }
      }
    }
  }

  // Update wildlife
  if (gs.wildlife) {
    updateWildlife(gs.wildlife, player, gs.hunter, world.tiles, gs.particles);
  }

  // Update falling trees (and spawn leaf resource tiles)
  updateTrees(gs.treeEntities, world.tiles, gs.particles, gs.screenShake, gs.leafPiles, gs.leafTiles, gs.woodPickups);

  // Update foliage
  if (world.foliage) {
    for (const f of world.foliage) {
      updateFoliage(f, gs.particles);
    }
  }

  // Damage foliage from explosions
  if (gs.firePatches.length > 0 && world.foliage) {
    for (const f of world.foliage) {
      if (!f.alive) continue;
      for (const fire of gs.firePatches) {
        const dist = Math.sqrt((f.x - fire.x) ** 2 + (f.y - fire.y) ** 2);
        if (dist < 40 && f.config.flammable) {
          if (damageFoliage(f, 2, 'fire')) {
            createFoliageParticles(f, 8, gs.particles);
          }
        }
      }
    }
  }

  // Update moving props
  if (world.props) {
    for (let i = world.props.length - 1; i >= 0; i--) {
      const prop = world.props[i];
      if (!prop.alive) continue;
      if (prop.state === 'moving') {
        updateMovingProp(prop, world.tiles);

        // Check collision with player
        if (player.alive) {
          const hit = checkPropEntityCollision(prop, player);
          if (hit) {
            player.health -= hit.damage;
            player.vx += hit.knockbackX * 0.1;
            player.vy += hit.knockbackY * 0.1;
            // Create dust impact particles
            for (let j = 0; j < 6; j++) {
              gs.particles.push({
                x: player.x + player.w / 2, y: player.y + player.h / 2,
                vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 3,
                life: 15, color: '#8a7a5a', size: 2, type: 'debris',
              });
            }
          }
        }

        // Check collision with hunter
        if (gs.hunter && gs.hunter.alive) {
          const hit = checkPropEntityCollision(prop, gs.hunter);
          if (hit) {
            gs.hunter.health -= hit.damage;
            gs.hunter.vx += hit.knockbackX * 0.08;
            gs.hunter.vy += hit.knockbackY * 0.08;
            // Impact particles
            for (let j = 0; j < 8; j++) {
              gs.particles.push({
                x: gs.hunter.x + gs.hunter.w / 2, y: gs.hunter.y + gs.hunter.h / 2,
                vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4,
                life: 18, color: '#6a7a5a', size: 3, type: 'debris',
              });
            }
          }
        }

        // Check collision with squad members
        if (gs.helicopter && gs.helicopter.squad) {
          for (const member of gs.helicopter.squad) {
            if (!member.alive) continue;
            const hit = checkPropEntityCollision(prop, member);
            if (hit) {
              member.health -= hit.damage * 0.5;
              member.vx += hit.knockbackX * 0.05;
              member.vy += hit.knockbackY * 0.05;
            }
          }
        }
      }
    }
  }

  // Update particles
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.type !== 'smoke' && p.type !== 'shimmer' && p.type !== 'glow') {
      p.vy += 0.1;
    }
    if (p.type === 'smoke') {
      p.size *= 1.02;
      p.vx *= 0.98;
    }
    p.life--;
    if (p.life <= 0) gs.particles.splice(i, 1);
  }

  // Fire system
  updateFire(gs.firePatches, world.tiles, gs.particles);
  // Fire damage (every 6 frames to avoid spam)
  if (gs.firePatches.length > 0) {
    if (player.alive && checkFireDamage(gs.firePatches, player)) {
      if (!player._fireDmgCooldown || player._fireDmgCooldown <= 0) {
        player.health -= 4;
        player._fireDmgCooldown = 20;
      }
    }
    if (player._fireDmgCooldown > 0) player._fireDmgCooldown--;
    if (gs.hunter && gs.hunter.alive && checkFireDamage(gs.firePatches, gs.hunter)) {
      if (!gs.hunter._fireDmgCooldown || gs.hunter._fireDmgCooldown <= 0) {
        damageHunter(gs.hunter, 3, gs.particles);
        gs.hunter._fireDmgCooldown = 20;
      }
    }
    if (gs.hunter && gs.hunter._fireDmgCooldown > 0) gs.hunter._fireDmgCooldown--;
  }

  // Update camera (with shake)
  updateCamera(gs.camera, player, deltaTime, gs.helicopter, []);
  // Screen shake — render-only offset (NEVER touches camera.x/y)
  if (gs.screenShake.intensity > 0) {
    gs.screenShake.ox = (Math.random() - 0.5) * gs.screenShake.intensity * 2;
    gs.screenShake.oy = (Math.random() - 0.5) * gs.screenShake.intensity * 2;
    gs.screenShake.intensity *= 0.74;  // slower decay = more sustained punch
    if (gs.screenShake.intensity < 0.3) { gs.screenShake.intensity = 0; gs.screenShake.ox = 0; gs.screenShake.oy = 0; }
  } else {
    gs.screenShake.ox = 0; gs.screenShake.oy = 0;
  }

  // Clamp camera to world bounds (zoom-aware)
  const _camZoom = gs.camera.zoom || 1;
  const _camCanvas = { w: 800, h: 600 }; // conservative estimate — actual canvas may be larger
  const _viewW = _camCanvas.w / _camZoom;
  const _viewH = _camCanvas.h / _camZoom;
  gs.camera.x = Math.max(0, Math.min(gs.camera.x, PIXEL_WORLD_W - _viewW));
  gs.camera.y = Math.max(0, Math.min(gs.camera.y, PIXEL_WORLD_H - _viewH));

  gs.score = player.score + (gs.score - player.score);
}

export function handleKeyDown(gs, key) {
  const k = key.toLowerCase();
  
  if (gs.gamePhase === GAME_STATES.TITLE && key === 'Enter') {
    // Signal the React component to navigate — avoids full page reload (white flash)
    gs._navigateTo = '/character-select';
    return;
  }
  if ((gs.gamePhase === GAME_STATES.VICTORY || gs.gamePhase === GAME_STATES.DEFEAT) && key === 'Enter') {
    gs.gamePhase = GAME_STATES.TITLE;
    setAudioPhase('title');
    return;
  }

  // Block gameplay keys during insertion cinematic
  const inGame = gs.gamePhase !== GAME_STATES.INSERTION;

  switch (k) {
    case 'a': case 'arrowleft':  gs.keys.left = true; break;
    case 'd': case 'arrowright': gs.keys.right = true; break;
    case 'w': case 'arrowup':    gs.keys.climbUp = true; break;
    case 's': case 'arrowdown':  gs.keys.crouch = true; gs.keys.climbDown = true; break;
    case ' ': gs.keys.jump = true; break;
    case 'f': {
      if (!inGame) break;
      // ── CONTEXT-FIRST F RESOLUTION ─────────────────────────────────────
      // Priority 1: tree chop (tool-agnostic — no C required)
      const _didChop = performContextTreeChop(
        gs.player,
        gs.treeEntities,
        gs.world.tiles,
        gs.particles
      );
      if (_didChop) break;

      // Priority 2: foliage chop — grass, bush, vine, reed (rope source)
      const _nearFoliage = findNearestChoppableFoliage(gs.player, gs.world.foliage, 44);
      if (_nearFoliage) {
        const { destroyed, resources } = chopFoliage(_nearFoliage, gs.player, gs.particles);
        if (Object.keys(resources).length > 0) {
          // Float up resource pickup particles
          for (const [res, amt] of Object.entries(resources)) {
            const color = res === 'rope' ? '#c8a060' : res === 'wood' ? '#8a6030' : '#88aa44';
            gs.particles.push({
              x: _nearFoliage.x + _nearFoliage.w / 2,
              y: _nearFoliage.y - 8,
              vx: (Math.random() - 0.5) * 1.5,
              vy: -1.8,
              life: 50,
              color,
              size: 3,
              type: 'glow',
              label: `+${amt} ${res.toUpperCase()}`,
            });
          }
          console.log('[FOLIAGE_CHOP]', { type: _nearFoliage.type, destroyed, resources });
        }
        break;
      }

      // Priority 3: normal attack (weapon / machete swing)
      playerAttack(gs.player);
      break;
    }
    case 'g': if (inGame) startGrenadeCharge(gs.grenadeThrow); break;
    case '1': // Equip pistol — clear active tool so no dual-state overlap
      if (inGame) {
        equipWeapon(gs.player.weaponState, 'pistol');
        gs.player.activeTool = null;  // weapon slot: no tool active
      }
      break;
    case '2': { // Equip character primary — clear active tool
      if (inGame) {
        // Read directly from characterConfig — single source of truth
        const primary = gs.player.characterConfig?.weaponId || 'm16_m203';
        equipWeapon(gs.player.weaponState, primary);
        gs.player.activeTool = null;  // weapon slot: no tool active
      }
      break;
    }
    case '3': // Equip machete — holster weapon to prevent dual-state
      if (inGame) {
        gs.player.activeTool = TOOLS.MACHETE;
        gs.player.weaponState.current = null;  // tool slot: no weapon active
      }
      break;
    case '4': // Equip shovel — holster weapon
      if (inGame) {
        gs.player.activeTool = TOOLS.SHOVEL;
        gs.player.weaponState.current = null;  // tool slot: no weapon active
      }
      break;
    case 'x': gs.keys.dig = true; break;
    case 'z': gs.keys.shovel = true; break; // dedicated shovel dig
    case 'c': // Cycle active tool
      if (inGame) {
        gs.player.activeTool = gs.player.activeTool === TOOLS.SHOVEL
          ? TOOLS.MACHETE
          : TOOLS.SHOVEL;
      }
      break;
    case 'v': // Thermal vision toggle
      if (inGame) gs.thermalMode = !gs.thermalMode;
      break;
    case 'e': // interact / next trap
      gs.keys.interact = true;
      gs.trapSelect = (gs.trapSelect + 1) % TRAP_LIST.length;
      break;
    case 'q': // prev trap
      gs.trapSelect = (gs.trapSelect - 1 + TRAP_LIST.length) % TRAP_LIST.length;
      break;
    case 't': // Place trap
      if (gs.gamePhase === GAME_STATES.PREP) {
        const trapType = TRAP_LIST[gs.trapSelect];
        if (canPlaceTrap(trapType, gs.player)) {
          const px = Math.floor(gs.player.x / TILE_SIZE) * TILE_SIZE + (gs.player.facing > 0 ? TILE_SIZE * 2 : -TILE_SIZE * 2);
          const py = Math.floor((gs.player.y + gs.player.h) / TILE_SIZE) * TILE_SIZE - TILE_SIZE * 2;
          placeTrap(trapType, px, py, gs.player, gs.traps, gs.world.tiles);
          gs.player._justPlacedTrap = true;
          gs.player.trapsPlaced = (gs.player.trapsPlaced || 0) + 1;
          gs.score += 50;
        }
      }
      break;
    case 'r': // Reload
      if (inGame) gs.keys.reload = true;
      break;
    case '+': case '=': // Zoom in
      handleZoomInput(gs.camera, 1);
      break;
    case '-': // Zoom out
      handleZoomInput(gs.camera, -1);
      break;
    case 'b': // Bow ammo type toggle (standard arrow ↔ explosive arrow)
      if (inGame && gs.player.bowDrawn === false) {
        if (gs.player.explosiveArrowCount > 0) {
          gs.player.bowAmmoType = gs.player.bowAmmoType === 'explosive_arrow' ? 'arrow' : 'explosive_arrow';
        }
      }
      break;
  }
}

export function handleKeyUp(gs, key) {
  const k = key.toLowerCase();
  switch (k) {
    case 'a': case 'arrowleft':  gs.keys.left = false; break;
    case 'd': case 'arrowright': gs.keys.right = false; break;
    case 'w': case 'arrowup':    gs.keys.climbUp = false; break;
    case 's': case 'arrowdown':  gs.keys.crouch = false; gs.keys.climbDown = false; break;
    case ' ': gs.keys.jump = false; break;
    case 'g':
      if (gs.grenadeThrow && gs.grenadeThrow.active) {
        releaseGrenade(gs.grenadeThrow, gs.player, gs.projectiles, gs.particles, gs.gameTime);
      } else {
        playerReleaseBow(gs.player, gs.projectiles);
      }
      break;
    case 'x': gs.keys.dig = false; break;
    case 'z': gs.keys.shovel = false; break;
    case 'e': gs.keys.interact = false; break;
  }
}

export function renderGameFrame(ctx, canvas, gs) {
  renderGame(ctx, canvas, {
    world: gs.world,
    player: gs.player,
    hunter: gs.hunter,
    traps: gs.traps,
    projectiles: gs.projectiles,
    particles: gs.particles,
    firePatches: gs.firePatches,
    camera: gs.camera,
    phase: gs.gamePhase,
    prepTimer: gs.prepTimer,
    score: gs.player.score + Math.floor(gs.prepTimer > 0 ? (PREP_TIME - gs.prepTimer) * 2 : 0),
    trapSelect: gs.trapSelect,
    gamePhase: gs.gamePhase,
    helicopter: gs.helicopter,
    treeEntities: gs.treeEntities,
    squad: gs.helicopter && gs.helicopter.squad ? gs.helicopter.squad : [],
    wildlife: gs.wildlife,
    thermalMode: gs.thermalMode,
    research: gs.research,
    foliage: gs.world.foliage || [],
    props: gs.world.props || [],
    grenadeThrow: gs.grenadeThrow,
    mouseWorld: gs.mouseWorld || null,
    leafTiles: gs.leafTiles || [],
    woodPickups: gs.woodPickups || [],
  });
}
// Re-export audio teardown for component cleanup
export { destroyAudio, initAudio, setAudioPhase };