// LAST HUNT: KILLBOX — Atmosphere System
// In-game weather + lightning + fog used during PREP/HUNT phases.
// Kept separate from menuVFX so gameplay systems can query weather state.

const WEATHER = { CLEAR: 0, RAIN: 1, STORM: 2, MIST: 3 };

// ── Shared state (module-level singleton) ────────────────────────────────────
let _weather     = WEATHER.CLEAR;
let _nextWeather = WEATHER.CLEAR;
let _transition  = 0;          // 0..1 blend to nextWeather
let _timer       = 600;

let _windPhase   = 0;
let _windGust    = 0;
let _gustTimer   = 300;

// Lightning
let _ltTimer     = 300;        // frames until next bolt
let _ltFlash     = 0;          // current flash brightness 0..1
let _ltX         = 0;          // screen-space X of bolt
let _ltBolt      = null;       // bolt segment array
let _ltFadeTimer = 0;

// Fog drifters
let _fogLayers   = [];
let _rainDrops   = [];

// ── Init ─────────────────────────────────────────────────────────────────────
export function initAtmosphere(W, H) {
  _weather = WEATHER.CLEAR;
  _nextWeather = WEATHER.STORM; // start heading toward storm for drama
  _transition = 0;
  _timer = 400;
  _ltTimer = 300 + Math.random() * 300;
  _ltFlash = 0;
  _ltBolt = null;

  _fogLayers = [];
  for (let i = 0; i < 3; i++) {
    _fogLayers.push({
      x: Math.random() * W * 2,
      y: H * (0.38 + i * 0.08),
      speed: 0.12 + Math.random() * 0.15,
      alpha: 0.03 + i * 0.025,
      h: 22 + i * 14,
      w: W * 1.6,
    });
  }
  _rainDrops = [];
  for (let i = 0; i < 80; i++) _spawnRain(W, H, true);
}

function _spawnRain(W, H, scatter = false) {
  const heavy = _weather === WEATHER.STORM || _nextWeather === WEATHER.STORM;
  _rainDrops.push({
    x: Math.random() * W,
    y: scatter ? Math.random() * H : -6,
    vy: 9 + Math.random() * (heavy ? 7 : 3),
    vx: -0.8 - Math.random() * (heavy ? 2.5 : 0.8),
    len: heavy ? 5 + Math.random() * 5 : 3 + Math.random() * 3,
    alpha: 0.18 + Math.random() * 0.2,
  });
}

// Build a branching lightning bolt from (x, startY) downward
function _buildBolt(x, startY, endY) {
  const segs = [];
  let cx = x, cy = startY;
  const steps = 12 + Math.floor(Math.random() * 8);
  const dy = (endY - startY) / steps;
  for (let i = 0; i < steps; i++) {
    const nx = cx + (Math.random() - 0.5) * 28;
    const ny = cy + dy * (0.8 + Math.random() * 0.4);
    segs.push({ x1: cx, y1: cy, x2: nx, y2: ny, branch: false });
    // Random fork
    if (Math.random() < 0.22 && i > steps * 0.4) {
      const bx = nx + (Math.random() - 0.5) * 40;
      const by = ny + dy * (1 + Math.random());
      segs.push({ x1: nx, y1: ny, x2: bx, y2: by, branch: true });
    }
    cx = nx; cy = ny;
  }
  return segs;
}

// ── Update (call once per frame) ─────────────────────────────────────────────
export function updateAtmosphere(W, H, dt = 1) {
  _windPhase += 0.007 * dt;
  _gustTimer -= dt;
  if (_gustTimer <= 0) {
    _windGust = Math.random() > 0.65 ? 0.5 + Math.random() * 0.5 : 0;
    _gustTimer = 200 + Math.random() * 300;
  }
  const windX = Math.sin(_windPhase) * 0.5 + _windGust * 1.5;

  // ── Weather cycle ──
  _timer -= dt;
  if (_timer <= 0) {
    const opts = [WEATHER.CLEAR, WEATHER.RAIN, WEATHER.STORM, WEATHER.MIST];
    _nextWeather = opts.filter(w => w !== _weather)[Math.floor(Math.random() * 3)];
    _transition = 0;
    _timer = 600 + Math.random() * 600;
  }
  if (_nextWeather !== _weather) {
    _transition = Math.min(1, _transition + 0.002 * dt);
    if (_transition >= 1) { _weather = _nextWeather; _transition = 0; }
  }

  const stormBlend = _weather === WEATHER.STORM ? 1 :
                     _nextWeather === WEATHER.STORM ? _transition : 0;
  const rainBlend  = (_weather === WEATHER.RAIN || _weather === WEATHER.STORM) ? 1 :
                     (_nextWeather === WEATHER.RAIN || _nextWeather === WEATHER.STORM) ? _transition : 0;

  // ── Rain ──
  if (rainBlend > 0.05) {
    const target = _weather === WEATHER.STORM ? 140 : 70;
    while (_rainDrops.length < target) _spawnRain(W, H);
    for (let i = _rainDrops.length - 1; i >= 0; i--) {
      const r = _rainDrops[i];
      r.x += (r.vx + windX * 0.6) * dt;
      r.y += r.vy * dt;
      if (r.y > H || r.x < -10) _rainDrops.splice(i, 1);
    }
  } else {
    while (_rainDrops.length > 8) _rainDrops.pop();
  }

  // ── Fog ──
  for (const fog of _fogLayers) {
    fog.x += fog.speed * dt;
    if (fog.x > W + fog.w) fog.x = -fog.w;
  }

  // ── Lightning ──
  _ltFlash = Math.max(0, _ltFlash - 0.055 * dt);
  _ltFadeTimer = Math.max(0, _ltFadeTimer - dt);
  if (stormBlend > 0.25) {
    _ltTimer -= dt;
    if (_ltTimer <= 0) {
      _ltFlash = 0.9 + Math.random() * 0.1;
      _ltX = W * 0.15 + Math.random() * W * 0.7;
      _ltBolt = _buildBolt(_ltX, 0, H * 0.55);
      _ltFadeTimer = 18;
      _ltTimer = 200 + Math.random() * 500;
    }
  }
}

// ── Query helpers (for game logic) ───────────────────────────────────────────
export function getLightningFlash() { return _ltFlash; }

export function getWeatherBlends() {
  return {
    storm:  _weather === WEATHER.STORM ? 1 : _nextWeather === WEATHER.STORM ? _transition : 0,
    rain:   (_weather === WEATHER.RAIN || _weather === WEATHER.STORM) ? 1 :
            (_nextWeather === WEATHER.RAIN || _nextWeather === WEATHER.STORM) ? _transition : 0,
    mist:   _weather === WEATHER.MIST ? 1 : _nextWeather === WEATHER.MIST ? _transition :
            (_weather !== WEATHER.MIST && _nextWeather !== WEATHER.MIST) ? 0 : 1 - _transition,
    wind:   Math.sin(_windPhase) * 0.5 + _windGust * 1.5,
  };
}

// ── Render: background pass (call before world tiles) ────────────────────────
export function renderAtmosphereBG(ctx, W, H, camX, camY) {
  const b = getWeatherBlends();

  // Storm darkness
  if (b.storm > 0) {
    ctx.save();
    ctx.globalAlpha = b.storm * 0.45;
    ctx.fillStyle = '#040908';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Lightning full-screen flash
  if (_ltFlash > 0.01) {
    ctx.save();
    ctx.globalAlpha = _ltFlash * 0.18;
    ctx.fillStyle = '#cce8ff';
    ctx.fillRect(0, 0, W, H);
    // Column brightening
    const cg = ctx.createLinearGradient(_ltX - 100, 0, _ltX + 100, 0);
    cg.addColorStop(0, 'transparent');
    cg.addColorStop(0.5, `rgba(180,220,255,${_ltFlash * 0.3})`);
    cg.addColorStop(1, 'transparent');
    ctx.globalAlpha = 1;
    ctx.fillStyle = cg;
    ctx.fillRect(_ltX - 100, 0, 200, H);
    ctx.restore();
  }

  // Rain bg pass — pure screen space (drops are in screen coords, no camX)
  if (b.rain > 0.01) {
    ctx.save();
    ctx.globalAlpha = b.rain * 0.28;
    ctx.strokeStyle = '#8ab0c8';
    ctx.lineWidth = 1;
    for (const r of _rainDrops) {
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.vx * r.len * 0.15, r.y - r.len * 0.6);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = b.rain * 0.1;
    ctx.fillStyle = '#060e06';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

// ── Render: foreground pass (call after entities, before HUD) ─────────────────
export function renderAtmosphereFG(ctx, W, H, camX, camY) {
  const b = getWeatherBlends();

  // Mist / fog drifters — pure screen-space, fog.x drifts independently each frame
  // camX is used only as a very slow additional parallax nudge (0.04 factor)
  if (b.mist > 0.02 || b.storm > 0.1) {
    const mistA = Math.max(b.mist, b.storm * 0.3);
    ctx.save();
    for (const fog of _fogLayers) {
      // fog.x already advances each frame (initAtmosphere/updateAtmosphere drift)
      // Subtract a tiny camera parallax so fog barely reacts to camera movement
      const sx = fog.x - camX * 0.04;
      ctx.globalAlpha = fog.alpha * mistA * 2;
      const fg = ctx.createLinearGradient(sx, fog.y - fog.h, sx, fog.y + fog.h);
      fg.addColorStop(0, 'transparent');
      fg.addColorStop(0.5, b.storm > 0.5 ? '#0a1408' : '#7a9a7a');
      fg.addColorStop(1, 'transparent');
      ctx.fillStyle = fg;
      // Draw two tiles side by side to prevent gaps as fog.x wraps
      ctx.fillRect(sx,          fog.y - fog.h, fog.w, fog.h * 2);
      ctx.fillRect(sx - fog.w,  fog.y - fog.h, fog.w, fog.h * 2);
    }
    ctx.restore();
  }

  // Foreground rain
  if (b.rain > 0.01) {
    ctx.save();
    ctx.globalAlpha = b.rain * 0.5;
    ctx.strokeStyle = '#aaccdd';
    ctx.lineWidth = 1;
    const slice = b.storm > 0.5 ? _rainDrops : _rainDrops.slice(0, Math.floor(_rainDrops.length * 0.5));
    for (const r of slice) {
      ctx.beginPath();
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.vx * r.len * 0.3, r.y - r.len);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Lightning bolt draw (foreground over world)
  if (_ltBolt && _ltFadeTimer > 0) {
    const alpha = Math.min(1, _ltFadeTimer / 8);
    ctx.save();
    // Outer glow pass
    ctx.globalAlpha = alpha * 0.35;
    ctx.strokeStyle = '#4488ff';
    ctx.lineWidth = 5;
    ctx.shadowColor = '#2255cc';
    ctx.shadowBlur = 12;
    for (const s of _ltBolt) {
      if (s.branch) continue;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    // Core bright pass
    ctx.globalAlpha = alpha * 0.9;
    ctx.strokeStyle = '#ddeeff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 6;
    for (const s of _ltBolt) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    // Branches (dimmer)
    ctx.globalAlpha = alpha * 0.55;
    ctx.strokeStyle = '#aaccee';
    ctx.lineWidth = 1;
    for (const s of _ltBolt) {
      if (!s.branch) continue;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}