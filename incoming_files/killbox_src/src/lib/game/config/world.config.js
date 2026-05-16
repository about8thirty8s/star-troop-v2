// ─── WORLD CONFIG ────────────────────────────────────────────────────────────
// All tunable world/terrain values live here. Do NOT hardcode in logic files.

export const WORLD_CONFIG = {
  tileSize: 16,
  worldWidth: 200,   // tiles
  worldHeight: 50,   // tiles

  // Terrain generation
  baseGroundRow: 32,
  terrainAmplitude: 6,

  // Digging
  macheteDiggable: ['dirt', 'mud', 'grass'],
  shovelDiggable:  ['dirt', 'mud', 'grass', 'wood'],

  // Fire
  fireMaxPatches: 60,
  fireSpreadChance: 0.5,
  fireFlammableTiles: ['grass', 'leaves', 'wood'],

  // Resources per tile destroyed
  resourceYield: {
    wood:    { wood: 1 },
    leaves:  { rope: 1 },
    crate:   { explosives: 2, metal: 1 },
    dirt:    { stone: 1 },
    grass:   { stone: 1 },
    mud:     { mud: 1 },
  },
};