// ─── HUNTER CONFIG ───────────────────────────────────────────────────────────
// All tunable Hunter AI values live here. Mod-friendly.

export const HUNTER_CONFIG = {
  width: 20,
  height: 30,
  baseHealth: 200,

  // Timing
  stalkDuration: 30,           // seconds before choosing a mode
  selfDestructDelay: 300,      // frames before boom (5s @60fps)

  // Movement speeds per mode
  groundSpeed: 2.8,
  groundSlowSpeed: 1.8,
  groundSlowRange: 100,
  treeSpeed: 2.4,              // slightly faster in tree mode — feels predatory
  treeJumpChance: 0.0033,      // per-frame random jump ~20%/s (was 5%/frame = way too spammy)
  treeJumpPower: -13,          // strong enough to clear 2 tile canopy gaps
  treeDoubleJumpPower: -9,     // second jump — weaker, directional adjustment
  treeLeapSpeed: 3.4,          // horizontal speed during tree-to-tree leap
  treeLeapMaxDist: 7,          // max tile distance for tree-to-tree targeting
  treeLandingParticles: 6,     // shimmer burst on canopy land
  plasmaKiteNearRange: 180,
  plasmaKiteFarRange: 350,
  plasmaKiteSpeed: 1.5,
  plasmaApproachSpeed: 1.2,

  // Blade combo (ground mode)
  bladeLunge1Speed: 4,
  bladeLunge1Duration: 8,      // frames
  bladePauseDuration: 12,
  bladeLunge2Speed: 5,
  bladeLunge2Duration: 8,
  bladeDamage1: 18,
  bladeDamage2: 22,
  bladeKnockbackX1: 9,
  bladeKnockbackX2: 10,
  bladeKnockbackY1: -4,
  bladeKnockbackY2: -6,
  bladeRange1: 50,
  bladeRange2: 55,
  bladeCooldown: 70,

  // Tree dive mode
  diveBombSpeed: 8,
  diveBombVX: 3,
  diveBombDamage: 20,
  diveBombKnockback: -8,
  diveBombRange: 70,
  treeAttackRange: 80,
  treeAttackCooldown: 90,

  // Plasma mode
  plasmaLockFrames: 90,        // frames to lock-on before firing
  plasmaChargeMax: 60,
  plasmaSpeed: 7.5,
  plasmaDamage: 35,
  plasmaRadius: 50,
  plasmaLife: 320,
  plasmaCooldown: 140,
  plasmaTrackBase: 0.06,
  plasmaTrackAccel: 0.0008,
  plasmaPredictFrames: 8,

  // Mud penalty on plasma tracking
  mudTrackPenalty: 0.4,

  // Cloaking
  cloakRecloakRange: 150,      // re-cloak if player farther than this
  cloakCooldownOnAttack: 90,
  cloakCooldownOnDamage: 60,
  cloakCooldownOnPlasma: 150,

  // Alert
  alertRateIdle: 0.001,
  alertRateHit: 0.15,
  alertTrapAvoidThreshold: 0.7,
  alertLightTrapAvoidChance: 0.4,

  // Low health retreat
  retreatHealthPct: 0.3,
  retreatChancePerFrame: 0.01,

  // Stuck / pathfinding
  stuckCheckInterval: 60,      // frames
  stuckThresholdPx: 4,
  stuckJumpPower: -12,
  stuckJumpPower2: -16,        // 2nd consecutive stuck
  stuckJumpVX: 6,
  stuckWallLeapPower: -10,

  // Obstacle obstacle jump (approach)
  obstacleJumpPower: -10,
  obstacleBlockThreshold: 20,

  // Self-destruct explosion
  selfDestructRadius: 120,
  selfDestructPlayerKillRange: 200,
  selfDestructScoreBonus: 5000,

  // Green blood
  bloodParticleCount: 8,
  bloodLife: 28,
  bloodColor: '#00ff66',
};