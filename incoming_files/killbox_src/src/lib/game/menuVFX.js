// LAST HUNT: KILLBOX — Menu Cinematic VFX
// All systems are self-contained. Call initMenuVFX() once, then renderMenuVFX(ctx, W, H) each frame.

// ─── WEATHER STATES ──────────────────────────────────────────────────────────
const WEATHER = { CLEAR: 0, RAIN: 1, STORM: 2, MIST: 3 };

// ─── STATE ───────────────────────────────────────────────────────────────────
let leaves = [];
let rainDrops = [];
let puddles = [];
let dustMotes = [];
let fireflies = [];
let fogLayers = [];
let clouds = [];

let weather = WEATHER.CLEAR;
let weatherTimer = 0;
let weatherTransition = 0; // 0→1 blend
let nextWeather = WEATHER.CLEAR;

let windPhase = 0;           // overall wind oscillation
let windGust = 0;            // gust multiplier 0..1
let gustTimer = 0;

let lightningTimer = 0;      // countdown to next bolt
let lightningFlash = 0;      // current flash brightness 0..1
let lightningX = 0;

let godRayPhase = 0;
let sunGlowPhase = 0;
let cloakShimmerTimer = 0;   // "something watching" shimmer
let cloakShimmerX = 0;
let cloakShimmerY = 0;

const LEAF_COLORS = ['#3a6a1a','#4a8a2a','#2a5a12','#5a7a2a','#6a9a3a','#8a7a2a'];

export function initMenuVFX(W, H) {
  leaves = [];
  rainDrops = [];
  puddles = [];
  dustMotes = [];
  fireflies = [];
  fogLayers = [];
  clouds = [];

  // Seed leaves
  for (let i = 0; i < 18; i++) spawnLeaf(W, H, true);

  // Seed dust motes
  for (let i = 0; i < 35; i++) {
    dustMotes.push({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.1 - Math.random() * 0.2,
      size: 1,
      life: Math.random(),        // 0..1 phase
      maxLife: 200 + Math.random() * 300,
      alpha: 0.15 + Math.random() * 0.2,
      layer: Math.random() < 0.4 ? 'fg' : 'bg',
    });
  }

  // Fireflies (start hidden, appear during storm transitions)
  for (let i = 0; i < 12; i++) {
    fireflies.push({
      x: Math.random() * W,
      y: H * 0.3 + Math.random() * H * 0.5,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.02 + Math.random() * 0.03,
    });
  }

  // Fog layers
  for (let i = 0; i < 4; i++) {
    fogLayers.push({
      x: Math.random() * W * 2 - W,
      y: H * (0.45 + i * 0.1),
      speed: 0.15 + Math.random() * 0.2,
      alpha: 0.04 + i * 0.03,
      h: 30 + i * 20,
      w: W * 1.5 + Math.random() * W,
    });
  }

  // Clouds (parallax drift)
  for (let i = 0; i < 6; i++) {
    clouds.push({
      x: Math.random() * W * 3 - W,
      y: H * (0.05 + Math.random() * 0.2),
      speed: 0.05 + Math.random() * 0.08,
      alpha: 0.06 + Math.random() * 0.08,
      w: 120 + Math.random() * 180,
      h: 18 + Math.random() * 28,
    });
  }

  // Seed rain
  for (let i = 0; i < 60; i++) spawnRainDrop(W, H, true);

  // Weather cycle seed
  weatherTimer = 600 + Math.random() * 300;
  lightningTimer = 200 + Math.random() * 400;
  cloakShimmerTimer = 800 + Math.random() * 600;
}

// ─── BOLT BUILDER ────────────────────────────────────────────────────────────
function _buildMenuBolt(x, startY, endY) {
  const segs = [];
  let cx = x, cy = startY;
  const steps = 14 + Math.floor(Math.random() * 8);
  const dy = (endY - startY) / steps;
  for (let i = 0; i < steps; i++) {
    const nx = cx + (Math.random() - 0.5) * 30;
    const ny = cy + dy * (0.8 + Math.random() * 0.4);
    segs.push({ x1: cx, y1: cy, x2: nx, y2: ny, branch: false });
    if (Math.random() < 0.2 && i > steps * 0.35) {
      segs.push({ x1: nx, y1: ny, x2: nx + (Math.random() - 0.5) * 50, y2: ny + dy * 1.2, branch: true });
    }
    cx = nx; cy = ny;
  }
  return segs;
}

// ─── SPAWN HELPERS ───────────────────────────────────────────────────────────
function spawnLeaf(W, H, randomY = false) {
  const gust = windGust > 0.5;
  leaves.push({
    x: Math.random() * W * 1.2,
    y: randomY ? Math.random() * H : -10,
    vx: (Math.random() - 0.5) * 0.6 + (gust ? 1.5 : 0),
    vy: 0.4 + Math.random() * 0.8,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.06,
    size: 2 + Math.floor(Math.random() * 3),
    color: LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)],
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.02 + Math.random() * 0.03,
    layer: Math.random() < 0.35 ? 'fg' : 'bg',
    alpha: 0.7 + Math.random() * 0.3,
  });
}

function spawnRainDrop(W, H, randomY = false) {
  const heavy = weather === WEATHER.STORM || nextWeather === WEATHER.STORM;
  rainDrops.push({
    x: Math.random() * W,
    y: randomY ? Math.random() * H : -4,
    vy: 8 + Math.random() * (heavy ? 8 : 4),
    vx: -0.5 - Math.random() * (heavy ? 2 : 0.5),
    len: heavy ? (4 + Math.random() * 5) : (2 + Math.random() * 3),
    alpha: 0.25 + Math.random() * 0.2,
  });
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
export function updateMenuVFX(W, H, dt = 1) {
  const t = Date.now() * 0.001;
  windPhase += 0.008 * dt;
  godRayPhase += 0.007 * dt;
  sunGlowPhase += 0.012 * dt;

  // Wind gust
  gustTimer -= dt;
  if (gustTimer <= 0) {
    windGust = Math.random() > 0.7 ? 0.6 + Math.random() * 0.4 : 0;
    gustTimer = 180 + Math.random() * 240;
  }
  const windX = Math.sin(windPhase) * 0.4 + windGust * 1.2;

  // ── Weather cycle ──
  weatherTimer -= dt;
  if (weatherTimer <= 0) {
    const options = [WEATHER.CLEAR, WEATHER.RAIN, WEATHER.STORM, WEATHER.MIST];
    nextWeather = options.filter(w => w !== weather)[Math.floor(Math.random() * 3)];
    weatherTransition = 0;
    weatherTimer = 700 + Math.random() * 500;
  }
  if (nextWeather !== weather) {
    weatherTransition = Math.min(1, weatherTransition + 0.003 * dt);
    if (weatherTransition >= 1) { weather = nextWeather; weatherTransition = 0; }
  }

  const rainAlpha = weather === WEATHER.RAIN ? 1 :
                    weather === WEATHER.STORM ? 1 :
                    nextWeather === WEATHER.RAIN || nextWeather === WEATHER.STORM ? weatherTransition : 0;
  const stormAlpha = weather === WEATHER.STORM ? 1 :
                     nextWeather === WEATHER.STORM ? weatherTransition : 0;
  const mistAlpha = weather === WEATHER.MIST ? 1 :
                    nextWeather === WEATHER.MIST ? weatherTransition :
                    weather !== WEATHER.MIST && nextWeather !== WEATHER.MIST ? 0 : 1 - weatherTransition;

  // ── Leaves ──
  const leafSpawnRate = windGust > 0.5 ? 0.25 : 0.04;
  if (Math.random() < leafSpawnRate * dt) spawnLeaf(W, H);
  for (let i = leaves.length - 1; i >= 0; i--) {
    const l = leaves[i];
    l.sway += l.swaySpeed * dt;
    l.vx = (Math.random() - 0.5) * 0.1 + Math.sin(l.sway) * 0.5 + windX * 0.5;
    l.x += l.vx * dt;
    l.y += l.vy * dt;
    l.rot += l.rotV * dt;
    if (l.y > H + 20 || l.x < -30 || l.x > W + 30) leaves.splice(i, 1);
  }

  // ── Rain ──
  if (rainAlpha > 0.01) {
    const targetCount = weather === WEATHER.STORM ? 120 : 60;
    while (rainDrops.length < targetCount) spawnRainDrop(W, H);
    for (let i = rainDrops.length - 1; i >= 0; i--) {
      const r = rainDrops[i];
      r.x += (r.vx + windX * 0.8) * dt;
      r.y += r.vy * dt;
      if (r.y > H) {
        // Puddle ripple
        if (puddles.length < 20 && Math.random() > 0.6) {
          puddles.push({ x: r.x, y: H - 2, r: 0, maxR: 6 + Math.random() * 6, alpha: 0.4 });
        }
        rainDrops.splice(i, 1);
      }
    }
  } else {
    rainDrops.length = Math.min(rainDrops.length, 5);
  }

  // ── Puddles ──
  for (let i = puddles.length - 1; i >= 0; i--) {
    const p = puddles[i];
    p.r += 0.3 * dt;
    p.alpha -= 0.012 * dt;
    if (p.alpha <= 0 || p.r > p.maxR) puddles.splice(i, 1);
  }

  // ── Dust motes ──
  for (const d of dustMotes) {
    d.x += (d.vx + windX * 0.15) * dt;
    d.y += d.vy * dt;
    d.life += dt / d.maxLife;
    if (d.life > 1) d.life = 0;
    if (d.x < 0) d.x = W;
    if (d.x > W) d.x = 0;
    if (d.y < 0) d.y = H;
  }

  // ── Fireflies (appear during mist/storm transition) ──
  const ffVisible = mistAlpha + stormAlpha * 0.5;
  for (const f of fireflies) {
    f.phase += f.speed * dt;
    f.x += f.vx * dt + Math.sin(f.phase * 0.7) * 0.3;
    f.y += f.vy * dt + Math.cos(f.phase * 0.5) * 0.2;
    if (f.x < 0) f.x = W;
    if (f.x > W) f.x = 0;
    if (f.y < H * 0.2) f.y = H * 0.7;
    if (f.y > H * 0.9) f.y = H * 0.4;
  }

  // ── Fog ──
  for (const fog of fogLayers) {
    fog.x += fog.speed * dt;
    if (fog.x > W + fog.w) fog.x = -fog.w;
  }

  // ── Clouds ──
  for (const c of clouds) {
    c.x += c.speed * dt;
    if (c.x > W + c.w) c.x = -c.w * 2;
  }

  // ── Lightning ──
  lightningFlash = Math.max(0, lightningFlash - 0.06 * dt);
  if (stormAlpha > 0.3) {
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningFlash = 0.8 + Math.random() * 0.2;
      lightningX = W * 0.2 + Math.random() * W * 0.6;
      lightningTimer = 180 + Math.random() * 360;
    }
  } else {
    lightningTimer = Math.max(lightningTimer, 120);
  }

  // ── Cloak shimmer easter egg ──
  cloakShimmerTimer -= dt;
  if (cloakShimmerTimer <= 0) {
    cloakShimmerX = W * 0.55 + Math.random() * W * 0.3;
    cloakShimmerY = H * 0.3 + Math.random() * H * 0.3;
    cloakShimmerTimer = 900 + Math.random() * 700;
  }
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
export function renderMenuVFX(ctx, W, H, layer = 'all') {
  const t = Date.now() * 0.001;
  const stormBlend = weather === WEATHER.STORM ? 1 :
                     nextWeather === WEATHER.STORM ? weatherTransition : 0;
  const rainBlend = weather === WEATHER.RAIN ? 1 :
                    weather === WEATHER.STORM ? 1 :
                    (nextWeather === WEATHER.RAIN || nextWeather === WEATHER.STORM) ? weatherTransition : 0;
  const mistBlend = weather === WEATHER.MIST ? 1 :
                    nextWeather === WEATHER.MIST ? weatherTransition :
                    weather !== WEATHER.MIST && nextWeather !== WEATHER.MIST ? 0 : 1 - weatherTransition;

  if (layer === 'bg' || layer === 'all') {
    // ── Storm darkness overlay ──
    if (stormBlend > 0) {
      ctx.save();
      ctx.globalAlpha = stormBlend * 0.38;
      ctx.fillStyle = '#050a05';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Lightning flash + bolt ──
    if (lightningFlash > 0.01) {
      ctx.save();
      // Full screen white flash
      ctx.globalAlpha = lightningFlash * 0.2;
      ctx.fillStyle = '#cce8ff';
      ctx.fillRect(0, 0, W, H);
      // Bright column near strike
      const flashGrad = ctx.createLinearGradient(lightningX - 80, 0, lightningX + 80, 0);
      flashGrad.addColorStop(0, 'transparent');
      flashGrad.addColorStop(0.5, `rgba(180,210,255,${lightningFlash * 0.32})`);
      flashGrad.addColorStop(1, 'transparent');
      ctx.globalAlpha = 1;
      ctx.fillStyle = flashGrad;
      ctx.fillRect(lightningX - 80, 0, 160, H);

      // Draw pixel bolt if fresh (high flash)
      if (lightningFlash > 0.55) {
        if (!renderMenuVFX._bolt || renderMenuVFX._boltX !== lightningX) {
          renderMenuVFX._bolt = _buildMenuBolt(lightningX, 0, H * 0.55);
          renderMenuVFX._boltX = lightningX;
        }
        const bolt = renderMenuVFX._bolt;
        // Glow pass
        ctx.globalAlpha = lightningFlash * 0.4;
        ctx.strokeStyle = '#4488ff';
        ctx.lineWidth = 5;
        ctx.shadowColor = '#2255cc';
        ctx.shadowBlur = 14;
        for (const s of bolt) {
          if (s.branch) continue;
          ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        }
        // Core pass
        ctx.globalAlpha = lightningFlash * 0.95;
        ctx.strokeStyle = '#e8f4ff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 6;
        for (const s of bolt) {
          ctx.beginPath(); ctx.moveTo(s.x1, s.y1); ctx.lineTo(s.x2, s.y2); ctx.stroke();
        }
        ctx.shadowBlur = 0;
      } else {
        renderMenuVFX._bolt = null; // clear so next strike rebuilds
      }
      ctx.restore();
    }

    // ── Cloud drift (dark soft blobs) ──
    ctx.save();
    for (const c of clouds) {
      const a = c.alpha * (0.5 + stormBlend * 0.5);
      ctx.globalAlpha = a;
      const grad = ctx.createRadialGradient(c.x + c.w / 2, c.y, 0, c.x + c.w / 2, c.y, c.w * 0.6);
      grad.addColorStop(0, stormBlend > 0.5 ? '#1a1f1a' : '#2a3a2a');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(c.x, c.y - c.h, c.w, c.h * 2);
    }
    ctx.restore();

    // ── God ray shimmer ──
    ctx.save();
    const rayBase = weather === WEATHER.CLEAR ? 1 : weather === WEATHER.MIST ? 0.6 : 1 - stormBlend * 0.7;
    for (let i = 0; i < 4; i++) {
      const rxBase = W * (0.15 + i * 0.22);
      const shimmer = Math.sin(t * 0.9 + i * 1.4) * 0.015 + 0.025;
      const pulse = 0.018 + Math.sin(godRayPhase + i * 0.8) * 0.008;
      const alpha = (shimmer + pulse) * rayBase;
      ctx.globalAlpha = alpha;
      // Volumetric ray shape
      const rayGrad = ctx.createLinearGradient(rxBase, 0, rxBase + 60, H);
      rayGrad.addColorStop(0, 'rgba(255,240,180,0.9)');
      rayGrad.addColorStop(0.4, 'rgba(255,230,160,0.4)');
      rayGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = rayGrad;
      ctx.beginPath();
      ctx.moveTo(rxBase, 0);
      ctx.lineTo(rxBase - 20, H);
      ctx.lineTo(rxBase + 70, H);
      ctx.lineTo(rxBase + 48, 0);
      ctx.fill();
    }
    // Dust motes (bg layer)
    for (const d of dustMotes) {
      if (d.layer !== 'bg') continue;
      const pulse = Math.sin(d.life * Math.PI) * d.alpha;
      ctx.globalAlpha = pulse * rayBase;
      ctx.fillStyle = '#e8d8a0';
      ctx.fillRect(d.x - 0.5, d.y - 0.5, 1, 1);
    }
    ctx.restore();

    // ── Sun glow ──
    if (stormBlend < 0.9) {
      ctx.save();
      const sg = 0.7 - stormBlend * 0.6;
      const sunPulse = Math.sin(sunGlowPhase) * 0.015 + 0.06;
      const sunX = W * 0.72, sunY = H * 0.18;
      ctx.globalAlpha = sunPulse * sg;
      const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, H * 0.45);
      sunGrad.addColorStop(0, 'rgba(255,230,120,0.9)');
      sunGrad.addColorStop(0.2, 'rgba(255,200,80,0.25)');
      sunGrad.addColorStop(0.6, 'rgba(255,160,60,0.06)');
      sunGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // ── Background leaves ──
    ctx.save();
    for (const l of leaves) {
      if (l.layer !== 'bg') continue;
      ctx.globalAlpha = l.alpha * 0.55;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = l.color;
      ctx.fillRect(-l.size, -l.size / 2, l.size * 2, l.size);
      ctx.restore();
    }
    ctx.restore();

    // ── Rain (bg pass) ──
    if (rainBlend > 0.01) {
      ctx.save();
      ctx.globalAlpha = rainBlend * 0.35;
      ctx.strokeStyle = '#99bbcc';
      ctx.lineWidth = 1;
      for (const r of rainDrops) {
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.3, r.y - r.len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Mist / fog layers ──
    if (mistBlend > 0.01) {
      ctx.save();
      for (const fog of fogLayers) {
        ctx.globalAlpha = fog.alpha * mistBlend * 1.4;
        const fogGrad = ctx.createLinearGradient(fog.x, fog.y - fog.h / 2, fog.x, fog.y + fog.h / 2);
        fogGrad.addColorStop(0, 'transparent');
        fogGrad.addColorStop(0.5, '#a8c8a8');
        fogGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = fogGrad;
        ctx.fillRect(fog.x, fog.y - fog.h, fog.w, fog.h * 2);
        // Also draw second copy seamlessly
        ctx.fillRect(fog.x - fog.w, fog.y - fog.h, fog.w, fog.h * 2);
      }
      ctx.restore();
    }

    // ── Rain atmosphere overlay ──
    if (rainBlend > 0.01) {
      ctx.save();
      ctx.globalAlpha = rainBlend * 0.12;
      ctx.fillStyle = '#0a1510';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  if (layer === 'fg' || layer === 'all') {
    // ── Foreground leaves (pass in front of UI) ──
    ctx.save();
    for (const l of leaves) {
      if (l.layer !== 'fg') continue;
      ctx.globalAlpha = l.alpha * 0.75;
      ctx.save();
      ctx.translate(l.x, l.y);
      ctx.rotate(l.rot);
      ctx.fillStyle = l.color;
      // Pixel leaf shape
      ctx.fillRect(-l.size, 0, l.size * 2, l.size);
      ctx.fillRect(-l.size / 2, -l.size, l.size, l.size);
      ctx.restore();
    }
    ctx.restore();

    // ── Foreground rain ──
    if (rainBlend > 0.01) {
      ctx.save();
      ctx.globalAlpha = rainBlend * 0.55;
      ctx.strokeStyle = '#b8d4e4';
      ctx.lineWidth = 1;
      const heavy = weather === WEATHER.STORM || nextWeather === WEATHER.STORM;
      for (const r of rainDrops.slice(0, heavy ? 80 : 40)) {
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x - r.len * 0.5, r.y - r.len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // ── Puddle ripples ──
    ctx.save();
    for (const p of puddles) {
      ctx.globalAlpha = p.alpha * rainBlend;
      ctx.strokeStyle = '#88aabb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r * 2, p.r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // ── Fireflies ──
    const ffAlpha = mistBlend * 0.7 + stormBlend * 0.4;
    if (ffAlpha > 0.01) {
      ctx.save();
      for (const f of fireflies) {
        const pulse = Math.sin(f.phase) * 0.5 + 0.5;
        ctx.globalAlpha = pulse * ffAlpha * 0.6;
        ctx.shadowColor = '#aaff88';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ccff99';
        ctx.fillRect(f.x - 1, f.y - 1, 2, 2);
      }
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Dust motes fg ──
    ctx.save();
    const rayBase = 1 - stormBlend * 0.5;
    for (const d of dustMotes) {
      if (d.layer !== 'fg') continue;
      const pulse = Math.sin(d.life * Math.PI) * d.alpha;
      ctx.globalAlpha = pulse * rayBase * 0.7;
      ctx.fillStyle = '#e0d090';
      ctx.fillRect(d.x - 0.5, d.y - 0.5, 1, 1);
    }
    ctx.restore();

    // ── Cloak shimmer easter egg ──
    if (cloakShimmerTimer < 80) {
      const shimmerLife = 1 - cloakShimmerTimer / 80;
      const fade = shimmerLife < 0.15 ? shimmerLife / 0.15 : shimmerLife > 0.75 ? (1 - shimmerLife) / 0.25 : 1;
      const shOff = Math.sin(Date.now() * 0.018) * 2;
      ctx.save();
      ctx.globalAlpha = fade * 0.09;
      ctx.fillStyle = 'rgba(140,220,255,0.3)';
      ctx.fillRect(cloakShimmerX + shOff, cloakShimmerY, 14, 28);
      ctx.globalAlpha = fade * 0.06;
      ctx.fillStyle = 'rgba(80,180,200,0.2)';
      ctx.fillRect(cloakShimmerX - shOff + 2, cloakShimmerY + 2, 14, 28);
      ctx.restore();
    }
  }
}