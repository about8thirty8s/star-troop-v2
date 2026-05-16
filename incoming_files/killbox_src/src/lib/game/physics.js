// LAST HUNT: KILLBOX - Physics System
import { TILE_SIZE, GRAVITY, MAX_FALL_SPEED, TILE } from './constants';
import { getTile, isSolid, setTile } from './worldGen';

export function applyGravity(entity) {
  entity.vy = Math.min(entity.vy + GRAVITY, MAX_FALL_SPEED);
}

export function moveEntity(entity, tiles) {
  // Horizontal movement
  const newX = entity.x + entity.vx;
  if (!checkCollision(newX, entity.y, entity.w, entity.h, tiles)) {
    entity.x = newX;
  } else {
    entity.vx = 0;
    // Try to step up — snap to top of blocking tile (partial steps work too)
    const stepY = Math.floor(entity.y / TILE_SIZE) * TILE_SIZE - 1;
    if (!checkCollision(newX, stepY - entity.h + 1, entity.w, entity.h, tiles)) {
      entity.x = newX;
      entity.y = stepY - entity.h + 1;
    }
  }

  // Vertical movement
  const newY = entity.y + entity.vy;
  if (!checkCollision(entity.x, newY, entity.w, entity.h, tiles)) {
    entity.y = newY;
    entity.onGround = false;
  } else {
    if (entity.vy > 0) {
      // Snap feet to the TOP of the tile they landed on.
      // feetY = newY + h → the tile row that blocked us:
      const feetTileTop = Math.floor((newY + entity.h - 1) / TILE_SIZE) * TILE_SIZE;
      entity.y = feetTileTop - entity.h;
      entity.onGround = true;
    }
    entity.vy = 0;
  }
}

export function checkCollision(x, y, w, h, tiles) {
  const left   = Math.floor(x / TILE_SIZE);
  const right  = Math.floor((x + w - 1) / TILE_SIZE);
  const top    = Math.floor(y / TILE_SIZE);
  const bottom = Math.floor((y + h - 1) / TILE_SIZE);

  for (let ty = top; ty <= bottom; ty++) {
    for (let tx = left; tx <= right; tx++) {
      if (isSolid(getTile(tiles, tx, ty))) {
        return true;
      }
    }
  }
  return false;
}

export function raycast(x1, y1, x2, y2, tiles, maxDist = 500) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.min(Math.ceil(dist / 4), maxDist / 4);
  if (steps === 0) return { hit: false, x: x2, y: y2, dist: 0 };
  const sx = dx / steps;
  const sy = dy / steps;

  for (let i = 0; i < steps; i++) {
    const cx = x1 + sx * i;
    const cy = y1 + sy * i;
    const tx = Math.floor(cx / TILE_SIZE);
    const ty = Math.floor(cy / TILE_SIZE);
    if (isSolid(getTile(tiles, tx, ty))) {
      return { hit: true, x: cx, y: cy, dist: i * 4 };
    }
  }
  return { hit: false, x: x2, y: y2, dist };
}

// Arrow / projectile physics
export function updateProjectile(proj, tiles) {
  proj.vx += (proj.wind || 0) * 0.01;
  proj.vy += GRAVITY * (proj.gravityScale || 1);
  proj.x += proj.vx;
  proj.y += proj.vy;
  proj.angle = Math.atan2(proj.vy, proj.vx);

  const tx = Math.floor(proj.x / TILE_SIZE);
  const ty = Math.floor(proj.y / TILE_SIZE);

  if (isSolid(getTile(tiles, tx, ty))) {
    proj.stuck = true;
    return true;
  }
  return false;
}

// ─── EXPLOSION + CRATER + FIRE ─────────────────────────────────────────────

export function createExplosion(x, y, radius, tiles, particles, firePatches, props = []) {
  const tileRadius = Math.ceil(radius / TILE_SIZE);
  const cx = Math.floor(x / TILE_SIZE);
  const cy = Math.floor(y / TILE_SIZE);

  for (let ty = cy - tileRadius; ty <= cy + tileRadius; ty++) {
    for (let tx = cx - tileRadius; tx <= cx + tileRadius; tx++) {
      const dist = Math.sqrt((tx - cx) ** 2 + (ty - cy) ** 2);
      if (dist <= tileRadius) {
        const tile = getTile(tiles, tx, ty);
        if (tile !== 0 && tile !== TILE.STONE) {
          tiles[ty][tx] = TILE.AIR;
          // Spawn fire on flammable tiles at crater edge
          if (firePatches && dist > tileRadius * 0.5 &&
              (tile === TILE.GRASS || tile === TILE.LEAVES || tile === TILE.WOOD) &&
              Math.random() > 0.5) {
            firePatches.push({
              x: tx * TILE_SIZE, y: ty * TILE_SIZE,
              life: 120 + Math.random() * 120,
              spreadTimer: 60 + Math.random() * 60,
            });
          }
        }
      }
    }
  }

  // Debris chunks
  for (let i = 0; i < 28; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      life: 30 + Math.random() * 30,
      color: Math.random() > 0.5 ? '#ff6600' : '#ffaa00',
      size: 2 + Math.random() * 4,
      type: 'explosion',
    });
  }
  // Dirt chunks
  for (let i = 0; i < 14; i++) {
    const angle = Math.random() * Math.PI * 2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * (2 + Math.random() * 5),
      vy: Math.sin(angle) * (2 + Math.random() * 5) - 2,
      life: 20 + Math.random() * 20,
      color: '#4a3728', size: 4 + Math.random() * 5, type: 'debris',
    });
  }
  // Smoke
  for (let i = 0; i < 18; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * radius,
      y: y + (Math.random() - 0.5) * radius,
      vx: (Math.random() - 0.5) * 2,
      vy: -1.5 - Math.random() * 2,
      life: 50 + Math.random() * 50,
      color: '#333333',
      size: 5 + Math.random() * 10,
      type: 'smoke',
    });
  }

  // Apply impulse to movable rocks
  if (props && props.length > 0) {
    for (const prop of props) {
      if (!prop.physics || !prop.physics.movable) continue;
      
      const dx = prop.x + prop.w / 2 - x;
      const dy = prop.y + prop.h / 2 - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < radius) {
        const distFactor = 1 - (dist / radius);
        const explosionPower = 20; // base explosion force
        const force = (explosionPower * distFactor * prop.physics.explosionForceMultiplier) / prop.physics.mass;
        
        // Apply horizontal impulse
        const dirX = dx / (dist || 1);
        const dirY = dy / (dist || 1);
        prop.vx = (prop.vx || 0) + dirX * force;
        prop.vy = (prop.vy || 0) + dirY * force;
        
        // Apply upward kick
        prop.vy -= force * 0.35;
        
        // Mark as moving
        prop.state = 'moving';
      }
    }
  }
}

// ─── FIRE SYSTEM ────────────────────────────────────────────────────────────

export function updateFire(firePatches, tiles, particles) {
  for (let i = firePatches.length - 1; i >= 0; i--) {
    const f = firePatches[i];
    f.life--;

    // Flame particles (performance-capped)
    if (f.life % 3 === 0) {
      const bright = f.life > 40 ? '#ff6600' : (f.life > 20 ? '#cc4400' : '#882200');
      particles.push({
        x: f.x + Math.random() * TILE_SIZE,
        y: f.y + TILE_SIZE - Math.random() * 4,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -1 - Math.random() * 2,
        life: 14 + Math.random() * 10,
        color: bright, size: 2 + Math.random() * 3, type: 'fire',
      });
    }

    // Slow spread to adjacent flammable tiles
    f.spreadTimer--;
    if (f.spreadTimer <= 0 && f.life > 40) {
      f.spreadTimer = 999; // spread once only
      const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
      for (const [ddx, ddy] of dirs) {
        if (Math.random() > 0.5) continue;
        const nx = Math.floor(f.x / TILE_SIZE) + ddx;
        const ny = Math.floor(f.y / TILE_SIZE) + ddy;
        const t = getTile(tiles, nx, ny);
        if (t === TILE.GRASS || t === TILE.LEAVES) {
          // Only spread if under fire cap
          if (firePatches.length < 60) {
            firePatches.push({
              x: nx * TILE_SIZE, y: ny * TILE_SIZE,
              life: 60 + Math.random() * 80,
              spreadTimer: 9999,
            });
          }
        }
      }
    }

    if (f.life <= 0) firePatches.splice(i, 1);
  }
}

export function checkFireDamage(firePatches, entity) {
  let damaged = false;
  const ex = entity.x + entity.w / 2;
  const ey = entity.y + entity.h / 2;
  for (const f of firePatches) {
    if (ex > f.x && ex < f.x + TILE_SIZE &&
        ey > f.y && ey < f.y + TILE_SIZE) {
      damaged = true;
      break;
    }
  }
  return damaged;
}

// ─── MOVING PROP PHYSICS ────────────────────────────────────────────────────

export function updateMovingProp(prop, tiles) {
  if (!prop.vx && !prop.vy) return; // stationary
  
  const physics = prop.physics;
  if (!physics) return;

  // Apply gravity
  prop.vy = Math.min(prop.vy + GRAVITY * 0.5, MAX_FALL_SPEED);

  // Apply friction
  prop.vx *= physics.friction;
  if (Math.abs(prop.vx) < 0.15) prop.vx = 0;

  // Move horizontally
  const newX = prop.x + prop.vx;
  if (!checkCollision(newX, prop.y, prop.w, prop.h, tiles)) {
    prop.x = newX;
  } else {
    prop.vx *= -physics.bounce; // bounce back
  }

  // Move vertically
  const newY = prop.y + prop.vy;
  if (!checkCollision(prop.x, newY, prop.w, prop.h, tiles)) {
    prop.y = newY;
    prop.onGround = false;
  } else {
    if (prop.vy > 0) {
      // Land on surface
      const groundTileTop = Math.floor((newY + prop.h - 1) / TILE_SIZE) * TILE_SIZE;
      prop.y = groundTileTop - prop.h;
      prop.onGround = true;
      prop.vy *= physics.bounce;
      if (Math.abs(prop.vy) < 0.5) prop.vy = 0;
    } else {
      prop.vy = 0;
    }
  }

  // Stop if speed is negligible
  const speed = Math.sqrt(prop.vx * prop.vx + prop.vy * prop.vy);
  if (speed < 0.1) {
    prop.vx = 0;
    prop.vy = 0;
    prop.state = 'static';
  }
}

// Check if moving prop collides with entity (for damage)
export function checkPropEntityCollision(prop, entity) {
  const speed = Math.sqrt(prop.vx * prop.vx + prop.vy * prop.vy);
  if (speed < (prop.physics?.minSpeedForDamage || 1)) return null;
  
  const propCenterX = prop.x + prop.w / 2;
  const propCenterY = prop.y + prop.h / 2;
  const entityCenterX = entity.x + entity.w / 2;
  const entityCenterY = entity.y + entity.h / 2;
  
  const dx = propCenterX - entityCenterX;
  const dy = propCenterY - entityCenterY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = (prop.w + entity.w) / 3;
  
  if (dist < minDist) {
    return {
      damage: prop.physics?.crushDamage || 10,
      knockbackX: (dx / (dist || 1)) * speed,
      knockbackY: (dy / (dist || 1)) * speed,
    };
  }
  return null;
}