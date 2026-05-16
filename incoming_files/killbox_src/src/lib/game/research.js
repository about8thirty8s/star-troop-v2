// LAST HUNT: KILLBOX — Meta Progression / Research System

export const RESEARCH_TREES = {
  TRAPS: {
    label: 'TRAPS',
    color: '#cc8833',
    tiers: [
      { id: 'punji_upgrade',  name: 'Barbed Punjis',     desc: '+50% punji damage',         cost: 3 },
      { id: 'claymore_range', name: 'Wide Claymore',      desc: 'Claymore blast +30% radius', cost: 5 },
      { id: 'remote_det',     name: 'Remote Detonator',   desc: 'Trigger traps manually (R)', cost: 8 },
      { id: 'mega_trap',      name: 'Kill-Zone Array',    desc: 'Place cluster trap (3-in-1)', cost: 12 },
    ],
  },
  WEAPONS: {
    label: 'WEAPONS',
    color: '#cc3333',
    tiers: [
      { id: 'rifle_upgrade',  name: 'Scoped Rifle',       desc: 'Arrow range +40%',           cost: 3 },
      { id: 'grenades',       name: 'Frag Grenades',      desc: 'Unlock grenade (G)',          cost: 5 },
      { id: 'grenade_launcher', name: 'GL-40',            desc: '3-round burst grenades',      cost: 8 },
      { id: 'anti_hunter',   name: 'Plasma Disruptor',    desc: 'Counter plasma shots',        cost: 12 },
    ],
  },
  SURVIVAL: {
    label: 'SURVIVAL',
    color: '#33aa55',
    tiers: [
      { id: 'mud_camo',       name: 'Mud Mastery',        desc: 'Mud lasts 2× longer',         cost: 3 },
      { id: 'fast_dig',       name: 'Power Shovel',       desc: 'Dig speed +50%',              cost: 5 },
      { id: 'thermal_resist', name: 'Thermal Blanket',    desc: 'Reduce heat signature 50%',   cost: 8 },
      { id: 'hunter_sense',   name: 'Hunter Sense',       desc: 'Ping hunter location (H)',    cost: 12 },
    ],
  },
};

export function createResearchState() {
  return {
    points: 0,
    totalEarned: 0,
    unlocked: new Set(),   // set of tier IDs
    runStats: {
      damageDealt: 0,
      trapKills: 0,
      survivalSeconds: 0,
      chainKills: 0,
      stealth: true,        // never detected
    },
  };
}

export function earnResearchPoints(rs, reason, amount) {
  rs.points += amount;
  rs.totalEarned += amount;
}

// Call at end of run to award points from runStats
export function finalizeRunResearch(rs) {
  const s = rs.runStats;
  let earned = 0;
  earned += Math.floor(s.damageDealt / 20);       // 1 pt per 20 damage
  earned += s.trapKills * 2;                       // 2 pts per trap kill
  earned += Math.floor(s.survivalSeconds / 30);   // 1 pt per 30s survived
  if (s.chainKills >= 2) earned += 5;             // chain reaction bonus
  if (s.stealth) earned += 3;                     // no-detection bonus
  rs.points += earned;
  rs.totalEarned += earned;
  // Reset run stats for next run
  rs.runStats = { damageDealt: 0, trapKills: 0, survivalSeconds: 0, chainKills: 0, stealth: true };
  return earned;
}

export function tryUnlock(rs, tierId) {
  // Find tier
  for (const branch of Object.values(RESEARCH_TREES)) {
    const tier = branch.tiers.find(t => t.id === tierId);
    if (tier && !rs.unlocked.has(tierId) && rs.points >= tier.cost) {
      rs.points -= tier.cost;
      rs.unlocked.add(tierId);
      return true;
    }
  }
  return false;
}

export function hasUpgrade(rs, tierId) {
  return rs.unlocked.has(tierId);
}