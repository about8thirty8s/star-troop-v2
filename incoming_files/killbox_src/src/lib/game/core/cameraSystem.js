// LAST HUNT: KILLBOX - Advanced Camera System
import { CAMERA_CONFIG } from '../config/camera.config';

export function createCamera(x, y) {
  return {
    x, y,
    targetX: x,
    targetY: y,
    zoom: CAMERA_CONFIG.defaultZoom,
    targetZoom: CAMERA_CONFIG.defaultZoom,

    mode: 'FOLLOW_PLAYER',  // FOLLOW_PLAYER | CINEMATIC | FOLLOW_TARGET | INSERTION
    target: null,
    targetGroupIds: [],     // for multi-entity framing

    // Cinematic state
    cinematicTimer: 0,
    cinematicDuration: 0,
    cinematicStartZoom: 1,
    cinematicEndZoom: 1,
    cinematicStartX: 0,
    cinematicStartY: 0,
    cinematicEndX: 0,
    cinematicEndY: 0,
    cinematicEase: null,    // function for interpolation

    // Insertion state
    insertionPhase: 0,      // which step in sequence
    insertionStepTimer: 0,
    insertionComplete: false,
  };
}

export function updateCamera(camera, player, deltaTime, helicopter, squad) {
  const dt = deltaTime / 1000;

  // Smooth zoom interpolation
  if (Math.abs(camera.zoom - camera.targetZoom) > 0.01) {
    camera.zoom += (camera.targetZoom - camera.zoom) * CAMERA_CONFIG.zoomSmoothness;
  }

  switch (camera.mode) {
    case 'FOLLOW_PLAYER':
      followEntity(camera, player, dt);
      break;

    case 'FOLLOW_TARGET':
      if (camera.target) followEntity(camera, camera.target, dt);
      break;

    case 'CINEMATIC':
      updateCinematic(camera, dt);
      break;

    case 'INSERTION':
      updateInsertionCamera(camera, player, helicopter, squad, dt);
      break;

    case 'FREE':
      // Manual pan — no automatic movement
      break;
  }

  // Clamp camera to world bounds (rough estimate)
  const worldWidth = 1280;  // approx based on world generation
  const worldHeight = 1600;
  const viewportW = 800 / camera.zoom;
  const viewportH = 600 / camera.zoom;
  camera.x = Math.max(0, Math.min(camera.x, worldWidth - viewportW));
  camera.y = Math.max(0, Math.min(camera.y, worldHeight - viewportH));
}

function followEntity(camera, entity, dt) {
  if (!entity) return;
  const offsetX = CAMERA_CONFIG.cameraOffsetX;
  const offsetY = CAMERA_CONFIG.cameraOffsetY;

  camera.targetX = entity.x + offsetX;
  camera.targetY = entity.y + offsetY;

  camera.x += (camera.targetX - camera.x) * CAMERA_CONFIG.cameraLerpX;
  camera.y += (camera.targetY - camera.y) * CAMERA_CONFIG.cameraLerpY;
}

function updateCinematic(camera, dt) {
  camera.cinematicTimer += dt;
  const progress = Math.min(1, camera.cinematicTimer / camera.cinematicDuration);

  // Ease-in-out for smooth motion
  const ease = progress < 0.5
    ? 2 * progress * progress
    : -1 + (4 - 2 * progress) * progress;

  camera.x = camera.cinematicStartX + (camera.cinematicEndX - camera.cinematicStartX) * ease;
  camera.y = camera.cinematicStartY + (camera.cinematicEndY - camera.cinematicStartY) * ease;
  camera.targetZoom = camera.cinematicStartZoom + (camera.cinematicEndZoom - camera.cinematicStartZoom) * ease;

  if (progress >= 1) {
    camera.mode = 'FOLLOW_PLAYER';
  }
}

function getInsertionFocusBounds(helicopter, player, squad) {
  // Compute a unified bounding box around all insertion entities
  if (!helicopter) return { minX: player.x, maxX: player.x + player.w, minY: player.y, maxY: player.y + player.h };

  // Helicopter fullBounds: fuselage + rotor disc + rope extent
  const heliMinX = helicopter.x - 60;  // rotor disc reach
  const heliMaxX = helicopter.x + 60;
  const heliMinY = helicopter.y - 60;  // rotor disc above
  const heliMaxY = helicopter.y + 50;  // body below + rope start

  let minX = Math.min(heliMinX, player.x);
  let maxX = Math.max(heliMaxX, player.x + player.w);
  let minY = Math.min(heliMinY, player.y);
  let maxY = Math.max(heliMaxY, player.y + player.h);

  // Include rope extent (deployed or pending)
  if (helicopter.ropeDeployed && helicopter.ropeLength > 0) {
    maxY = Math.max(maxY, helicopter.y + helicopter.ropeLength + 20);  // rope + buffer
  }

  // Include squad members
  if (squad && squad.length > 0) {
    for (const member of squad) {
      minX = Math.min(minX, member.x);
      maxX = Math.max(maxX, member.x + member.w);
      minY = Math.min(minY, member.y);
      maxY = Math.max(maxY, member.y + member.h);
    }
  }

  return { minX, maxX, minY, maxY };
}

function updateInsertionCamera(camera, player, helicopter, squad, dt) {
  if (!helicopter || helicopter.done) {
    camera.mode = 'FOLLOW_PLAYER';
    // Snap camera directly to player so lerp doesn't pull from a bad position
    if (player && player.x > -9000) {
      camera.x = player.x + CAMERA_CONFIG.cameraOffsetX;
      camera.y = player.y + CAMERA_CONFIG.cameraOffsetY;
      camera.targetX = camera.x;
      camera.targetY = camera.y;
    }
    return;
  }

  const steps = CAMERA_CONFIG.insertionSequenceSteps;
  camera.insertionStepTimer += dt;

  if (camera.insertionPhase >= steps.length) {
    camera.insertionComplete = true;
    camera.mode = 'FOLLOW_PLAYER';
    if (player && player.x > -9000) {
      camera.x = player.x + CAMERA_CONFIG.cameraOffsetX;
      camera.y = player.y + CAMERA_CONFIG.cameraOffsetY;
      camera.targetX = camera.x;
      camera.targetY = camera.y;
    }
    return;
  }

  const currentStep = steps[camera.insertionPhase];
  const stepProgress = Math.min(1, camera.insertionStepTimer / currentStep.duration);

  // Get unified focus bounds (helicopter + all descending characters)
  const focusBounds = getInsertionFocusBounds(helicopter, player, squad);
  const focusCenterX = (focusBounds.minX + focusBounds.maxX) / 2;
  const focusCenterY = (focusBounds.minY + focusBounds.maxY) / 2;
  const focusW = focusBounds.maxX - focusBounds.minX;
  const focusH = focusBounds.maxY - focusBounds.minY;

  // Target position: frame the focus group with some padding
  const padding = 80;
  const targetX = focusCenterX - 400 / 2;  // assume 800px viewport width
  const targetY = focusCenterY - 200;      // center, biased upward

  // Smooth lerp to target (no snap)
  const lerpX = 0.06;  // smooth but responsive
  const lerpY = 0.06;
  const lerpZoom = 0.04;  // zoom changes slightly slower

  camera.targetX = targetX;
  camera.targetY = targetY;
  camera.x += (camera.targetX - camera.x) * lerpX;
  camera.y += (camera.targetY - camera.y) * lerpY;
  camera.targetZoom = currentStep.zoom;
  camera.zoom += (camera.targetZoom - camera.zoom) * lerpZoom;

  // Advance to next step
  if (stepProgress >= 1) {
    camera.insertionPhase++;
    camera.insertionStepTimer = 0;
  }
}

export function panCameraTo(camera, targetX, targetY, duration) {
  camera.mode = 'CINEMATIC';
  camera.cinematicTimer = 0;
  camera.cinematicDuration = duration;
  camera.cinematicStartX = camera.x;
  camera.cinematicStartY = camera.y;
  camera.cinematicEndX = targetX;
  camera.cinematicEndY = targetY;
  camera.cinematicStartZoom = camera.zoom;
  camera.cinematicEndZoom = camera.targetZoom;
}

export function zoomCameraTo(camera, targetZoom, duration) {
  camera.mode = 'CINEMATIC';
  camera.cinematicTimer = 0;
  camera.cinematicDuration = duration;
  camera.cinematicStartX = camera.x;
  camera.cinematicStartY = camera.y;
  camera.cinematicEndX = camera.x;
  camera.cinematicEndY = camera.y;
  camera.cinematicStartZoom = camera.zoom;
  camera.cinematicEndZoom = Math.max(CAMERA_CONFIG.minZoom, Math.min(CAMERA_CONFIG.maxZoom, targetZoom));
}

export function startInsertionCamera(camera) {
  camera.mode = 'INSERTION';
  camera.insertionPhase = 0;
  camera.insertionStepTimer = 0;
  camera.insertionComplete = false;
}

export function handleZoomInput(camera, direction) {
  const newZoom = camera.targetZoom + direction * CAMERA_CONFIG.zoomStep;
  camera.targetZoom = Math.max(CAMERA_CONFIG.minZoom, Math.min(CAMERA_CONFIG.maxZoom, newZoom));
}

export function panCameraFree(camera, dx, dy) {
  // Switch to FREE pan mode — detaches from player follow
  camera.mode = 'FREE';
  camera.x += dx;
  camera.y += dy;
}

export function returnCameraToPlayer(camera, player, duration = 1.5) {
  panCameraTo(camera, player.x + CAMERA_CONFIG.cameraOffsetX, player.y + CAMERA_CONFIG.cameraOffsetY, duration);
}