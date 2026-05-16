// LAST HUNT: KILLBOX - Squad Member Behavior System
// Now delegates to modular AI subsystems
import { SQUAD_CONFIG } from './config/squad.config';
import { TILE_SIZE, TILE, PIXEL_WORLD_W } from './constants';
import { getTile } from './worldGen';
import { emit } from './core/eventBus';
import { updateSquadMemberAI } from './ai/squadOrchestrator';

const BEHAVIORS = {
  GUNG_HO:     'gung_ho',
  LOW_PROFILE: 'low_profile',
  TREE_AMBUSH: 'tree_ambush',
};

// ─── MAIN ENTRY ──────────────────────────────────────────────────────────────

export function updateSquadMemberBehavior(member, player, hunter, tiles, projectiles, particles, treeEntities, squad = [], coordState = null) {
  if (!member.alive) return;

  // Hard boundary clamp
  if (member.x < 16) {
    member.x = 16;
    member.vx = Math.abs(member.vx);
    member.facing = 1;
  }
  if (member.x + member.w > PIXEL_WORLD_W - 16) {
    member.x = PIXEL_WORLD_W - 16 - member.w;
    member.vx = -Math.abs(member.vx);
    member.facing = -1;
  }

  // Assign behavior style on first activation
  if (!member.behaviorStyle) {
    const styles = Object.values(BEHAVIORS);
    member.behaviorStyle = styles[Math.floor(Math.random() * styles.length)];
  }

  // Init evasion state if missing
  if (member.evadeTimer === undefined) {
    member.evadeTimer = 0;
    member.evadeDir = 1;
    member.retreatTimer = 0;
    member.lastDodgeFrame = 0;
  }

  // DELEGATE TO NEW MODULAR AI SYSTEM
  // Determine game phase from player state (prep = hunter not yet active)
  const gamePhase = (typeof window !== 'undefined' && window.__KILLBOX_PHASE__) ? window.__KILLBOX_PHASE__ : 'PREP';
  updateSquadMemberAI(member, player, hunter, tiles, projectiles, particles, [], treeEntities, squad, coordState, gamePhase);
}



// Old traversal and evasion helpers have been moved to ai/ subsystem.