// LAST HUNT: KILLBOX - Helicopter Insertion System
import { createSquad } from './squad';
import { emit } from './core/eventBus';

export const HELI_STATE = {
  APPROACH:  'approach',
  HOVER:     'hover',
  ROPE_DROP: 'rope_drop',
  PLAYER_CLIMB: 'player_climb',
  DEPART:    'depart',
  GONE:      'gone',
};

const ROPE_SEGMENTS = 10;
const ROPE_SEG_LEN  = 14;
const ROPE_TOTAL    = ROPE_SEGMENTS * ROPE_SEG_LEN;

export function createHelicopter(worldSpawnX, worldGroundY) {
  // Hover directly above the spawn point
  const insertX = worldSpawnX;
  // Hover altitude: high enough that the full rope reaches the ground
  const hoverAltitude = Math.max(ROPE_TOTAL + 40, 140);
  const insertY = worldGroundY - hoverAltitude;

  // Rope: starts collapsed at attachment point, will grow during drop
  const rope = [];
  for (let i = 0; i <= ROPE_SEGMENTS; i++) {
    rope.push({ x: insertX, y: insertY + 14 }); // all stacked at base
  }

  return {
    x: insertX - 600,   // starts off-screen left
    y: insertY,
    vx: 1.25,    // VULCAN ×0.5 — slower approach
    vy: 0,
    targetX: insertX,
    targetY: insertY,

    rotorAngle: 0,
    swayPhase: 0,
    tiltAngle: 0,       // body tilt for realistic flight
    state: HELI_STATE.APPROACH,
    stateTimer: 0,

    ropeDeployed: false,
    ropeLength: 0,
    rope,

    washRadius: 120,
    washForce: 1.8,

    // Cached ground Y so landing always hits real terrain
    _groundY: worldGroundY,

    done: false,

    // Squad insertion
    squad: null,
    squadDeployed: false,

    // Expanded cull bounds: covers fuselage + rotors + rope + characters descending
    // Updated every frame during insertion
    fullBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
  };
}

// Verlet-ish rope simulation (lightweight)
function updateRope(heli, playerX, playerY, playerOnRope) {
  const base = heli.rope[0];
  base.x = heli.x;
  base.y = heli.y + 14;     // undercarriage attachment

  const segments = Math.ceil(heli.ropeLength / ROPE_SEG_LEN);

  for (let i = 1; i <= segments; i++) {
    const prev  = heli.rope[i - 1];
    const cur   = heli.rope[i];

    // Light wind sway
    const sway = Math.sin(Date.now() * 0.003 + i * 0.7) * 0.6 * (heli.vx !== 0 ? 2 : 1);

    // Snap to length constraint
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const diff = (dist - ROPE_SEG_LEN) / dist;
    cur.x -= dx * diff * 0.5 + sway;
    cur.y -= dy * diff * 0.5;

    // Gravity pull on segments
    cur.y += 0.15;
  }

  // If player is climbing, pin bottom of rope to player
  if (playerOnRope) {
    const last = heli.rope[segments];
    last.x += (playerX - last.x) * 0.3;
    last.y += (playerY - last.y) * 0.3;
  }
}

export function updateHelicopter(heli, player, particles, groundY) {
  if (heli.done) return;

  heli.swayPhase += 0.025;
  heli.rotorAngle += 0.28;
  heli.stateTimer++;

  // Update expanded fullBounds for cull-safe rendering
  const rotorDist = 65;  // rotor disc extends this far from center
  const ropeBuffer = 20;
  heli.fullBounds = {
    minX: heli.x - rotorDist,
    maxX: heli.x + rotorDist,
    minY: heli.y - rotorDist,
    maxY: Math.max(
      heli.y + 50,  // fuselage bottom
      heli.y + heli.ropeLength + ropeBuffer  // rope extent if deployed
    ),
  };

  // Subtle body sway
  const sway = Math.sin(heli.swayPhase) * 1.2;

  switch (heli.state) {

    case HELI_STATE.APPROACH: {
      // Fly in from left toward target — realistic tilt down during approach
      const dx = heli.targetX - heli.x;
      heli.vx += (dx * 0.012 - heli.vx) * 0.1;
      heli.x += heli.vx;
      heli.y  = heli.targetY + sway;
      
      // Tilt forward realistically as approaching
      heli.tiltAngle = Math.min(0.15, heli.tiltAngle + 0.004);  // VULCAN ×0.5

      // Rotor wash blows leaves while flying over
      spawnRotorWash(heli, particles);

      if (Math.abs(dx) < 10) {
        heli.vx = 0;
        heli.x  = heli.targetX;
        heli.tiltAngle = 0;  // level off at hover
        heli.state = HELI_STATE.HOVER;
        heli.stateTimer = 0;
      }
      break;
    }

    case HELI_STATE.HOVER: {
      heli.x = heli.targetX + sway;
      heli.y = heli.targetY + Math.sin(heli.swayPhase * 0.4) * 3;
      spawnRotorWash(heli, particles);

      // Deploy squad ropes at start of hover
      if (heli.stateTimer === 1 && !heli.squadDeployed) {
        heli.squad = createSquad(heli.targetX, heli.targetY);
        heli.squadDeployed = true;
        emit('SQUAD_INSERTION', { squad: heli.squad });
      }

      if (heli.stateTimer > 120) {       // VULCAN ×0.5 — hover ~2s then drop rope
        heli.state = HELI_STATE.ROPE_DROP;
        heli.stateTimer = 0;
        heli.ropeDeployed = true;
      }
      break;
    }

    case HELI_STATE.ROPE_DROP: {
      heli.x = heli.targetX + sway;
      heli.y = heli.targetY + Math.sin(heli.swayPhase * 0.4) * 3;
      spawnRotorWash(heli, particles);

      // Extend rope downward at 1.5 px/frame (VULCAN ×0.5 — cinematic drop)
      heli.ropeLength = Math.min(heli.ropeLength + 1.5, ROPE_TOTAL);
      updateRope(heli, 0, 0, false);

      // Descend squad members along their rope anchors
      const ropeOffsets = [-24, -8, 8, 24];
      if (heli.squad) {
        for (let i = 0; i < heli.squad.length; i++) {
          const member = heli.squad[i];
          const ropeAnchorX = ropeOffsets[i + 1];  // ropes 1,2,3 for squad (rope 0 is player)
          member.x = heli.x + ropeAnchorX - member.w / 2;
          member.y = heli.y + heli.ropeLength;
          member.vx = 0;
          member.vy = 0;
          member.onGround = false;
        }
      }

      if (heli.ropeLength >= ROPE_TOTAL) {
        heli.state = HELI_STATE.PLAYER_CLIMB;
        heli.stateTimer = 0;

        // Attach player to rope tip — ALL in world coordinates
        const tip = heli.rope[ROPE_SEGMENTS];
        player.x = tip.x - player.w / 2;
        player.y = tip.y;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        player.isOnRope = true;
        player.inInsertion = true;
      }
      break;
    }

    case HELI_STATE.PLAYER_CLIMB: {
      heli.x = heli.targetX + sway;
      heli.y = heli.targetY + Math.sin(heli.swayPhase * 0.4) * 3;
      spawnRotorWash(heli, particles);

      if (player.isOnRope) {
        // Descend at 0.5 px/frame — VULCAN ×0.5 cinematic descent
        player.y += 0.5;  // VULCAN ×0.5 — cinematic descent
        // Keep horizontally centred under helicopter (world X)
        player.x = heli.x - player.w / 2;
        player.vx = 0;
        player.vy = 0;

        // Pin rope tip to player feet so visual matches
        updateRope(heli, player.x + player.w / 2, player.y, true);

        // Landing: feet reach actual ground tile — snap to tile top exactly
        if (player.y + player.h >= groundY) {
          player.y = groundY - player.h;  // feet ON tile surface, not inside
          player.onGround = true;
          player.isOnRope = false;
          player.inInsertion = false;
          player.vx = 0;
          player.vy = 0;
          player.coyoteTimer = 6;
          player.jumpBufferTimer = 0;

          heli.state = HELI_STATE.DEPART;
          heli.stateTimer = 0;
        }
      } else {
        updateRope(heli, 0, 0, false);
      }

      // Continue descending squad members at 1 px/frame
      const ropeOffsets = [-24, -8, 8, 24];
      if (heli.squad) {
        for (let i = 0; i < heli.squad.length; i++) {
          const member = heli.squad[i];
          const ropeAnchorX = ropeOffsets[i + 1];
          member.x = heli.x + ropeAnchorX - member.w / 2;
          member.y += 0.5;  // VULCAN ×0.5 — same rate as player
          member.vx = 0;
          member.vy = 0;

          // Landing: snap to ground and assign behavior
          if (member.y + member.h >= groundY) {
            member.y = groundY - member.h;
            member.onGround = true;
            member.insertionState = 'LANDED';
            // Assign random behavior on landing
            const behaviors = ['gung_ho', 'low_profile', 'tree_ambush'];
            member.behaviorStyle = behaviors[Math.floor(Math.random() * behaviors.length)];
          }
        }
      }
      break;
    }

    case HELI_STATE.DEPART: {
      // Wait 40 frames then fly off right and up — tilted forward realistically
      if (heli.stateTimer > 40) {
        heli.vx += 0.06;  // VULCAN ×0.5
        heli.x += heli.vx;
        heli.y -= 0.6;  // VULCAN ×0.5 — slower climb out
        
        // Tilt forward realistically as climbing away
        heli.tiltAngle = Math.min(0.2, heli.tiltAngle + 0.005);  // VULCAN ×0.5

        // Exhaust particles while departing
        if (Math.random() > 0.5) {
          particles.push({
            x: heli.x - 20, y: heli.y - 5,
            vx: -heli.vx * 0.4 - Math.random(), vy: -0.5 - Math.random(),
            life: 30 + Math.random() * 20,
            color: '#555555', size: 5 + Math.random() * 4, type: 'smoke',
          });
        }
      }

      updateRope(heli, 0, 0, false);

      // Exit at top-right after climbing
      if (heli.y < -200 || heli.x > 6000) {
        heli.state = HELI_STATE.GONE;
        heli.done  = true;
      }
      break;
    }
  }
}

// Spawn rotor-wash leaf / dust particles
function spawnRotorWash(heli, particles) {
  if (Math.random() > 0.55) return;
  const angle  = Math.random() * Math.PI * 2;
  const radius = 30 + Math.random() * heli.washRadius;
  particles.push({
    x: heli.x + Math.cos(angle) * radius,
    y: heli.y + 20 + Math.random() * 20,
    vx: Math.cos(angle) * (1.5 + Math.random() * 2),
    vy: -0.5 - Math.random() * 1.5,
    life: 20 + Math.random() * 25,
    color: Math.random() > 0.5 ? '#2a4a1a' : '#4a3a10',
    size: 2 + Math.random() * 3,
    type: 'debris',
  });
  // Occasional dust puff under wash
  if (Math.random() > 0.8) {
    particles.push({
      x: heli.x + (Math.random() - 0.5) * 80,
      y: heli.y + 35,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 0.5 + Math.random(),
      life: 35 + Math.random() * 25,
      color: 'rgba(120,100,60,0.5)',
      size: 6 + Math.random() * 8,
      type: 'smoke',
    });
  }
}

export function renderHelicopter(ctx, heli) {
  if (heli.state === HELI_STATE.GONE) return;

  const { x, y, rotorAngle, tiltAngle, ropeDeployed, rope, ropeLength } = heli;

  ctx.save();
  ctx.translate(x, y);

  // Apply body tilt for realistic flight attitude
  ctx.rotate(tiltAngle);

  // Load Huey sprite
  if (!renderHelicopter._hueyImg) {
    renderHelicopter._hueyImg = new Image();
    renderHelicopter._hueyImg.src = 'https://media.base44.com/images/public/6a06ed19120e7e74497baea4/2dbfc81b0_vehicle_huey_body_open.png';
  }

  const hueyImg = renderHelicopter._hueyImg;
  if (hueyImg.complete && hueyImg.naturalWidth > 0) {
    // Draw Huey sprite flipped horizontally (facing left for right-approach)
    // Sprite is ~250px wide, 120px tall
    ctx.scale(-1, 1);
    ctx.drawImage(hueyImg, -125, -60, 250, 120);
    ctx.scale(-1, 1);
  }

  // Top rotor side-on effect — positioned above fuselage
  ctx.save();
  ctx.translate(0, -38);  // rotor disc sits at top of mast pole
  
  const bladeLength = 80;
  const bladeThickness = 3;
  
  // Main blade (full opacity at certain angles)
  ctx.globalAlpha = 0.7 + Math.abs(Math.sin(rotorAngle)) * 0.3;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = bladeThickness;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-bladeLength * 0.8, 0);
  ctx.lineTo(bladeLength * 0.8, 0);
  ctx.stroke();
  
  // Trailing blur streak
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = '#3a3a3a';
  ctx.beginPath();
  ctx.moveTo(-bladeLength * 0.6, 0);
  ctx.lineTo(bladeLength * 0.6, 0);
  ctx.stroke();
  
  ctx.restore();

  // Tail rotor (small side rotor — visible from side)
  ctx.save();
  ctx.translate(-65, -8);
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 12, rotorAngle, rotorAngle + Math.PI);
  ctx.stroke();
  ctx.restore();

  ctx.restore();

  // Rope
  if (ropeDeployed && ropeLength > 0) {
    const segments = Math.ceil(ropeLength / ROPE_SEG_LEN);
    ctx.strokeStyle = '#8a7a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(rope[0].x, rope[0].y);
    for (let i = 1; i <= Math.min(segments, ROPE_SEGMENTS); i++) {
      ctx.lineTo(rope[i].x, rope[i].y);
    }
    ctx.stroke();
    // Knots
    ctx.fillStyle = '#6a5a3a';
    for (let i = 1; i <= Math.min(segments, ROPE_SEGMENTS); i += 2) {
      ctx.beginPath();
      ctx.arc(rope[i].x, rope[i].y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}