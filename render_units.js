const { createCanvas } = require('canvas');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════
// NPC TROOPER — canvas pixel art
// ═══════════════════════════════════════════════════════════════════════════
function drawNPCTrooper(ctx, sx, sy, sw, sh, darkness, t, flip, unitState, shootTimer) {
  const phase = (sx * 0.0137) % (Math.PI * 2);
  const tCycle = (t * 0.001 + phase);
  const SHOOT_INTERVAL = 2200, FLASH_DUR = 180;
  const isShooting = (unitState === 'shoot') && (shootTimer !== undefined) && ((shootTimer % SHOOT_INTERVAL) < FLASH_DUR);
  const shootPhaseMs = isShooting ? (shootTimer % SHOOT_INTERVAL) : 0;
  const flashT = isShooting ? shootPhaseMs / FLASH_DUR : 0;
  const flashAlpha = isShooting ? (flashT < 0.3 ? flashT / 0.3 : 1 - (flashT - 0.3) / 0.7) : 0;
  const isWalking = (unitState === 'patrol' || unitState === 'alert');
  const walkCycle = isWalking ? Math.sin(tCycle * 6) : 0;
  const bobY = isWalking ? Math.abs(Math.sin(tCycle * 6)) * sh * 0.035 : Math.sin(tCycle * 1.8) * sh * 0.02;
  const PW = sw / 8, PH = sh / 12;

  function px(lx, ly, lw, lh, color, alpha) {
    ctx.save();
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    const rx = flip ? sx + (8 - lx - lw) * PW : sx + lx * PW;
    const ry = sy + ly * PH + bobY;
    ctx.fillRect(rx, ry, lw * PW + 0.5, lh * PH + 0.5);
    ctx.restore();
  }

  const DARK = '#18191f', ARMOR = '#23262e', ARMHL = '#353a46', BOOT = '#161618';
  const RIFLE = '#28292f', RIFHL = '#484d58', STRAP = '#30333c', VISOR = '#00ddff';
  const nightFade = Math.min(0.42, darkness * 0.5);

  const bootOffL = isWalking ? Math.round(walkCycle * 1.0) : 0;
  const bootOffR = isWalking ? Math.round(-walkCycle * 1.0) : 0;
  px(1, 10 + bootOffL, 2, 2, BOOT);
  px(5, 10 + bootOffR, 2, 2, BOOT);
  const legSwayL = isWalking ? walkCycle * 0.3 : 0;
  const legSwayR = isWalking ? -walkCycle * 0.3 : 0;
  px(1 + legSwayL, 8, 2, 2, ARMOR);
  px(5 + legSwayR, 8, 2, 2, ARMOR);
  px(1 + legSwayL, 8, 2, 1, ARMHL);
  px(5 + legSwayR, 8, 2, 1, ARMHL);
  const torsoLean = isWalking ? (flip ? -0.3 : 0.3) : 0;
  px(1 + torsoLean, 5, 6, 3, ARMOR);
  px(1 + torsoLean, 5, 6, 1, ARMHL);
  px(2 + torsoLean, 6, 1, 1, STRAP);
  px(5 + torsoLean, 6, 1, 1, STRAP);
  px(0, 4, 2, 2, ARMHL);
  px(6, 4, 2, 2, ARMHL);
  px(2, 1, 4, 4, ARMOR);
  px(1, 2, 1, 2, ARMOR);
  px(6, 2, 1, 2, ARMOR);
  px(2, 1, 4, 1, ARMHL);

  // Visor
  ctx.save();
  const visorX = flip ? sx + 2 * PW : sx + 3 * PW;
  const visorY = sy + 2.5 * PH + bobY;
  ctx.fillStyle = VISOR;
  ctx.globalAlpha = darkness > 0.3 ? Math.min(1.0, 0.7 + darkness * 0.5) : 0.55;
  ctx.fillRect(visorX, visorY, 3 * PW, PH * 0.65);
  ctx.restore();

  // Visor glow (night)
  if (darkness > 0.3) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.55, darkness * 0.65);
    const vx = (flip ? sx + 3.5 * PW : sx + 4.5 * PW);
    const vy = sy + 2.8 * PH + bobY;
    const vg = ctx.createRadialGradient(vx, vy, 0, vx, vy, PW * 2.8);
    vg.addColorStop(0, 'rgba(0,210,255,0.9)');
    vg.addColorStop(1, 'rgba(0,100,200,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(vx - PW * 3, vy - PH, PW * 6, PH * 2.5);
    ctx.restore();
  }

  // Arms
  if (!flip) { px(3, 5, 1, 2, ARMOR); px(6, 5, 1, 2, ARMOR); }
  else { px(4, 5, 1, 2, ARMOR); px(1, 5, 1, 2, ARMOR); }

  // Rifle
  const rifleRow = isShooting ? 5.0 : 5.5;
  const rifleRecoil = isShooting ? (flashT < 0.3 ? flashT * 1.5 : 0) : 0;
  if (!flip) {
    const rc = rifleRecoil;
    px(4 - rc, rifleRow, 4, 1, RIFLE);
    px(7 - rc, rifleRow, 1, 1, RIFHL);
    px(4 - rc, rifleRow + 1, 2, 0.8, RIFLE);
    px(5 - rc, rifleRow - 0.4, 2, 0.4, RIFHL);
  } else {
    const rc = rifleRecoil;
    px(0 + rc, rifleRow, 4, 1, RIFLE);
    px(0 + rc, rifleRow, 1, 1, RIFHL);
    px(2 + rc, rifleRow + 1, 2, 0.8, RIFLE);
    px(1 + rc, rifleRow - 0.4, 2, 0.4, RIFHL);
  }

  // Muzzle flash
  if (isShooting && flashAlpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = flashAlpha;
    const muzzleOffset = rifleRecoil * PW;
    const muzzleX = flip ? sx + 0.2 * PW + muzzleOffset : sx + 7.8 * PW - muzzleOffset;
    const muzzleY = sy + rifleRow * PH + bobY + PH * 0.5;
    const fDir = flip ? -1 : 1;
    const beamLen = sw * 3.8;
    const beamX = fDir > 0 ? muzzleX : muzzleX - beamLen;
    const bg = ctx.createLinearGradient(beamX, muzzleY, beamX + beamLen, muzzleY);
    bg.addColorStop(0, 'rgba(255,255,200,1.0)');
    bg.addColorStop(0.12, 'rgba(255,220,60,0.9)');
    bg.addColorStop(0.45, 'rgba(255,140,10,0.45)');
    bg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(beamX, muzzleY - PH * 0.35, beamLen, PH * 0.7);
    const outerR = PW * 2.6;
    const og = ctx.createRadialGradient(muzzleX, muzzleY, 0, muzzleX, muzzleY, outerR * 2.0);
    og.addColorStop(0, 'rgba(255,255,180,0.85)');
    og.addColorStop(0.3, 'rgba(255,180,40,0.5)');
    og.addColorStop(0.7, 'rgba(255,80,0,0.2)');
    og.addColorStop(1, 'rgba(200,20,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(muzzleX, muzzleY, outerR * 2.0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,130,0.95)';
    const spikeAngles = [0, Math.PI * 0.33, Math.PI * 0.66, Math.PI, Math.PI * 1.33, Math.PI * 1.66];
    for (const ang of spikeAngles) {
      const sLen = outerR * 1.4;
      ctx.save(); ctx.translate(muzzleX, muzzleY); ctx.rotate(ang);
      ctx.fillRect(-PW * 0.25, -sLen, PW * 0.5, sLen);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,1.0)';
    ctx.beginPath(); ctx.arc(muzzleX, muzzleY, PW * 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  if (darkness > 0.35) {
    ctx.save();
    ctx.globalAlpha = nightFade;
    ctx.fillStyle = 'rgba(10,15,40,1)';
    ctx.fillRect(sx, sy + bobY, sw, sh);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WARRIOR BUG
// ═══════════════════════════════════════════════════════════════════════════
function drawWarriorBug(ctx, sx, sy, sw, sh, darkness, t, flip) {
  const phase = (sx * 0.019 + sy * 0.007) % (Math.PI * 2);
  const tCycle = t * 0.0015 + phase;
  const walkOff = Math.sin(tCycle * 4) * sh * 0.03;
  const PW = sw / 10, PH = sh / 8;

  function r(lx, ly, lw, lh, col, a) {
    ctx.save();
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = col;
    const rx = flip ? sx + (10 - lx - lw) * PW : sx + lx * PW;
    ctx.fillRect(rx, sy + ly * PH + walkOff, lw * PW + 0.5, lh * PH + 0.5);
    ctx.restore();
  }

  const DARK = '#150e04', CHIT = '#2c1a07', MID = '#412610', HI = '#5e3818';
  const EDGE = '#7a4c22', CLAW = '#1a1005', EYE = '#ff8800', EYEG = '#ffcc44';
  const LEG = '#251508', LEGH = '#3d2210';

  r(0, 5, 1, 3, LEG); r(0, 5, 1, 1, LEGH);
  r(9, 5, 1, 3, LEG); r(9, 5, 1, 1, LEGH);
  r(1, 5.5, 1, 2.5, LEG); r(8, 5.5, 1, 2.5, LEG);
  r(1, 5.5, 1, 0.8, LEGH); r(8, 5.5, 1, 0.8, LEGH);
  r(2, 5, 1.5, 2, LEG); r(6.5, 5, 1.5, 2, LEG);
  r(2, 5, 1, 0.8, LEGH); r(7, 5, 1, 0.8, LEGH);
  r(5, 2, 5, 4, DARK); r(5, 2, 5, 3, CHIT); r(5, 2, 5, 1, MID);
  r(6, 2.5, 3, 0.5, HI); r(9, 3, 1, 2, DARK);
  r(3, 2.5, 3, 3.5, CHIT); r(3, 2.5, 3, 1, MID); r(3.5, 3, 2, 0.5, HI);
  r(0, 3, 4, 3, CHIT); r(0, 3, 4, 1, MID); r(0.5, 3.2, 3, 0.6, HI);
  r(0, 3.5, 1.5, 1, CLAW); r(0, 4.2, 1, 1, CLAW);
  r(0, 2.8, 0.8, 0.5, EDGE); r(0, 4.5, 0.8, 0.5, EDGE);

  const eyeLX = sx + 1.0 * PW, eyeRX = sx + 2.0 * PW;
  const eyeY = sy + 3.5 * PH + walkOff;
  const eyePulse = 0.85;
  ctx.save();
  ctx.globalAlpha = 0.55 * eyePulse;
  const eg = ctx.createRadialGradient(eyeLX, eyeY, 0, eyeLX, eyeY, PW * 1.8);
  eg.addColorStop(0, 'rgba(255,140,0,0.9)'); eg.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = eg;
  ctx.fillRect(eyeLX - PW * 1.8, eyeY - PH, PW * 3.6, PH * 2);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = EYE; ctx.globalAlpha = eyePulse;
  ctx.fillRect(eyeLX, eyeY, PW * 0.9, PH * 0.7);
  ctx.fillRect(eyeRX, eyeY, PW * 0.9, PH * 0.7);
  ctx.fillStyle = EYEG; ctx.globalAlpha = eyePulse * 0.8;
  ctx.fillRect(eyeLX + PW * 0.1, eyeY, PW * 0.35, PH * 0.3);
  ctx.fillRect(eyeRX + PW * 0.1, eyeY, PW * 0.35, PH * 0.3);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// HOPPER BUG
// ═══════════════════════════════════════════════════════════════════════════
function drawHopperBug(ctx, sx, sy, sw, sh, darkness, t, flip) {
  const phase = (sx * 0.023 + sy * 0.011) % (Math.PI * 2);
  const tCycle = t * 0.002 + phase;
  const hoverY = Math.sin(tCycle * 3.5) * sh * 0.08;
  const wingFlap = Math.sin(tCycle * 12);
  const PW = sw / 10, PH = sh / 10;

  function r(lx, ly, lw, lh, col, a) {
    ctx.save();
    if (a !== undefined) ctx.globalAlpha = a;
    ctx.fillStyle = col;
    const rx = flip ? sx + (10 - lx - lw) * PW : sx + lx * PW;
    ctx.fillRect(rx, sy + ly * PH + hoverY, lw * PW + 0.5, lh * PH + 0.5);
    ctx.restore();
  }

  const DARK = '#1a1a08', BODY = '#2e2e0e', MID = '#3e3a14', HI = '#5a541e';
  const LEG = '#282810', EYE = '#00ff88', EYEG = '#aaffcc';
  const wingSpread = 0.8 + Math.abs(wingFlap) * 0.4;
  const wAlpha = 0.25 + Math.abs(wingFlap) * 0.15;

  ctx.save();
  ctx.globalAlpha = wAlpha;
  ctx.fillStyle = 'rgba(180,210,160,1)';
  ctx.fillRect(sx - PW * wingSpread * 1.5, sy + hoverY + PH, PW * 3.5 * wingSpread, PH * 2.5);
  ctx.fillRect(sx + 6 * PW, sy + hoverY + PH, PW * 3.5 * wingSpread, PH * 2.5);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = wAlpha * 0.65;
  ctx.fillStyle = 'rgba(180,210,160,1)';
  ctx.fillRect(sx - PW * wingSpread, sy + hoverY + 3 * PH, PW * 2.5 * wingSpread, PH * 1.8);
  ctx.fillRect(sx + 5 * PW, sy + hoverY + 3 * PH, PW * 2.5 * wingSpread, PH * 1.8);
  ctx.restore();

  r(2, 6, 0.8, 2.5, LEG); r(7.2, 6, 0.8, 2.5, LEG);
  r(3.5, 5.5, 0.8, 2, LEG); r(5.7, 5.5, 0.8, 2, LEG);
  r(4, 5, 1, 1.5, LEG); r(5, 5, 1, 1.5, LEG);
  r(4, 4, 2, 5, DARK); r(4.2, 4, 1.6, 5, BODY); r(4.2, 4, 1.6, 1, MID);
  for (let seg = 1; seg < 4; seg++) r(4.2, 4 + seg * 1.2, 1.6, 0.2, DARK);
  r(3, 3, 4, 2.5, BODY); r(3, 3, 4, 0.8, MID); r(3.5, 3.3, 3, 0.4, HI);
  r(3, 1, 4, 2.5, BODY); r(3, 1, 4, 0.7, MID);

  const eyeLX = sx + 2 * PW, eyeRX = sx + 6 * PW;
  const eyeY = sy + 1.5 * PH + hoverY;
  const eyePulse = 0.85;
  ctx.save();
  ctx.globalAlpha = 0.5 * eyePulse;
  const eg = ctx.createRadialGradient(eyeLX, eyeY, 0, eyeLX, eyeY, PW * 2);
  eg.addColorStop(0, 'rgba(0,255,130,0.9)'); eg.addColorStop(1, 'rgba(0,180,80,0)');
  ctx.fillStyle = eg; ctx.fillRect(eyeLX - PW * 2, eyeY - PH, PW * 4, PH * 2);
  const eg2 = ctx.createRadialGradient(eyeRX, eyeY, 0, eyeRX, eyeY, PW * 2);
  eg2.addColorStop(0, 'rgba(0,255,130,0.9)'); eg2.addColorStop(1, 'rgba(0,180,80,0)');
  ctx.fillStyle = eg2; ctx.fillRect(eyeRX - PW * 2, eyeY - PH, PW * 4, PH * 2);
  ctx.restore();
  ctx.save();
  ctx.fillStyle = EYE; ctx.globalAlpha = eyePulse;
  ctx.fillRect(eyeLX, eyeY, PW * 1.2, PH * 1.2);
  ctx.fillRect(eyeRX, eyeY, PW * 1.2, PH * 1.2);
  ctx.fillStyle = EYEG; ctx.globalAlpha = eyePulse * 0.7;
  ctx.fillRect(eyeLX, eyeY, PW * 0.5, PH * 0.5);
  ctx.fillRect(eyeRX, eyeY, PW * 0.5, PH * 0.5);
  ctx.restore();
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE SHOWCASE IMAGE
// ═══════════════════════════════════════════════════════════════════════════

const W = 900, H = 600;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const t = 1000; // fixed time for static render

// Background
ctx.fillStyle = '#1a0d05';
ctx.fillRect(0, 0, W, H);

// Title
ctx.fillStyle = '#f97316';
ctx.font = 'bold 16px monospace';
ctx.textAlign = 'center';
ctx.fillText('VULCAN — CANVAS-DRAWN UNIT SHOWCASE', W / 2, 25);

// Labels
ctx.fillStyle = '#a05020';
ctx.font = '10px monospace';
ctx.textAlign = 'center';

// ── Trooper Idle ──
ctx.fillStyle = '#2a1505';
ctx.fillRect(30, 50, 160, 240);
drawNPCTrooper(ctx, 50, 60, 120, 180, 0, t, false, 'idle', 0);
ctx.fillStyle = '#a05020';
ctx.fillText('TROOPER — IDLE', 110, 310);

// ── Trooper Shooting (wider canvas for beam) ──
ctx.fillStyle = '#2a1505';
ctx.fillRect(210, 50, 460, 240);
drawNPCTrooper(ctx, 230, 60, 120, 180, 0, t, false, 'shoot', 50);
ctx.fillStyle = '#a05020';
ctx.fillText('TROOPER — SHOOTING (muzzle flash + beam tracer)', 440, 310);

// ── Trooper Walking ──
ctx.fillStyle = '#2a1505';
ctx.fillRect(690, 50, 160, 240);
drawNPCTrooper(ctx, 710, 60, 120, 180, 0, t, false, 'patrol', 0);
ctx.fillStyle = '#a05020';
ctx.fillText('TROOPER — WALKING', 770, 310);

// ── Warrior Bug ──
ctx.fillStyle = '#2a1505';
ctx.fillRect(50, 340, 350, 200);
drawWarriorBug(ctx, 80, 370, 280, 150, 0, t, false);
ctx.fillStyle = '#a05020';
ctx.fillText('WARRIOR BUG — 6 legs, claws, amber eyes', 225, 560);

// ── Hopper Bug ──
ctx.fillStyle = '#2a1505';
ctx.fillRect(430, 340, 300, 220);
drawHopperBug(ctx, 460, 360, 240, 180, 0, t, false);
ctx.fillStyle = '#a05020';
ctx.fillText('HOPPER BUG — wings, green eyes', 580, 580);

// ── Trooper Night ──
ctx.fillStyle = '#0a0a18';
ctx.fillRect(750, 340, 130, 220);
drawNPCTrooper(ctx, 770, 360, 90, 170, 0.7, t, false, 'alert', 0);
ctx.fillStyle = '#a05020';
ctx.fillText('NIGHT MODE', 815, 580);
ctx.fillText('(visor glow)', 815, 592);

// Save
const buf = canvas.toBuffer('image/png');
fs.writeFileSync('/app/incoming_files/unit_showcase.png', buf);
console.log('✅ Saved unit_showcase.png');
