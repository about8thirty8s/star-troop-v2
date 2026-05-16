// ── Procedural parallax layer renderers ──────────────────────────────────────
// These generate procedural background silhouettes for the parallax scrolling system.

export function renderFarMountainsScreenSpace(ctx, camX, camY, W, H, tod, sz) {
  // Distant mountain silhouettes — procedurally generated, slow parallax
  ctx.fillStyle = 'rgba(20,30,40,0.4)';
  const mCount = 5;
  for (let i = 0; i < mCount; i++) {
    const mx = ((i * W * 0.35 - camX * 0.06) % (W * 2.5)) - W * 0.5;
    const mh = 80 + Math.sin(i * 1.5) * 30;
    const mw = 200 + Math.cos(i * 0.8) * 60;
    _drawMountain(ctx, mx + W / 2, H * 0.65, mw, mh);
  }
}

export function renderMidTreesScreenSpace(ctx, camX, camY, W, H, tod, sz) {
  // Mid-distance jungle trees — silhouettes at parallax 0.25
  ctx.fillStyle = 'rgba(15,40,20,0.5)';
  const tCount = 6;
  for (let i = 0; i < tCount; i++) {
    const tx = ((i * W * 0.4 - camX * 0.25) % (W * 2)) - W * 0.25;
    const th = 100 + Math.sin(i * 2) * 40;
    _drawJungleSilhouette(ctx, tx + W / 2, H * 0.72, th, i % 2);
  }
}

export function renderVinesScreenSpace(ctx, camX, camY, W, H, sz) {
  // Foreground vines and foliage — slow drift
  ctx.fillStyle = 'rgba(20,60,10,0.35)';
  const vCount = 4;
  for (let i = 0; i < vCount; i++) {
    const vx = ((i * W * 0.5 - camX * 0.32) % (W * 2.5)) - W * 0.5;
    const vs = 20 + Math.sin(i * 1.2) * 8;
    _drawForegroundLeafClump(ctx, vx + W / 2, H * 0.8, vs);
  }
}

// Helper drawing functions
function _drawMountain(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.38, y - h);
  ctx.lineTo(x + w * 0.55, y - h * 0.85);
  ctx.lineTo(x + w, y);
  ctx.fill();
}

function _drawJungleSilhouette(ctx, x, y, h, detail) {
  ctx.fillRect(x - 3, y - h * 0.6, 5, h * 0.6);
  for (let j = 0; j < 3; j++) {
    ctx.beginPath();
    ctx.arc(x + (j - 1) * 12, y - h * (0.7 + j * 0.08), 14 + j * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _drawForegroundLeafClump(ctx, x, y, s) {
  for (let j = 0; j < 4; j++) {
    const ox = (j - 1.5) * s * 0.4;
    const oy = Math.sin(j * 1.1) * s * 0.25;
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, s * 0.55, s * 0.32, -0.4 + j * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}