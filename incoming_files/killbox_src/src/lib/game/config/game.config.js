// ─── GAME / SESSION CONFIG ────────────────────────────────────────────────────
// Match timing, phase transitions, scoring.
// VULCAN PHASE 1 — Movement hardening pass. 2026-05-16

export const GAME_CONFIG = {
  prepTime: 180,             // seconds — prep phase duration
  hunterStalkTime: 30,       // seconds before hunter picks a mode

  // Scoring
  trapDamageScoreMulti: 10,
  arrowHitScore: 100,
  resourceHarvestScore: {
    helicopter: 50,
    compound: 75,
  },
  trapPlaceScore: 50,
  terrainHitScore: 10,
  bowFireScore: 5,

  // Physics — reduced gravity for floatier jump arcs
  gravity: 0.25,           // VULCAN ×0.5 — cinematic slow arc
  maxFallSpeed: 8,         // VULCAN ×0.5 — slower terminal velocity

  // Screen shake
  shakeDecay: 0.82,

  // Camera
  cameraLerpX: 0.08,
  cameraLerpY: 0.08,
  cameraOffsetX: -400,
  cameraOffsetY: -250,

  // Insertion camera
  insertionCamLerp: 0.06,
  insertionCamOffY: -200,
};