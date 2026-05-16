// LAST HUNT: KILLBOX — Wildlife System
// Birds perch in trees, flee when startled, appear hot on thermal.
// Rats scurry along ground through tunnels, can trigger traps.

import { TILE_SIZE, TILE } from './constants';
import { getTile, isSolid } from './worldGen';

const BIRD_TYPES = [
  { name: 'macaw',   color: '#dd4422', wingColor: '#ffaa00', size: 5 },
  { name: 'toucan',  color: '#111111', wingColor: '#ffcc00', size: 6 },
  { name: 'parrot',  color: '#22aa44', wingColor: '#88ee33', size: 5 },
];

const RAT_COLOR = '#554433';

export function createWildlife(world) {
  const birds = [];
  const rats = [];

  // Place birds on tree canopy tiles
  for (const tree of world.trees) {
    if (Math.random() > 0.55) continue;
    const type = BIRD_TYPES[Math.floor(Math.random() * BIRD_TYPES.length)];
    birds.push({
      x: tree.x + (Math.random() - 0.5) * 24,
      y: tree.y - 8,
      vx: 0, vy: 0,
      type,
      state: 'perch',   // perch | flee | fly
      fleeTimer: 0,
      flapPhase: Math.random() * Math.PI * 2,
      heatSig: 0.6 + Math.random() * 0.3,  // thermal visibility
      perchX: tree.x + (Math.random() - 0.5) * 24,
      perchY: tree.y - 8,
    });
  }

  // Place rats near ground level at jungle floor
  const ratPositions = [20, 35, 55, 75, 95, 110, 145, 165, 185];
  for (const rx of ratPositions) {
    const groundRow = world.heights[Math.min(rx, world.heights.length - 1)];
    rats.push({
      x: rx * TILE_SIZE,
      y: (groundRow - 1) * TILE_SIZE,
      vx: (Math.random() > 0.5 ? 1 : -1) * 0.6,
      vy: 0,
      state: 'wander',
      wanderTimer: 60 + Math.floor(Math.random() * 120),
      heatSig: 0.25 + Math.random() * 0.15,
      alive: true,
    });
  }

  return { birds, rats };
}

export function updateWildlife(wildlife, player, hunter, tiles, particles) {
  const { birds, rats } = wildlife;

  // ── Birds ────────────────────────────────────────────────────────────────
  for (const bird of birds) {
    bird.flapPhase += 0.18;

    // Flee if player or hunter is too close
    const pdx = player.x - bird.x;
    const pdy = player.y - bird.y;
    const playerDist = Math.sqrt(pdx * pdx + pdy * pdy);

    let hunterDist = 9999;
    if (hunter && hunter.alive) {
      const hdx = hunter.x - bird.x;
      const hdy = hunter.y - bird.y;
      hunterDist = Math.sqrt(hdx * hdx + hdy * hdy);
    }

    const threatened = playerDist < 80 || hunterDist < 120;

    if (threatened && bird.state === 'perch') {
      bird.state = 'flee';
      bird.vx = (Math.random() - 0.5) * 4;
      bird.vy = -3 - Math.random() * 2;
      // Squawk particles (visual startle)
      for (let i = 0; i < 3; i++) {
        particles.push({
          x: bird.x, y: bird.y,
          vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2,
          life: 18, color: bird.type.color, size: 2, type: 'debris',
        });
      }
    }

    if (bird.state === 'flee' || bird.state === 'fly') {
      bird.x += bird.vx;
      bird.y += bird.vy;
      bird.vy += 0.05; // gentle gravity pull
      bird.vx *= 0.99;

      // If off-screen or high enough, circle back to a perch
      if (bird.y < -60 || bird.x < 0 || bird.x > 200 * TILE_SIZE) {
        // Reset to original perch
        bird.x = bird.perchX + (Math.random() - 0.5) * 200;
        bird.y = bird.perchY - 80;
        bird.vx = 0; bird.vy = 0;
        bird.state = 'perch';
      }
    }
  }

  // ── Rats ─────────────────────────────────────────────────────────────────
  for (const rat of rats) {
    if (!rat.alive) continue;

    rat.wanderTimer--;
    if (rat.wanderTimer <= 0) {
      rat.vx = (Math.random() > 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.5);
      rat.wanderTimer = 80 + Math.floor(Math.random() * 120);
    }

    rat.x += rat.vx;

    // Simple ground snap
    const tx = Math.floor(rat.x / TILE_SIZE);
    const groundTy = Math.floor((rat.y + 8) / TILE_SIZE);
    if (!isSolid(getTile(tiles, tx, groundTy))) {
      rat.vy += 0.5;
      rat.y += rat.vy;
    } else {
      rat.vy = 0;
      rat.y = groundTy * TILE_SIZE - 6;
    }

    // Reverse if hitting wall
    const frontTx = Math.floor((rat.x + rat.vx * 4) / TILE_SIZE);
    if (isSolid(getTile(tiles, frontTx, groundTy - 1))) {
      rat.vx *= -1;
    }

    // Flee from player stomp / explosion nearby
    const rdx = player.x - rat.x;
    const rdy = player.y - rat.y;
    if (Math.sqrt(rdx * rdx + rdy * rdy) < 40) {
      rat.vx = -(rdx > 0 ? 1 : -1) * 2;
    }
  }
}

export function renderWildlife(ctx, wildlife, thermalMode) {
  const { birds, rats } = wildlife;

  // ── Birds ────────────────────────────────────────────────────────────────
  for (const bird of birds) {
    ctx.save();
    ctx.translate(bird.x, bird.y);

    if (thermalMode) {
      // Show as heat blob
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
      grd.addColorStop(0, `rgba(255,${Math.floor(200 * bird.heatSig)},0,0.9)`);
      grd.addColorStop(1, 'rgba(255,80,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const flapY = bird.state !== 'perch' ? Math.sin(bird.flapPhase) * 3 : 0;
      // Body
      ctx.fillStyle = bird.type.color;
      ctx.fillRect(-bird.type.size / 2, -bird.type.size / 2, bird.type.size, bird.type.size);
      // Wings
      ctx.fillStyle = bird.type.wingColor;
      ctx.fillRect(-bird.type.size - 1, -bird.type.size / 2 + flapY, bird.type.size, 2);
      ctx.fillRect(1, -bird.type.size / 2 + flapY, bird.type.size, 2);
    }

    ctx.restore();
  }

  // ── Rats ─────────────────────────────────────────────────────────────────
  for (const rat of rats) {
    if (!rat.alive) continue;

    ctx.save();
    ctx.translate(rat.x, rat.y);

    if (thermalMode) {
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
      grd.addColorStop(0, `rgba(200,${Math.floor(150 * rat.heatSig)},0,0.8)`);
      grd.addColorStop(1, 'rgba(180,50,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = RAT_COLOR;
      ctx.fillRect(-4, -3, 8, 4);
      // Tail
      ctx.strokeStyle = '#3a2a1a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(10, -2);
      ctx.stroke();
      // Eye
      ctx.fillStyle = '#cc2200';
      ctx.fillRect(3, -3, 1, 1);
    }

    ctx.restore();
  }
}