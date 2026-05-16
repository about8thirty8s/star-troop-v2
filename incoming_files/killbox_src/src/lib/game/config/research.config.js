// ─── RESEARCH CONFIG ─────────────────────────────────────────────────────────
// Upgrade trees and costs. Add new upgrades here — no engine changes needed.

export const RESEARCH_CONFIG = {
  trees: {
    traps: {
      name: 'Traps',
      upgrades: [
        { id: 'trap_damage_1',  name: '+25% Trap Damage',     cost: 3,  effect: { trapDamageBonus: 0.25 } },
        { id: 'trap_chain_1',   name: 'Chain Range +50%',     cost: 5,  effect: { chainRadiusBonus: 0.5 } },
        { id: 'trap_reset',     name: 'Trap Auto-Reset',      cost: 8,  effect: { autoReset: true } },
      ],
    },
    weapons: {
      name: 'Weapons',
      upgrades: [
        { id: 'bow_damage_1',   name: '+20% Bow Damage',      cost: 3,  effect: { bowDamageBonus: 0.2 } },
        { id: 'arrow_pierce',   name: 'Piercing Arrows',      cost: 5,  effect: { arrowPierce: true } },
        { id: 'plasma_resist',  name: 'Plasma Dampener',      cost: 8,  effect: { plasmaDamageReduce: 0.3 } },
      ],
    },
    survival: {
      name: 'Survival',
      upgrades: [
        { id: 'mud_extend',     name: 'Mud Coat +50%',        cost: 3,  effect: { mudDurationBonus: 0.5 } },
        { id: 'thermal_range',  name: 'Thermal Range +30%',   cost: 5,  effect: { thermalRangeBonus: 0.3 } },
        { id: 'regen_1',        name: 'Field Regen',          cost: 8,  effect: { healthRegenPerSec: 1 } },
      ],
    },
  },

  // Points awarded per milestone
  pointRewards: {
    perTrapKill: 1,
    perChainKill: 2,
    perSurvivalMinute: 1,
    perDamageDealt100: 1,
  },
};