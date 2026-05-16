// Mud Camouflage System Config
export const MUD_CONFIG = {
  // Mud coating duration in frames (60fps)
  durationSeconds: 60,
  durationFrames: 60 * 60,

  // Stealth multiplier for thermal detection
  // At full mud: hunter thermal lock is 35% as visible
  thermalVisibilityMultiplier: 0.35,

  // Lock-on speed penalty while muddy
  // At full mud: hunter lock takes 75% longer (1.75x multiplier)
  lockOnSlowMultiplier: 1.75,

  // Mud coating rate (per frame while standing on mud tile)
  mudCoatRate: 0.012,  // ~5 seconds to reach full mud at 60fps

  // Mud decay rates
  mudDecayPerFrame: 1.0 / (60 * 60),  // 1.0 / (60fps * 60 seconds)

  // Visual appearance stages
  mudStages: {
    full: { threshold: 0.70, opacity: 0.8, color: '#2a1a0a' },
    heavy: { threshold: 0.40, opacity: 0.6, color: '#3a2a15' },
    partial: { threshold: 0.10, opacity: 0.3, color: '#4a3a25' },
    light: { threshold: 0.0, opacity: 0.1, color: '#5a4a35' },
  },

  // Mud drip particle frequency (frames between spawns)
  dripParticleFrequency: 8,
  dripParticleLife: 20,
};