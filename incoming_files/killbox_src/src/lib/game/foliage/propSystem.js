// LAST HUNT: KILLBOX - Props System
// Manages destructible level objects: rocks, logs, stumps, roots

import { PROP_CONFIG, PROP_TYPES } from '../config/props.config';
import { emit } from '../core/eventBus';

export function createProp(type, x, y) {
  const config = PROP_CONFIG[type];
  if (!config) return null;

  return {
    id: Math.random().toString(36).slice(2, 9),
    type,
    x, y,
    w: config.w,
    h: config.h,
    health: config.health,
    maxHealth: config.health,
    alive: true,
    destroyed: false,
    
    // Behavior
    climbable: config.climbable || false,
    blocksMovement: config.blocksMovement,
    blocksBullets: config.blocksBullets,
    flammable: config.flammable,
    
    // Physics (for movable rocks)
    vx: 0,
    vy: 0,
    onGround: true,
    state: 'static',
    physics: config.physics || null,
    
    // Config reference
    config,
  };
}

export function damageProp(prop, damage, damageType = 'generic') {
  if (!prop.alive || prop.destroyed) return false;
  
  // Rocks resist light damage
  if (prop.config.needsExplosion && damageType !== 'explosion' && damageType !== 'plasma') {
    return false;
  }
  
  prop.health -= damage;
  
  if (prop.health <= 0) {
    prop.destroyed = true;
    prop.alive = false;
    emit('PROP_DESTROYED', { prop: prop.type, x: prop.x, y: prop.y });
    return true;
  }
  return false;
}

export function createPropParticles(prop, count, particles) {
  const config = prop.config;
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 1.5 + Math.random() * 4;
    
    let color = '#8a8a8a';  // default stone
    let size = 2;
    
    if (prop.type.includes('rock') || prop.type.includes('boulder')) {
      color = '#6a6a6a';
      size = 2 + Math.random() * 3;
    } else if (prop.type.includes('log') || prop.type.includes('stump') || prop.type.includes('branch')) {
      color = '#8a6a3a';
      size = 2 + Math.random() * 2;
    } else if (prop.type === PROP_TYPES.ROOT_CLUSTER) {
      color = '#7a5a2a';
      size = 2 + Math.random() * 2;
    }

    particles.push({
      x: prop.x + prop.w / 2,
      y: prop.y + prop.h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      life: 25 + Math.random() * 20,
      color,
      size,
      type: 'debris',
    });
  }
}

export function renderProp(ctx, prop, cameraX, cameraY) {
  if (!prop.alive) return;

  // Already inside world-space transform — use world coords directly
  ctx.save();
  ctx.translate(prop.x, prop.y);
  ctx.globalAlpha = 0.9;

  switch (prop.type) {
    case PROP_TYPES.SMALL_ROCK:
      ctx.fillStyle = '#7a7a7a';
      ctx.beginPath();
      ctx.ellipse(prop.w / 2, prop.h / 2, prop.w / 2.2, prop.h / 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(4, 4, 4, 3);
      break;

    case PROP_TYPES.MEDIUM_ROCK:
      ctx.fillStyle = '#6a6a6a';
      ctx.beginPath();
      ctx.ellipse(prop.w / 2, prop.h / 2, prop.w / 2.2, prop.h / 2.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8a8a8a';
      ctx.fillRect(6, 6, 6, 5);
      ctx.fillRect(16, 10, 5, 4);
      break;

    case PROP_TYPES.LARGE_BOULDER:
      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath();
      ctx.ellipse(prop.w / 2, prop.h / 2, prop.w / 2.1, prop.h / 2.3, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a7a7a';
      ctx.fillRect(8, 8, 8, 7);
      ctx.fillRect(22, 14, 8, 6);
      break;

    case PROP_TYPES.HOLLOW_LOG:
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(0, 0, prop.w, prop.h);
      // Hollow opening
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(4, 3, prop.w - 8, prop.h - 6);
      ctx.fillStyle = '#6a5a2a';
      ctx.fillRect(4, 3, prop.w - 8, 2);
      break;

    case PROP_TYPES.FALLEN_LOG:
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(0, 0, prop.w, prop.h);
      ctx.fillStyle = '#7a5a2a';
      ctx.fillRect(0, 4, prop.w, 2);
      ctx.fillRect(0, 10, prop.w, 1);
      break;

    case PROP_TYPES.STUMP:
      ctx.fillStyle = '#8a6a3a';
      ctx.beginPath();
      ctx.ellipse(prop.w / 2, prop.h / 2, prop.w / 2.2, prop.h / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Growth rings
      ctx.strokeStyle = '#7a5a2a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(prop.w / 2, prop.h / 2, 4, 3, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;

    case PROP_TYPES.ROOT_CLUSTER:
      ctx.fillStyle = '#7a5a2a';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(prop.w / 2, prop.h);
        ctx.quadraticCurveTo(i * 10 - 5, prop.h / 2, i * 10, 0);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;

    case PROP_TYPES.FALLEN_BRANCH:
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(0, 3, prop.w, 5);
      // Side branches
      ctx.fillRect(12, 0, 2, 4);
      ctx.fillRect(24, 2, 2, 4);
      ctx.fillStyle = '#7a5a2a';
      ctx.fillRect(0, 4, prop.w, 2);
      break;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}