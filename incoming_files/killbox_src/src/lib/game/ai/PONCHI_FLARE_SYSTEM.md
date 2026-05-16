# PONCHI TRIPWIRE FLARE SYSTEM
## Information Warfare, Not Just Damage

### SYSTEM OVERVIEW

Ponchi (rifleman, role: perimeter defender) automatically places up to 2 cheap tripwire flare devices at clever chokepoints around the map during PREP phase.

These flares are **not** damage traps—they're early-warning sensors that:
- Detect hunter approach
- Briefly reveal cloaked hunter
- Emit light and noise to disrupt tactics
- Create tactical uncertainty through directional variance

### HUNTER ENTRY VARIANCE

Hunter now spawns from either **LEFT** or **RIGHT** side of the map, forcing player to defend perimeter on both sides.

This creates:
- **Uncertainty**: Player may have built everything facing one direction
- **Replay Value**: Each run plays differently
- **Tactical Depth**: Perimeter traps now matter more
- **Value for Ponchi**: Flare positioning directly counters unknown entry direction

### FILES

#### Config
- `lib/game/config/traps.config.js` — TRIPWIRE_FLARE_CONFIG, HUNTER_ENTRY_CONFIG

#### Core Systems
- `lib/game/ai/ponchiFlares.js` — Flare placement, scoring, triggering
- `lib/game/ai/hunterEntry.js` — Hunter entry direction, spawn position calculation
- `lib/game/hunter.js` — Added `entrySide` property to hunter entity

#### Engine Integration
- `lib/game/engine.js` — Hunter creation now uses entry system

### FLARE MECHANICS

#### Placement
Ponchi evaluates candidates and places up to 2 flares based on score:

```
score =
  chokepointScore * 2.0 +
  approachPathScore * 1.8 +
  distanceFromPlayerScore * 0.8 +
  lineOfSightScore * 0.6 -
  overlapTrapPenalty * 2.0 -
  dangerPenalty * 1.5
```

**Good locations:**
- Bridges and narrow passages (chokepoint)
- Tunnel mouths and ravines
- Likely hunter entry paths (left/right edges)
- Outside player trap zone, not inside it
- 160-520px from player
- 160px+ apart from other flares

**Avoid:**
- Inside solid terrain
- Directly under player
- Too close together
- Immediate danger zones

#### Trigger
When hunter crosses flare (16px trigger radius):
- Red/orange flare burst (12 particles)
- Smoke trail (6 particles)
- Emit TRIPWIRE_FLARE_TRIGGERED event
- Emit HUNTER_REVEALED_BY_FLARE event
- Light radius: 180px for 8 frames
- Cloak reveal duration: 4 frames
- Noise radius: 300px

#### Cost
- Rope: 1
- Metal: 0
- **Total cost: Very cheap**, encouragable in early PREP

### HUNTER ENTRY DIRECTION

#### Calculation
```
entrySide = random(0.5 LEFT, 0.5 RIGHT)
spawnPos = findValidSpawnInLane(entrySide, world, player)
```

Finds valid ground at edge of map, facing inward.

#### Spawn Rules
- LEFT: spawn outside left boundary, face right (1), enter rightward
- RIGHT: spawn outside right boundary, face left (-1), enter leftward
- Avoid spawning on player (420px avoidance radius)
- Always find solid ground

### SQUAD REACTIONS

When flare triggers, squad reacts based on alert level:

**MAC** (aggressive suppressor):
- Turn toward flare
- Begin suppressive fire
- Move to high ground if possible

**PONCHI** (perimeter defender):
- Call out direction ("LEFT APPROACH!" / "RIGHT APPROACH!")
- Reload and move to flare zone
- Place more flares if possible

**ANNIE** (tactician):
- Move to cover with line of sight to flare
- Prepare for hunter approach from that direction

**BLAZE** (firepower):
- Begin spin-up if minigun equipped
- Face flare direction

### PLAYER FEEDBACK

When flare triggers:
- Screen edge pulse toward direction
- Small HUD text: "FLARE TRIGGERED — LEFT APPROACH"
- Minimap marker (if minimap exists)
- Audio hook (if audio system exists)

### HUNTER COUNTERPLAY

Hunter can:
- **Cautious**: Pause, inspect, take alternate route
- **Aggressive**: Sprint through and attack immediately
- **Plasma**: Blast flare area to suppress
- **Cloaked**: Shimmer briefly revealed, then continue

Flares are useful but not guaranteed protection.

### TECHNICAL NOTES

#### No Complexity Limits
Do NOT add:
- Complex trap inventory UI
- Squad command system
- Heavy director AI
- Flare damage mechanics

#### Keep Config-Driven
All values in `TRIPWIRE_FLARE_CONFIG` and `HUNTER_ENTRY_CONFIG`.

#### Minimal Integration
- Flares use existing trap system structure
- Entry variance is one-line change per run
- Squad reactions use existing bark system

### ACCEPTANCE TESTS

✓ Hunter can spawn from LEFT
✓ Hunter can spawn from RIGHT
✓ Hunter does not spawn inside terrain
✓ Hunter does not spawn on player
✓ Ponchi places max 2 flare tripwires
✓ Flares appear in sensible choke/approach points
✓ Flares do not overlap each other (160px minimum)
✓ Hunter crossing flare triggers it
✓ Flare reveals cloaked hunter briefly
✓ Squad reacts to triggered flare
✓ Player gets directional warning
✓ Hunter may still adapt/counter
✓ System remains lightweight
✓ Config can be tweaked without code changes

### FUTURE ENHANCEMENTS (Not In MVP)

- Hunter entry side weighted by trap density (director AI)
- Ponchi places flares reactively mid-hunt
- Player-controllable flare placement in PREP
- Flare chain reactions (nearby flares trigger)
- Thermal detection of flares by hunter
- Ponchi callouts with compass directions

---

**Current Status**: Foundation implemented, ready for placement logic and squad integration.