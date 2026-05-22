// ━━━ STAR TROOP RENDERER ━━━
import { CANVAS_WIDTH, CANVAS_HEIGHT, GROUND_Y, WORLD_WIDTH, COLORS, PLAYER } from '../constants';
import { drawPlayer } from './sprites/drawPlayer';
import { drawBug } from './sprites/drawBug';
import { drawBuilding } from './sprites/drawBuilding';
import { drawInfantry } from './sprites/drawInfantry';
import { drawHUD } from './drawHUD';

export class Renderer {
  constructor(ctx) {
    this.ctx  = ctx;
    this.time = 0;
    // FX system ref — set in render() so crosshair can be called without engine
    this.fx   = null;
  }

  render(engine) {
    const ctx = this.ctx;
    const cam = engine.camera;
    this.fx = engine.fx; // keep ref for crosshair
    const dn = engine.dayNight;
    const fx = engine.fx;
    this.time += 16;

    ctx.save();

    // Apply screen shake
    ctx.translate(fx.shakeX, fx.shakeY);

    // === BACKGROUND ===
    this._drawSky(ctx, dn);
    this._drawStars(ctx, dn);
    this._drawMountainsFar(ctx, cam, dn);
    this._drawMountainsMid(ctx, cam, dn);

    // === TERRAIN ===
    this._drawGround(ctx, cam, dn);

    // === GAME ENTITIES ===
    // Ore nodes
    for (const ore of engine.entities.oreNodes) {
      if (ore.collected) continue;
      if (!cam.isVisible(ore.x)) continue;
      this._drawOre(ctx, ore, cam);
    }

    // Survivor pods
    for (const s of engine.entities.survivors) {
      if (s.rescued) continue;
      if (!cam.isVisible(s.x)) continue;
      this._drawSurvivor(ctx, s, cam);
    }

    // Buildings
    for (const b of engine.entities.buildings) {
      if (!cam.isVisible(b.x + b.width / 2, b.width)) continue;
      drawBuilding(ctx, b, cam);
    }

    // Infantry
    for (const mi of engine.entities.infantry) {
      if (!cam.isVisible(mi.x)) continue;
      drawInfantry(ctx, mi, cam);
    }

    // Bugs
    for (const bug of engine.entities.bugs) {
      if (!cam.isVisible(bug.x)) continue;
      drawBug(ctx, bug, cam);
    }

    // Player
    drawPlayer(ctx, engine.entities.player, cam, dn);

    // Projectiles
    this._drawProjectiles(ctx, engine.entities.projectiles, cam);

    // Grenades
    this._drawGrenades(ctx, engine.entities.grenades, cam);

    // Particles
    this._drawParticles(ctx, engine.entities.particles, cam);

    // Lifepod trails, columns, pods, off-screen arrows
    if (engine.lifepods) {
      engine.lifepods.render(ctx, engine);
    }

    // === LIGHTING OVERLAY ===
    this._drawNightOverlay(ctx, dn, engine.entities.player, cam);

    // Atmospheric flash (lifepod ship explosion)
    if (engine.fx && engine.fx.flash && engine.fx.flash.timer > 0) {
      const f = engine.fx.flash;
      const a = f.alpha * (f.timer / f.duration);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle   = f.color;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.restore();
      f.timer -= 16;
    }

    // === UI ===
    drawHUD(ctx, engine);

    // Crosshair — always on top of everything
    const sustainRatio = engine.entities.player
      ? Math.min(1, (engine.entities.player.sustainedFireMs || 0) / 2400)
      : 0;
    this.fx.drawCrosshair(ctx, engine.mouseX, engine.mouseY, sustainRatio);

    // Pause screen
    if (engine.paused) this._drawPauseScreen(ctx, engine);

    // Win / Lose screens
    if (engine.gameWon)  this._drawWinScreen(ctx, engine);
    if (engine.gameOver) this._drawGameOver(ctx, engine);

    ctx.restore();
  }

  _drawSky(ctx, dn) {
    const d = dn.darkness;
    // Gradient from sky color
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    if (d < 0.3) {
      grad.addColorStop(0, this._lerpColor('#c45a20', '#6b1a3a', d / 0.3));
      grad.addColorStop(1, this._lerpColor('#e8854a', '#3a0e1e', d / 0.3));
    } else {
      grad.addColorStop(0, this._lerpColor('#6b1a3a', '#0d0a1a', (d - 0.3) / 0.7));
      grad.addColorStop(1, this._lerpColor('#3a0e1e', '#050310', (d - 0.3) / 0.7));
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  _drawStars(ctx, dn) {
    if (dn.darkness < 0.5) return;
    const alpha = (dn.darkness - 0.5) * 2;
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.6})`;
    // Pseudo-random stars
    const seed = 42;
    for (let i = 0; i < 60; i++) {
      const px = ((i * 7919 + seed) % CANVAS_WIDTH);
      const py = ((i * 4231 + seed) % (GROUND_Y - 40));
      const sz = ((i * 3) % 3) * 0.5 + 0.5;
      const flicker = Math.sin(this.time * 0.003 + i) * 0.3 + 0.7;
      ctx.globalAlpha = alpha * 0.6 * flicker;
      ctx.fillRect(px, py, sz, sz);
    }
    ctx.globalAlpha = 1;
  }

  _drawMountainsFar(ctx, cam, dn) {
    const parallax = 0.1;
    const offset = -(cam.x * parallax) % CANVAS_WIDTH;
    const d = dn.darkness;
    ctx.fillStyle = this._lerpColor('#5a2a10', '#1a0a08', d);

    for (let x = -CANVAS_WIDTH; x < CANVAS_WIDTH * 2; x += 160) {
      const sx = x + offset;
      const h = 60 + Math.sin(x * 0.01) * 30 + Math.cos(x * 0.007) * 20;
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y - 60);
      ctx.lineTo(sx + 80, GROUND_Y - 60 - h);
      ctx.lineTo(sx + 160, GROUND_Y - 60);
      ctx.fill();
    }
  }

  _drawMountainsMid(ctx, cam, dn) {
    const parallax = 0.25;
    const offset = -(cam.x * parallax) % CANVAS_WIDTH;
    const d = dn.darkness;
    ctx.fillStyle = this._lerpColor('#4a2008', '#120608', d);

    for (let x = -CANVAS_WIDTH; x < CANVAS_WIDTH * 2; x += 120) {
      const sx = x + offset;
      const h = 40 + Math.sin(x * 0.015 + 1) * 25;
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y - 30);
      ctx.lineTo(sx + 60, GROUND_Y - 30 - h);
      ctx.lineTo(sx + 120, GROUND_Y - 30);
      ctx.fill();
    }
  }

  _drawGround(ctx, cam, dn) {
    const d = dn.darkness;
    // Main ground
    ctx.fillStyle = this._lerpColor(COLORS.GROUND, COLORS.GROUND_DARK, d);
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, CANVAS_HEIGHT - GROUND_Y);

    // Terrain detail line
    ctx.fillStyle = this._lerpColor(COLORS.TERRAIN_ACCENT, '#1a0e06', d);
    ctx.fillRect(0, GROUND_Y, CANVAS_WIDTH, 3);

    // Ground texture dots
    ctx.fillStyle = this._lerpColor('#4a3520', '#1e120a', d);
    for (let i = 0; i < 40; i++) {
      const wx = ((i * 127 + 31) % WORLD_WIDTH);
      const sx = cam.worldToScreen(wx);
      if (sx < -10 || sx > CANVAS_WIDTH + 10) continue;
      const sy = GROUND_Y + 8 + (i * 7) % 20;
      ctx.fillRect(sx, sy, 2 + (i % 3), 1);
    }
  }

  _drawOre(ctx, ore, cam) {
    const sx = cam.worldToScreen(ore.x);
    const sy = ore.y;

    // Glow
    const pulse = Math.sin(this.time * 0.004 + ore.glowPhase) * 0.3 + 0.7;
    ctx.fillStyle = COLORS.ORE_GLOW;
    ctx.globalAlpha = 0.3 * pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Crystal shape
    ctx.fillStyle = COLORS.ORE;
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy + 4);
    ctx.lineTo(sx - 2, sy - 8);
    ctx.lineTo(sx + 3, sy - 6);
    ctx.lineTo(sx + 7, sy + 2);
    ctx.lineTo(sx + 2, sy + 6);
    ctx.closePath();
    ctx.fill();

    // Highlight
    ctx.fillStyle = '#bbddff';
    ctx.fillRect(sx - 1, sy - 6, 2, 3);
  }

  _drawSurvivor(ctx, s, cam) {
    const sx = cam.worldToScreen(s.x);
    const sy = s.y;
    const pulse = Math.sin(this.time * 0.005 + s.pulsePhase) * 0.3 + 0.7;

    // Pod glow
    ctx.fillStyle = COLORS.SURVIVOR_POD;
    ctx.globalAlpha = 0.2 * pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Pod body
    ctx.fillStyle = '#336699';
    ctx.fillRect(sx - 10, sy - 14, 20, 22);
    ctx.fillStyle = COLORS.SURVIVOR_POD;
    ctx.fillRect(sx - 8, sy - 12, 16, 8);

    // Beacon flash
    ctx.fillStyle = `rgba(68, 170, 255, ${pulse})`;
    ctx.fillRect(sx - 2, sy - 18, 4, 4);
  }

  _drawProjectiles(ctx, projectiles, cam) {
    for (const p of projectiles) {
      if (!cam.isVisible(p.x)) continue;
      const sx = cam.worldToScreen(p.x);

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';

      // Trail
      ctx.strokeStyle = COLORS.BULLET;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      for (let j = 0; j < p.trail.length; j++) {
        const t = p.trail[j];
        const tx = cam.worldToScreen(t.x);
        if (j === 0) ctx.moveTo(tx, t.y);
        else ctx.lineTo(tx, t.y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Bullet
      ctx.fillStyle = COLORS.BULLET;
      ctx.fillRect(sx - 2, p.y - 1, 4, 2);

      ctx.restore();
    }
  }

  _drawGrenades(ctx, grenades, cam) {
    for (const g of grenades) {
      if (!cam.isVisible(g.x)) continue;
      const sx = cam.worldToScreen(g.x);
      ctx.fillStyle = COLORS.GRENADE;
      ctx.beginPath();
      ctx.arc(sx, g.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Fuse spark
      if (g.life < 600) {
        ctx.fillStyle = '#ff4422';
        ctx.beginPath();
        ctx.arc(sx, g.y - 5, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _drawParticles(ctx, particles, cam) {
    for (const p of particles) {
      if (!cam.isVisible(p.x, 50)) continue;
      const sx = cam.worldToScreen(p.x);
      const alpha = Math.max(0, p.life / (p.maxLife || 500));

      // Guard: skip particles with missing or invalid color
      if (!p.color) continue;

      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'transparent';
      ctx.lineWidth = 0;

      if (p.text) {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, sx, p.y);
      } else {
        const sz = Math.max(0.5, p.size * alpha);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(sx - sz / 2, p.y - sz / 2, sz, sz);
      }

      ctx.restore();
    }
  }

  _drawNightOverlay(ctx, dn, player, cam) {
    if (dn.darkness <= 0) return;

    const d = dn.darkness;
    const px = cam.worldToScreen(player.x);
    const py = player.y - player.height / 2;

    // Dark overlay
    ctx.fillStyle = `rgba(5, 3, 16, ${d * 0.65})`;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Player flashlight cone
    if (d > 0.3) {
      const flashAlpha = (d - 0.3) * 0.7;
      const dir = player.facing;
      const range = PLAYER.FLASHLIGHT_RANGE;

      const grad = ctx.createRadialGradient(
        px + dir * 20, py, 10,
        px + dir * range, py, range
      );
      grad.addColorStop(0, `rgba(255, 220, 160, ${flashAlpha * 0.5})`);
      grad.addColorStop(0.5, `rgba(255, 200, 120, ${flashAlpha * 0.2})`);
      grad.addColorStop(1, 'rgba(255, 200, 120, 0)');

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(px + dir * range * 0.5, py, range, range * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Ambient glow around player
      const ambGrad = ctx.createRadialGradient(px, py, 0, px, py, 80);
      ambGrad.addColorStop(0, `rgba(255, 200, 140, ${flashAlpha * 0.15})`);
      ambGrad.addColorStop(1, 'rgba(255, 200, 140, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = ambGrad;
      ctx.beginPath();
      ctx.arc(px, py, 80, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawGameOver(ctx, engine) {
    const t       = Math.min(1, engine.gameOverTimer / 800);
    const reason  = engine.gameOverReason || 'hq_destroyed';
    const titleTxt = reason === 'player_dead' ? 'SOLDIER DOWN' : 'BASE LOST';

    // Dark vignette fade in
    ctx.save();
    ctx.globalAlpha = t * 0.82;
    ctx.fillStyle   = '#050210';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    if (t < 0.4) return; // wait for fade before showing text

    const textAlpha = Math.min(1, (t - 0.4) / 0.6);
    ctx.save();
    ctx.globalAlpha = textAlpha;

    // Title
    ctx.font        = 'bold 52px monospace';
    ctx.textAlign   = 'center';
    ctx.fillStyle   = '#cc2222';
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur  = 24;
    ctx.fillText(titleTxt, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    // Subtitle
    ctx.font      = '18px monospace';
    ctx.fillStyle = '#e8d4b4';
    ctx.shadowBlur = 6;
    const sub = reason === 'player_dead'
      ? 'The mission continues without you.'
      : 'The bugs have overrun the base.';
    ctx.fillText(sub, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 16);

    // Stats
    ctx.font      = '14px monospace';
    ctx.fillStyle = '#aaa';
    ctx.shadowBlur = 0;
    ctx.fillText(`Night ${engine.wave}  ·  Score ${engine.score}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

    // Restart prompt
    if (engine.gameOverTimer > 1800) {
      ctx.font      = '13px monospace';
      ctx.fillStyle = `rgba(200,180,140,${0.5 + Math.sin(Date.now() * 0.004) * 0.5})`;
      ctx.fillText('[ R ] to deploy again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
    }

    ctx.restore();
  }

  _lerpColor(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16);
    const bg = parseInt(b.slice(3, 5), 16);
    const bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `rgb(${r},${g},${bl})`;
  }
  _drawWinScreen(ctx, engine) {
    const t = Math.min(1, engine.gameWonTimer / 1000);

    ctx.save();
    ctx.globalAlpha = t * 0.75;
    ctx.fillStyle   = '#020810';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.restore();

    if (t < 0.35) return;

    const textAlpha = Math.min(1, (t - 0.35) / 0.65);
    ctx.save();
    ctx.globalAlpha = textAlpha;
    ctx.textAlign   = 'center';

    // Golden title
    ctx.font        = 'bold 52px monospace';
    ctx.fillStyle   = '#ffdd44';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur  = 28;
    ctx.fillText('MISSION COMPLETE', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    ctx.font      = '18px monospace';
    ctx.fillStyle = '#e8d4b4';
    ctx.shadowBlur = 8;
    ctx.fillText('All waves repelled. The colony survives.', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 14);

    ctx.font      = '14px monospace';
    ctx.fillStyle = '#aaa';
    ctx.shadowBlur = 0;
    const rescued = engine.entities.infantry.filter(m => m.hp > 0).length;
    ctx.fillText(
      `Score ${engine.score}  ·  Survivors ${rescued}  ·  Night ${engine.wave}`,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 22
    );

    if (engine.gameWonTimer > 2000) {
      ctx.font      = '13px monospace';
      ctx.fillStyle = `rgba(200,200,140,${0.5 + Math.sin(Date.now() * 0.004) * 0.5})`;
      ctx.fillText('[ R ] to deploy again', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 62);
    }
    ctx.restore();
  }

  _drawPauseScreen(ctx, engine) {
    // Semi-transparent dark blur overlay
    ctx.save();
    ctx.fillStyle = 'rgba(4, 4, 16, 0.78)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.textAlign   = 'center';
    ctx.shadowBlur  = 16;

    // Title
    ctx.font        = 'bold 42px monospace';
    ctx.fillStyle   = '#e8d4b4';
    ctx.shadowColor = '#e8d4b4';
    ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 70);

    // Divider
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(200,160,80,0.35)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(CANVAS_WIDTH / 2 - 120, CANVAS_HEIGHT / 2 - 46);
    ctx.lineTo(CANVAS_WIDTH / 2 + 120, CANVAS_HEIGHT / 2 - 46);
    ctx.stroke();

    // Controls list
    ctx.font      = '13px monospace';
    ctx.shadowBlur = 0;
    const controls = [
      ['A / D',        'Move'],
      ['W / Space',    'Jump'],
      ['Mouse',        'Aim & Shoot'],
      ['G / E',        'Grenade'],
      ['B',            'Build'],
      ['ESC',          'Pause / Resume'],
      ['R',            'Restart  (game over)'],
    ];
    const startY = CANVAS_HEIGHT / 2 - 24;
    const lineH  = 22;
    controls.forEach(([key, desc], i) => {
      const y = startY + i * lineH;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(200,180,120,0.9)';
      ctx.fillText(key, CANVAS_WIDTH / 2 - 10, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(180,200,160,0.7)';
      ctx.fillText(desc, CANVAS_WIDTH / 2 + 10, y);
    });

    // Resume prompt — pulses
    ctx.textAlign   = 'center';
    ctx.font        = '13px monospace';
    ctx.fillStyle   = `rgba(200,200,140,${0.5 + Math.sin(Date.now() * 0.004) * 0.5})`;
    ctx.fillText('[ ESC ] to resume', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 116);

    // Current status strip
    const dn = engine.dayNight;
    const phase = dn.phase.toUpperCase();
    const infantry = engine.entities.infantry.filter(m => m.hp > 0).length;
    ctx.font      = '11px monospace';
    ctx.fillStyle = 'rgba(150,150,150,0.6)';
    ctx.fillText(
      `Night ${engine.wave}  ·  ${phase}  ·  Squad ${infantry}  ·  Ore ${engine.ore}  ·  Score ${engine.score}`,
      CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20
    );

    ctx.restore();
  }

}