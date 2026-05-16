// SQUAD DECISION ENGINE — Utility-based action scoring
import { SQUAD_CONFIG } from '../config/squad.config';
import { detectThreats, scanTerrainAhead } from './squadPerception';

export function scoreActions(member, hunter, player, tiles, firePatches) {
  const { threats, topThreat } = detectThreats(member, hunter, [], firePatches);
  
  const health = member.health / member.maxHealth;
  const distToHunter = hunter ? Math.hypot(hunter.x - member.x, hunter.y - member.y) : 9999;
  const terrainInfo = scanTerrainAhead(member, member.facing, tiles);

  const actions = [
    {
      action: 'HOLD_POSITION',
      score: scoreHoldPosition(member, health, topThreat),
    },
    {
      action: 'MOVE_TO_COVER',
      score: scoreMoveTocover(member, topThreat, distToHunter),
    },
    {
      action: 'ENGAGE_HUNTER',
      score: scoreEngage(member, hunter, distToHunter, health, topThreat),
    },
    {
      action: 'RETREAT',
      score: scoreRetreat(member, health, topThreat, distToHunter),
    },
    {
      action: 'EVADE',
      score: scoreEvade(member, topThreat),
    },
    {
      action: 'CLIMB_TO_AMBUSH',
      score: scoreClimbAmbush(member, distToHunter, terrainInfo),
    },
    // ── INITIATIVE: prep-phase autonomous tasks ──────────────────────────────
    {
      action: 'INITIATIVE_TASK',
      score: scoreInitiativeTask(member, health, topThreat, distToHunter),
    },
  ];

  // Sort by score descending
  actions.sort((a, b) => b.score - a.score);

  return { actions, topThreat, threats };
}

function scoreHoldPosition(member, health, topThreat) {
  if (topThreat) return 0; // Don't hold if threatened
  if (health < 0.3) return 0.1; // Only if barely alive
  // During prep: HOLD is never a valid idle sink — always yields to initiative
  // holdReason check: only score HOLD if explicitly ordered
  if (member._holdReason === 'PLAYER_ORDER') return 0.5;
  return 0.05; // Near-zero — initiative will always win during prep
}

function scoreMoveTocover(member, topThreat, distToHunter) {
  if (!topThreat) return 0.2;
  if (topThreat.type === 'plasma_lock') return 0.85; // Very important
  if (topThreat.type === 'melee_danger') return 0.7;
  if (distToHunter < 150) return 0.6; // Mid-range threat
  return 0.3;
}

function scoreEngage(member, hunter, distToHunter, health, topThreat) {
  if (!hunter || !hunter.alive) return 0;
  if (health < 0.2) return 0.1; // Almost dead, don't engage
  if (distToHunter > 300) return 0.2; // Out of range
  
  const inRange = distToHunter < 200;
  const canSeeHunter = distToHunter < 250;
  
  // Gung-ho personality: aggressive
  if (member.behaviorStyle === 'gung_ho') {
    return inRange ? 0.8 : (canSeeHunter ? 0.5 : 0.1);
  }
  
  // Low-profile: only if safe
  if (member.behaviorStyle === 'low_profile') {
    return inRange && !topThreat ? 0.4 : 0.1;
  }
  
  // Tree ambush: wait for hunter below
  if (member.behaviorStyle === 'tree_ambush') {
    return inRange ? 0.7 : 0.2;
  }

  return 0.3;
}

function scoreRetreat(member, health, topThreat, distToHunter) {
  if (health > 0.6) return 0.1; // Healthy, don't retreat
  if (health < 0.3 && topThreat) return 0.9; // Dying + threatened = flee
  if (topThreat && distToHunter < 100) return 0.75; // Close threat
  return 0.2;
}

function scoreEvade(member, topThreat) {
  if (!topThreat) return 0;
  if (topThreat.type === 'plasma_lock') return 0.9;
  if (topThreat.type === 'melee_danger') return 0.8;
  if (topThreat.type === 'projectile') return 0.6;
  if (topThreat.type === 'fire') return 0.5;
  return 0.3;
}

function scoreClimbAmbush(member, distToHunter, terrainInfo) {
  // Only tree ambush style should do this
  if (member.behaviorStyle !== 'tree_ambush') return 0;
  
  // Only if climbable nearby and hunter is within sight
  if (!terrainInfo.climbableNearby) return 0;
  if (distToHunter > 300) return 0.2;
  
  return 0.6; // Good tactical option
}

// ── INITIATIVE TASK SCORE ─────────────────────────────────────────────────────
// Drives autonomous prep-phase behavior (tree chopping, clearing, ambush prep).
// Only scores well when combat pressure is LOW and we're in prep phase.
function scoreInitiativeTask(member, health, topThreat, distToHunter) {
  // Never take initiative during active combat
  if (topThreat) return 0;
  if (distToHunter < 200) return 0;   // hunter too close — genuine threat
  if (health < 0.4) return 0;          // too hurt

  // Momentum: already mid-task — protect from interruption
  if (member.initiativeState === 'CHOP_TREE_MOVE' ||
      member.initiativeState === 'CHOP_TREE_WORK') {
    return 0.90; // dominant — never interrupted mid-chop
  }

  // Tree reserved and waiting to approach
  if (member.initiativeTree) return 0.82;

  // Base willingness — raised to guarantee win over HOLD (0.05) during prep
  // MAC is most aggressive, Billy is selective, Poncho is tactical
  const base = {
    gung_ho:     0.75,  // MAC: absolutely yes, let's clear this jungle
    low_profile: 0.65,  // PONCHO: yes if it helps the trap setup
    tree_ambush: 0.60,  // BILLIE: yes if it gets him height
  }[member.behaviorStyle] || 0.65;

  return base;
}