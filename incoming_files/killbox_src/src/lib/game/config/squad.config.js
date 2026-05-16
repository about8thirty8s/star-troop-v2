// ─── SQUAD CONFIG — V2 ──────────────────────────────────────────────────────
// AI Squad member archetypes, stats, behavior tuning.
// V2: personality nav weights, treeAmbush tuning, stuck recovery params.
// VULCAN P1 — Squad AI V2.

export const SQUAD_CONFIG = {
  // ── Global settings ──────────────────────────────────────────────────────
  squadSize: 3,
  insertionHeight: 400,
  descentSpeed: 1.5,  // VULCAN ×0.5 — slower rope descent
  dispersalDelay: 180,

  // ── Archetypes ────────────────────────────────────────────────────────────
  archetypes: {
    MAC: {
      name: 'Mac',
      role: 'gung_ho',
      health: 100,
      maxHealth: 100,
      speed: 1.6,            // VULCAN ×0.5
      weapon: 'rifle',
      weaponDamage: 12,
      weaponCooldown: 28,
      color: '#8B4513',
      skinColor: '#C68642',
      traits: {
        behaviorStyle: 'gung_ho',
        // MAC: pushes forward, breaks obstacles, favors combat routes
        navWeights: {
          forwardBias: 0.85,   // heavily prefers moving toward Hunter
          elevatedBias: 0.1,   // rarely seeks height
          coverBias: 0.1,      // light cover usage
        },
      },
    },
    BILLIE: {
      name: 'Billy',
      role: 'tree_ambush',
      health: 85,
      maxHealth: 85,
      speed: 1.0,            // VULCAN ×0.5
      weapon: 'bow',
      weaponDamage: 18,
      weaponCooldown: 55,
      color: '#556B2F',
      skinColor: '#A0785A',
      traits: {
        behaviorStyle: 'tree_ambush',
        // BILLIE: prefers elevation, tree ambush specialist, silent
        navWeights: {
          forwardBias: 0.2,
          elevatedBias: 0.85,  // strongly prefers height
          coverBias: 0.4,
        },
      },
    },
    PONCHO: {
      name: 'Poncho',
      role: 'low_profile',
      health: 95,
      maxHealth: 95,
      speed: 1.0,            // VULCAN ×0.5
      weapon: 'pistol',
      weaponDamage: 8,
      weaponCooldown: 20,
      color: '#4A6741',
      skinColor: '#8D5524',
      traits: {
        behaviorStyle: 'low_profile',
        // PONCHO: defensive rear, trap-layer, flanks
        navWeights: {
          forwardBias: 0.2,
          elevatedBias: 0.2,
          coverBias: 0.85,     // strongly prefers cover
        },
      },
    },
  },

  // ── AI decision config ────────────────────────────────────────────────────
  ai: {
    decisionInterval: 0.35,     // seconds between action re-scoring
    stuckThresholdDist: 0.4,    // pixels/frame below which member is "stuck"
    teleportLeashTime: 3.6,     // seconds stuck before teleport leash fires
    teleportLeashOffscreenDist: 800, // px from player to qualify for leash
  },

  // ── Movement config ───────────────────────────────────────────────────────
  movement: {
    jumpCooldown: 1.1,          // seconds between jump attempts
    doubleJumpCooldown: 0.25,   // min airtime before second jump
    postLandingPause: 0.15,     // brief pause after landing (feels grounded)
    maxJumpSpamAttempts: 2,     // before rerouting
  },

  // ── Tree ambush config ────────────────────────────────────────────────────
  treeAmbush: {
    stagingSearchRadius: 320,
    doubleJumpMaxHeight: 160,       // pixels — max height for double-jump reach
    maxHorizontalJumpDistance: 100, // pixels — max horizontal gap per jump
    maxRouteNodes: 4,
    firstJumpVelocity: -5.5,  // VULCAN ×0.5
    secondJumpVelocity: -3.5,  // VULCAN ×0.5
    jumpCooldown: 1.1,
    doubleJumpMinDelay: 0.28,       // seconds airborne before firing second jump
    heightAdvantageWeight: 0.45,
    distanceToHunterWeight: 0.30,
    reachabilityWeight: 0.25,
  },

  // ── Insertion zones ───────────────────────────────────────────────────────
  insertionZones: [
    { label: 'LEFT_FLANK',  xFraction: 0.15, yFraction: 0.6 },
    { label: 'CENTER',      xFraction: 0.50, yFraction: 0.6 },
    { label: 'RIGHT_FLANK', xFraction: 0.85, yFraction: 0.6 },
  ],

  // ── States ────────────────────────────────────────────────────────────────
  states: {
    SCOUT:   { duration: 5.0 },
    PATROL:  { duration: 8.0 },
    ENGAGE:  { duration: 4.0 },
    RETREAT: { duration: 3.0 },
  },

  // ── Bark probability ──────────────────────────────────────────────────────
  panicScreenProb: 0.3,

  // ── Loot drops on death ───────────────────────────────────────────────────
  lootDropTable: {
    ammo:    { chance: 0.6, amount: 10 },
    medkit:  { chance: 0.25, amount: 1 },
    grenade: { chance: 0.15, amount: 1 },
  },
};
