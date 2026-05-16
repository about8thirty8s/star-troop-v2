// LAST HUNT: KILLBOX — Hand Grenade Physics System
import { TILE_SIZE, TILE } from './constants';
import { getTile, isSolid } from './worldGen';
import { emit } from './core/eventBus';

export const GRENADE_CONFIG = {
  fuseTime: 2.5,          // seconds
  minThrowPower: 180,
  maxThrowPower: 560,
  chargeTime: 1.0,        // seconds to reach max power
  gravityScale: 0.32,     // per-frame gravity on grenade (uses same GRAVITY constant scaled)
  bounce: 0.35,
  friction: 0.88,
  explosionRadius: 82,
  terrainRadius: 54,
  damage: 90,
  noiseRadius: 340,
};

// ── Throw State ──────────────────────────────────────────────────────────────

export function createGrenadeThrowState() {
  return {
    active: false,    // is player holding G
    chargeTime: 0,    // seconds held
    power: 0,         // 0-1
  };
}

export function startGrenadeCharge(throwState) {
  if (throwState.active) return;
  throwState.active = true;
  throwState.chargeTime = 0;
  throwState.power = 0;
}

export function updateGrenadeCharge(throwState, deltaTime) {
  if (!throwState.active) return;
  throwState.chargeTime = Math.min(throwState.chargeTime + deltaTime / 1000, GRENADE_CONFIG.chargeTime);
  throwState.power = throwState.chargeTime / GRENADE_CONFIG.chargeTime;
}

export function releaseGrenade(throwState, player, projectiles, particles, gameTime) {
  if (!throwState.active) return;
  throwState.active = false;

  const power = GRENADE_CONFIG.minThrowPower +
    throwState.power * (GRENADE_CONFIG.maxThrowPower - GRENADE_CONFIG.minThrowPower);

  // Throw at ~35° upward angle in facing direction
  const angleRad = -0.6; // ~35° above horizontal
  const vx = Math.cos(angleRad) * power * player.facing / 60;  // convert to px/frame
  const vy = Math.sin(angleRad) * power / 60;

  projectiles.push({
    x: player.x + player.w / 2 + player.facing * 8,
    y: player.y + player.h * 0.3,
    vx,
    vy,
    type: 'hand_grenade',
    damage: GRENADE_CONFIG.damage,
    explosionRadius: GRENADE_CONFIG.explosionRadius,
    terrainRadius: GRENADE_CONFIG.terrainRadius,
    noiseRadius: GRENADE_CONFIG.noiseRadius,
    fuseTimer: GRENADE_CONFIG.fuseTime,
    bounce: GRENADE_CONFIG.bounce,
    friction: GRENADE_CONFIG.friction,
    gravityScale: GRENADE_CONFIG.gravityScale,
    life: 600,
    owner: 'player',
    onGround: false,
  });

  throwState.chargeTime = 0;
  throwState.power = 0;

  emit('NOISE_EVENT', { x: player.x, y: player.y, radius: 80 });
}

// ── Grenade Projectile Update ────────────────────────────────────────────────
// Called from engine.js projectile loop for type === 'hand_grenade'

export function updateHandGrenade(proj, tiles, deltaTime) {
  const GRAVITY_PX = 0.38; // px/frame gravity for grenade

  proj.vy += GRAVITY_PX;
  const newX = proj.x + proj.vx;
  const newY = proj.y + proj.vy;

  const txNew = Math.floor(newX / TILE_SIZE);
  const tyNew = Math.floor(newY / TILE_SIZE);

  // Horizontal collision
  if (isSolid(getTile(tiles, Math.floor(newX / TILE_SIZE), Math.floor(proj.y / TILE_SIZE)))) {
    proj.vx *= -proj.bounce;
    proj.x -= proj.vx * 0.5;
  } else {
    proj.x = newX;
  }

  // Vertical collision
  if (isSolid(getTile(tiles, Math.floor(proj.x / TILE_SIZE), Math.floor(newY / TILE_SIZE)))) {
    if (proj.vy > 0) {
      proj.onGround = true;
      proj.vy *= -proj.bounce;
      if (Math.abs(proj.vy) < 0.4) proj.vy = 0;
      // Roll friction
      proj.vx *= proj.friction;
      if (Math.abs(proj.vx) < 0.1) proj.vx = 0;
    } else {
      proj.vy *= -0.2;
    }
  } else {
    proj.y = newY;
    proj.onGround = false;
  }

  // Fuse countdown
  proj.fuseTimer -= deltaTime / 1000;

  // Smoke trail while in air
  if (!proj.onGround && Math.random() > 0.6) {
    // returned so engine can add particle
    return { smokeAt: { x: proj.x, y: proj.y } };
  }

  return null;
}

// ── Terrain Crater ───────────────────────────────────────────────────────────

export function createGrenadeCrater(x, y, tiles, particles, firePatches, props = []) {
  const radius = GRENADE_CONFIG.terrainRadius;
  const tileRadius = Math.ceil(radius / TILE_SIZE);
  const cx = Math.floor(x / TILE_SIZE);
  const cy = Math.floor(y / TILE_SIZE);

  for (let ty = cy - tileRadius; ty <= cy + tileRadius; ty++) {
    for (let tx = cx - tileRadius; tx <= cx + tileRadius; tx++) {
      const dist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
      if (dist > tileRadius) continue;

      if (!tiles[ty] || tiles[ty][tx] === undefined) continue;
      const tile = tiles[ty][tx];
      if (tile === TILE.AIR) continue;

      if (tile === TILE.STONE || tile === TILE.METAL) {
        // Chip stone at crater edges only
        if (dist > tileRadius * 0.55 && Math.random() > 0.6) {
          tiles[ty][tx] = TILE.AIR;
        }
      } else if (tile === TILE.WATER) {
        // Splash — no crater
        for (let i = 0; i < 6; i++) {
          const ang = Math.random() * Math.PI * 2;
          particles.push({ x, y, vx: Math.cos(ang) * 4, vy: -3 - Math.random() * 3,
            life: 20, color: '#4a88cc', size: 3, type: 'debris' });
        }
      } else {
        // Dirt / wood / grass / leaves / mud — remove
        tiles[ty][tx] = TILE.AIR;

        // Fire patches at crater rim on flammable tiles
        if (dist > tileRadius * 0.4 &&
            (tile === TILE.GRASS || tile === TILE.LEAVES || tile === TILE.WOOD) &&
            Math.random() > 0.55) {
          firePatches.push({
            x: tx * TILE_SIZE, y: ty * TILE_SIZE,
            life: 100 + Math.random() * 100,
            spreadTimer: 80 + Math.random() * 40,
          });
        }

        // Dirt chunk particles
        if (Math.random() > 0.4) {
          const ang = Math.random() * Math.PI * 2;
          particles.push({
            x: tx * TILE_SIZE + TILE_SIZE / 2,
            y: ty * TILE_SIZE,
            vx: Math.cos(ang) * (2 + Math.random() * 6),
            vy: Math.sin(ang) * (2 + Math.random() * 6) - 4,
            life: 25 + Math.random() * 20,
            color: tile === TILE.GRASS ? '#2a5a14' : '#4a3728',
            size: 3 + Math.random() * 4,
            type: 'debris',
          });
        }
      }
    }
  }

  // Big smoke cloud
  for (let i = 0; i < 22; i++) {
    const ang = Math.random() * Math.PI * 2;
    const r = Math.random() * radius * 0.8;
    particles.push({
      x: x + Math.cos(ang) * r,
      y: y + Math.sin(ang) * r,
      vx: (Math.random() - 0.5) * 2,
      vy: -1.5 - Math.random() * 2.5,
      life: 60 + Math.random() * 60,
      color: '#333333',
      size: 6 + Math.random() * 12,
      type: 'smoke',
    });
  }

  // Explosion flash particles
  for (let i = 0; i < 30; i++) {
    const ang = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    particles.push({
      x, y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 3,
      life: 20 + Math.random() * 20,
      color: Math.random() > 0.5 ? '#ff6600' : '#ffcc00',
      size: 3 + Math.random() * 5,
      type: 'explosion',
    });
  }

  // Impulse to props
  if (props && props.length > 0) {
    for (const prop of props) {
      if (!prop.physics?.movable) continue;
      const dx = prop.x + prop.w / 2 - x;
      const dy = prop.y + prop.h / 2 - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius * 1.5) {
        const f = (1 - dist / (radius * 1.5)) * 22 * (prop.physics.explosionForceMultiplier || 1) / (prop.physics.mass || 1);
        prop.vx = (prop.vx || 0) + (dx / (dist || 1)) * f;
        prop.vy = (prop.vy || 0) + (dy / (dist || 1)) * f - f * 0.35;
        prop.state = 'moving';
      }
    }
  }
}

// ── Trajectory Preview ───────────────────────────────────────────────────────

export function getGrenadeTrajectoryPoints(player, throwState, tiles, screenW, screenH, camera) {
  if (!throwState.active) return [];

  const power = GRENADE_CONFIG.minThrowPower +
    throwState.power * (GRENADE_CONFIG.maxThrowPower - GRENADE_CONFIG.minThrowPower);

  const angleRad = -0.6;
  let vx = Math.cos(angleRad) * power * player.facing / 60;
  let vy = Math.sin(angleRad) * power / 60;
  let px = player.x + player.w / 2 + player.facing * 8;
  let py = player.y + player.h * 0.3;

  const points = [];
  const GRAVITY_PX = 0.38;
  const MAX_STEPS = 80;

  for (let i = 0; i < MAX_STEPS; i++) {
    vy += GRAVITY_PX;
    px += vx;
    py += vy;

    // Check terrain hit
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (isSolid(getTile(tiles, tx, ty))) {
      points.push({ x: px, y: py, hit: true });
      break;
    }

    points.push({ x: px, y: py, hit: false });
  }

  return points;
}

// Render arc preview (called from renderer in world-space after ctx.translate)
export function renderGrenadeArc(ctx, points, camera) {
  if (!points || points.length < 2) return;

  const t = Date.now() * 0.008;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const fade = 1 - i / points.length;

    if (p.hit) {
      // Landing indicator — blinking crosshair
      const blink = Math.sin(t * 3) > 0;
      ctx.save();
      ctx.globalAlpha = blink ? 0.9 : 0.4;
      ctx.strokeStyle = '#ff4400';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 8, p.y); ctx.lineTo(p.x + 8, p.y);
      ctx.moveTo(p.x, p.y - 8); ctx.lineTo(p.x, p.y + 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }

    // Dotted arc — every other dot
    if (i % 3 === 0) {
      ctx.save();
      ctx.globalAlpha = fade * 0.75;
      ctx.fillStyle = i % 6 === 0 ? '#ffcc44' : '#ff8800';
      ctx.fillRect(p.x - 1, p.y - 1, 3, 3);
      ctx.restore();
    }
  }
}