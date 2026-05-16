// Tree variant renderer — VULCAN KILLBOX v3 — PROCEDURAL
// No external image dependency. All trees drawn with canvas 2D primitives.
// 5 distinct archetypes matching the reference art direction:
// gnarled, wide canopy, tall emergent, dense mid, vine-draped.

// Seeded pseudo-random for deterministic per-tree variation
function _tr(seed) {
  let s = seed | 0;
  s = ((s ^ (s >>> 13)) * 1540483477) | 0;
  return ((s ^ (s >>> 15)) >>> 0) / 0xFFFFFFFF;
}

function _drawGnarledTree(ctx, cx, groundY, scale, seed) {
  const h = _tr(seed);
  const trunkH = (120 + h * 60) * scale;
  const trunkW = (14 + h * 6) * scale;

  // Root buttresses
  ctx.fillStyle = '#3a2008';
  for (let i = -2; i <= 2; i++) {
    const rw = (8 + Math.abs(i) * 4) * scale;
    const rh = (20 + Math.abs(i) * 6) * scale;
    ctx.beginPath();
    ctx.moveTo(cx + i * (trunkW * 0.4), groundY);
    ctx.lineTo(cx + i * (trunkW * 0.4) - rw/2, groundY);
    ctx.lineTo(cx, groundY - rh);
    ctx.closePath();
    ctx.fill();
  }

  // Main trunk
  ctx.fillStyle = '#2e1a08';
  ctx.fillRect(cx - trunkW/2, groundY - trunkH, trunkW, trunkH);
  // Trunk highlight
  ctx.fillStyle = '#3e2810';
  ctx.fillRect(cx - trunkW/2 + 2*scale, groundY - trunkH, 3*scale, trunkH * 0.7);

  // Twisted branch left
  ctx.strokeStyle = '#2e1a08';
  ctx.lineWidth = 6 * scale;
  ctx.beginPath();
  ctx.moveTo(cx, groundY - trunkH * 0.7);
  ctx.quadraticCurveTo(cx - 40*scale, groundY - trunkH * 0.9, cx - 80*scale, groundY - trunkH * 1.1);
  ctx.stroke();

  // Twisted branch right
  ctx.beginPath();
  ctx.moveTo(cx, groundY - trunkH * 0.65);
  ctx.quadraticCurveTo(cx + 35*scale, groundY - trunkH * 0.85, cx + 70*scale, groundY - trunkH * 0.95);
  ctx.stroke();

  // Canopy layers — dark at back, bright at front
  const cr = (55 + h * 20) * scale;
  const cy = groundY - trunkH * 1.05;
  for (const [offX, offY, r, col] of [
    [-35*scale, 10*scale, cr*0.7, '#1e4a0e'],
    [35*scale, 5*scale,  cr*0.65, '#1e4a0e'],
    [0, -10*scale, cr*0.9, '#2a5e14'],
    [-20*scale, -20*scale, cr*0.6, '#3a7a1c'],
    [20*scale, -18*scale, cr*0.55, '#3a7a1c'],
    [0, -28*scale, cr*0.5, '#4a9024'],
  ]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx + offX, cy + offY, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hanging vines
  ctx.strokeStyle = '#1a3a0a';
  ctx.lineWidth = 1.5 * scale;
  for (let i = 0; i < 5; i++) {
    const vx = cx + (_tr(seed + i * 7) - 0.5) * cr * 1.4;
    const vy = cy + _tr(seed + i * 3) * cr * 0.3;
    const vlen = (30 + _tr(seed + i) * 50) * scale;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.quadraticCurveTo(vx + (_tr(seed+i+1)-0.5)*12*scale, vy + vlen/2, vx + (_tr(seed+i+2)-0.5)*8*scale, vy + vlen);
    ctx.stroke();
  }
}

function _drawWideCanopyTree(ctx, cx, groundY, scale, seed) {
  const h = _tr(seed);
  const trunkH = (90 + h * 40) * scale;
  const trunkW = (12 + h * 5) * scale;

  // Roots
  ctx.fillStyle = '#3a2008';
  for (let i = -3; i <= 3; i += 2) {
    ctx.beginPath();
    ctx.moveTo(cx, groundY - 15*scale);
    ctx.lineTo(cx + i * 16*scale, groundY);
    ctx.lineWidth = (4 + Math.abs(i)) * scale;
    ctx.strokeStyle = '#3a2008';
    ctx.stroke();
  }

  // Trunk
  ctx.fillStyle = '#2a1806';
  ctx.fillRect(cx - trunkW/2, groundY - trunkH, trunkW, trunkH);
  ctx.fillStyle = '#3c2610';
  ctx.fillRect(cx - trunkW/2 + 2*scale, groundY - trunkH + 10*scale, 2*scale, trunkH * 0.6);

  // Wide spreading canopy
  const cr = (75 + h * 25) * scale;
  const cy = groundY - trunkH;
  for (const [offX, offY, rx, ry, col] of [
    [-cr*0.6, cr*0.1, cr*0.7, cr*0.45, '#1a4210'],
    [cr*0.6, cr*0.1, cr*0.65, cr*0.4, '#1a4210'],
    [-cr*0.3, -cr*0.05, cr*0.6, cr*0.5, '#235218'],
    [cr*0.3, -cr*0.08, cr*0.55, cr*0.45, '#235218'],
    [0, -cr*0.2, cr*0.8, cr*0.55, '#2e6a1c'],
    [-cr*0.2, -cr*0.35, cr*0.45, cr*0.35, '#3a8020'],
    [cr*0.2, -cr*0.3, cr*0.4, cr*0.32, '#3a8020'],
    [0, -cr*0.48, cr*0.38, cr*0.28, '#4a9228'],
  ]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx + offX, cy + offY, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _drawTallEmergentTree(ctx, cx, groundY, scale, seed) {
  const h = _tr(seed);
  const trunkH = (170 + h * 50) * scale;
  const trunkW = (8 + h * 4) * scale;

  // Thin straight trunk
  ctx.fillStyle = '#281808';
  ctx.fillRect(cx - trunkW/2, groundY - trunkH, trunkW, trunkH);
  // Epiphyte bumps
  ctx.fillStyle = '#1e4a0e';
  for (let i = 0; i < 4; i++) {
    const ey = groundY - trunkH * (0.3 + i * 0.18);
    ctx.beginPath();
    ctx.ellipse(cx + (_tr(seed+i)-0.5)*trunkW*2, ey, 8*scale, 5*scale, 0, 0, Math.PI*2);
    ctx.fill();
  }

  // High tight canopy bursting above
  const cr = (40 + h * 20) * scale;
  const cy = groundY - trunkH * 1.0;
  for (const [offX, offY, r, col] of [
    [-cr*0.4, cr*0.1, cr*0.5, '#1e4a10'],
    [cr*0.4, cr*0.1, cr*0.45, '#1e4a10'],
    [0, 0, cr*0.65, '#2a6018'],
    [-cr*0.2, -cr*0.3, cr*0.4, '#388020'],
    [cr*0.2, -cr*0.28, cr*0.38, '#388020'],
    [0, -cr*0.5, cr*0.4, '#4a9a28'],
    [0, -cr*0.72, cr*0.28, '#5aaa30'],
  ]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx + offX, cy + offY, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _drawDenseMidTree(ctx, cx, groundY, scale, seed) {
  const h = _tr(seed);
  const trunkH = (100 + h * 45) * scale;
  const trunkW = (11 + h * 5) * scale;

  // Root spread
  ctx.strokeStyle = '#2e1806';
  ctx.lineWidth = 4 * scale;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, groundY - 10*scale);
    ctx.lineTo(cx + i * 14*scale, groundY);
    ctx.stroke();
  }

  // Mossy trunk
  ctx.fillStyle = '#2e1a08';
  ctx.fillRect(cx - trunkW/2, groundY - trunkH, trunkW, trunkH);
  // Moss patches
  ctx.fillStyle = 'rgba(30,80,10,0.5)';
  ctx.fillRect(cx - trunkW/2, groundY - trunkH * 0.6, trunkW, 8*scale);
  ctx.fillRect(cx - trunkW/2, groundY - trunkH * 0.35, trunkW, 6*scale);

  // Full rounded canopy
  const cr = (60 + h * 22) * scale;
  const cy = groundY - trunkH * 1.0;
  for (const [offX, offY, r, col] of [
    [-cr*0.45, cr*0.1, cr*0.55, '#1e4a10'],
    [cr*0.45, cr*0.12, cr*0.5, '#1e4a10'],
    [0, cr*0.05, cr*0.72, '#285c16'],
    [-cr*0.22, -cr*0.2, cr*0.5, '#326a1a'],
    [cr*0.22, -cr*0.18, cr*0.48, '#326a1a'],
    [0, -cr*0.35, cr*0.55, '#3c7e20'],
    [0, -cr*0.5, cr*0.38, '#4a9228'],
  ]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx + offX, cy + offY, r, r * 0.78, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _drawVineDrapedTree(ctx, cx, groundY, scale, seed) {
  const h = _tr(seed);
  const trunkH = (115 + h * 45) * scale;
  const trunkW = (10 + h * 5) * scale;

  // Trunk — barely visible under vines
  ctx.fillStyle = '#241608';
  ctx.fillRect(cx - trunkW/2, groundY - trunkH, trunkW, trunkH);

  // Canopy
  const cr = (50 + h * 18) * scale;
  const cy = groundY - trunkH;
  for (const [offX, offY, r, col] of [
    [-cr*0.4, cr*0.08, cr*0.5, '#1a420e'],
    [cr*0.4, cr*0.08, cr*0.48, '#1a420e'],
    [0, -cr*0.05, cr*0.65, '#24581a'],
    [-cr*0.18, -cr*0.25, cr*0.42, '#2e6e1c'],
    [cr*0.18, -cr*0.22, cr*0.4, '#2e6e1c'],
    [0, -cr*0.4, cr*0.38, '#3a8020'],
  ]) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(cx + offX, cy + offY, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Heavy curtain of vines
  ctx.lineWidth = 1.5 * scale;
  for (let i = 0; i < 9; i++) {
    const vx = cx + (_tr(seed + i * 5) - 0.5) * cr * 1.6;
    const vstart = cy + _tr(seed + i * 2) * cr * 0.5;
    const vlen = (40 + _tr(seed + i) * 80) * scale;
    ctx.strokeStyle = i % 3 === 0 ? '#1a3a0a' : '#244a14';
    ctx.beginPath();
    ctx.moveTo(vx, vstart);
    ctx.quadraticCurveTo(
      vx + (_tr(seed+i*3+1)-0.5)*16*scale, vstart + vlen*0.5,
      vx + (_tr(seed+i*3+2)-0.5)*10*scale, vstart + vlen
    );
    ctx.stroke();
    // Leaf nodes along vine
    if (_tr(seed + i * 11) > 0.4) {
      ctx.fillStyle = '#2a5a14';
      ctx.beginPath();
      ctx.ellipse(vx + (_tr(seed+i+5)-0.5)*6*scale, vstart + vlen*0.5, 5*scale, 3*scale, 0.3, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

const TREE_DRAW_FNS = [
  _drawGnarledTree,
  _drawWideCanopyTree,
  _drawTallEmergentTree,
  _drawDenseMidTree,
  _drawVineDrapedTree,
];

const imageCache = {};

export function createTreeVariantInstance(variant, x, y, scale = 1.0) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    variant,
    x, y,
    scale,
    drawFnIdx: Math.floor(Math.random() * TREE_DRAW_FNS.length),
    seed: Math.floor(Math.random() * 99999),
    parallaxDepth: 0.2 + Math.random() * 0.15,
    alive: true,
  };
}

export function renderTreeVariant(ctx, treeVariant, camera) {
  if (!treeVariant || !treeVariant.alive) return;

  const scale = treeVariant.scale || 1.0;
  const groundY = treeVariant.y;
  const cx = treeVariant.x;

  // Viewport culling
  if (camera) {
    const camX = camera.x || 0;
    const camY = camera.y || 0;
    const zoom  = camera.zoom || 1;
    const vW = 1600 / zoom;
    const vH = 900  / zoom;
    const pad = 200 * scale;
    if (cx > camX + vW + pad || cx < camX - pad) return;
    if (groundY < camY - pad || groundY - 250*scale > camY + vH + pad) return;
  }

  const fnIdx = treeVariant.drawFnIdx ?? (Math.floor(treeVariant.x * 0.1 + treeVariant.y * 0.07) % TREE_DRAW_FNS.length);
  const seed  = treeVariant.seed ?? Math.floor(treeVariant.x * 7 + treeVariant.y * 13);

  ctx.save();
  TREE_DRAW_FNS[fnIdx](ctx, cx, groundY, scale, seed);
  ctx.restore();
}

export function updateTreeVariants(variants) {
  // Static trees — no update needed
}