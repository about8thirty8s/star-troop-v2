// ─── TRAPS CONFIG ─────────────────────────────────────────────────────────────
// All trap definitions live here. Add new traps here — no engine changes needed.

export const TRAPS_CONFIG = {
  PUNJI: {
    name: 'Punji Spikes',
    cost: { wood: 3, stone: 2 },
    damage: 15,
    stun: 0,
    tier: 'light',
    digPit: true,       // modifies terrain on placement
  },
  TRIPWIRE: {
    name: 'Tripwire',
    cost: { rope: 2, explosives: 1 },
    damage: 10,
    stun: 0,
    tier: 'light',
    digPit: false,
  },
  FALLING_LOG: {
    name: 'Falling Log',
    cost: { wood: 5, rope: 3 },
    damage: 30,
    stun: 0,
    tier: 'medium',
    digPit: false,
  },
  SNARE: {
    name: 'Rope Snare',
    cost: { rope: 4, wood: 2 },
    damage: 5,
    stun: 3,
    tier: 'medium',
    digPit: false,
  },
  BOULDER: {
    name: 'Boulder Trap',
    cost: { stone: 6, rope: 2 },
    damage: 40,
    stun: 0,
    tier: 'medium',
    digPit: false,
  },
  TREE_CRUSH: {
    name: 'Tree Crusher',
    cost: { wood: 8, rope: 5 },
    damage: 60,
    stun: 0,
    tier: 'heavy',
    digPit: false,
  },
  EXPLOSIVE: {
    name: 'Explosive Trap',
    cost: { explosives: 4, metal: 2 },
    damage: 50,
    stun: 0,
    tier: 'heavy',
    digPit: false,
    isExplosive: true,
    explosionRadius: 48,
  },
  CLAYMORE: {
   name: 'Claymore',
   cost: { explosives: 3, metal: 3 },
   damage: 70,
   stun: 0,
   tier: 'heavy',
   digPit: false,
   isExplosive: true,
   explosionRadius: 48,
  },
  TRIPWIRE_FLARE: {
   name: 'Tripwire Flare',
   cost: { rope: 1, metal: 0 },
   damage: 0,
   stun: 0,
   tier: 'light',
   digPit: false,
   isExplosive: false,
   isFlare: true,
  },
  };

  // Trap system tuning
  export const TRAP_SYSTEM_CONFIG = {
  chainRadius: 64,          // px — radius for chain reaction
  chainDelay: 15,           // frames delay for chained traps
  destroyAfterFrames: 60,   // frames until triggered trap is cleaned up
  damageDealFrame: 5,       // frames after trigger to deal damage
  };

  // Tripwire Flare config
  export const TRIPWIRE_FLARE_CONFIG = {
  maxPerPonchi: 2,
  wireLength: 64,
  triggerRadius: 16,
  flareDuration: 8,
  revealDuration: 4,
  lightRadius: 180,
  noiseRadius: 300,
  placementMinDistance: 160,
  placementMaxDistance: 520,
  chokepointScoreWeight: 2.0,
  approachPathScoreWeight: 1.8,
  distanceFromPlayerScoreWeight: 0.8,
  overlapTrapPenaltyWeight: 2.0,
  dangerPenaltyWeight: 1.5,
  };

  // Hunter entry direction config
  export const HUNTER_ENTRY_CONFIG = {
  leftWeight: 0.5,
  rightWeight: 0.5,
  spawnPadding: 96,
  avoidPlayerRadius: 420,
  };