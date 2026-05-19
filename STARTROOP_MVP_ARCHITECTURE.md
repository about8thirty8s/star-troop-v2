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
- Win/Lose detection (Command Post destroyed = lose)
- Day timer HUD + resource HUD

**OUT (post-MVP):**
- Hopper / Tanker / Brain / Plasma bugs
- Scientist / Miner / Medic / Pilot classes
- Tech tree
- Electric fences, auto-turrets, generators
- Evac Beacon win condition
- Survivor rescue system
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
      infantry.js             ← createMI(), updateMI(member, tiles, bugs, dt) — holds line at night

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
// One function. Receives full game state + dt. Calls all subsystems in order.
export function updateGame(gs, deltaTime) {
  updatePhase(gs, deltaTime)
  updatePlayer(gs.player, gs.input, gs.world.tiles, gs.projectiles, gs.particles, deltaTime)
  updateProjectiles(gs.projectiles, gs.world.tiles, deltaTime)
  updateInfantry(gs.units, gs.world.tiles, gs.bugs, deltaTime)
  updateBugs(gs.bugs, gs.world.tiles, gs.structures, gs.units, gs.player, deltaTime)
  updateWaveSpawner(gs, deltaTime)
  updateStructures(gs.structures, gs.resources, deltaTime)
  updateCamera(gs.camera, gs.player, deltaTime)
  updateHUD(gs)
}
```

### phaseSystem.js
```js
// Single responsibility: track DAY/NIGHT, fire transition events, expose timer.
const PHASES = { DAY: 'day', NIGHT: 'night' }
DAY_DURATION  = 180s   // configurable
NIGHT_DURATION = 120s  // configurable — grows with wave number

// Events emitted: 'phase:day_start', 'phase:night_start', 'phase:wave_clear'
```

### waveSpawner.js
```js
// Reads waves.config.js. Spawns from left + right flanks.
// Tracks: alive bug count. Emits 'wave:clear' when count hits 0.
// Escalation is pure data — edit waves.config.js, behaviour changes.
```

### bugAI.js
```js
// MVP: Warrior Bug only.
// States: SPAWNING → CHARGING → ATTACKING → DEAD
// Target priority: nearest structure on their flank. Fall back to player.
// No pathfinding — direct charge. Obstacles = jump.
```

### buildSystem.js
```js
// Placement grid: base zone tiles flagged as BUILDABLE.
// canAfford(type, resources) → bool
// placeStructure(type, tileX, resources) → mutates gs.structures + deducts resources
// No drag-and-drop for MVP — click zone, confirm, done.
```

---

## CAMERA — THE TRICKY PART

Kingdom: New Lands locks the world and scrolls the camera.
StarTroop locks the BASE (world centre) but lets the player explore left/right.

**Solution:**
```
- World is 6400px wide (200 tiles × 32px)
- Base occupies tiles 80–120 (centre 1280px)
- Camera target = player.x (with base-zone dead zone)
- Dead zone: if player is within base zone, camera lerps toward base centre
- Outside base zone: camera follows player normally
- Hard clamp at world edges
```

This means the base always feels anchored. Exploration feels like leaving safety.

---

## WORLD ZONES

```
[0 ─────── 1600px] LEFT WING    ← Mining, bug burrows
[1600 ──── 2400px] LEFT PERIMETER ← Defensive wall left side
[2400 ──── 4000px] BASE ZONE    ← Structures, command post (world centre)
[4000 ──── 4800px] RIGHT PERIMETER ← Defensive wall right side
[4800 ──── 6400px] RIGHT WING   ← Crash sites, rescue pods
```

Bug waves spawn off-screen at x=0 (left) and x=6400 (right).

---

## RESOURCE SYSTEM (MVP)

Two resources only. No food, no biomass, no power cells for MVP.

| Resource | Source | Used For |
|---|---|---|
| Ore | Walk over ore nodes (no miner unit for MVP) | Build structures |
| Ammo | Spawns in base at dawn | Morita rifle fire |

Ore nodes are world props — player walks over them to collect (like Kingdom coins).
Ammo regenerates at dawn from Command Post. Simple. No production chain for MVP.

---

## NIGHT WAVE TABLE (MVP)

```js
// waves.config.js
export const WAVE_TABLE = [
  { night: 1,  left: { warrior: 6  }, right: { warrior: 6  } },
  { night: 2,  left: { warrior: 10 }, right: { warrior: 10 } },
  { night: 3,  left: { warrior: 15 }, right: { warrior: 15 } },
  { night: 4,  left: { warrior: 20 }, right: { warrior: 20 } },
  { night: 5,  left: { warrior: 25 }, right: { warrior: 25 } },
  // Post-MVP: add hopper, tanker, plasma entries here
]
// Nights beyond table: scale last entry by 1.25x per night
```

---

## MVP BUILD ORDER

Build in this exact order. Each step is independently testable.

```
STEP 1 — Skeleton
  GameCanvas.jsx + RAF loop
  engine.js stub (empty updateGame)
  constants.js + configs
  eventBus.js

STEP 2 — World
  worldGen.js (flat terrain, tile grid)
  renderer.js (draw tiles)
  cameraSystem.js (follow player, clamp)

STEP 3 — Player
  player.js (move, jump, physics)
  input.js (keyboard state)
  → Playable: run around a flat world

STEP 4 — Shooting
  weapons.js (fireMorita, projectiles)
  renderer.js (draw projectiles)
  → Playable: run and shoot

STEP 5 — Base Structures
  structures.js (Command Post, Wall — static for now)
  buildSystem.js (place with keypress, cost ore)
  → Playable: place walls

STEP 6 — Day/Night
  phaseSystem.js (timer, transition, sky colour shift)
  hud.js (timer, night counter)
  → Playable: watch day/night cycle

STEP 7 — Bugs
  bugAI.js (Warrior Bug, charge + attack)
  waveSpawner.js (spawn from flanks)
  → Playable: defend against first wave

STEP 8 — Units
  infantry.js (MI holds wall at night, shoots bugs)
  → Playable: full MVP loop

STEP 9 — Win/Lose
  Command Post HP. Bugs damage it. HP=0 → game over screen.
  → MVP COMPLETE
```

---

## MODULARITY RULES

These are non-negotiable. Same laws as Killbox.

1. **No file over ~300 lines.** Split before you hit 400.
2. **Config is data, not code.** If it's a number someone might tune, it goes in config/.
3. **No system imports from another system directly.** Use eventBus for cross-system communication.
4. **engine.js is the only orchestrator.** Nothing else calls multiple systems.
5. **renderer.js renders. It does not update state.** Ever.
6. **Each entity type owns its own file.** bugs/bugAI.js, units/infantry.js, etc.
7. **No globals except window.__ST_STATE__ (debug only).**

---

## DESIGN DECISIONS — LOCKED FOR MVP

**Q: Kingdom-style passive coin collection or active mining?**
A: Passive. Player walks over ore nodes = collected. No miner unit for MVP. Keeps loop tight.

**Q: Click-to-build or proximity build?**
A: Proximity. Stand near base, press B, pick structure from radial menu (3 options). No drag-and-drop complexity.

**Q: How do Infantry know where to stand at night?**
A: Each wall/guard tower has a `defensePoint` property. Infantry pathfind to nearest unclaimed defensePoint at night start. Simple, readable, extensible.

**Q: Does the player fight at night too?**
A: Yes. Player is always active. MI hold the line, player fills gaps, throws grenades, manages the chaos. This is the tension.

**Q: One-hit kill bugs or HP?**
A: HP but low. Warrior Bug = 3 Morita shots. Dies fast in sustained fire. Feels like the film.

---

## NEXT ACTIONS

1. **Scaffold the repo** — Vite + vanilla JS (no React in game loop, React only for menus)
2. **Wire Steps 1–3** first — world + player + camera
3. **Art pipeline** — key out GDD assets, categorise, wire into renderer catalogue
4. **Design deep-dive** — Survivor rescue system (most emotionally important, most underspecified in GDD)
