// ━━━ WARRIOR BUG SPRITE ━━━
import { COLORS } from '../../constants';

export function drawBug(ctx, bug, cam) {
  const sx = cam.worldToScreen(bug.x);
  const sy = bug.y;
  const f = bug.facing;

  if (bug.dead) {
    // Dead bug: flattened, fading
    const alpha = Math.max(0, 1 - bug.deathTimer / 1500);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'transparent';
    ctx.lineWidth = 0;
    ctx.fillStyle = COLORS.BUG_BODY;
    ctx.fillRect(sx - 14, sy - 4, 28, 6);
    ctx.fillStyle = COLORS.BUG_BLOOD;
    ctx.fillRect(sx - 8, sy - 2, 16, 4);
    ctx.restore();
    return;
  }

  ctx.save();

  // ── Hard-reset stroke state so no grey box bleeds through ──────────────
  ctx.strokeStyle = 'transparent';
  ctx.lineWidth   = 0;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  ctx.translate(sx, sy);

  const flashing = bug.hitFlash > 0;

  // === LEGS ===
  const legAnim = bug.legFrame;
  ctx.fillStyle = flashing ? '#fff' : COLORS.BUG_ACCENT;

  for (let i = 0; i < 3; i++) {
    const offset = (legAnim + i) % 4;
    const yOff   = offset < 2 ? -2 : 2;
    const legX   = -10 + i * 10;
    ctx.fillRect(legX - 4, -6 + yOff, 3, 8);
    ctx.fillRect(legX + 2, -6 - yOff, 3, 8);
  }

  // === BODY ===
  // Abdomen
  ctx.fillStyle = flashing ? '#fff' : COLORS.BUG_BODY;
  ctx.beginPath();
  ctx.ellipse(-f * 6, -10, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();                 // fill only — NO stroke

  // Thorax
  ctx.fillStyle = flashing ? '#fff' : COLORS.BUG_ACCENT;
  ctx.beginPath();
  ctx.ellipse(f * 4, -12, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // === HEAD ===
  ctx.fillStyle = flashing ? '#fff' : '#1a0a00';
  ctx.beginPath();
  ctx.ellipse(f * 14, -14, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mandibles
  ctx.fillStyle = flashing ? '#fff' : '#4a2a0a';
  ctx.fillRect(f * 18, -16, f * 5, 2);
  ctx.fillRect(f * 18, -12, f * 5, 2);

  // Eyes (only when not flashing)
  if (!flashing) {
    ctx.fillStyle = '#cc2200';
    ctx.fillRect(f * 16, -16, 2, 2);
    ctx.fillRect(f * 16, -12, 2, 2);
  }

  // Carapace highlight (only when not flashing)
  if (!flashing) {
    ctx.fillStyle = 'rgba(100, 60, 20, 0.3)';
    ctx.beginPath();
    ctx.ellipse(-f * 4, -14, 6, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
