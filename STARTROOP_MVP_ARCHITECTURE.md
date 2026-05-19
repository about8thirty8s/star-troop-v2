# STAR TROOP — MVP Architecture & Design Brief
**VULCAN / Driftgate Studios**
**Date:** 2026-05-19

---

## PHILOSOPHY

Lightweight. Modular. Playable fast.

Same rules as Killbox:
- No god files
- No monolithic systems
- Config lives in config/
- Each system is one file, one job
- MVP ships the loop — not the full game

---

## MVP SCOPE — WHAT WE'RE BUILDING

Cut everything that isn't the core loop.

**IN:**
- Day/Night cycle (timer-driven phase switch)
- Player movement + Morita rifle combat
- Base centre-locked camera with left/right exploration scroll
- 3 structures only: Command Post, Barracks, Defensive Wall
- 1 unit type: Mobile Infantry (AI, holds line at night)
- 1 enemy type: Warrior Bug (swarm, melee)
- 2 resources only: Ore + Ammo
- Night wave spawner (both flanks, escalating count)
- Lifepod rescue system (survivor arrival + squad follow)
- Squad formation + idle behaviour system
- Win/Lose detection (Command Post destroyed = lose)
- Day timer HUD + resource HUD

**OUT (post-MVP):**
- Hopper / Tanker / Brain / Plasma bugs
- Scientist / Miner / Medic / Pilot classes
- Tech tree
- Electric fences, auto-turrets, generators
- Evac Beacon win condition
- Dropship crash events (post-MVP variant)
- Full audio

---

## FILE ARCHITECTURE

```
src/
  main.jsx                    ← Vite entry, mounts GameCanvas
  App.jsx                     ← Route shell

  lib/game/
    engine.js                 ← Master update loop. updateGame(gs, dt). Nothing else.
    constants.js              ← TILE_SIZE, WORLD_WIDTH, PHASE durations, etc.
    eventBus.js               ← Lightweight pub/sub. emit() / on() / off()

    config/
      game.config.js          ← Phase timers, camera, screen shake
      player.config.js        ← Speed, jump, weapon stats
      world.config.js         ← World width, tile size, zone boundaries
      bugs.config.js          ← Per-type: speed, health, damage, reward
      structures.config.js    ← Per-type: cost, hp, footprint, function
      waves.config.js         ← Night → wave definition table
      lifepod.config.js       ← Pod timing, smoke trail params, survivor class weights
      squad.config.js         ← Formation slots, idle timers, drift params

    world/
      worldGen.js             ← Tile grid, getTile/setTile, zone seeding
      terrain.js              ← Ore nodes, crash sites, prop placement

    physics.js                ← applyGravity(e,dt), moveEntity(e,tiles,dt), checkCollision
    renderer.js               ← drawWorld, drawEntities, drawHUD, drawStructures
    input.js                  ← Keyboard + mouse state object

    player/
      player.js               ← createPlayer(), updatePlayer(player, keys, tiles, dt)
      weapons.js              ← fireMorita(), updateProjectiles(projs, tiles, dt)

    base/
      structures.js           ← createStructure(), updateStructures(), renderStructures()
      buildSystem.js          ← canAfford(), placeStructure(), getFootprint()

    units/
      infantry.js             ← createMI(), updateMI(member, tiles, bugs, dt)
      squadFormation.js       ← Slot assignment, formation update, idle drift
      squadIdle.js            ← Per-unit idle state machine (scan, fidget, crouch)

    rescue/
      lifepodSystem.js        ← Pod spawning, descent physics, landing, smoke trails
      survivorSpawn.js        ← Spawn survivor at pod landing site, assign class

    bugs/
      bugAI.js                ← createBug(type), updateBug(bug, tiles, structures, units, dt)
      waveSpawner.js          ← spawnWave(night, gameState) — both flanks, escalating

    phase/
      phaseSystem.js          ← DAY / NIGHT state machine, timer, transition events

    camera/
      cameraSystem.js         ← updateCamera(cam, player, dt) — base-locked with scroll

    hud/
      hud.js                  ← renderHUD(ctx, gs) — resources, phase timer, night counter

  components/
    game/
      GameCanvas.jsx          ← RAF loop, canvas ref, deltaTime clamp, mounts engine
```

---

## SYSTEM CONTRACTS

### engine.js
```js
export function updateGame(gs, deltaTime) {
  updatePhase(gs, deltaTime)
  updateLifepods(gs.lifepods, gs.world.tiles, gs.particles, deltaTime)  // pods fall, land, spawn survivor
  updatePlayer(gs.player, gs.input, gs.world.tiles, gs.projectiles, gs.particles, deltaTime)
  updateProjectiles(gs.projectiles, gs.world.tiles, deltaTime)
  updateSquadFormation(gs.player, gs.units, deltaTime)   // slot targeting + idle drift
  updateSquadIdle(gs.units, deltaTime)                   // per-unit idle state machine
  updateInfantry(gs.units, gs.world.tiles, gs.bugs, deltaTime)
  updateBugs(gs.bugs, gs.world.tiles, gs.structures, gs.units, gs.player, deltaTime)
  updateWaveSpawner(gs, deltaTime)
  updateStructures(gs.structures, gs.resources, deltaTime)
  updateCamera(gs.camera, gs.player, deltaTime)
}
```

---

## ── LIFEPOD RESCUE SYSTEM ──────────────────────────────────────────────────

### Design

Two survivor arrival types. Different frequency, different scale, different feel.

**LIFEPODS** (common — every 90-180s of day time, configurable)
- A ship explosion occurs in the upper atmosphere — screen flash + distant boom
- 1-3 pods scatter across the horizon in different directions
- Each pod has a visible smoke trail arcing down to a landing zone
- The smoke trail persists after landing as a column — you can see it from the base
- Player must travel to the landing site to rescue the survivor
- Survivor class is assigned on landing (weighted random, configurable per-day)

**DROPSHIP CRASHES** (rare — post-MVP, every 5-6 days)
- Larger event. 3-4 survivors from one location
- Wreckage becomes a persistent lootable prop
- Deeper in bug territory — higher risk, higher reward

### Lifepod State Machine

```
INCOMING         ← Pod spawns off-screen top, begins descent arc
  ↓
DESCENDING       ← Physics arc (fast, with configurable lateral drift)
  ↓
IMPACT           ← Hits ground: screen shake, impact particles, dust cloud
  ↓
LANDED           ← Pod sits on terrain, smoke column rising
  ↓
SURVIVOR_READY   ← Survivor entity spawned, crouching at pod door
  ↓ (player walks within rescue radius)
RESCUED          ← Survivor joins squad, pod remains as prop
```

### Smoke Trail System

```js
// lifepodSystem.js
// Trail is NOT a particle system — it's a persistent polyline
// stored as an array of {x, y} points sampled every 4 frames during descent.
// Rendered as a fading semi-transparent line (opacity decays over 30s).
// This is cheap and always readable — no particle budget required.

// Landing smoke column = simple looping particle emitter, capped at 12 particles.
// Visible from full world distance — player can see which direction to go.
```

### HUD Indicator

When a pod lands off-screen, a directional arrow appears on the screen edge pointing
toward the pod's world position. Fades after 60s. Same pattern as Kingdom: New Lands
deer indicators. Simple, no radar required.

### Config
```js
// lifepod.config.js
export const LIFEPOD_CONFIG = {
  daySpawnChance: 0.6,         // probability a pod arrives each day phase
  minPerDay: 1,
  maxPerDay: 3,
  descentDuration: 3.5,        // seconds from spawn to impact (s)
  lateralDriftRange: [-400, 400], // px from spawn X, randomised
  smokeTrailFadeTime: 30,      // seconds before trail vanishes
  smokeColumnParticles: 12,    // max particles in landing column
  rescueRadius: 64,            // px — how close player must be
  survivorClassWeights: {      // weighted random class on rescue
    infantry: 0.6,
    scientist: 0.2,
    miner: 0.2,
  },
}
```

---

## ── SQUAD FORMATION + IDLE SYSTEM ─────────────────────────────────────────

### The Problem

All units targeting player.x produces a single-point blob. Looks like one person.
Fix: slot-based formation with per-unit drift and an idle state machine.

### Formation Slots

```js
// squadFormation.js
// Each rescued unit is assigned a slot index on rescue. Never shared.
// Slot offsets are staggered behind the player — alternating left/right
// of the follow line to create a loose wedge, not a conga line.

const SLOT_OFFSETS = [
  { dx: -30, dy:  0  },   // slot 0 — close behind
  { dx: -55, dy:  4  },   // slot 1 — further, slightly lower
  { dx: -80, dy: -4  },   // slot 2 — further, slightly higher
  { dx: -50, dy:  8  },   // slot 3 — mid, offset down
  { dx: -100,dy:  0  },   // slot 4 — back of pack
]
// Beyond slot 4: wrap with increasing -dx

// Each unit lerps toward their slot position at their own speed (with personality variance).
// Fast units overshoot slightly and correct. Slow units lag. No two move identically.
```

### Idle Drift

```js
// Per unit, on creation:
unit.idlePhase  = Math.random() * Math.PI * 2   // unique sine offset
unit.idleSpeed  = 0.4 + Math.random() * 0.3     // unique oscillation rate
unit.idleAmpX   = 1.5 + Math.random() * 1.5     // ±px horizontal drift
unit.idleAmpY   = 1.0 + Math.random() * 1.0     // ±px vertical drift (subtle)

// Every frame when player is stationary:
unit.x += Math.sin(time * unit.idleSpeed + unit.idlePhase) * unit.idleAmpX * dt_scale
unit.y += Math.cos(time * unit.idleSpeed * 0.7 + unit.idlePhase) * unit.idleAmpY * dt_scale
```

### Idle State Machine

```
FOLLOWING    ← Moving with player, lerping to slot
  ↓ (player stops > 1.5s)
IDLE_ALERT   ← Standing, weapon up, eyes forward. Drift active.
  ↓ (random 4-8s)
IDLE_SCAN    ← Head turns, scanning left/right. Still drifting.
  ↓ (random 2-4s)
IDLE_FIDGET  ← Class-specific behaviour (see below)
  ↓ (random 1-2s)
IDLE_ALERT   ← Cycles back

NIGHT PHASE → breaks formation entirely → PATHFIND_TO_DEFENSE_POINT
```

### Class-Specific Idle Fidgets

| Class | Fidget Behaviour |
|---|---|
| Mobile Infantry | Checks rifle, shifts stance, crouches briefly |
| Scientist | Pulls out data pad, taps it, puts it away |
| Miner | Taps tool on ground twice, looks at it |
| Medic | Opens kit, checks contents, closes it |
| Pilot | Crosses arms, looks at sky, uncrosses |

Implementation: `unit.idleVariant` string → renderer picks the right animation frame set.
Zero extra logic — just a sprite selection key.

### Night Transition

```js
// On 'phase:night_start' event:
// Each infantry unit is assigned the nearest unclaimed defensePoint from gs.structures.
// defensePoint = { x, y } property on each Wall / Guard Tower structure.
// Units pathfind to their point (simple direct move, jump over obstacles).
// Once at point: enter DEFENDING state — shoot at any bug within range.
// Player is free to roam and fill gaps.

// The visual: squad breaks formation and fans out to the walls as the sun sets.
// This is a cinematic moment. Make it feel intentional.
```

---

## CAMERA — THE TRICKY PART

Kingdom locks the world. StarTroop locks the *base* but lets the player explore.

```
World: 6400px wide (200 tiles × 32px)
Base zone: tiles 80–120 (centre 1280px, world x 2560–3840)

Camera logic:
  if player.x is within base zone:
    camera lerps toward world centre (3200px) — base feels anchored
  else:
    camera follows player.x directly
  Always: hard clamp at world edges [0, 6400 - SCREEN_WIDTH]
```

Exploration feels like leaving safety. Return to base is a visual pull back to centre.

---

## WORLD ZONES

```
[0 ─────── 1600px] LEFT WING      ← Mining, bug burrows, lifepod landing zones
[1600 ──── 2560px] LEFT PERIMETER ← Defensive wall left side
[2560 ──── 3840px] BASE ZONE      ← Structures, command post (world centre = 3200)
[3840 ──── 4800px] RIGHT PERIMETER← Defensive wall right side
[4800 ──── 6400px] RIGHT WING     ← Crash sites, rescue pods, lifepod landing zones
```

Lifepods land in the wing zones — always off the safe perimeter. Always a journey.

---

## RESOURCE SYSTEM (MVP)

| Resource | Source | Used For |
|---|---|---|
| Ore | Walk over ore nodes | Build structures |
| Ammo | Spawns in base at dawn | Morita rifle fire |

Passive collection — walk over = collected. No production chain for MVP.

---

## NIGHT WAVE TABLE (MVP)

```js
export const WAVE_TABLE = [
  { night: 1,  left: { warrior: 6  }, right: { warrior: 6  } },
  { night: 2,  left: { warrior: 10 }, right: { warrior: 10 } },
  { night: 3,  left: { warrior: 15 }, right: { warrior: 15 } },
  { night: 4,  left: { warrior: 20 }, right: { warrior: 20 } },
  { night: 5,  left: { warrior: 25 }, right: { warrior: 25 } },
]
// Nights beyond table: scale last entry by 1.25x per night
```

---

## MVP BUILD ORDER

```
STEP 1 — Skeleton
  GameCanvas.jsx + RAF loop
  engine.js stub
  constants.js + all configs
  eventBus.js

STEP 2 — World
  worldGen.js (flat terrain, tile grid)
  renderer.js (draw tiles)
  cameraSystem.js (base-locked + scroll)

STEP 3 — Player
  player.js (move, jump, physics)
  input.js
  → Playable: run around a flat world

STEP 4 — Shooting
  weapons.js (fireMorita, projectiles)
  → Playable: run and shoot

STEP 5 — Base Structures
  structures.js (Command Post, Wall)
  buildSystem.js (place with keypress, cost ore)
  → Playable: place walls

STEP 6 — Day/Night
  phaseSystem.js (timer, transition, sky colour)
  hud.js (timer, night counter, resources)
  → Playable: watch day/night cycle

STEP 7 — Bugs
  bugAI.js (Warrior Bug)
  waveSpawner.js
  → Playable: defend against first wave

STEP 8 — Lifepods + Squad
  lifepodSystem.js (descent arc, impact, smoke trail)
  survivorSpawn.js (spawn MI at landing site)
  squadFormation.js (slots, drift)
  squadIdle.js (idle state machine)
  infantry.js (defend at night)
  → Playable: FULL MVP LOOP

STEP 9 — Win/Lose
  Command Post HP → 0 = game over screen
  → MVP COMPLETE
```

---

## MODULARITY RULES

Non-negotiable. Same laws as Killbox.

1. No file over ~300 lines. Split before 400.
2. Config is data. Numbers live in config/.
3. No system imports from another system. Use eventBus.
4. engine.js is the only orchestrator. Period.
5. renderer.js renders. Never mutates state.
6. Each entity type owns its file.
7. No globals except window.__ST_STATE__ (debug only).

---

## DESIGN DECISIONS — LOCKED

| Question | Answer |
|---|---|
| Lifepods or Dropship crashes? | Both — pods are common (daily), crashes are rare (every 5-6 days, post-MVP) |
| Passive or active ore collection? | Passive — walk over = collected |
| Click-to-build or proximity? | Proximity — press B near base, radial pick |
| Squad bunching fix? | Slot-based formation with per-unit sine drift |
| Squad at night? | Break formation → pathfind to defensePoints on walls |
| One-hit or HP bugs? | HP — Warrior Bug = 3 Morita shots |
| Lifepod direction indicator? | Screen-edge arrow HUD when pod lands off-screen |
| Smoke trail implementation? | Persistent polyline (not particles) — cheap, always readable |

---

## ART DIRECTION OVERRIDE

The GDD contains assets with cinematic 3/4 and isometric perspective.
**These are overridden. StarTroop is a strict 2D side-scroller.**

All in-engine sprites must be:
- **Side-elevation only** — viewed from directly left or right, never angled
- **Left-facing by default** — flipped horizontally for right-facing
- **Silhouette-readable** at target game resolution (16px characters, 32-64px buildings)

### Asset Audit Results

| Category | Status | Action |
|---|---|---|
| Characters | Most 3/4 angle | Regenerate all as strict left-facing side profile |
| Enemies | Warrior Bug ✓ | Regenerate Tanker/Hopper — Warrior usable for MVP |
| Buildings | 10/12 isometric | **Full regeneration — side elevation, Metal Slug style** |
| Backgrounds | ✓ Usable | Keep — horizontal strips work perfectly |
| Terrain | ✓ Mostly usable | Keep |
| Props | Rescue Pod + Ore Node ✓ | Keep usable, regenerate rest |
| Concept Art | Reference only | Not used as sprites |

### Priority Regenerations for MVP (minimum to unblock Step 8)
1. Mobile Infantry — strict left-facing side profile
2. Command Post — side elevation building (largest, most prominent)
3. Lifepod — side-on descent + landed state (new asset, not in GDD)

**Palette lock:** Red-orange alien atmosphere. Deep purple-black night sky.
16-bit pixel art. Consistent across all assets. Do not deviate.
