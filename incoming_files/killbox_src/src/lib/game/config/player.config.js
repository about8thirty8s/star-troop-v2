// ─── PLAYER CONFIG ───────────────────────────────────────────────────────────
// All tunable player values live here.
// VULCAN PHASE 1 — Movement hardening pass. 2026-05-16

export const PLAYER_CONFIG = {
  speed: 1.1,       // VULCAN ×0.5 — cinematic weight
  jumpPower: -5.5,  // VULCAN ×0.5 — slower rise arc
  width: 14,
  height: 24,
  crouchHeight: 16,
  maxHealth: 100,

  // Jump feel — VULCAN tuned
  coyoteFrames: 8,         // was 6 — slightly more ledge forgiveness
  jumpBufferFrames: 10,    // was 7 — better input queue window

  // Machete
  attackDuration: 12,
  attackDamageFrame: 8,
  macheteTileRange: 22,

  // Bow
  bowMaxPower: 15,
  bowChargeRate: 0.5,
  bowMinFirePower: 2,
  bowBaseDamage: 5,
  bowPowerDamageScale: 2,
  arrowLife: 300,
  arrowGravityScale: 0.4,

  // Mud camouflage
  mudCoatDuration: 480,
  mudCoatMax: 960,
  mudWashRate: 8,
  mudAlphaMax: 0.35,

  // Crouch speed penalty
  crouchSpeedMult: 0.5,
};