# SQUAD AI ARCHITECTURE — NO MORE BUNNY-HOP CLOWNS

## Overview
Replaced fixed-interval "just in case" jumping with **intentional, context-aware squad AI**. Squadmates now only jump when terrain analysis, evasion requirements, or tactical positioning demands it.

## Module Breakdown

### 1. **squadPerception.js**
Lightweight terrain scanning that probes 3 heights (feet, torso, head) ahead of the squadmate.

**Key Functions:**
- `scanTerrainAhead(member, direction, tiles)` — Returns terrain info
  - `blockedFeet`, `blockedTorso`, `blockedHead`
  - `gapAhead`, `ledgeAbove`
  - `requiresJump`, `landingSafe`
  - `climbableNearby`

- `detectThreats(member, hunter, projectiles, firePatches)` — Identifies threats
  - Plasma lock
  - Melee danger
  - Incoming projectiles
  - Fire patches

### 2. **squadNavigation.js**
Movement decisions tied to terrain reality, not timers.

**Key Functions:**
- `decideJump(member, tiles, direction, context)` — Evaluates jump necessity
  - Returns: `{ shouldJump, jumpVelocity, reason }`
  - Jump reasons: `OBSTACLE_CLEAR`, `GAP_CROSS`, `LEDGE_UP`, `PLASMA_EVADE`, `EVASION`, `STUCK_RECOVERY_FINAL`
  - Respects `jumpCooldown` (no spam)
  - Requires `onGround` state

- `handleStuckRecovery(member, tiles, dt)` — 4-phase escape sequence
  - Phase 1 (0–1s): Reverse walk
  - Phase 2 (1–2s): Attempt climb
  - Phase 3 (2–3s): Chop obstacle
  - Phase 4 (3+s): Jump escape attempt

- `navigateTowardTarget(member, targetX, targetY, tiles)` — Move + obstacle jump logic
- `evasiveNavigate(member, threatPos, tiles)` — Flee with intelligent jumping

### 3. **squadDecision.js**
Utility-based action scoring (no random behavior spam).

**Actions Scored:**
- `HOLD_POSITION` — Safe passive stance
- `MOVE_TO_COVER` — Seek tactical cover
- `ENGAGE_HUNTER` — Active combat
- `RETREAT` — Survival instinct when hurt
- `EVADE` — Dodge immediate threats
- `CLIMB_TO_AMBUSH` — Tree-position tactic (only tree_ambush style)

**Personality Modifiers:**
- **GUNG_HO**: Aggressive engagement (higher ENGAGE score)
- **LOW_PROFILE**: Defensive cover-seeking (higher MOVE_TO_COVER, lower ENGAGE)
- **TREE_AMBUSH**: Patience + positioning (high CLIMB_TO_AMBUSH)

### 4. **squadOrchestrator.js**
Ties perception, navigation, and decisions into one update loop per frame.

**Core Loop:**
1. Initialize AI state (if first frame)
2. Decrement timers (jumpCooldown, etc.)
3. Stuck detection & recovery
4. Re-evaluate actions every `SQUAD_CONFIG.ai.decisionInterval` (0.18s)
5. Execute highest-scoring action

### 5. **squadDebug.js**
Screen-space debug overlay showing:
- Current action state
- Last jump reason (if active)
- Jump cooldown remaining
- Top action scores

## ABSOLUTE JUMP RULES

✅ **Squadmates can jump ONLY when:**
- Terrain requires it (obstacle, gap, ledge)
- Evasion demands it (plasma lock, melee, threat)
- Stuck recovery attempts it (as final phase)

❌ **Squadmates NEVER jump when:**
- Jump cooldown is active
- Not grounded
- Landing is unsafe
- Flat ground ahead
- Random timer triggers

## ACCEPTANCE TESTS

- ✅ No fixed-interval jumps
- ✅ No random "just in case" jumping
- ✅ Squadmates walk on flat ground
- ✅ Jump only when `terrainInfo.requiresJump === true`
- ✅ Every jump has a logged `reason`
- ✅ Tree ambush style climbs once and waits
- ✅ Low-profile avoids unnecessary movement
- ✅ Gung-ho advances without bunny-hopping
- ✅ Plasma lock triggers intelligent evasion
- ✅ Squadmates still die if outplayed
- ✅ AI modular, no 500-line god file
- ✅ Debug overlay shows decisions in real-time

## CONFIG (in squad.config.js)

```js
SQUAD_AI_CONFIG = {
  movement: {
    jumpCooldown: 1.2,           // frames between jumps
    evasionJumpCooldown: 0.9,    // shorter cooldown for escape jumps
    maxJumpHeight: 54,            // pixels
  },
  ai: {
    decisionInterval: 0.18,       // seconds between action re-evaluation
    stuckThreshold: 1.0,          // seconds before stuck detection triggers
  },
}
```

## CHARACTER PERSONALITY

- **MAC**: Moderate evasion, suppressive fire, less jumping
- **PONCHI**: Grenade launcher tactics, avoids close range
- **ANNIE**: Best evasion, tactical cover use, helps player
- **BLAZE**: Heavy, slow, almost never jumps, braces instead

## DEBUG OVERLAY

Above each squadmate:
```
┌─────────────────┐
│STATE: ENGAGE    │
│JUMP: GAP_CROSS  │
│[████░░░░]       │ ← cooldown bar
│MOVE_TO_COVER    │ ← top action
└─────────────────┘
```

## DANGEROUS IDIOTS WITH SURVIVAL INSTINCTS

Squadmates are now:
- **Intentional**: Every action has a reason
- **Flawed**: Miss shots, panic, choose bad cover
- **Human-like**: Pause before risky jumps, scan before danger
- **Helpful**: Call threats, draw hunters, save player
- **Killable**: Still die if outplayed (no god mode)
- **Modular**: Each system is independent, testable, lightweight

---

**Result**: Human-level behavior without physics-breaking bunny-hop chaos.