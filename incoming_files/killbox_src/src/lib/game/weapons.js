// LAST HUNT: KILLBOX — Firearm & Combat System
import { WEAPONS_CONFIG } from './config/weapons.config';
import { TILE_SIZE } from './constants';
import { emit } from './core/eventBus';

export function createPlayerWeaponState() {
  return {
    current: null,           // weapon id
    ammoInMag: 0,
    ammoReserve: 0,
    isReloading: false,
    reloadTimer: 0,
    lastFireTime: 0,
    spinUpTimer: 0,          // for minigun
    burstCounter: 0,         // for MP5 burst
    burstMode: false,
    secondaryAmmo: 0,        // for M203 grenades
  };
}

export function equipWeapon(weaponState, weaponId) {
  const weaponConfig = WEAPONS_CONFIG[weaponId];
  if (!weaponConfig) return false;

  weaponState.current = weaponId;
  weaponState.ammoInMag = weaponConfig.magazineSize;
  weaponState.ammoReserve = weaponConfig.reserveAmmo;
  weaponState.isReloading = false;
  weaponState.reloadTimer = 0;
  weaponState.lastFireTime = 0;

  // Secondary ammo (grenades for M203)
  if (weaponId === 'm16_m203') {
    weaponState.secondaryAmmo = 6;
  }

  return true;
}

export function canFireWeapon(weaponState, currentTime) {
  if (!weaponState.current) return false;
  if (weaponState.isReloading) return false;
  if (weaponState.ammoInMag <= 0) return false;

  const config = WEAPONS_CONFIG[weaponState.current];
  const timeSinceLastFire = currentTime - weaponState.lastFireTime;
  return timeSinceLastFire >= config.fireRate;
}

export function fireWeapon(weaponState, playerX, playerY, playerFacing, aimAngle, currentTime, particles, projectiles, screenShake) {
  if (!canFireWeapon(weaponState, currentTime)) return false;

  const weaponId = weaponState.current;
  const config = WEAPONS_CONFIG[weaponId];

  // Minigun spin-up
  if (weaponId === 'minigun') {
    if (weaponState.spinUpTimer < config.spinUpTime) {
      weaponState.spinUpTimer += 0.016;
      return false;
    }
  }

  // Consume ammo
  weaponState.ammoInMag--;
  weaponState.lastFireTime = currentTime;

  // Accumulate recoil bloom (decays in updateWeaponFiring via updateReload/tick)
  weaponState.recoilBloom = (weaponState.recoilBloom || 0) + config.recoil * 0.012;
  weaponState.recoilBloom = Math.min(weaponState.recoilBloom, config.spread * 3.5);

  // Emit noise for hunter
  emit('LOUD_WEAPON_FIRED', {
    x: playerX,
    y: playerY,
    radius: config.noiseRadius,
    weaponId,
  });

  // Screen shake — per-weapon character for maximum visceral feel
  if (screenShake) {
    const perWeaponShake = {
      pistol:       3.5,
      m16:          5.5,
      m16_m203:     6.5,
      m60:          10.0,
      minigun:      7.5,
      shotgun:      12.0,
      bow:          1.8,
      explosive_bow: 5.0,
    };
    const shotShake = perWeaponShake[weaponState.current] || (config.recoil * 4.5);
    screenShake.intensity = Math.max(screenShake.intensity, shotShake);
  }

  // Muzzle position — forward along aim angle from player centre
  const muzzleLen = 14;
  const startX = playerX + Math.cos(aimAngle) * muzzleLen;
  const startY = playerY + Math.sin(aimAngle) * muzzleLen;

  if (weaponId === 'shotgun') {
    fireShellRound(startX, startY, playerFacing, aimAngle, weaponState, config, particles, projectiles);
  } else if (weaponId === 'grenade_launcher') {
    fireGrenade(startX, startY, playerFacing, aimAngle, config, particles, projectiles);
  } else {
    fireBullet(startX, startY, playerFacing, aimAngle, weaponState, config, particles, projectiles);
  }

  // Muzzle flash particles
  createMuzzleFlash(startX, startY, aimAngle, playerFacing, config, particles);

  // Shell casing eject (not for launcher)
  if (weaponId !== 'grenade_launcher') {
    ejectCasing(startX, startY, aimAngle, playerFacing, config, particles);
  }

  // Auto-reload on empty
  if (weaponState.ammoInMag <= 0 && weaponState.ammoReserve > 0) {
    startReload(weaponState);
  }

  return true;
}

export function fireSecondary(weaponState, playerX, playerY, playerFacing, aimAngle, currentTime, particles, projectiles) {
  if (!weaponState.current) return false;

  const weaponId = weaponState.current;
  const config = WEAPONS_CONFIG[weaponId];
  const muzzleLen = 14;
  const startX = playerX + Math.cos(aimAngle) * muzzleLen;
  const startY = playerY + Math.sin(aimAngle) * muzzleLen;

  if (weaponId === 'shotgun') {
    // Slug — single high-pen round
    fireBullet(startX, startY, playerFacing, aimAngle, weaponState, {
      ...config,
      pelletCount: 1,
      spread: config.secondary_spread,
      bulletDamage: config.secondary_bulletDamage,
    }, particles, projectiles);
  } else if (weaponId === 'mp5') {
    // Burst fire — 3 rounds (approximate with spread each)
    for (let i = 0; i < 3; i++) {
      fireBullet(startX, startY, playerFacing, aimAngle, weaponState, config, particles, projectiles);
      if (weaponState.ammoInMag > 0) weaponState.ammoInMag--;
    }
  } else if (weaponId === 'grenade_launcher') {
    if (weaponState.ammoInMag > 0) {
      fireGrenade(startX, startY, playerFacing, aimAngle, { ...config, secondary_detonateDelay: 2.0 }, particles, projectiles);
      weaponState.ammoInMag--;
    }
  } else if (weaponId === 'm16_m203') {
    if (weaponState.secondaryAmmo > 0) {
      fireGrenade(startX, startY, playerFacing, aimAngle, config, particles, projectiles);
      weaponState.secondaryAmmo--;
    }
  }

  return true;
}

function fireBullet(startX, startY, facing, aimAngle, weaponState, config, particles, projectiles) {
  const bloom = (weaponState.recoilBloom || 0);
  const totalSpread = config.spread + bloom;

  for (let i = 0; i < config.pelletCount; i++) {
    const angle = aimAngle + (Math.random() - 0.5) * totalSpread;
    const spd = config.bulletSpeed;
    const vx = Math.cos(angle) * spd;
    const vy = Math.sin(angle) * spd;

    projectiles.push({
      x: startX,
      y: startY,
      vx,
      vy,
      type: 'bullet',
      damage: config.bulletDamage,
      penetration: config.bulletPenetration,
      woodDamage: config.woodDamage,
      treeDamage: config.treeDamage,
      hunterDamage: config.hunterDamage,
      weaponId: config.id,
      life: 60,   // in update ticks; projectile removed on tile hit or expiry
      owner: 'player',
      angle,      // store for tracer rendering
    });

    // Tracer — 1-in-3 chance for visual variety
    if (Math.random() < 0.35) {
      const tracerLen = 12 + Math.random() * 8;
      particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * spd * 0.9,
        vy: Math.sin(angle) * spd * 0.9,
        life: 6,
        color: config.id === 'minigun' ? '#ffffaa' : '#ffcc55',
        size: tracerLen,
        type: 'tracer',
        angle,
      });
    }
  }
}

function fireShellRound(startX, startY, facing, aimAngle, weaponState, config, particles, projectiles) {
  const bloom = (weaponState.recoilBloom || 0);
  for (let i = 0; i < config.pelletCount; i++) {
    const angle = aimAngle + (Math.random() - 0.5) * (config.spread + bloom);
    const vx = Math.cos(angle) * config.bulletSpeed;
    const vy = Math.sin(angle) * config.bulletSpeed;

    projectiles.push({
      x: startX,
      y: startY,
      vx,
      vy,
      type: 'pellet',
      damage: config.bulletDamage / config.pelletCount,
      penetration: config.bulletPenetration,
      woodDamage: config.woodDamage,
      life: 40,
      owner: 'player',
      angle,
    });
  }
}

function fireGrenade(startX, startY, facing, aimAngle, config, particles, projectiles) {
  // Clamp grenade angle — don't allow shooting straight back or too steeply down
  const vx = Math.cos(aimAngle) * config.bulletSpeed;
  const vy = Math.sin(aimAngle) * config.bulletSpeed - 2; // slight upward bias

  projectiles.push({
    x: startX,
    y: startY,
    vx,
    vy,
    type: 'grenade',
    damage: config.explosionDamage,
    explosionRadius: config.explosionRadius,
    fireRadius: config.fireRadius,
    weaponId: config.id,
    detonateDelay: config.secondary_detonateDelay || 1.5,
    life: 300,
    owner: 'player',
  });

  // Smoke puff at launch
  particles.push({
    x: startX,
    y: startY,
    vx: Math.cos(aimAngle) * 1.5,
    vy: Math.sin(aimAngle) * 1.5 - 0.5,
    life: 55,
    color: '#888866',
    size: 4,
    type: 'smoke',
  });
}

function createMuzzleFlash(x, y, aimAngle, facing, config, particles) {
  const isMinigun = config.id === 'minigun';
  const isShotgun = config.id === 'shotgun';
  const flashSize = isMinigun ? 7 : isShotgun ? 6 : 4;
  const flashColor = isMinigun ? '#ffffaa' : isShotgun ? '#ffeeaa' : '#ffcc44';
  const flashCount = isShotgun ? 3 : isMinigun ? 2 : 1;

  for (let f = 0; f < flashCount; f++) {
    const jitter = (Math.random() - 0.5) * 0.15;
    const fAngle = aimAngle + jitter;
    particles.push({
      x: x + Math.cos(fAngle) * 4,
      y: y + Math.sin(fAngle) * 4,
      vx: Math.cos(fAngle) * 3,
      vy: Math.sin(fAngle) * 3,
      life: 5 + Math.floor(Math.random() * 4),
      color: flashColor,
      size: flashSize + Math.random() * 3,
      type: 'muzzleFlash',
    });
  }

  // Smoke puff
  particles.push({
    x,
    y,
    vx: Math.cos(aimAngle) * 2 + (Math.random() - 0.5),
    vy: Math.sin(aimAngle) * 2 - 0.8,
    life: 18,
    color: '#777766',
    size: isShotgun ? 5 : 3,
    type: 'smoke',
  });
}

function ejectCasing(x, y, aimAngle, facing, config, particles) {
  // Eject perpendicular to aim direction, slightly upward
  const perpAngle = aimAngle - Math.PI / 2 * facing; // eject to the right side of firer
  const ejSpd = 1 + Math.random() * 1.2;
  particles.push({
    x,
    y,
    vx: Math.cos(perpAngle) * ejSpd + facing * -0.5,
    vy: Math.sin(perpAngle) * ejSpd - 0.8,
    life: 20 + Math.floor(Math.random() * 10),
    color: config.id === 'shotgun' ? '#cc8833' : '#ccaa44',
    size: config.id === 'shotgun' ? 3 : 2,
    type: 'casing',
  });
}

export function startReload(weaponState) {
  if (!weaponState.current || weaponState.isReloading) return;

  const config = WEAPONS_CONFIG[weaponState.current];
  if (weaponState.ammoReserve <= 0) return;

  weaponState.isReloading = true;
  weaponState.reloadTimer = config.reloadTime;
  weaponState.spinUpTimer = 0; // reset minigun spin
}

export function updateReload(weaponState, deltaTime) {
  // Decay recoil bloom over time
  if (weaponState.recoilBloom > 0) {
    const config = WEAPONS_CONFIG[weaponState.current];
    const decayRate = config ? (config.spread * 1.8) : 0.02;
    weaponState.recoilBloom = Math.max(0, weaponState.recoilBloom - decayRate * (deltaTime / 16));
  }

  if (!weaponState.isReloading) return;
  weaponState.reloadTimer -= deltaTime;
  if (weaponState.reloadTimer <= 0) {
    completeReload(weaponState);
  }
}

function completeReload(weaponState) {
  const config = WEAPONS_CONFIG[weaponState.current];
  const ammoNeeded = config.magazineSize - weaponState.ammoInMag;
  const ammoAvailable = Math.min(ammoNeeded, weaponState.ammoReserve);

  weaponState.ammoInMag += ammoAvailable;
  weaponState.ammoReserve -= ammoAvailable;
  weaponState.isReloading = false;
  weaponState.reloadTimer = 0;
}