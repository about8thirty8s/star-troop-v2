// ─── MOD API ──────────────────────────────────────────────────────────────────
// Register new traps, weapons, animals, weather presets, and research upgrades
// WITHOUT touching engine code.
//
// Example:
//   import { registerTrap } from './modApi';
//   registerTrap({
//     id: 'SWINGING_LOG',
//     name: 'Swinging Log',
//     cost: { wood: 5, rope: 2 },
//     damage: 40,
//     stun: 0,
//     tier: 'medium',
//   });

import { TRAPS_CONFIG, TRAP_SYSTEM_CONFIG } from './config/traps.config';
import { WILDLIFE_CONFIG } from './config/wildlife.config';
import { RESEARCH_CONFIG } from './config/research.config';
import { ATMOSPHERE_CONFIG } from './config/atmosphere.config';

// ── TRAPS ──────────────────────────────────────────────────────────────────
export function registerTrap(def) {
  if (!def.id) throw new Error('registerTrap: id required');
  TRAPS_CONFIG[def.id] = {
    name: def.name || def.id,
    cost: def.cost || {},
    damage: def.damage || 0,
    stun: def.stun || 0,
    tier: def.tier || 'light',
    digPit: def.digPit || false,
    isExplosive: def.isExplosive || false,
    explosionRadius: def.explosionRadius || 0,
    ...def._extra,
  };
  console.log(`[MOD] Trap registered: ${def.id}`);
}

// ── BIRDS ──────────────────────────────────────────────────────────────────
export function registerBird(def) {
  if (!def.id) throw new Error('registerBird: id required');
  WILDLIFE_CONFIG.birds.push({
    id: def.id,
    color: def.color || '#888888',
    wingColor: def.wingColor || '#aaaaaa',
    size: def.size || 4,
  });
  console.log(`[MOD] Bird registered: ${def.id}`);
}

// ── RESEARCH UPGRADES ───────────────────────────────────────────────────────
export function registerUpgrade(tree, def) {
  if (!RESEARCH_CONFIG.trees[tree]) {
    RESEARCH_CONFIG.trees[tree] = { name: tree, upgrades: [] };
  }
  RESEARCH_CONFIG.trees[tree].upgrades.push({
    id: def.id,
    name: def.name,
    cost: def.cost || 5,
    effect: def.effect || {},
  });
  console.log(`[MOD] Upgrade registered: ${tree}/${def.id}`);
}

// ── WEATHER PRESETS ────────────────────────────────────────────────────────
const _weatherPresets = {};

export function registerWeatherPreset(id, config) {
  _weatherPresets[id] = config;
  console.log(`[MOD] Weather preset registered: ${id}`);
}

export function getWeatherPreset(id) {
  return _weatherPresets[id] || null;
}

// ── CONFIG PATCH ───────────────────────────────────────────────────────────
// Patch any config object at runtime. Useful for balance mods.
export function patchConfig(configObj, patches) {
  for (const [key, val] of Object.entries(patches)) {
    if (key in configObj) {
      configObj[key] = val;
    } else {
      console.warn(`[MOD] patchConfig: unknown key "${key}"`);
    }
  }
}