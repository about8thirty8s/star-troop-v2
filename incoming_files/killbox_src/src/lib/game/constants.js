// LAST HUNT: KILLBOX - Game Constants
// Structural constants only. Tunable values live in lib/game/config/*.config.js
// Import from config files to read/change balance values.

import { WORLD_CONFIG } from './config/world.config';
import { PLAYER_CONFIG } from './config/player.config';
import { GAME_CONFIG }   from './config/game.config';

export const TILE_SIZE    = WORLD_CONFIG.tileSize;
export const WORLD_WIDTH  = WORLD_CONFIG.worldWidth;
export const WORLD_HEIGHT = WORLD_CONFIG.worldHeight;
export const PIXEL_WORLD_W = WORLD_WIDTH * TILE_SIZE;
export const PIXEL_WORLD_H = WORLD_HEIGHT * TILE_SIZE;

export const GRAVITY       = GAME_CONFIG.gravity;
export const MAX_FALL_SPEED = GAME_CONFIG.maxFallSpeed;
export const PLAYER_SPEED  = PLAYER_CONFIG.speed;
export const PLAYER_JUMP   = PLAYER_CONFIG.jumpPower;
export const PLAYER_WIDTH  = PLAYER_CONFIG.width;
export const PLAYER_HEIGHT = PLAYER_CONFIG.height;

export const PREP_TIME         = GAME_CONFIG.prepTime;
export const HUNTER_STALK_TIME = GAME_CONFIG.hunterStalkTime;

export const TILE = {
  AIR: 0,
  DIRT: 1,
  GRASS: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  WATER: 6,
  BRIDGE: 7,
  VINE: 8,
  MUD: 9,
  METAL: 10,
  CRATE: 11,
  MUD_EDGE: 12,  // Muddy water edge (stealth tile)
  TIMBER_LADDER: 13,  // Dug shaft ladder for climbing escape
};

export const RESOURCES = {
  WOOD: 'wood',
  ROPE: 'rope',
  STONE: 'stone',
  MUD: 'mud',
  EXPLOSIVES: 'explosives',
  METAL: 'metal',
  BONES: 'bones',
  FUEL: 'fuel',
};

// Active tool slot
export const TOOLS = {
  MACHETE: 'machete',
  SHOVEL:  'shovel',
  BOW:     'bow',
};

export const TRAP_TYPES = {
  PUNJI: { name: 'Punji Spikes', cost: { wood: 3, stone: 2 }, damage: 15, tier: 'light' },
  TRIPWIRE: { name: 'Tripwire', cost: { rope: 2, explosives: 1 }, damage: 10, tier: 'light' },
  FALLING_LOG: { name: 'Falling Log', cost: { wood: 5, rope: 3 }, damage: 30, tier: 'medium' },
  SNARE: { name: 'Rope Snare', cost: { rope: 4, wood: 2 }, damage: 5, tier: 'medium', stun: 3 },
  BOULDER: { name: 'Boulder Trap', cost: { stone: 6, rope: 2 }, damage: 40, tier: 'medium' },
  TREE_CRUSH: { name: 'Tree Crusher', cost: { wood: 8, rope: 5 }, damage: 60, tier: 'heavy' },
  EXPLOSIVE: { name: 'Explosive Trap', cost: { explosives: 4, metal: 2 }, damage: 50, tier: 'heavy' },
  CLAYMORE: { name: 'Claymore', cost: { explosives: 3, metal: 3 }, damage: 70, tier: 'heavy' },
};

export const HUNTER_MODES = {
  GROUND: 'ground',
  TREE: 'tree',
  PLASMA: 'plasma',
};

export const GAME_STATES = {
  TITLE:     'title',
  INSERTION: 'insertion',  // cinematic helicopter drop
  PREP:      'prep',
  HUNT:      'hunt',
  VICTORY:   'victory',
  DEFEAT:    'defeat',
  ESCAPE:    'escape',
};

export const COLORS = {
  SKY_TOP: '#1a0e2e',
  SKY_BOTTOM: '#2d4a1e',
  DIRT: '#4a3728',
  DIRT_DARK: '#3a2a1e',
  GRASS: '#2d5a1e',
  GRASS_LIGHT: '#4a8a2e',
  STONE: '#6a6a6a',
  WOOD: '#8a6a3a',
  LEAVES: '#1e4a1e',
  LEAVES_LIGHT: '#2e6a2e',
  WATER: '#1e3a5a',
  MUD: '#3a2a15',
  PLAYER_SKIN: '#d4a574',
  PLAYER_CAMO: '#4a5a3a',
  PLAYER_DARK: '#2a3a1e',
  HUNTER_CLOAK: 'rgba(100,200,255,0.15)',
  HUNTER_BODY: '#4a4a3a',
  HUNTER_MASK: '#c0c0a0',
  PLASMA: '#00ffaa',
  EXPLOSION: '#ff6600',
  BLOOD: '#aa0000',
  HUD_BG: 'rgba(0,0,0,0.7)',
  HUD_TEXT: '#e0e0c0',
  HUD_RED: '#cc3333',
  HUD_GREEN: '#33aa33',
  HUD_YELLOW: '#ccaa33',
};