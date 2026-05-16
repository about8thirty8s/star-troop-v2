// LAST HUNT: KILLBOX - Tree Variety System
// Extends base tree system with multiple archetypes and appearances

import { TREE_ARCHETYPES, TREE_ARCHETYPE_CONFIG } from '../config/treeVariety.config';
import { TREE_STATE } from '../trees';

export function createTreeVariety(x, y, height, archetypeOverride = null) {
  let archetype = archetypeOverride;
  
  // Randomly select archetype by rarity if not overridden
  if (!archetype) {
    const roll = Math.random();
    let cumulative = 0;
    for (const [key, config] of Object.entries(TREE_ARCHETYPE_CONFIG)) {
      cumulative += config.rarity;
      if (roll < cumulative) {
        archetype = key;
        break;
      }
    }
    if (!archetype) archetype = TREE_ARCHETYPES.THIN_JUNGLE;
  }

  const arcConfig = TREE_ARCHETYPE_CONFIG[archetype];
  const finalHeight = height || (
    Math.floor(Math.random() * (arcConfig.heightRange[1] - arcConfig.heightRange[0])) +
    arcConfig.heightRange[0]
  );

  return {
    // Base tree data
    x, y,
    height: finalHeight,
    archetype,
    
    // Health and durability
    health: arcConfig.health,
    maxHealth: arcConfig.health,
    
    // Physical properties
    canopySize: arcConfig.canopySize,
    fallSpeed: arcConfig.fallSpeed,
    logResourceMulti: arcConfig.logResourceMulti,
    
    // Chopping
    maxChops: arcConfig.maxChops,
    chopsRemaining: arcConfig.maxChops,
    
    // Behavior flags
    fragile: arcConfig.fragile || false,
    heavyObject: arcConfig.heavyObject || false,
    goodForAmbush: arcConfig.goodForAmbush || false,
    climbableVines: arcConfig.climbableVines || false,
    shatterOnFall: arcConfig.shatterOnFall || false,
    dropCoconut: arcConfig.dropCoconut || false,
    
    // State (reuse tree.js state machine)
    state: TREE_STATE.STANDING,
    angle: 0,
    angleVel: 0,
    fallDir: 1,
    chopHits: 0,
    hitGround: false,
    fallTimer: 0,
    cutTileY: null,
    stumpHeight: 0,
    fracturedUpper: null,
  };
}

export function selectRandomArchetype() {
  const archetypes = Object.keys(TREE_ARCHETYPE_CONFIG);
  return archetypes[Math.floor(Math.random() * archetypes.length)];
}

export function getArchetypeConfig(archetype) {
  return TREE_ARCHETYPE_CONFIG[archetype] || TREE_ARCHETYPE_CONFIG[TREE_ARCHETYPES.THIN_JUNGLE];
}