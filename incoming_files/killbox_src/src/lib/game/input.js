// LAST HUNT: KILLBOX — Input Handler for Weapons & Actions
import { fireWeapon, fireSecondary, startReload } from './weapons';

export function handleMouseMove(gs, event, canvas) {
  const rect = canvas.getBoundingClientRect();
  // Account for zoom: canvas logical px vs display px
  const zoom = gs.camera.zoom || 1;
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mouseX = (event.clientX - rect.left) * scaleX;
  const mouseY = (event.clientY - rect.top) * scaleY;

  // World position of cursor
  // Subtract screenShake render offset — shake is screen-space only,
  // must never pollute the world-space aim angle calculation.
  const shakeOx = (gs.screenShake && gs.screenShake.ox) ? gs.screenShake.ox / (gs.camera.zoom || 1) : 0;
  const shakeOy = (gs.screenShake && gs.screenShake.oy) ? gs.screenShake.oy / (gs.camera.zoom || 1) : 0;
  gs.mouseWorld = {
    x: mouseX / zoom + gs.camera.x - shakeOx,
    y: mouseY / zoom + gs.camera.y - shakeOy,
    screenX: mouseX,
    screenY: mouseY,
  };

  // Update player facing based on mouse
  if (gs.player && gs.player.alive) {
    const dx = gs.mouseWorld.x - (gs.player.x + gs.player.w / 2);
    if (dx !== 0) gs.player.facing = dx > 0 ? 1 : -1;
  }
}

export function handleMouseDown(gs, event, canvas) {
  if (gs.gamePhase === 'insertion' || gs.gamePhase === 'title') return;
  // Update mouse world on click too
  handleMouseMove(gs, event, canvas);

  if (event.button === 0) {
    gs.keys.primaryFire = true;
  } else if (event.button === 2) {
    gs.keys.secondaryFire = true;
  }
}

export function handleMouseUp(gs, event) {
  if (event.button === 0) {
    gs.keys.primaryFire = false;
  } else if (event.button === 2) {
    gs.keys.secondaryFire = false;
  }
}

export function updateWeaponFiring(gs, deltaTime) {
  if (!gs.player.alive || !gs.player.weaponState.current) return;

  const weaponState = gs.player.weaponState;

  // Handle reload key
  if (gs.keys.reload) {
    startReload(weaponState);
    gs.keys.reload = false;
  }

  // Compute aim angle from player centre → mouse world pos
  const playerCX = gs.player.x + gs.player.w / 2;
  const playerCY = gs.player.y + gs.player.h / 2 - 4; // slight upward offset for muzzle height
  const mw = gs.mouseWorld || { x: playerCX + gs.player.facing * 100, y: playerCY };
  const aimAngle = Math.atan2(mw.y - playerCY, mw.x - playerCX);

  // Store on player for renderer
  gs.player.aimAngle = aimAngle;

  // Primary fire (left click / hold)
  if (gs.keys.primaryFire && !weaponState.isReloading) {
    fireWeapon(
      weaponState,
      playerCX,
      playerCY,
      gs.player.facing,
      aimAngle,
      gs.gameTime,
      gs.particles,
      gs.projectiles,
      gs.screenShake
    );
  }

  // Secondary fire (right click — one-shot per click)
  if (gs.keys.secondaryFire && !weaponState.isReloading) {
    fireSecondary(
      weaponState,
      playerCX,
      playerCY,
      gs.player.facing,
      aimAngle,
      gs.gameTime,
      gs.particles,
      gs.projectiles
    );
    gs.keys.secondaryFire = false;
  }
}