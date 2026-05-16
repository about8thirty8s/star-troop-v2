// LAST HUNT: KILLBOX — Character Configuration
// Each character has distinct body proportions, thermal signature, and weapon identity.

export const CHARACTERS = {
  mac: {
    id: "mac",
    displayName: "MAC",
    weaponId: "m60",
    role: "Suppressive Fire",
    description: "Heavy rifleman. Loud, steady, dangerous.",
    stats: {
      health: 100,
      speed: 0.95,
      stamina: 0.9,
      recoilControl: 0.85,
      trapSpeed: 0.8
    },
    // Visual identity
    color: "#8a4a3a",
    skinColor: "#c9a876",
    barkProfile: "aggressive",
    // Body proportions (pixel offsets from centre-bottom)
    body: {
      w: 14, h: 26,           // broad, medium-tall
      shoulderW: 16,          // extra shoulder bulk
      headW: 9, headH: 9,
      legSpread: 6,
    },
    // Gear detail
    gear: 'bandolier',        // rendered as diagonal strap + ammo loops
    headGear: 'boonie',       // wide-brimmed hat
    // Thermal
    thermalRx: 22, thermalRy: 28,
    thermalColor: [255, 200, 60],
    // Weapon carry
    weaponYOffset: -8,        // carry height relative to mid-body
    muzzleXOffset: 18,
  },

  ponchi: {
    id: "ponchi",
    displayName: "PONCHI",
    weaponId: "grenade_launcher",
    role: "Demolition",
    description: "Explosive specialist. Opens terrain and ruins plans.",
    stats: {
      health: 90,
      speed: 1.0,
      stamina: 1.0,
      recoilControl: 0.75,
      trapSpeed: 0.9
    },
    color: "#3a5a6a",
    skinColor: "#c9a876",
    barkProfile: "nervous",
    body: {
      w: 13, h: 22,           // stockier, slightly shorter
      shoulderW: 13,
      headW: 8, headH: 8,
      legSpread: 5,
    },
    gear: 'demolition_pack',  // square pack on back + grenade belt
    headGear: 'helmet',
    thermalRx: 19, thermalRy: 25,
    thermalColor: [255, 180, 40],
    weaponYOffset: -7,
    muzzleXOffset: 20,
  },

  annie: {
    id: "annie",
    displayName: "ANNIE",
    weaponId: "m16_m203",
    role: "Field Leader",
    description: "Balanced rifle work with explosive backup.",
    stats: {
      health: 95,
      speed: 1.05,
      stamina: 1.05,
      recoilControl: 1.0,
      trapSpeed: 1.0
    },
    color: "#4a6a3a",
    skinColor: "#c9a876",
    barkProfile: "focused",
    body: {
      w: 10, h: 24,           // leaner, taller stance
      shoulderW: 11,
      headW: 7, headH: 8,
      legSpread: 4,
    },
    gear: 'vest',             // tactical vest with chest pouches
    headGear: 'bandana',      // red bandana (distinct)
    thermalRx: 15, thermalRy: 24,
    thermalColor: [255, 220, 80],
    weaponYOffset: -9,
    muzzleXOffset: 16,
  },

  blaze: {
    id: "blaze",
    displayName: "BLAZE",
    weaponId: "minigun",
    role: "Heavy Gunner",
    description: "Slow spin-up. Terrifying firepower.",
    stats: {
      health: 110,
      speed: 0.82,
      stamina: 0.8,
      recoilControl: 0.7,
      trapSpeed: 0.65
    },
    color: "#8a5a2a",
    skinColor: "#c9a876",
    barkProfile: "reckless",
    body: {
      w: 17, h: 28,           // largest/heaviest
      shoulderW: 20,
      headW: 10, headH: 9,
      legSpread: 7,
    },
    gear: 'ammo_belt',        // huge belt over shoulder + forearm wraps
    headGear: 'wrap',         // head wrap
    thermalRx: 26, thermalRy: 30,
    thermalColor: [255, 140, 20],
    weaponYOffset: -6,
    muzzleXOffset: 22,
  }
};

export const CHARACTER_ORDER = ["mac", "ponchi", "annie", "blaze"];