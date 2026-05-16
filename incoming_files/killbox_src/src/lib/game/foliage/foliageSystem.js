// LAST HUNT: KILLBOX - Foliage System
// Manages destructible foliage instances: grasses, ferns, shrubs, vines

import { FOLIAGE_CONFIG, FOLIAGE_TYPES } from '../config/foliage.config';
import { TILE_SIZE } from '../constants';
import { emit } from '../core/eventBus';

export function createFoliage(type, x, y) {
  const config = FOLIAGE_CONFIG[type];
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
    
    // Behavior
    destroyed: false,
    swayPhase: Math.random() * Math.PI * 2,
    flattenAmount: 0,  // for grasses
    climbable: config.climbable || false,
    hidesFoliage: config.hidesFoliage || false,
    
    // Config reference
    config,
  };
}

export function damageFoliage(foliage, damage, damageType = 'generic') {
  if (!foliage.alive || foliage.destroyed) return false;
  
  foliage.health -= damage;
  
  if (foliage.health <= 0) {
    foliage.destroyed = true;
    foliage.alive = false;
    emit('FOLIAGE_DESTROYED', { foliage: foliage.type, x: foliage.x, y: foliage.y, yields: foliage.config?.yields });
    return true;
  }
  return false;
}


// ── chopFoliage — F-key single chop action ───────────────────────────────────
// Awards fractional yields via accumulator on the player object.
// Returns { destroyed, resources } where resources = { rope, wood, ... } awarded this hit.
export function chopFoliage(foliage, player, particles) {
  if (!foliage.alive || foliage.destroyed) return { destroyed: false, resources: {} };

  foliage.chopHitsDealt = (foliage.chopHitsDealt || 0) + 1;
  const destroyed = damageFoliage(foliage, 1, 'machete');
  createFoliageParticles(foliage, destroyed ? 10 : 4, particles);
  foliage.hitFlash = 6;

  const awarded = {};
  if (destroyed && foliage.config && foliage.config.yields) {
    if (!player._foliageYieldAccum) player._foliageYieldAccum = {};
    const accum = player._foliageYieldAccum;
    for (const [res, amount] of Object.entries(foliage.config.yields)) {
      accum[res] = (accum[res] || 0) + amount;
      const whole = Math.floor(accum[res]);
      if (whole > 0) {
        accum[res] -= whole;
        player.resources[res] = (player.resources[res] || 0) + whole;
        awarded[res] = whole;
      }
    }
  }
  return { destroyed, resources: awarded };
}

// ── findNearestChoppableFoliage ───────────────────────────────────────────────
// Returns closest alive destructible foliage within horizontal range of player.
export function findNearestChoppableFoliage(player, foliageList, range = 44) {
  if (!foliageList || foliageList.length === 0) return null;
  const px = player.x + (player.w || 8) / 2;
  const py = player.y + (player.h || 24);
  let nearest = null; let nearestDist = Infinity;
  for (const f of foliageList) {
    if (!f.alive || f.destroyed) continue;
    if (!f.config || !f.config.destructible) continue;
    const fx = f.x + f.w / 2;
    const fy = f.y + f.h / 2;
    const horizDist = Math.abs(px - fx);
    const vertDist  = Math.abs(py - fy);
    if (horizDist < range && vertDist < 64) {
      const dist = Math.hypot(px - fx, py - fy);
      if (dist < nearestDist) { nearest = f; nearestDist = dist; }
    }
  }
  return nearest;
}

export function updateFoliage(foliage, particles) {
  if (!foliage.alive) return;

  // Sway animation (wind effect)
  if (foliage.config.sway) {
    foliage.swayPhase += 0.02;
  }

  // Flatten decay for crushed grass
  if (foliage.flattenAmount > 0) {
    foliage.flattenAmount = Math.max(0, foliage.flattenAmount - 0.02);
  }
}

export function createFoliageParticles(foliage, count, particles) {
  const config = foliage.config;
  const fxType = config.destroyFx || 'debris';
  
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    
    let color = '#2a6a2a';  // default green
    if (foliage.type.includes('grass')) color = '#3a8a2a';
    if (foliage.type === FOLIAGE_TYPES.FERN) color = '#2e6a2e';
    if (foliage.type === FOLIAGE_TYPES.SHRUB) color = '#1e4a1e';
    if (foliage.type.includes('vine')) color = '#2a5a1a';
    if (foliage.type === FOLIAGE_TYPES.REED) color = '#4a6a3a';

    particles.push({
      x: foliage.x + foliage.w / 2,
      y: foliage.y + foliage.h / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1,
      life: 20 + Math.random() * 15,
      color,
      size: 2 + Math.random() * 2,
      type: 'debris',
    });
  }
}

const foliageSpriteCache = {};

function loadFoliageSprite(url) {
  if (foliageSpriteCache[url]) return foliageSpriteCache[url];
  const img = new Image();
  img.failed = false;
  img.onerror = () => { img.failed = true; };
  img.src = url;
  foliageSpriteCache[url] = img;
  return img;
}

export function renderFoliage(ctx, foliage, cameraX, cameraY) {
  if (!foliage.alive) return;

  // Already inside world-space transform — use world coords directly
  const swayOff = foliage.config.sway ? Math.sin(foliage.swayPhase) * 1.5 : 0;

  // Decay hit flash counter
  if (foliage.hitFlash > 0) foliage.hitFlash--;

  ctx.save();
  ctx.translate(foliage.x + swayOff, foliage.y);
  // Hit flash whitens the plant briefly
  ctx.globalAlpha = foliage.hitFlash > 0 ? 1.0 : 0.85;
  if (foliage.hitFlash > 0) {
    ctx.filter = 'brightness(3) saturate(0.2)';
  }

  // Try sprite — only draw if loaded AND not errored
  if (foliage.config.spriteUrl) {
    const img = loadFoliageSprite(foliage.config.spriteUrl);
    if (!img.failed && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
      ctx.drawImage(img, -foliage.w / 2, -foliage.h, foliage.w, foliage.h);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }
    // Sprite missing / errored — fall through to procedural pixel art below
  }

  // Fallback to pixel art
  switch (foliage.type) {
    case FOLIAGE_TYPES.GRASS_CLUMP:
      ctx.fillStyle = '#3a8a2a';
      ctx.beginPath();
      ctx.moveTo(2, foliage.h);
      ctx.lineTo(4, 2);
      ctx.lineTo(6, foliage.h);
      ctx.lineTo(8, 0);
      ctx.lineTo(10, foliage.h);
      ctx.stroke();
      break;

    case FOLIAGE_TYPES.TALL_GRASS:
      ctx.fillStyle = '#38821e';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 5, foliage.h);
        ctx.lineTo(i * 5 + 2, 0);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      break;

    case FOLIAGE_TYPES.FERN:
      ctx.fillStyle = '#2e6a2e';
      // Left frond
      ctx.beginPath();
      ctx.moveTo(8, foliage.h);
      ctx.quadraticCurveTo(2, foliage.h / 2, 0, 2);
      ctx.lineWidth = 2;
      ctx.stroke();
      // Right frond
      ctx.beginPath();
      ctx.moveTo(8, foliage.h);
      ctx.quadraticCurveTo(14, foliage.h / 2, 16, 2);
      ctx.stroke();
      // Center stem
      ctx.strokeStyle = '#1e4a1e';
      ctx.beginPath();
      ctx.moveTo(8, foliage.h);
      ctx.lineTo(8, 0);
      ctx.lineWidth = 1;
      ctx.stroke();
      break;

    case FOLIAGE_TYPES.SHRUB:
      ctx.fillStyle = '#1e4a1e';
      ctx.beginPath();
      ctx.ellipse(foliage.w / 2, foliage.h / 2, foliage.w / 2.2, foliage.h / 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e6a2e';
      ctx.beginPath();
      ctx.ellipse(foliage.w / 2 - 2, foliage.h / 2 - 2, foliage.w / 3, foliage.h / 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;

    case FOLIAGE_TYPES.REED:
      ctx.fillStyle = '#4a6a3a';
      ctx.fillRect(2, 0, 4, foliage.h);
      ctx.fillStyle = '#5a7a4a';
      ctx.fillRect(3, foliage.h - 4, 2, 4);
      break;

    case FOLIAGE_TYPES.BUSH: {
      // Dense leafy bush — bright green, clearly visible rope source
      // Base dark mass
      ctx.fillStyle = '#1a4a18';
      ctx.fillRect(0, foliage.h * 0.4, foliage.w, foliage.h * 0.6);
      // Upper rounded canopy — 3 overlapping circles
      const bw = foliage.w, bh = foliage.h;
      const bumps = [
        { cx: bw * 0.25, cy: bh * 0.35, rx: bw * 0.28, ry: bh * 0.38 },
        { cx: bw * 0.58, cy: bh * 0.28, rx: bw * 0.30, ry: bh * 0.42 },
        { cx: bw * 0.82, cy: bh * 0.40, rx: bw * 0.24, ry: bh * 0.35 },
      ];
      for (const b of bumps) {
        ctx.fillStyle = '#2a6e22';
        ctx.beginPath();
        ctx.ellipse(b.cx, b.cy, b.rx, b.ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Highlight top of each bump
      for (const b of bumps) {
        ctx.fillStyle = '#3a8a2a';
        ctx.beginPath();
        ctx.ellipse(b.cx, b.cy - b.ry * 0.25, b.rx * 0.6, b.ry * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Small rope-hint accent — thin yellow-green wisps (signals rope loot)
      ctx.strokeStyle = '#7a9a30';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const tx = bw * (0.2 + i * 0.3);
        const ty = bh * 0.15;
        ctx.beginPath();
        ctx.moveTo(tx, ty + 4);
        ctx.lineTo(tx + 2, ty);
        ctx.lineTo(tx + 4, ty + 3);
        ctx.stroke();
      }
      break;
    }

    case FOLIAGE_TYPES.VINE_HANGING:
    case FOLIAGE_TYPES.VINE_CLIMBING:
      ctx.strokeStyle = '#2a5a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(3, 0);
      ctx.quadraticCurveTo(3 + swayOff, foliage.h / 2, 3, foliage.h);
      ctx.stroke();
      // Leaf accents
      ctx.fillStyle = '#3a7a2a';
      for (let i = 0; i < 4; i++) {
        const ty = (i / 4) * foliage.h;
        ctx.beginPath();
        ctx.ellipse(0, ty, 2, 3, -0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}