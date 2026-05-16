// LAST HUNT: KILLBOX - World Generation
import { TILE, WORLD_WIDTH, WORLD_HEIGHT, TILE_SIZE } from './constants';
import { createFoliage } from './foliage/foliageSystem';
import { createProp } from './foliage/propSystem';
import { FOLIAGE_TYPES, BIOME_FOLIAGE_DENSITY } from './config/foliage.config';
import { PROP_TYPES, BIOME_PROP_DENSITY } from './config/props.config';
import { createTreeVariantInstance, getRandomTreeVariant } from './config/treeVariants.config';

function noise(x, scale = 0.05) {
  // Simple pseudo-noise for terrain
  return Math.sin(x * scale * 7.3 + 1.7) * 0.3 +
         Math.sin(x * scale * 13.1 + 3.2) * 0.2 +
         Math.sin(x * scale * 3.7 + 0.5) * 0.5;
}

export function generateWorld() {
  const tiles = [];
  for (let y = 0; y < WORLD_HEIGHT; y++) {
    tiles[y] = new Uint8Array(WORLD_WIDTH);
  }

  // Base terrain height (ground level around row 30-35)
  const baseHeight = 32;
  const heights = [];
  
  for (let x = 0; x < WORLD_WIDTH; x++) {
    let h = baseHeight + Math.floor(noise(x, 0.04) * 6);
    // Create some valleys and hills
    if (x > 40 && x < 55) h += 3; // hill
    if (x > 80 && x < 95) h -= 4; // valley/river
    if (x > 120 && x < 140) h += 2; // compound area elevation
    if (x > 160 && x < 175) h -= 2; // cave entrance dip
    heights[x] = Math.max(20, Math.min(WORLD_HEIGHT - 5, h));
  }

  // Fill terrain
  for (let x = 0; x < WORLD_WIDTH; x++) {
    const groundY = heights[x];
    
    // Grass top layer
    tiles[groundY][x] = TILE.GRASS;
    
    // Dirt layers
    for (let y = groundY + 1; y < WORLD_HEIGHT; y++) {
      if (y > groundY + 8) {
        tiles[y][x] = TILE.STONE;
      } else {
        tiles[y][x] = TILE.DIRT;
      }
    }
  }

  // River area (x: 82-92) with muddy edges
  for (let x = 82; x < 92; x++) {
    const riverDepth = heights[x] + 2;
    for (let y = heights[x]; y < riverDepth; y++) {
      tiles[y][x] = TILE.WATER;
    }
    // Bridge over river
    if (x >= 85 && x <= 89) {
      tiles[heights[x] - 1][x] = TILE.BRIDGE;
    }
  }

  // Create muddy water edges around river (left/right banks)
  for (let x = 80; x < 94; x++) {
    const riverY = heights[x];
    // Left bank edge (one tile left of water)
    if (x < 82 && x > 80) {
      tiles[riverY][x] = TILE.MUD_EDGE;
    }
    // Right bank edge (one tile right of water)
    if (x > 91 && x < 94) {
      tiles[riverY][x] = TILE.MUD_EDGE;
    }
  }

  // Trees (vertical wood columns with leaf tops)
  const trees = [];
  const treePositions = [8, 15, 22, 30, 38, 50, 58, 65, 72, 100, 108, 115, 150, 158, 170, 180, 190];
  
  for (const tx of treePositions) {
    if (tx >= WORLD_WIDTH) continue;
    const groundY = heights[tx];
    const treeHeight = 6 + Math.floor(Math.random() * 5);
    const treeTop = groundY - treeHeight;
    
    // Trunk
    for (let y = treeTop + 2; y < groundY; y++) {
      tiles[y][tx] = TILE.WOOD;
    }
    
    // Canopy
    for (let dy = -2; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const lx = tx + dx;
        const ly = treeTop + dy;
        if (lx >= 0 && lx < WORLD_WIDTH && ly >= 0 && ly < WORLD_HEIGHT) {
          if (tiles[ly][lx] === TILE.AIR && Math.abs(dx) + Math.abs(dy) < 4) {
            tiles[ly][lx] = TILE.LEAVES;
          }
        }
      }
    }
    
    // Vines hanging from some trees
    if (Math.random() > 0.5) {
      const vineX = tx + (Math.random() > 0.5 ? 1 : -1);
      if (vineX >= 0 && vineX < WORLD_WIDTH) {
        for (let vy = treeTop + 2; vy < treeTop + 5; vy++) {
          if (tiles[vy][vineX] === TILE.AIR) {
            tiles[vy][vineX] = TILE.VINE;
          }
        }
      }
    }
    
    trees.push({ x: tx * TILE_SIZE, y: treeTop * TILE_SIZE, height: treeHeight, alive: true });
  }

  // Crashed helicopter (x: 60-68, surface)
  const heliY = heights[64];
  for (let x = 62; x < 68; x++) {
    tiles[heliY - 1][x] = TILE.METAL;
    tiles[heliY - 2][x] = TILE.METAL;
  }
  // Crates near helicopter
  tiles[heliY - 1][60] = TILE.CRATE;
  tiles[heliY - 1][69] = TILE.CRATE;

  // Enemy compound (x: 125-138)
  const compY = heights[130];
  // Walls
  for (let y = compY - 4; y < compY; y++) {
    tiles[y][125] = TILE.WOOD;
    tiles[y][138] = TILE.WOOD;
  }
  // Floor
  for (let x = 125; x <= 138; x++) {
    tiles[compY - 1][x] = TILE.WOOD;
  }
  // Watchtower
  for (let y = compY - 7; y < compY - 4; y++) {
    tiles[y][126] = TILE.WOOD;
    tiles[y][127] = TILE.WOOD;
  }
  // Crates inside
  tiles[compY - 2][130] = TILE.CRATE;
  tiles[compY - 2][133] = TILE.CRATE;
  tiles[compY - 2][135] = TILE.CRATE;

  // Cave system (x: 162-178, below surface)
  const caveY = heights[170] + 3;
  for (let x = 162; x < 178; x++) {
    for (let y = caveY; y < caveY + 5; y++) {
      if (y < WORLD_HEIGHT && tiles[y][x] !== TILE.AIR) {
        tiles[y][x] = TILE.AIR;
      }
    }
  }
  // Cave entrance
  for (let y = heights[162]; y < caveY; y++) {
    tiles[y][162] = TILE.AIR;
    tiles[y][163] = TILE.AIR;
  }

  // Mud pits
  for (let x = 45; x < 50; x++) {
    tiles[heights[x]][x] = TILE.MUD;
    tiles[heights[x] + 1][x] = TILE.MUD;
  }

  // Resource nodes tracking
  const resourceNodes = [];
  
  // Helicopter loot
  resourceNodes.push({ x: 64 * TILE_SIZE, y: (heliY - 3) * TILE_SIZE, type: 'helicopter', looted: false });
  
  // Compound loot
  resourceNodes.push({ x: 131 * TILE_SIZE, y: (compY - 3) * TILE_SIZE, type: 'compound', looted: false });

  // Spawn foliage and props (jungle density pass)
  const foliage = spawnFoliage(tiles, heights, BIOME_FOLIAGE_DENSITY.JUNGLE);
  const props = spawnProps(tiles, heights, BIOME_PROP_DENSITY.JUNGLE);

  // Spawn tree variants as background decorative elements
  const treeVariants = spawnTreeVariants(heights);

  return {
    tiles,
    heights,
    trees,
    resourceNodes,
    foliage,
    props,
    treeVariants,
    spawnPoint: { x: 10 * TILE_SIZE, y: (heights[10] - 3) * TILE_SIZE },
    hunterSpawn: { x: 190 * TILE_SIZE, y: (heights[190] - 3) * TILE_SIZE },
  };
}

export function getTile(tiles, tx, ty) {
  if (tx < 0 || tx >= WORLD_WIDTH || ty < 0 || ty >= WORLD_HEIGHT) return TILE.AIR;
  return tiles[ty][tx];
}

export function setTile(tiles, tx, ty, type) {
  if (tx >= 0 && tx < WORLD_WIDTH && ty >= 0 && ty < WORLD_HEIGHT) {
    tiles[ty][tx] = type;
  }
}

export function destroyTile(tiles, tx, ty) {
  setTile(tiles, tx, ty, TILE.AIR);
}

export function isSolid(tileType) {
  return tileType !== TILE.AIR && tileType !== TILE.WATER && tileType !== TILE.VINE && tileType !== TILE.MUD_EDGE && tileType !== TILE.TIMBER_LADDER;
}

// Spawn decorative and destructible foliage throughout the world
function spawnFoliage(tiles, heights, densityConfig) {
  const foliage = [];
  const forbiddenZones = [
    { minX: 0, maxX: 20, name: 'spawn' },
    { minX: 180, maxX: 200, name: 'hunter' },
    { minX: 62, maxX: 68, name: 'heli' },
    { minX: 125, maxX: 138, name: 'compound' },
  ];

  for (let x = 0; x < WORLD_WIDTH; x++) {
    // Skip forbidden zones
    if (forbiddenZones.some(z => x >= z.minX && x <= z.maxX)) continue;

    const groundY = heights[x];
    const surfaceX = x * TILE_SIZE;
    const surfaceY = groundY * TILE_SIZE;

    // Grass clumps (very common, foreground)
    if (Math.random() < densityConfig.grassDensity) {
      foliage.push(createFoliage(FOLIAGE_TYPES.GRASS_CLUMP, surfaceX + Math.random() * 10 - 5, surfaceY - 8));
    }

    // Tall grass (common, semi-cover)
    if (Math.random() < densityConfig.tallGrassDensity) {
      foliage.push(createFoliage(FOLIAGE_TYPES.TALL_GRASS, surfaceX + Math.random() * 8 - 4, surfaceY - 18));
    }

    // Ferns (medium density, jungle feel)
    if (Math.random() < densityConfig.fernDensity) {
      foliage.push(createFoliage(FOLIAGE_TYPES.FERN, surfaceX + Math.random() * 12 - 6, surfaceY - 24));
    }

    // Shrubs (provide light cover)
    if (Math.random() < densityConfig.shrubDensity) {
      foliage.push(createFoliage(FOLIAGE_TYPES.SHRUB, surfaceX + Math.random() * 14 - 7, surfaceY - 20));
    }

    // Bushes — rope-bearing, obvious, interactive
    if (Math.random() < (densityConfig.bushDensity || 0.35)) {
      foliage.push(createFoliage(FOLIAGE_TYPES.BUSH, surfaceX + Math.random() * 16 - 8, surfaceY - 24));
    }

    // Vines (climbing and decorative)
    if (Math.random() < densityConfig.vineDensity) {
      const vineType = Math.random() > 0.6 ? FOLIAGE_TYPES.VINE_CLIMBING : FOLIAGE_TYPES.VINE_HANGING;
      foliage.push(createFoliage(vineType, surfaceX + Math.random() * 6 - 3, surfaceY - 40));
    }

    // Reeds (near water only)
    if (x >= 80 && x < 94 && Math.random() < densityConfig.reedDensity) {
      foliage.push(createFoliage(FOLIAGE_TYPES.REED, surfaceX + Math.random() * 8 - 4, surfaceY - 28));
    }
  }

  return foliage;
}

// Spawn props (rocks, logs, etc.) throughout the world
function spawnProps(tiles, heights, densityConfig) {
  const props = [];
  const forbiddenZones = [
    { minX: 0, maxX: 20, name: 'spawn' },
    { minX: 180, maxX: 200, name: 'hunter' },
    { minX: 62, maxX: 68, name: 'heli' },
    { minX: 125, maxX: 138, name: 'compound' },
  ];

  for (let x = 0; x < WORLD_WIDTH; x++) {
    // Skip forbidden zones
    if (forbiddenZones.some(z => x >= z.minX && x <= z.maxX)) continue;

    const groundY = heights[x];
    const surfaceX = x * TILE_SIZE;
    const surfaceY = groundY * TILE_SIZE;

    // Small rocks
    if (Math.random() < densityConfig.smallRockDensity) {
      props.push(createProp(PROP_TYPES.SMALL_ROCK, surfaceX + Math.random() * 10 - 5, surfaceY - 14));
    }

    // Medium rocks (occasional cover)
    if (Math.random() < densityConfig.mediumRockDensity) {
      props.push(createProp(PROP_TYPES.MEDIUM_ROCK, surfaceX + Math.random() * 12 - 6, surfaceY - 22));
    }

    // Large boulders (rare, major obstacles)
    if (Math.random() < densityConfig.boulderDensity) {
      props.push(createProp(PROP_TYPES.LARGE_BOULDER, surfaceX + Math.random() * 14 - 7, surfaceY - 38));
    }

    // Hollow logs (crawlable passages)
    if (Math.random() < densityConfig.logDensity) {
      props.push(createProp(PROP_TYPES.HOLLOW_LOG, surfaceX + Math.random() * 16 - 8, surfaceY - 16));
    }

    // Stumps (remains of chopped trees)
    if (Math.random() < densityConfig.stumpDensity) {
      props.push(createProp(PROP_TYPES.STUMP, surfaceX + Math.random() * 10 - 5, surfaceY - 16));
    }

    // Root clusters (jungle detail)
    if (Math.random() < densityConfig.rootDensity) {
      props.push(createProp(PROP_TYPES.ROOT_CLUSTER, surfaceX + Math.random() * 12 - 6, surfaceY - 18));
    }

    // Fallen branches (occasional)
    if (Math.random() < (densityConfig.logDensity * 0.4)) {
      props.push(createProp(PROP_TYPES.FALLEN_BRANCH, surfaceX + Math.random() * 20 - 10, surfaceY - 8));
    }
  }

  return props;
}

// Spawn decorative tree variant sprites (background foliage)
function spawnTreeVariants(heights) {
  const variants = [];
  
  // Spawn ~8-12 tree variants scattered across the world at varied Y depths
  const treeCount = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < treeCount; i++) {
    const x = Math.random() * WORLD_WIDTH * TILE_SIZE;
    const tx = Math.floor(x / TILE_SIZE);
    
    // Avoid spawn and hunter zones
    if ((tx >= 0 && tx <= 20) || (tx >= 180 && tx <= 200)) continue;
    
    const groundY = heights[Math.floor(x / TILE_SIZE)];
    const y = groundY * TILE_SIZE - 40 + (Math.random() - 0.5) * 60;  // vary height
    
    const variant = getRandomTreeVariant();
    const scale = 0.7 + Math.random() * 0.6;  // 0.7 to 1.3
    
    variants.push(createTreeVariantInstance(variant, x, y, scale));
  }
  
  return variants;
}