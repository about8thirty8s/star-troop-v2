// SQUAD MORALE, FEAR + HERO SYSTEM — LAST HUNT: KILLBOX
// Each squadmate tracks emotional state. Events shift morale.
// Low morale → hesitation, silence, panic. High morale → initiative, sacrifice.
// Hero moments are rare, emergent, and create stories.

// ─── MORALE DEFAULTS BY ARCHETYPE ────────────────────────────────────────────
const MORALE_DEFAULTS = {
  MAC:    { confidence: 0.85, fear: 0.05, aggression: 0.90, trust: 0.80 },
  BILLIE: { confidence: 0.75, fear: 0.15, aggression: 0.45, trust: 0.70 },
  PONCHO: { confidence: 0.65, fear: 0.30, aggression: 0.35, trust: 0.75 },
};

// ─── MORALE EVENTS — what shifts the numbers ──────────────────────────────────
export const MORALE_EVENT = {
  // Good
  PLAYER_SAVED_TEAMMATE:  'PLAYER_SAVED_TEAMMATE',
  TRAP_KILLED_HUNTER:     'TRAP_KILLED_HUNTER',
  HUNTER_TOOK_DAMAGE:     'HUNTER_TOOK_DAMAGE',
  REGROUPED:              'REGROUPED',
  SUCCESSFUL_PREP:        'SUCCESSFUL_PREP',
  HERO_MOMENT:            'HERO_MOMENT',
  // Bad
  SQUADMATE_DIED:         'SQUADMATE_DIED',
  BRUTAL_KILL_WITNESSED:  'BRUTAL_KILL_WITNESSED',
  FIRE_SPREADING:         'FIRE_SPREADING',
  ISOLATED:               'ISOLATED',
  PLASMA_NEAR_MISS:       'PLASMA_NEAR_MISS',
  BODY_DISPLAYED:         'BODY_DISPLAYED',
};

const MORALE_DELTAS = {
  // confidence, fear, aggression
  PLAYER_SAVED_TEAMMATE:  { confidence:  0.15, fear: -0.10, aggression:  0.05 },
  TRAP_KILLED_HUNTER:     { confidence:  0.20, fear: -0.15, aggression:  0.10 },
  HUNTER_TOOK_DAMAGE:     { confidence:  0.10, fear: -0.08, aggression:  0.12 },
  REGROUPED:              { confidence:  0.08, fear: -0.05, aggression:  0.02 },
  SUCCESSFUL_PREP:        { confidence:  0.06, fear: -0.03, aggression:  0.00 },
  HERO_MOMENT:            { confidence:  0.25, fear: -0.20, aggression:  0.15 },
  SQUADMATE_DIED:         { confidence: -0.18, fear:  0.20, aggression: -0.05 },
  BRUTAL_KILL_WITNESSED:  { confidence: -0.25, fear:  0.35, aggression: -0.10 },
  FIRE_SPREADING:         { confidence: -0.08, fear:  0.12, aggression: -0.02 },
  ISOLATED:               { confidence: -0.10, fear:  0.18, aggression: -0.05 },
  PLASMA_NEAR_MISS:       { confidence: -0.05, fear:  0.10, aggression:  0.00 },
  BODY_DISPLAYED:         { confidence: -0.30, fear:  0.45, aggression: -0.15 },
  SUCCESSFUL_PREP:        { confidence:  0.06, fear: -0.03, aggression:  0.00 },
};

// ─── INIT ─────────────────────────────────────────────────────────────────────
export function initMorale(member) {
  if (member.morale) return;
  const def = MORALE_DEFAULTS[member.archetype] || MORALE_DEFAULTS.MAC;
  member.morale = {
    confidence: def.confidence,
    fear:       def.fear,
    aggression: def.aggression,
    trust:      def.trust,
    // State flags
    isPanicking:     false,
    isHyperAggro:    false,
    isSilent:        false,
    panicTimer:      0,
    hyperAggroTimer: 0,
    heroCheckTimer:  0,
    lastEventTime:   0,
  };
}

// ─── APPLY EVENT ──────────────────────────────────────────────────────────────
export function applyMoraleEvent(member, eventType, squad) {
  initMorale(member);
  const delta = MORALE_DELTAS[eventType];
  if (!delta) return;

  const m = member.morale;
  m.confidence = Math.max(0, Math.min(1, m.confidence + (delta.confidence || 0)));
  m.fear       = Math.max(0, Math.min(1, m.fear       + (delta.fear       || 0)));
  m.aggression = Math.max(0, Math.min(1, m.aggression + (delta.aggression || 0)));
  m.lastEventTime = Date.now();

  // Check for break moments
  _checkBreak(member, squad);
}

// Broadcast event to whole squad (some events affect everyone)
export function broadcastMoraleEvent(squad, eventType, exceptId = null) {
  if (!squad) return;
  for (const m of squad) {
    if (!m.alive) continue;
    if (exceptId && m.id === exceptId) continue;
    applyMoraleEvent(m, eventType, squad);
  }
}

// ─── TICK (called per frame) ──────────────────────────────────────────────────
export function tickMorale(member, player, squad, hunter, dt) {
  initMorale(member);
  const m = member.morale;

  // Natural fear decay toward baseline
  m.fear       = lerp(m.fear,       0.1, 0.008 * dt * 60);
  m.confidence = lerp(m.confidence, 0.6, 0.004 * dt * 60);

  // Isolation check — far from player and all allies
  const playerDist = Math.hypot(member.x - player.x, member.y - player.y);
  const allyDist = squad
    ? Math.min(...squad.filter(s => s.id !== member.id && s.alive)
        .map(s => Math.hypot(member.x - s.x, member.y - s.y)))
    : Infinity;
  if (playerDist > 280 && allyDist > 240) {
    m.fear = Math.min(1, m.fear + 0.003 * dt * 60);
    m.confidence = Math.max(0, m.confidence - 0.002 * dt * 60);
  }

  // Panic timer
  if (m.isPanicking) {
    m.panicTimer -= dt;
    if (m.panicTimer <= 0) {
      m.isPanicking = false;
      m.fear = Math.max(0.3, m.fear - 0.15); // panic exhaustion
    }
  }

  // Hyper-aggro timer
  if (m.isHyperAggro) {
    m.hyperAggroTimer -= dt;
    if (m.hyperAggroTimer <= 0) m.isHyperAggro = false;
  }

  // Hero moment check (every 3s when morale is high)
  m.heroCheckTimer -= dt;
  if (m.heroCheckTimer <= 0) {
    m.heroCheckTimer = 3.0;
    _checkHeroMoment(member, player, squad, hunter);
  }

  // Apply morale to combat stats
  member.accuracyPenalty  = m.fear * 0.4;        // 0..40% miss chance
  member.hesitationFrames = Math.floor(m.fear * 12); // 0..12 extra frames before shooting
  member.speedMult        = 1.0 - m.fear * 0.25; // fear slows movement

  // Tick cover-retreat timer — self-terminating
  if (member.coverRetreatTimer > 0) {
    member.coverRetreatTimer -= dt;
    if (member.coverRetreatTimer <= 0) {
      member.isCoveringRetreat = false;
      member.coverRetreatTimer = 0;
    }
  }
}

// ─── BREAK MOMENTS ────────────────────────────────────────────────────────────
function _checkBreak(member, squad) {
  const m = member.morale;
  const arch = member.archetype;

  // PANIC: high fear + low confidence
  if (m.fear > 0.75 && m.confidence < 0.25 && !m.isPanicking) {
    const panicChance = arch === 'PONCHO' ? 0.45 : arch === 'BILLIE' ? 0.20 : 0.08; // MAC rarely panics
    if (Math.random() < panicChance) {
      m.isPanicking = true;
      m.panicTimer  = 4.0 + Math.random() * 3.0;
      member.aiState = { currentAction: 'PANIC_FLEE' };
      _barkMorale(member, 'PANIC');
    }
  }

  // HYPER-AGGRO: very low fear + very high aggression (Mac's "rage mode")
  if (m.fear < 0.15 && m.aggression > 0.85 && arch === 'MAC' && !m.isHyperAggro) {
    if (Math.random() < 0.35) {
      m.isHyperAggro   = true;
      m.hyperAggroTimer = 8.0;
      _barkMorale(member, 'HYPER_AGGRO');
    }
  }

  // EERIE CALM: Billy at very high fear paradoxically goes silent and hyper-focused
  if (m.fear > 0.70 && arch === 'BILLIE' && !m.isSilent) {
    m.isSilent = true;
    member.currentBark = null; // stop talking
  } else if (m.fear < 0.40 && arch === 'BILLIE') {
    m.isSilent = false;
  }
}

// ─── HERO MOMENTS ─────────────────────────────────────────────────────────────
function _checkHeroMoment(member, player, squad, hunter) {
  if (!hunter || !hunter.alive) return;
  const m = member.morale;
  // Only high-morale, non-panicking members attempt hero actions
  if (m.isPanicking || m.confidence < 0.6) return;

  const heroRoll = Math.random();

  // HERO 1: Push player out of plasma radius
  if (hunter.plasmaLockTimer > 60 && heroRoll < 0.08 && member.alive) {
    const targetDist = Math.hypot(
      hunter.plasmaReticleX - player.x,
      hunter.plasmaReticleY - player.y
    );
    const memberDistToReticle = Math.hypot(
      hunter.plasmaReticleX - member.x,
      hunter.plasmaReticleY - member.y
    );
    if (targetDist < 80 && memberDistToReticle < 200) {
      // Charge player, knock them sideways
      const dir = player.x > member.x ? 1 : -1;
      player.vx = dir * 6;
      player.vy = -4;
      member.vx = dir * 5;
      // Hero bark
      _barkMorale(member, 'HERO_PLASMA_PUSH');
      applyMoraleEvent(member, MORALE_EVENT.HERO_MOMENT, squad);
      broadcastMoraleEvent(squad, MORALE_EVENT.HERO_MOMENT, member.id);
      member.morale.heroCheckTimer = 20.0; // long cooldown after hero
    }
  }

  // HERO 2: Drag wounded teammate
  if (heroRoll < 0.05 && squad) {
    const wounded = squad.find(s =>
      s.id !== member.id && s.alive && s.health < s.maxHealth * 0.25
      && Math.hypot(s.x - member.x, s.y - member.y) < 120
    );
    if (wounded) {
      // Pull toward player
      const dx = player.x - wounded.x;
      wounded.x += dx * 0.08;
      wounded.vx = Math.sign(dx) * 1.5;
      _barkMorale(member, 'HERO_DRAG');
      member.morale.heroCheckTimer = 15.0;
    }
  }

  // HERO 3: Throw emergency grenade to buy retreat time
  if (heroRoll < 0.04 && m.aggression > 0.6) {
    const dist = Math.hypot(hunter.x - member.x, hunter.y - member.y);
    if (dist < 200 && dist > 60) {
      // Signal grenade event (engine picks it up via member.heroGrenade flag)
      member.heroGrenade = { x: hunter.x, y: hunter.y, timer: 0 };
      _barkMorale(member, 'HERO_GRENADE');
      member.morale.heroCheckTimer = 18.0;
    }
  }

  // HERO 4: Cover retreat — stand and fire while allies escape
  if (heroRoll < 0.06 && m.aggression > 0.7 && m.fear < 0.3) {
    const retreatingAllies = squad ? squad.filter(s =>
      s.id !== member.id && s.alive &&
      s.aiState?.currentAction === 'RETREAT'
    ) : [];
    if (retreatingAllies.length >= 1) {
      member.isCoveringRetreat = true;
      member.coverRetreatTimer  = 5.0;
      _barkMorale(member, 'HERO_COVER');
      member.morale.heroCheckTimer = 20.0;
    }
  }
}

// ─── PREP PERSONALITY EXPANSION ───────────────────────────────────────────────
export function applyPrepPersonality(member, player, tiles, treeEntities, dt) {
  if (!member.alive || !member.morale) return;
  const arch = member.archetype;

  // MAC — clears heavy terrain aggressively, creates firing lanes
  if (arch === 'MAC') {
    member._prepRole = 'CLEAR_TERRAIN';
    // Preference: chop trees that are between spawn and expected Hunter entry
    // (handled in initiative scoring — high forward bias)
    if (member.morale.aggression > 0.7 && Math.random() < 0.002 * dt * 60) {
      _barkMorale(member, 'MAC_PREP');
    }
  }

  // BILLIE — scouts elevated positions, marks Hunter routes
  if (arch === 'BILLIE') {
    member._prepRole = 'SCOUT_HEIGHT';
    if (!member._scoutTarget) {
      // Pick a new elevated scout point near the player
      member._scoutTargetX = player.x + (Math.random() - 0.5) * 300;
      member._scoutTargetY = player.y - 80;
      member._scoutTarget = true;
    }
    // Clear target when reached (within 40px) — pick a new one next tick
    if (member._scoutTarget && member._scoutTargetX !== undefined) {
      const sdist = Math.hypot(member.x - member._scoutTargetX, member.y - member._scoutTargetY);
      if (sdist < 40) {
        member._scoutTarget = false;
        member._scoutTargetX = undefined;
        member._scoutTargetY = undefined;
      }
    }
    if (Math.random() < 0.001 * dt * 60 && !member.morale.isSilent) {
      _barkMorale(member, 'BILLIE_SCOUT');
    }
  }

  // PONCHO — secures perimeter, builds traps, creates fallback zones
  if (arch === 'PONCHO') {
    member._prepRole = 'SECURE_PERIMETER';
    if (Math.random() < 0.001 * dt * 60) {
      _barkMorale(member, 'PONCHO_PREP');
    }
  }
}

// ─── BARK HELPERS ─────────────────────────────────────────────────────────────
const MORALE_BARKS = {
  PANIC: {
    MAC:    ['Not like this!', "I can't—!"],
    BILLIE: ['Fall back. NOW.', '...'],
    PONCHO: ["HE'S RIGHT THERE!", 'GO GO GO GO!'],
  },
  HYPER_AGGRO: {
    MAC: ["COME ON!", "YOU WANT SOME?!", "FIRE EVERYTHING!"],
  },
  HERO_PLASMA_PUSH: {
    MAC:    ['GET DOWN!', 'MOVE!'],
    BILLIE: ['Move.', 'Down!'],
    PONCHO: ['LOOK OUT!', 'MOVE IT!'],
  },
  HERO_DRAG: {
    MAC:    ["I got you! MOVE!", "Stay with me!"],
    BILLIE: ['Come on. Up.'],
    PONCHO: ["I got him! Cover us!"],
  },
  HERO_GRENADE: {
    MAC:    ['EAT THIS!', 'GRENADE OUT!'],
    BILLIE: ['Frag out.'],
    PONCHO: ['FRAG OUT — MOVE!'],
  },
  HERO_COVER: {
    MAC:    ["GO! I'LL HOLD 'EM!", 'FALL BACK — I GOT THIS!'],
    BILLIE: ['Go. I have the angle.'],
    PONCHO: ['Move! I cover!'],
  },
  MAC_PREP:    { MAC:    ['Clearing this out!', 'Coming DOWN!'] },
  BILLIE_SCOUT:{ BILLIE: ['Checking the high ground.', 'Marking routes.'] },
  PONCHO_PREP: { PONCHO: ['Setting the perimeter.', 'Trap line is here.'] },
};

function _barkMorale(member, event) {
  const table = MORALE_BARKS[event];
  if (!table) return;
  const lines = table[member.archetype] || table[Object.keys(table)[0]];
  if (!lines || lines.length === 0) return;
  const text = lines[Math.floor(Math.random() * lines.length)];
  const now = Date.now();
  if (now - (member.lastBarkTime || 0) < 2500) return;
  member.currentBark = { text, life: 110 };
  member.lastBarkTime = now;
}

function lerp(a, b, t) { return a + (b - a) * t; }

export { _barkMorale };
