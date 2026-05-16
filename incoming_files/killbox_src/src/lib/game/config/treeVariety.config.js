// LAST HUNT: KILLBOX - Tree Variety Configuration
// Defines multiple tree archetypes with different health, heights, and appearances

export const TREE_ARCHETYPES = {
  THIN_JUNGLE: 'thin_jungle',
  PALM: 'palm',
  BROAD_CANOPY: 'broad_canopy',
  ANCIENT_TRUNK: 'ancient_trunk',
  DEAD_TREE: 'dead_tree',
  VINE_WRAPPED: 'vine_wrapped',
};

export const TREE_ARCHETYPE_CONFIG = {
  [TREE_ARCHETYPES.THIN_JUNGLE]: {
    heightRange: [4, 7],
    health: 12,
    maxChops: 2,
    fallSpeed: 0.015,
    logResourceMulti: 0.8,
    canopySize: 1.8,
    appearance: 'thin',
    rarity: 0.35,
  },
  [TREE_ARCHETYPES.PALM]: {
    heightRange: [6, 9],
    health: 15,
    maxChops: 3,
    fallSpeed: 0.013,
    logResourceMulti: 1.0,
    canopySize: 2.2,
    appearance: 'palm',
    rarity: 0.25,
    dropCoconut: true,
  },
  [TREE_ARCHETYPES.BROAD_CANOPY]: {
    heightRange: [5, 8],
    health: 20,
    maxChops: 3,
    fallSpeed: 0.012,
    logResourceMulti: 1.2,
    canopySize: 2.8,
    appearance: 'broad',
    rarity: 0.2,
    goodForAmbush: true,
  },
  [TREE_ARCHETYPES.ANCIENT_TRUNK]: {
    heightRange: [7, 11],
    health: 35,
    maxChops: 4,
    fallSpeed: 0.01,
    logResourceMulti: 1.8,
    canopySize: 2.0,
    appearance: 'thick',
    rarity: 0.1,
    heavyObject: true,
  },
  [TREE_ARCHETYPES.DEAD_TREE]: {
    heightRange: [5, 9],
    health: 8,
    maxChops: 2,
    fallSpeed: 0.018,
    logResourceMulti: 0.5,
    canopySize: 1.2,
    appearance: 'dead',
    rarity: 0.05,
    fragile: true,
    shatterOnFall: true,
  },
  [TREE_ARCHETYPES.VINE_WRAPPED]: {
    heightRange: [6, 9],
    health: 18,
    maxChops: 3,
    fallSpeed: 0.013,
    logResourceMulti: 1.1,
    canopySize: 2.4,
    appearance: 'vined',
    rarity: 0.05,
    climbableVines: true,
  },
};

export const TREE_SPAWN_CONFIG = {
  minDistanceFromPlayer: 80,
  minDistanceFromTrees: 60,
  minDistanceFromStructures: 120,
  clusterRadius: 200,  // trees tend to group
  clusterChance: 0.6,
};