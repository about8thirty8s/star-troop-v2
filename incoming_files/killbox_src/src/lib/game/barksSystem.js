// LAST HUNT: KILLBOX - Bark Display System
import { BARKS_CONFIG, BARK_RULES } from './config/barks.config.js';

export function createBark(text, squadMember, duration = 180) {
  return {
    text,
    squadMemberId: squadMember.id || Math.random(),
    x: squadMember.x + squadMember.w / 2,
    y: squadMember.y - 20,
    life: duration,
    maxLife: duration,
    floatSpeed: 0.3,
  };
}

export function updateBarks(barks) {
  for (let i = barks.length - 1; i >= 0; i--) {
    const bark = barks[i];
    bark.life--;
    bark.y -= bark.floatSpeed;
    if (bark.life <= 0) {
      barks.splice(i, 1);
    }
  }
}

export function renderBarks(ctx, barks) {
  for (const bark of barks) {
    const alpha = Math.min(1, bark.life / 30);
    ctx.globalAlpha = alpha;

    // Black outline
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        if (ox !== 0 || oy !== 0) {
          ctx.fillText(bark.text, bark.x + ox, bark.y + oy);
        }
      }
    }

    // White text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(bark.text, bark.x, bark.y);

    ctx.globalAlpha = 1;
  }
}

export function triggerBark(category, squad, eventData = {}) {
  if (!BARKS_CONFIG[category]) return;

  const barks = BARKS_CONFIG[category];
  const rule = BARK_RULES[category];

  // Filter eligible squad members
  const eligible = squad.filter(member => {
    // Check if already barking recently
    if (member.lastBarkTime && Date.now() - member.lastBarkTime < (rule?.cooldown || 10) * 1000) {
      return false;
    }
    // Check behavior filter if specified
    if (rule?.behaviorFilter && member.behaviorStyle !== rule.behaviorFilter) {
      return false;
    }
    return member.alive;
  });

  if (eligible.length === 0) return;

  // Limit concurrent barks if specified
  const maxBarks = rule?.maxBarksNear || 2;
  const speakers = eligible.slice(0, maxBarks);

  speakers.forEach(member => {
    const bark = barks[Math.floor(Math.random() * barks.length)];
    member.currentBark = createBark(bark, member);
    member.lastBarkTime = Date.now();
  });
}

export function updateSquadMemberBarkState(member) {
  // Update bark position to follow member
  if (member.currentBark) {
    member.currentBark.x = member.x + member.w / 2;
    member.currentBark.y = member.y - 20;
  }
}