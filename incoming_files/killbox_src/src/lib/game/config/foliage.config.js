// LAST HUNT: KILLBOX - Foliage Configuration
// Defines destructible plant types: grasses, shrubs, ferns, vines, reeds

export const FOLIAGE_TYPES = {
  GRASS_CLUMP: 'grass_clump',
  TALL_GRASS: 'tall_grass',
  FERN: 'fern',
  SHRUB: 'shrub',
  BUSH: 'bush',              // Dense rope-bearing bush — obvious F-key target
  REED: 'reed',
  VINE_HANGING: 'vine_hanging',
  VINE_CLIMBING: 'vine_climbing',
};

export const FOLIAGE_CONFIG = {
  [FOLIAGE_TYPES.GRASS_CLUMP]: {
    health: 1,
    w: 12, h: 8,
    destructible: true,
    flammable: true,
    blocksMovement: false,
    blocksBullets: false,
    damageThreshold: 1,
    yields: { wood: 0.1 },
    hitFx: 'grass_clip',
    destroyFx: 'grass_burst_small',
  },
  [FOLIAGE_TYPES.TALL_GRASS]: {
    health: 2,
    w: 14, h: 20,
    destructible: true,
    flammable: true,
    blocksMovement: false,
    blocksBullets: false,
    damageThreshold: 1,
    yields: { wood: 0.2, rope: 0.1 },  // rare rope from grass
    hidesFoliage: true,  // partially hides player
    hitFx: 'grass_bend',
    destroyFx: 'grass_burst_tall',
  },
  [FOLIAGE_TYPES.FERN]: {
    health: 3,
    w: 16, h: 24,
    destructible: true,
    flammable: true,
    blocksMovement: false,
    blocksBullets: false,
    damageThreshold: 2,
    yields: { wood: 0.3 },
    hitFx: 'leaf_scatter',
    destroyFx: 'fern_burst',
  },
  [FOLIAGE_TYPES.SHRUB]: {
    health: 8,
    w: 24, h: 20,
    destructible: true,
    flammable: true,
    blocksMovement: false,
    blocksBullets: false,
    damageThreshold: 3,
    yields: { wood: 0.5 },
    hidesFoliage: true,  // provides light cover
    hitFx: 'branch_snap',
    destroyFx: 'shrub_burst',
  },
  // ── BUSH — primary rope source, dense and visible ──────────────────────────
  [FOLIAGE_TYPES.BUSH]: {
    health: 6,
    w: 28, h: 24,
    destructible: true,
    flammable: true,
    blocksMovement: false,
    blocksBullets: true,       // dense enough to partially block shots
    damageThreshold: 2,
    yields: { rope: 1.0 },     // 1 guaranteed rope per destroy — primary source
    hidesFoliage: true,
    sway: false,
    hitFx: 'branch_snap',
    destroyFx: 'bush_burst',
    chopHits: 3,               // takes 3 F-key hits to destroy
  },

  [FOLIAGE_TYPES.REED]: {
    health: 2,
    w: 8, h: 28,
    destructible: true,
    flammable: true,
    blocksMovement: false,
    blocksBullets: false,
    damageThreshold: 1,
    yields: { rope: 0.5 },    // 2 reeds = 1 rope
    sway: true,  // moves in wind
    hitFx: 'reed_crack',
    destroyFx: 'reed_scatter',
  },
  [FOLIAGE_TYPES.VINE_HANGING]: {
    health: 3,
    w: 6, h: 40,
    destructible: true,
    flammable: false,
    blocksMovement: false,
    blocksBullets: false,
    damageThreshold: 2,
    yields: { rope: 1.0 },    // 1 rope per vine destroyed
    hitFx: 'vine_snap',
    destroyFx: 'vine_drop',
  },
  [FOLIAGE_TYPES.VINE_CLIMBING]: {
    health: 5,
    w: 6, h: 60,
    destructible: true,
    flammable: false,
    blocksMovement: false,
    blocksBullets: false,
    damageThreshold: 2,
    climbable: true,
    yields: { rope: 1.0 },    // 1 rope per vine destroyed
    hitFx: 'vine_snap',
    destroyFx: 'vine_cascade',
  },
};

export const BIOME_FOLIAGE_DENSITY = {
  JUNGLE: {
    grassDensity: 0.7,
    tallGrassDensity: 0.45,
    fernDensity: 0.35,
    shrubDensity: 0.3,
    bushDensity: 0.35,         // prominent rope-source bushes
    reedDensity: 0.15,  // near water only
    vineDensity: 0.25,
  },
  SWAMP: {
    grassDensity: 0.5,
    tallGrassDensity: 0.6,
    fernDensity: 0.45,
    shrubDensity: 0.25,
    bushDensity: 0.20,
    reedDensity: 0.5,
    vineDensity: 0.35,
  },
  DENSE_FOREST: {
    grassDensity: 0.4,
    tallGrassDensity: 0.3,
    fernDensity: 0.6,
    shrubDensity: 0.5,
    bushDensity: 0.30,
    reedDensity: 0.1,
    vineDensity: 0.4,
  },
};