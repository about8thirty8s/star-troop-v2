// LAST HUNT: KILLBOX — Thermal Vision Overlay
// Full mud = invisible. Squadmates glow. Animals show. Dead bodies cool.

// Per-character thermal signature sizes
const CHAR_THERMAL = {
  mac:    { rx: 22, ry: 28, color: [255, 200, 60]  },  // broad hot signature
  ponchi: { rx: 19, ry: 25, color: [255, 180, 40]  },  // medium, stocky
  annie:  { rx: 15, ry: 24, color: [255, 220, 80]  },  // slim, balanced
  blaze:  { rx: 26, ry: 30, color: [255, 140, 20]  },  // biggest, hottest
};

const DEFAULT_SQUAD_THERMAL = { rx: 18, ry: 24, color: [255, 200, 60] };

function worldToScreenThermal(worldX, worldY, camera, W, H) {
  return {
    x: (worldX - camera.x) * camera.zoom,
    y: (worldY - camera.y) * camera.zoom,
  };
}

export function renderThermalOverlay(ctx, W, H, gameState) {
  const { player, hunter, wildlife, firePatches, particles, camera, helicopter } = gameState;
  const squad = helicopter?.squad || gameState.squad || [];
  const zoom = camera.zoom || 1;

  // Dark teal base
  ctx.fillStyle = 'rgba(0, 15, 20, 0.88)';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  // ── Fire patches — very hot ───────────────────────────────────────────
  for (const f of (firePatches || [])) {
    const intensity = Math.min(1, f.life / 80);
    const fireRadius = 28 * zoom;
    const grd = ctx.createRadialGradient(f.x + 8, f.y + 8, 0, f.x + 8, f.y + 8, fireRadius);
    grd.addColorStop(0, `rgba(255,255,100,${0.9 * intensity})`);
    grd.addColorStop(0.4, `rgba(255,120,0,${0.7 * intensity})`);
    grd.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(f.x - 20 * zoom, f.y - 20 * zoom, 56 * zoom, 56 * zoom);
  }

  // ── Player heat signature — mud blocks thermal completely ─────────────
  if (player.alive) {
    const mud = player.mudAmount || 0;
    // thermalVisibility: 0 = fully hidden, 1 = fully visible
    const thermalVis = Math.max(0, 1.0 - mud * 1.18);  // drops to 0 at ~0.85 mud
    const researchFactor = gameState.research?.unlocked?.has('thermal_resist') ? 0.5 : 1.0;
    const alpha = 0.85 * thermalVis * researchFactor;

    if (alpha > 0.01) {
      // Partial mud: draw broken/fragmented heat signature
      const charId = player.characterId || 'annie';
      const sig = CHAR_THERMAL[charId] || CHAR_THERMAL.annie;
      const cx = player.x + player.w / 2;
      const cy = player.y + player.h / 2;

      if (mud > 0.4 && mud < 0.85) {
        // Partial mud — draw broken gaps: 3 separate heat fragments
        const fragments = 3;
        for (let i = 0; i < fragments; i++) {
          const fragAlpha = alpha * (0.5 + Math.sin(Date.now() * 0.003 + i * 2.1) * 0.3);
          const ox = (Math.sin(i * 1.7) * sig.rx * 0.5);
          const oy = (Math.cos(i * 2.3) * sig.ry * 0.4);
          const radius = sig.rx * 0.6 * zoom;
          const grd = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, radius);
          grd.addColorStop(0, `rgba(${sig.color[0]},${sig.color[1]},${sig.color[2]},${fragAlpha})`);
          grd.addColorStop(1, 'rgba(255,40,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.ellipse(cx + ox, cy + oy, sig.rx * 0.5 * zoom, sig.ry * 0.5 * zoom, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (mud <= 0.4) {
        // Clean or light mud — full clean signature
        const radius = (sig.rx + 8) * zoom;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        grd.addColorStop(0, `rgba(${sig.color[0]},${sig.color[1]},${sig.color[2]},${alpha})`);
        grd.addColorStop(0.5, `rgba(255,120,0,${alpha * 0.7})`);
        grd.addColorStop(1, 'rgba(255,40,0,0)');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.ellipse(cx, cy, sig.rx * zoom, sig.ry * zoom, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // mud >= 0.85: nothing drawn — fully hidden
    }

    // Mud status label (screen-space, restore before text)
    ctx.restore();
    if (mud >= 0.85) {
      ctx.fillStyle = 'rgba(40,180,80,0.7)';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText('[CONCEALED]', (player.x + player.w / 2 - camera.x) * zoom - 18, (player.y - camera.y) * zoom - 14);
    } else if (mud > 0.5) {
      ctx.fillStyle = 'rgba(100,200,100,0.6)';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText('[MUDDY]', (player.x + player.w / 2 - camera.x) * zoom - 12, (player.y - camera.y) * zoom - 12);
    }
    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);
  }

  // ── Squadmate heat signatures ─────────────────────────────────────────
  for (const member of squad) {
    if (!member.alive) continue;
    const charId = member.characterId;
    const sig = (charId && CHAR_THERMAL[charId]) ? CHAR_THERMAL[charId] : DEFAULT_SQUAD_THERMAL;
    const cx = member.x + member.w / 2;
    const cy = member.y + member.h / 2;
    const pulse = 0.75 + Math.sin(Date.now() * 0.004 + cx * 0.01) * 0.15;
    const radius = (sig.rx + 6) * zoom;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grd.addColorStop(0, `rgba(${sig.color[0]},${sig.color[1]},${sig.color[2]},${0.8 * pulse})`);
    grd.addColorStop(0.5, `rgba(255,110,0,${0.55 * pulse})`);
    grd.addColorStop(1, 'rgba(255,40,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(cx, cy, sig.rx * zoom, sig.ry * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Squadmate labels (screen-space)
  ctx.restore();
  for (const member of squad) {
    if (!member.alive) continue;
    const charId = member.characterId;
    const sig = (charId && CHAR_THERMAL[charId]) ? CHAR_THERMAL[charId] : DEFAULT_SQUAD_THERMAL;
    const sx = (member.x + member.w / 2 - camera.x) * zoom;
    const sy = (member.y - camera.y) * zoom;
    ctx.fillStyle = `rgba(${sig.color[0]},${sig.color[1]},${sig.color[2]},0.7)`;
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText(charId ? charId.toUpperCase() : 'SQUAD', sx - 8, sy - 8);
  }
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  // ── Hunter heat signature ─────────────────────────────────────────────
  if (hunter && hunter.alive) {
    const blink = Math.floor(Date.now() / 120) % 2;
    const hunterRadius = 30 * zoom;
    const grd = ctx.createRadialGradient(
      hunter.x + hunter.w / 2, hunter.y + hunter.h / 2, 0,
      hunter.x + hunter.w / 2, hunter.y + hunter.h / 2, hunterRadius
    );
    grd.addColorStop(0, `rgba(0,255,180,${blink ? 0.95 : 0.7})`);
    grd.addColorStop(0.5, 'rgba(0,180,100,0.5)');
    grd.addColorStop(1, 'rgba(0,80,40,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.ellipse(hunter.x + hunter.w / 2, hunter.y + hunter.h / 2, 20 * zoom, 26 * zoom, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Hunter label (screen-space)
  ctx.restore();
  if (hunter && hunter.alive) {
    const sx = (hunter.x + hunter.w / 2 - camera.x) * zoom;
    const sy = (hunter.y - camera.y) * zoom;
    ctx.fillStyle = '#00ffaa';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('HUNTER', sx - 14, sy - 8);
  }
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-camera.x, -camera.y);

  ctx.restore();

  // ── Scanline effect ───────────────────────────────────────────────────
  ctx.save();
  for (let y = 0; y < H; y += 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, y, W, 1);
  }
  ctx.restore();

  // ── UI label ─────────────────────────────────────────────────────────
  ctx.fillStyle = '#00ffaa';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.shadowColor = '#00ffaa';
  ctx.shadowBlur = 6;
  ctx.fillText('[ THERMAL ]', 10, 58);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#336655';
  ctx.font = '6px "Press Start 2P", monospace';
  ctx.fillText('V to exit', 10, 68);
}

// Exported helper: should hunter plasma lock fail due to mud?
export function getMudThermalVisibility(player) {
  const mud = player?.mudAmount || 0;
  return Math.max(0, 1.0 - mud * 1.18);
}