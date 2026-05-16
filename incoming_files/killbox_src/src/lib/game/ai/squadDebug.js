// SQUAD AI DEBUG OVERLAY V2 — VULCAN KILLBOX
// Full chop-task diagnostic: state, task, treeId, chopSpot side, distances, jumps, failReason
export function renderSquadDebugOverlay(ctx, squad, camera) {
  if (!squad || !Array.isArray(squad)) return;
  const zoom = camera.zoom || 1;

  for (const member of squad) {
    if (!member.alive) continue;

    const screenX = (member.x + (member.w || 14) / 2 - camera.x) * zoom;
    const screenY = (member.y - camera.y) * zoom - 6;
    if (screenX < -120 || screenX > 1400 || screenY < -60 || screenY > 960) continue;

    ctx.save();

    // Color by archetype
    const col = member.behaviorStyle === 'tree_ambush' ? '#88ccff'
              : member.behaviorStyle === 'low_profile' ? '#ffcc44'
              : '#00ff88';

    const action = member.aiState?.currentAction || 'INIT';
    const iState = member.initiativeState || '-';
    const treeId = member.initiativeTree?.id ?? '-';
    const side   = member._chopSide || '-';
    const jumps  = member._jumpAttempts ?? 0;
    const hits   = member.chopHitsDealt ?? 0;

    // Line 1: name · action
    const line1 = `${member.name || '?'} · ${action.replace('INITIATIVE_TASK','INIT').replace('HOLD_POSITION','HOLD')}`;
    // Line 2: initiative state + tree
    const line2 = `${iState} tree:${treeId} side:${side}`;
    // Line 3: jumps, hits, debug reason
    const failReason = member._debugState || '';
    const line3 = `j:${jumps} hits:${hits} ${failReason}`.slice(0, 40);

    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'center';

    const lines = [line1, line2, line3];
    lines.forEach((txt, idx) => {
      const ly = screenY - idx * 9;
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillText(txt, screenX + 1, ly + 1);
      ctx.fillStyle = idx === 0 ? col : 'rgba(255,255,255,0.75)';
      ctx.fillText(txt, screenX, ly);
    });

    // Chop flash indicator
    if (member.initiativeState === 'CHOP_TREE_WORK') {
      ctx.fillStyle = '#ffaa00';
      ctx.fillText(`⚒ ${hits} hits`, screenX, screenY - 28);
    }

    ctx.restore();
  }
}

export function renderHunterDebugOverlay(ctx, hunter, camera) {
  if (!hunter || !hunter.alive) return;
  const zoom = camera.zoom || 1;
  const screenX = (hunter.x + (hunter.w || 16) / 2 - camera.x) * zoom;
  const screenY = (hunter.y - 20 - camera.y) * zoom;
  if (screenX < -80 || screenX > 1200 || screenY < -40 || screenY > 900) return;

  ctx.save();
  const phase = hunter.aiState?.currentPhase || 'UNKNOWN';
  const goal  = hunter.aiState?.currentGoal  || 'IDLE';
  const conf  = hunter.confidence !== undefined ? hunter.confidence.toFixed(2) : '0.00';

  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillText(`${phase} • ${goal}`, screenX + 1, screenY + 1);
  ctx.fillStyle = '#ff6633';
  ctx.fillText(`${phase} • ${goal}`, screenX, screenY);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(screenX - 20, screenY + 8, 40, 4);
  const confColor = parseFloat(conf) > 0.7 ? '#00ff66' : parseFloat(conf) > 0.4 ? '#ffdd00' : '#ff3333';
  ctx.fillStyle = confColor;
  ctx.fillRect(screenX - 20, screenY + 8, 40 * Math.min(1, parseFloat(conf)), 4);
  ctx.restore();
}
