// ─── ATMOSPHERE CONFIG ────────────────────────────────────────────────────────
// Weather, lighting, and VFX tuning.

export const ATMOSPHERE_CONFIG = {
  // Weather cycle durations (frames)
  weatherMinDuration: 600,
  weatherMaxDuration: 1800,

  // Weather blend speed
  blendSpeed: 0.003,

  // Rain
  rainParticleCount: 120,
  rainSpeedY: 14,
  rainSpeedX: -2,
  rainAlpha: 0.45,
  rainLengthMin: 8,
  rainLengthMax: 18,

  // Fog
  fogLayerCount: 12,
  fogAlphaMax: 0.18,
  fogDriftSpeed: 0.15,

  // Lightning
  lightningStormThreshold: 0.4,   // storm blend above this = lightning enabled
  lightningChancePerFrame: 0.004,
  lightningFlashDecay: 0.055,
  lightningBoltSteps: 14,
  lightningBoltJitter: 30,
  lightningBranchChance: 0.2,

  // God rays
  godRayCount: 5,
  godRaySpacing: 380,
  godRayParallax: 0.15,
  godRayBaseStrength: 0.055,
  godRayStormSuppression: 0.85,
  godRayPulseAmp: 0.012,
};