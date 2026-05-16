// LAST HUNT: KILLBOX — Weapon Crate System Configuration

export const CRATES_CONFIG = {
  spawnCount: 8,           // random crates per map
  crateHealth: 80,         // HP before breaking
  crateWidth: 16,
  crateHeight: 16,
  
  // Spawn rules
  minDistanceFromPlayer: 300,    // tiles away from insertion
  minDistanceFromOtherCrate: 150, // spacing between crates
  maxAttemptsToSpawn: 50,
  
  // Destruction
  breakParticleCount: 12,
  
  // Loot
  lootTable: 'weapon_crate',
};