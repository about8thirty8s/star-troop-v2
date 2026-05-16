// LAST HUNT: KILLBOX - Physical Tree Fall System
import { TILE_SIZE, TILE } from './constants';
import { getTile, setTile, isSolid } from './worldGen';

// ── TRUNK SPRITE SYSTEM ───────────────────────────────────────────────────────
// Modular stacking: root base (bottom) + mid sections (repeating) + top cap (top)
const TRUNK_SPRITES = {
  root48: null, mid48: null, top48: null,
  root64: null, mid64: null, top64: null,
};
const TRUNK_URLS = {
  root48: 'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/3c6180959_trunk_root_base_48.png',
  mid48:  'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/f134d504d_trunk_mid_section_48.png',
  top48:  'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/1b0799d04_trunk_top_cap_48.png',
  root64: 'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/272b331aa_trunk_root_base_64.png',
  mid64:  'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/5772d7e61_trunk_mid_section_64.png',
  top64:  'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/359e63ab4_trunk_top_cap_64.png',
};
let _trunkSpritesLoaded = false;
function _loadTrunkSprites() {
  if (_trunkSpritesLoaded) return;
  _trunkSpritesLoaded = true;
  for (const [key, url] of Object.entries(TRUNK_URLS)) {
    const img = new Image();
    img.src = url;
    TRUNK_SPRITES[key] = img;
  }
}
// Call once at module load
if (typeof window !== 'undefined') _loadTrunkSprites();

function _drawTrunkSprite(ctx, tW, tH, baseX, baseY, angle) {
  // Choose sprite size based on trunk width
  const sz = tW >= 20 ? '64' : '48';
  const root = TRUNK_SPRITES['root' + sz];
  const mid  = TRUNK_SPRITES['mid'  + sz];
  const top  = TRUNK_SPRITES['top'  + sz];

  // Only use sprites if all loaded — fallback to procedural
  if (!root?.complete || !mid?.complete || !top?.complete ||
      !root.naturalWidth || !mid.naturalWidth || !top.naturalWidth) {
    // Procedural fallback
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(-tW/2, -tH, tW, tH);
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(-tW/2 + tW*0.3, -tH, tW*0.15, tH);
    ctx.fillStyle = '#4a2a0a';
    ctx.fillRect(-tW/2 + tW*0.7, -tH, tW*0.08, tH);
    return;
  }

  // Sprite dimensions (48px column)
  const tw = root.naturalWidth;   // canvas width (wider for root flare)
  const mh = mid.naturalHeight;
  const th = top.naturalHeight;
  const rh = root.naturalHeight;

  // Scale sprites to match trunk pixel width
  const scale = tW / (sz === '64' ? 64 : 48);
  const scaledTW  = tw  * scale;
  const scaledMH  = mh  * scale;
  const scaledTH  = th  * scale;
  const scaledRH  = rh  * scale;
  const scaledMW  = mid.naturalWidth * scale;
  const scaledTopW = top.naturalWidth * scale;
  const scaledRootW = tw * scale;

  // How many mid sections to stack?
  const midCount = Math.max(1, Math.ceil((tH - scaledTH - scaledRH) / scaledMH));

  let yPtr = -tH; // start at trunk top

  // Draw top cap
  ctx.drawImage(top, -scaledTopW/2, yPtr, scaledTopW, scaledTH);
  yPtr += scaledTH;

  // Draw mid sections
  for (let i = 0; i < midCount; i++) {
    ctx.drawImage(mid, -scaledMW/2, yPtr, scaledMW, scaledMH);
    yPtr += scaledMH;
  }

  // Draw root base at bottom (may extend wider than column)
  ctx.drawImage(root, -scaledRootW/2, yPtr, scaledRootW, scaledRH);
}


export const TREE_STATE = {
  STANDING:        'standing',
  FALLING:         'falling',
  FALLEN:          'fallen',
  HARVESTABLE_LOG: 'harvestable_log', // landed — hitbox live, resources spawned
  DEPLETED:        'depleted',        // log fully chopped — no resources left
  FALLEN_CLEANED:  'fallen_cleaned',  // removed from simulation
  HARVEST:         'harvest',
  STUMP:           'stump',
};

// Fallen log harvest constants
export const LOG_MAX_CHOP_HITS = 6;
export const WOOD_PER_CHOP     = 1;

// Track all "live" tree entities (distinct from world.trees metadata)
export function buildTreeEntities(worldTrees, tiles) {
  return worldTrees.map(t => createTreeEntity(t, tiles));
}

function createTreeEntity(treeMeta, tiles) {
  const tx = Math.floor(treeMeta.x / TILE_SIZE);
  const ty = Math.floor(treeMeta.y / TILE_SIZE);

  // Single source of truth: dimensions derived once from world metadata.
  // These never change — standing, falling, and fallen all use the same values.
  const trunkH    = treeMeta.height * TILE_SIZE;   // pixel height of trunk
  const trunkW    = TILE_SIZE;                      // trunk is exactly 1 tile wide
  const canopyR   = TILE_SIZE * 2.4;               // ~38px — matches the 5-wide leaf blob

  return {
    // Unique identity — required for task reservation system
    id: `tree_${tx}_${ty + treeMeta.height}`,

    // Root world position (tile space)
    rootTileX: tx,
    rootTileY: ty + treeMeta.height,   // ground tile row
    height:    treeMeta.height,

    // Frozen pixel dimensions — do NOT modify after creation
    trunkW,
    trunkH,
    canopyR,

    state: TREE_STATE.STANDING,

    // Fall physics
    angle:    0,           // radians from vertical (0 = upright)
    angleVel: 0,
    fallDir:  1,           // +1 right, -1 left
    hitGround: false,
    fallTimer: 0,

    // Fallen-log bounding box (pixel space, filled when landed)
    logX: 0, logY: 0, logW: 0, logH: 8,
    // Interaction bounds (larger than collision, for machete chopping only)
    interactionX: 0, interactionY: 0, interactionW: 0, interactionH: 0,

    // Chop progress (hit count)
    chopHits: 0,
    maxChopHits: 3,

    // Fracture system
    cutTileY: null,
    stumpHeight: 0,
    fracturedUpper: null,

    // Fallen log harvest state
    logDurability:    0,
    logChopHits:      0,
    resourcesSpawned: false,
  };
}

// Called by player/hunter machete attack hitting a WOOD tile at attackTileY
export function hitTree(tree, attackerX, attackTileY, tiles, particles) {
  if (tree.state !== TREE_STATE.STANDING && tree.state !== TREE_STATE.STUMP) return;

  tree.chopHits++;

  // Splinter particles at cut location
  const rx = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
  const ry = attackTileY * TILE_SIZE + TILE_SIZE / 2;
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: rx, y: ry,
      vx: (Math.random() - 0.5) * 5,
      vy: -1.5 - Math.random() * 3,
      life: 22, color: '#8a6a3a', size: 3, type: 'debris',
    });
  }

  if (tree.chopHits >= tree.maxChopHits) {
    tree.cutTileY = attackTileY;
    startFall(tree, attackerX, tiles, particles);
  }
}

function startFall(tree, attackerX, tiles, particles) {
  tree.fallDir = attackerX > tree.rootTileX * TILE_SIZE ? 1 : -1;
  tree.angleVel = 0.006;  // VULCAN ×0.5 — cinematic slow topple

  // If this is a stump being chopped, always fall the whole remaining stump (no canopy)
  const isStump = tree.state === TREE_STATE.STUMP;

  const cutY = (!isStump && tree.cutTileY) ? tree.cutTileY : tree.rootTileY - 1;
  const isCutAtBase = isStump || cutY >= tree.rootTileY - 1;

  tree.state = TREE_STATE.FALLING;
  tree.isStump = isStump;  // flag so renderer skips canopy

  if (isCutAtBase) {
    // ── WHOLE TREE FALLS ────────────────────────────────────────────────────
    // Remove all trunk tiles
    for (let y = tree.rootTileY - tree.height; y < tree.rootTileY; y++) {
      setTile(tiles, tree.rootTileX, y, TILE.AIR);
    }
    // Remove canopy
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const t = getTile(tiles, tree.rootTileX + dx, tree.rootTileY - tree.height + dy);
        if (t === TILE.LEAVES) setTile(tiles, tree.rootTileX + dx, tree.rootTileY - tree.height + dy, TILE.AIR);
      }
    }
    // Full tree leaf burst
    const cx = tree.rootTileX * TILE_SIZE;
    const cy = (tree.rootTileY - tree.height) * TILE_SIZE;
    for (let i = 0; i < 25; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 40,
        y: cy + (Math.random() - 0.5) * 20,
        vx: tree.fallDir * (0.5 + Math.random() * 4),
        vy: -1 - Math.random() * 4,
        life: 35, color: Math.random() > 0.5 ? '#2e6a2e' : '#3a8a2a',
        size: 3 + Math.random() * 3, type: 'debris',
      });
    }
    // Tree is now falling and will animate
    return;
  } else {
    // ── FRACTURE: UPPER SECTION DETACHES ───────────────────────────────────
    // Calculate remaining stump in tiles
    tree.stumpHeight = tree.rootTileY - cutY;  // tiles from cut point down to ground
    if (tree.stumpHeight < 1) tree.stumpHeight = 1;

    // Create falling upper section entity
    const upperHeight = tree.height - tree.stumpHeight;
    tree.fracturedUpper = {
      angle: 0,
      angleVel: tree.angleVel,
      fallDir: tree.fallDir,
      fallTimer: 0,
      rootTileX: tree.rootTileX,
      rootTileY: cutY,        // pivot from cut point
      height: upperHeight,
      trunkW: tree.trunkW,
      trunkH: upperHeight * TILE_SIZE,
      canopyR: tree.canopyR,
      hitGround: false,
      logX: 0, logY: 0, logW: 0,
    };

    // Remove ONLY the upper trunk tiles (above the cut point)
    for (let y = tree.rootTileY - tree.height; y < cutY; y++) {
      setTile(tiles, tree.rootTileX, y, TILE.AIR);
    }
    // Remove canopy
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const t = getTile(tiles, tree.rootTileX + dx, tree.rootTileY - tree.height + dy);
        if (t === TILE.LEAVES) setTile(tiles, tree.rootTileX + dx, tree.rootTileY - tree.height + dy, TILE.AIR);
      }
    }

    // Upper section leaf burst at cut point
    const cx = tree.rootTileX * TILE_SIZE;
    const cy = cutY * TILE_SIZE;
    for (let i = 0; i < 15; i++) {
      particles.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 15,
        vx: tree.fallDir * (0.5 + Math.random() * 4),
        vy: -1 - Math.random() * 3,
        life: 30, color: Math.random() > 0.5 ? '#2e6a2e' : '#3a8a2a',
        size: 2 + Math.random() * 2, type: 'debris',
      });
    }
    // Convert to stump — update tree data to reflect ONLY remaining trunk
    tree.state = TREE_STATE.STUMP;
    tree.chopHits = 0;  // reset for potential further chopping
    tree.cutTileY = null;  // clear old cut point so new chops start fresh
    tree.height = tree.stumpHeight;  // shrink tree height to match remaining stub
    tree.trunkH = tree.stumpHeight * TILE_SIZE;  // update pixel height
    return;  // stump doesn't animate, only the fractured upper does
  }
}

// Leaf resource tile data structure
export function createLeafResourceTile(x, y, amount = 1) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    type: 'leaf_resource',
    resource: 'leaves',
    amount,
    x, y,
    w: TILE_SIZE,
    h: TILE_SIZE,
    collected: false,
    pickupRadius: 18,
  };
}

function spawnLeafTilesFromCanopy(baseX, baseY, tree, particles, leafTiles, tiles, leafPiles) {
  // Spawn leaf resource tiles where the canopy was
  // Scatter horizontally around impact point, snap to ground
  const canopyRadius = tree.canopyR;
  const scatterCount = 4 + Math.floor(Math.random() * 3);
  
  for (let i = 0; i < scatterCount; i++) {
    // Random horizontal offset from canopy center
    const offsetX = (Math.random() - 0.5) * canopyRadius * 1.5;
    const spawnX = baseX + offsetX;
    const spawnY = baseY;
    
    // Snap to valid ground
    const snappedTile = findNearestGroundBelow(spawnX, spawnY, tiles);
    if (snappedTile) {
      const leafTile = createLeafResourceTile(snappedTile.x, snappedTile.y, 1);
      leafTiles.push(leafTile);
      
      // Small pop particle at spawn
      particles.push({
        x: spawnX, y: spawnY,
        vx: (Math.random() - 0.5) * 2,
        vy: -1 - Math.random() * 1.5,
        life: 12, color: '#3a8a2a', size: 2, type: 'glow',
      });
    }
  }
}

function findNearestGroundBelow(x, y, tiles) {
  // Return { x, y } grid position of nearest valid ground tile
  const startTx = Math.floor(x / TILE_SIZE);
  const startTy = Math.floor(y / TILE_SIZE);
  
  // Search within a local radius for valid landing spot
  const searchRadius = 3;
  for (let dy = 0; dy <= searchRadius * TILE_SIZE; dy += TILE_SIZE) {
    const ty = startTy + Math.floor(dy / TILE_SIZE);
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      const tx = startTx + dx;
      const tile = getTile(tiles, tx, ty);
      // Check if current is air and tile below is solid
      const tileBelow = getTile(tiles, tx, ty + 1);
      if (tile === TILE.AIR && isSolid(tileBelow)) {
        return { x: tx * TILE_SIZE, y: ty * TILE_SIZE };
      }
    }
  }
  return null;
}

export function updateTrees(trees, tiles, particles, screenShake, leafPiles, leafTiles = [], woodPickups = null) {
  for (let i = trees.length - 1; i >= 0; i--) {
    const tree = trees[i];
    
    // Clean up: remove DEPLETED or FALLEN_CLEANED trees from entity array
    if (tree.state === TREE_STATE.DEPLETED || tree.state === TREE_STATE.FALLEN_CLEANED) {
      // For fractured trees, wait until upper section also lands
      if (tree.fracturedUpper && !tree.fracturedUpper.cleanup) continue;
      trees.splice(i, 1);
      continue;
    }

    if (tree.state === TREE_STATE.STANDING) continue;

    if (tree.state === TREE_STATE.STUMP) continue;  // stumps don't animate

    if (tree.state === TREE_STATE.FALLING) {
      tree.fallTimer++;
      tree.angleVel += 0.002;
      tree.angle += tree.angleVel * tree.fallDir;

      if (Math.abs(tree.angle) >= Math.PI / 2) {
        tree.angle = (Math.PI / 2) * tree.fallDir;

        const baseX    = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
        const baseY    = tree.rootTileY * TILE_SIZE;
        const logPxLen = tree.height * TILE_SIZE;

        // Canopy impact position (where canopy hits ground)
        const canopyLandX = baseX + tree.fallDir * logPxLen;
        const canopyLandY = baseY;

        // Set log hitbox
        if (tree.fallDir > 0) {
          tree.logX = baseX;       tree.logY = baseY - 8;  tree.logW = logPxLen;
        } else {
          tree.logX = baseX - logPxLen;  tree.logY = baseY - 8;  tree.logW = logPxLen;
        }
        tree.interactionX = tree.logX - 24;
        tree.interactionY = tree.logY - 32;
        tree.interactionW = tree.logW + 48;
        tree.interactionH = 56;

        // Stamp BRIDGE tiles under the log so player can walk on it
        const logTiles  = Math.floor(tree.logW / TILE_SIZE);
        const logStartX = Math.floor(tree.logX / TILE_SIZE);
        const logTileY  = tree.rootTileY - 1;
        for (let j = 0; j < logTiles; j++) {
          const ltx = logStartX + j;
          if (getTile(tiles, ltx, logTileY) === TILE.AIR)
            setTile(tiles, ltx, logTileY, TILE.BRIDGE);
        }

        // Transition to HARVESTABLE_LOG — keeps it in the entity array & interaction system
        tree.state         = TREE_STATE.HARVESTABLE_LOG;
        tree.logDurability = LOG_MAX_CHOP_HITS;
        tree.logChopHits   = 0;
        tree.state         = TREE_STATE.HARVESTABLE_LOG;

        // Spawn leaf resources at canopy impact point
        spawnLeafTilesFromCanopy(canopyLandX, canopyLandY, tree, particles, leafTiles, tiles, leafPiles);

        // Spawn wood chunk scatter pickups alongside the log
        if (woodPickups) {
          const woodCount = 2 + Math.floor(Math.random() * 3);
          for (let w = 0; w < woodCount; w++) {
            woodPickups.push({
              id: Math.random().toString(36).slice(2, 9),
              type: 'wood',
              x: tree.logX + Math.random() * tree.logW,
              y: tree.logY - 4,
              vx: (Math.random() - 0.5) * 3,
              vy: -2 - Math.random() * 2,
              amount: 1,
              collectRadius: 20,
              lifetime: 1800,
              sourceTreeId: tree.id,
              collected: false,
            });
          }
          console.log('[TREE_LANDED]', { treeId: tree.id, state: 'HARVESTABLE_LOG',
            woodCount, canopyLandX: Math.round(canopyLandX), logX: Math.round(tree.logX) });
        }

        // Impact debris
        for (let i = 0; i < 22; i++) {
          particles.push({ x: tree.logX + Math.random() * tree.logW, y: tree.logY,
            vx: (Math.random() - 0.5) * 7, vy: -2 - Math.random() * 5,
            life: 28, color: Math.random() > 0.5 ? '#8a6a3a' : '#4a3728',
            size: 3 + Math.random() * 4, type: 'debris' });
        }
        for (let i = 0; i < 14; i++) {
          particles.push({ x: tree.logX + tree.logW / 2 + (Math.random() - 0.5) * 60, y: tree.logY + 4,
            vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2,
            life: 20, color: '#8a7a5a', size: 5 + Math.random() * 6, type: 'smoke' });
        }
        if (screenShake) screenShake.intensity = 6;
      }
    }

    // HARVESTABLE_LOG → DEPLETED when chopped out
    if (tree.state === TREE_STATE.HARVESTABLE_LOG && tree.logDurability <= 0) {
      tree.state = TREE_STATE.DEPLETED;
      console.log('[TREE_FALLEN] depleted:', tree.id);
    }

    // Update fractured upper section
    if (tree.fracturedUpper) {
      const upper = tree.fracturedUpper;
      upper.fallTimer++;
      upper.angleVel += 0.002;  // VULCAN ×0.5
      upper.angle += upper.angleVel * upper.fallDir;

      if (Math.abs(upper.angle) >= Math.PI / 2) {
        upper.angle = (Math.PI / 2) * upper.fallDir;
        upper.hitGround = true;

        const baseX = upper.rootTileX * TILE_SIZE + TILE_SIZE / 2;
        const baseY = upper.rootTileY * TILE_SIZE;
        const logPxLen = upper.height * TILE_SIZE;

        if (upper.fallDir > 0) {
          upper.logX = baseX;
          upper.logY = baseY - 8;
          upper.logW = logPxLen;
        } else {
          upper.logX = baseX - logPxLen;
          upper.logY = baseY - 8;
          upper.logW = logPxLen;
        }

        // Interaction bounds for fractured upper section
        upper.interactionX = upper.logX - 24;
        upper.interactionY = upper.logY - 24;
        upper.interactionW = upper.logW + 48;
        upper.interactionH = 48;

        const logTiles = Math.floor(upper.logW / TILE_SIZE);
        const logStartX = Math.floor(upper.logX / TILE_SIZE);
        const logTileY  = upper.rootTileY - 1;
        for (let i = 0; i < logTiles; i++) {
          const ltx = logStartX + i;
          const existing = getTile(tiles, ltx, logTileY);
          if (existing === TILE.AIR) {
            setTile(tiles, ltx, logTileY, TILE.BRIDGE);
          }
        }

        for (let i = 0; i < 16; i++) {
          particles.push({
            x: upper.logX + Math.random() * upper.logW,
            y: upper.logY,
            vx: (Math.random() - 0.5) * 6,
            vy: -2 - Math.random() * 4,
            life: 24, color: Math.random() > 0.5 ? '#8a6a3a' : '#4a3728',
            size: 2 + Math.random() * 3, type: 'debris',
          });
        }
        for (let i = 0; i < 10; i++) {
          particles.push({
            x: upper.logX + upper.logW / 2 + (Math.random() - 0.5) * 50,
            y: upper.logY + 4,
            vx: (Math.random() - 0.5) * 2,
            vy: -0.5 - Math.random() * 1.5,
            life: 16, color: '#8a7a5a', size: 4 + Math.random() * 5, type: 'smoke',
          });
        }
        
        // Spawn leaf + wood resources at upper section landing
        spawnLeafTilesFromCanopy(upper.logX + upper.logW / 2, upper.logY, upper, particles, leafTiles, tiles, leafPiles);
        if (woodPickups) {
          const woodCount = 1 + Math.floor(Math.random() * 2);
          for (let w = 0; w < woodCount; w++) {
            woodPickups.push({
              id: Math.random().toString(36).slice(2, 9),
              type: 'wood',
              x: upper.logX + Math.random() * upper.logW,
              y: upper.logY - 4,
              vx: (Math.random() - 0.5) * 2, vy: -1 - Math.random() * 2,
              amount: 1, collectRadius: 20, lifetime: 1800,
              sourceTreeId: tree.id, collected: false,
            });
          }
        }
        if (screenShake) screenShake.intensity = 4;
        upper.cleanup = true;
      }
    }
  }
}

// Check if a player/hunter WOOD tile chop corresponds to a tracked tree
export function getTreeAtTile(trees, tx, ty) {
  for (const tree of trees) {
    const isStanding = tree.state === TREE_STATE.STANDING;
    const isStump = tree.state === TREE_STATE.STUMP;
    if (!isStanding && !isStump) continue;

    if (tx === tree.rootTileX &&
        ty >= tree.rootTileY - tree.height &&
        ty <  tree.rootTileY) {
      return tree;
    }
  }
  return null;
}

// Find fallen/fractured logs within machete swing range (AABB overlap)
export function getFallenLogInMacheteRange(trees, playerX, playerW, playerY, playerH) {
  let closestTree = null;
  let closestDist = Infinity;

  for (const tree of trees) {
    // Check main fallen log — HARVESTABLE_LOG is the interactable state
    if (tree.state === TREE_STATE.HARVESTABLE_LOG) {
      if (aabbOverlap(
        playerX, playerY, playerW, playerH,
        tree.interactionX, tree.interactionY, tree.interactionW, tree.interactionH
      )) {
        const dist = Math.abs(playerX + playerW / 2 - (tree.logX + tree.logW / 2));
        if (dist < closestDist) {
          closestDist = dist;
          closestTree = tree;
        }
      }
    }

    // Check fractured upper section if landed
    if (tree.fracturedUpper?.cleanup) {
      const upper = tree.fracturedUpper;
      if (aabbOverlap(
        playerX, playerY, playerW, playerH,
        upper.interactionX, upper.interactionY, upper.interactionW, upper.interactionH
      )) {
        const dist = Math.abs(playerX + playerW / 2 - (upper.logX + upper.logW / 2));
        if (dist < closestDist) {
          closestDist = dist;
          closestTree = { ...tree, fracturedUpper: upper, isFracturedOnly: true };
        }
      }
    }
  }

  return closestTree;
}

// Simple AABB overlap test
function aabbOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 &&
         y1 < y2 + h2 && y1 + h1 > y2;
}

// Render the falling / fallen tree and fractured upper sections.
export function renderFallingTrees(ctx, trees) {
  for (const tree of trees) {
    if (tree.state === TREE_STATE.STANDING) continue;

    // Render main tree if falling or fallen
    if (tree.state === TREE_STATE.FALLING || tree.state === TREE_STATE.FALLEN || tree.state === TREE_STATE.HARVESTABLE_LOG) {
      const baseX  = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
      const baseY  = tree.rootTileY * TILE_SIZE;
      const tW     = tree.trunkW;
      const tH     = tree.trunkH;
      const cR     = tree.canopyR;
      const halfW  = tW / 2;

      ctx.save();
      ctx.translate(baseX, baseY);
      ctx.rotate(tree.angle);

      _drawTrunkSprite(ctx, tW, tH, 0, 0, tree.angle);

      if (tree.state === TREE_STATE.FALLING && !tree.isStump) {
        ctx.fillStyle = '#1e4a1e';
        ctx.beginPath();
        ctx.arc(0, -tH, cR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e6a2e';
        ctx.beginPath();
        ctx.arc(-cR * 0.22, -tH - cR * 0.18, cR * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a8a3a';
        ctx.beginPath();
        ctx.arc(cR * 0.18, -tH + cR * 0.12, cR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    // Render stump (standing base after fracture)
    if (tree.state === TREE_STATE.STUMP) {
      const stumpX = tree.rootTileX * TILE_SIZE + TILE_SIZE / 2;
      const stumpY = tree.rootTileY * TILE_SIZE;
      const stumpH = tree.height * TILE_SIZE;  // height was already updated to stumpHeight
      const halfW = tree.trunkW / 2;

      ctx.save();
      ctx.translate(stumpX, stumpY);

      _drawTrunkSprite(ctx, tree.trunkW, stumpH, 0, 0, 0);

      ctx.restore();
    }

    // Render fractured upper section
    if (tree.fracturedUpper) {
      const upper = tree.fracturedUpper;
      if (!upper.hitGround) {
        const baseX  = upper.rootTileX * TILE_SIZE + TILE_SIZE / 2;
        const baseY  = upper.rootTileY * TILE_SIZE;
        const tW     = upper.trunkW;
        const tH     = upper.trunkH;
        const cR     = upper.canopyR;
        const halfW  = tW / 2;

        ctx.save();
        ctx.translate(baseX, baseY);
        ctx.rotate(upper.angle);

        _drawTrunkSprite(ctx, tW, tH, 0, 0, upper.angle);

        // Canopy on upper section while falling
        ctx.fillStyle = '#1e4a1e';
        ctx.beginPath();
        ctx.arc(0, -tH, cR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e6a2e';
        ctx.beginPath();
        ctx.arc(-cR * 0.22, -tH - cR * 0.18, cR * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a8a3a';
        ctx.beginPath();
        ctx.arc(cR * 0.18, -tH + cR * 0.12, cR * 0.45, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }
    }
  }
}