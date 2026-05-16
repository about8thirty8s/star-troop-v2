// LAST HUNT: KILLBOX — Firearm System Configuration
// All weapon tuning lives here for easy balancing

export const WEAPONS_CONFIG = {
  // ── SHOTGUN ──
  shotgun: {
    id: 'shotgun',
    displayName: 'SHOTGUN',
    category: 'shotgun',
    ammoType: 'shells',
    magazineSize: 8,
    reserveAmmo: 24,
    fireRate: 0.5,        // seconds between shots
    reloadTime: 2.2,
    bulletDamage: 18,
    pelletCount: 8,       // shells spread into pellets
    spread: 0.15,         // radians, wide spray
    recoil: 2.0,          // strong kickback
    bulletSpeed: 14,
    bulletPenetration: 0.6,
    woodDamage: 1.8,
    treeDamage: 2.2,
    hunterDamage: 1.0,    // multiplier to base damage
    noiseRadius: 400,
    secondary: 'slug',    // alternate fire mode
    secondary_pelletCount: 1,
    secondary_spread: 0.02,
    secondary_bulletDamage: 32,
    secondary_penetration: 1.0,
  },

  // ── MP5 ──
  mp5: {
    id: 'mp5',
    displayName: 'MP5',
    category: 'smg',
    ammoType: 'smg',
    magazineSize: 30,
    reserveAmmo: 150,
    fireRate: 0.08,       // fast auto
    reloadTime: 1.4,
    bulletDamage: 8,
    pelletCount: 1,
    spread: 0.08,
    recoil: 0.4,
    bulletSpeed: 16,
    bulletPenetration: 0.3,
    woodDamage: 0.4,
    treeDamage: 0.3,
    hunterDamage: 1.0,
    noiseRadius: 250,
    secondary: 'burst',   // 3-round burst
    secondary_rateMultiplier: 1.0,  // fire rate during burst
  },

  // ── GRENADE LAUNCHER ──
  grenade_launcher: {
    id: 'grenade_launcher',
    displayName: 'GRENADE LAUNCHER',
    category: 'launcher',
    ammoType: 'grenades',
    magazineSize: 6,
    reserveAmmo: 18,
    fireRate: 0.8,
    reloadTime: 2.5,
    bulletDamage: 40,
    pelletCount: 1,
    spread: 0.01,         // very accurate
    recoil: 1.5,
    bulletSpeed: 10,      // slow arc
    bulletPenetration: 0.0,
    explosionRadius: 80,
    explosionDamage: 50,
    fireRadius: 60,
    hunterDamage: 1.5,
    noiseRadius: 500,
    secondary: 'bounce',  // delayed/bouncing grenade
    secondary_detonateDelay: 2.0,  // seconds
  },

  // ── M16 WITH M203 ──
  m16_m203: {
    id: 'm16_m203',
    displayName: 'M16/M203',
    category: 'rifle',
    ammoType: 'rifle',
    magazineSize: 20,
    reserveAmmo: 180,
    fireRate: 0.1,        // semi-auto / controlled
    reloadTime: 1.8,
    bulletDamage: 16,
    pelletCount: 1,
    spread: 0.04,         // tight
    recoil: 0.6,
    bulletSpeed: 18,
    bulletPenetration: 0.7,
    woodDamage: 0.9,
    treeDamage: 1.2,
    hunterDamage: 1.0,
    noiseRadius: 350,
    secondary: 'grenade', // underbarrel M203
    secondary_grenadeAmmo: 6,
    secondary_explosionRadius: 70,
    secondary_explosionDamage: 45,
  },

  // ── MINIGUN ──
  minigun: {
    id: 'minigun',
    displayName: 'MINIGUN',
    category: 'minigun',
    ammoType: 'minigun',
    magazineSize: 200,
    reserveAmmo: 400,
    fireRate: 0.05,       // extremely fast
    spinUpTime: 0.3,      // barrel spin delay before firing
    reloadTime: 3.5,
    bulletDamage: 10,
    pelletCount: 1,
    spread: 0.12,         // increases during fire
    recoil: 1.2,
    bulletSpeed: 16,
    bulletPenetration: 0.4,
    woodDamage: 1.5,      // shreds wood
    treeDamage: 1.8,
    hunterDamage: 1.0,
    noiseRadius: 600,
    movementSlowdown: 0.6, // slows player while firing
    screenShakeIntensity: 0.8,
    secondary: 'aim',     // stabilize aim / reduce recoil
    secondary_spreadReduction: 0.5,
  },

  // ── PISTOL (universal sidearm) ──
  pistol: {
    id: 'pistol',
    displayName: 'PISTOL',
    category: 'pistol',
    ammoType: 'pistol',
    magazineSize: 12,
    reserveAmmo: 12,  // 1 spare mag (2 total clips)
    fireRate: 0.22,
    reloadTime: 1.1,
    bulletDamage: 12,
    pelletCount: 1,
    spread: 0.02,
    recoil: 0.25,
    bulletSpeed: 16,
    bulletPenetration: 0.3,
    woodDamage: 0.1,
    treeDamage: 0.1,
    hunterDamage: 0.8,
    noiseRadius: 200,
  },

  // ── EXPLOSIVE ARROW (BOW AMMO) ──
  explosive_arrow: {
    id: 'explosive_arrow',
    displayName: 'EXP ARROW',
    category: 'ammo',
    ammoType: 'explosive_arrow',
    damage: 55,
    explosionRadius: 48,
    terrainRadius: 28,
    fuseTime: 0.4,            // delay before explosion
    firePatchChance: 0.45,    // 45% chance to ignite fire
    noiseRadius: 220,
    projectileSpeed: 10,      // slightly slower than standard arrow for weight
    gravityScale: 0.5,        // slightly more gravity
    pierceArmor: false,
    hunterDamage: 1.4,        // slightly more effective vs hunter
    treeDamage: 2.0,          // strong vs vegetation
    foliageDamage: 3.0,       // clears leaves fast
  },
};

// Weapon rarity for loot table
export const WEAPON_CRATE_LOOT = [
  { id: 'shotgun', weight: 1.0 },
  { id: 'mp5', weight: 1.0 },
  { id: 'grenade_launcher', weight: 0.75 },
  { id: 'm16_m203', weight: 0.75 },
  { id: 'minigun', weight: 0.25 }, // rare cursed jungle lawnmower
];

export function getRandomWeapon() {
  const totalWeight = WEAPON_CRATE_LOOT.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const weapon of WEAPON_CRATE_LOOT) {
    roll -= weapon.weight;
    if (roll <= 0) return weapon.id;
  }
  return WEAPON_CRATE_LOOT[0].id; // fallback
}