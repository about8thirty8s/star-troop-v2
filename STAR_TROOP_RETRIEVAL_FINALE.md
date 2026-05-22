# STAR TROOP — RETRIEVAL FINALE
## "Hold Until Retrieval" — Game Loop Ending Design

**VULCAN / Driftgate Studios**
**Date:** 2026-05-22

---

## THE PREMISE

After surviving WIN_WAVES nights, the mission doesn't just end with a screen.
The dropship comes.
You hold until it lands.
Everyone boards.
You fly away — sometimes taking fire.

This is the finale the game was always building toward.

---

## EMOTIONAL ARC

```
NIGHT 5 CLEAR
  → Radio crackle: "Retrieval confirmed. ETA 90 seconds."
  → Bug wave intensity SPIKES — they know you're leaving
  → Dropship appears on horizon (distant silhouette)
  → Closes in over ~60 seconds, bugs pouring in
  → Dropship descends to center base, dust cloud, engine roar
  → Squad runs to board (animation)
  → Player boards last
  → Dropship lifts off
  → ESCAPE GAUNTLET — bugs fire as you ascend, ship takes damage
  → Clear atmosphere — mission complete
  → Final stat screen
```

---

## GAME STATES (new phases added to gamePhase)

```
normal gameplay  →  RETRIEVAL_CALLED
                 →  RETRIEVAL_INBOUND   (dropship visible on horizon)
                 →  RETRIEVAL_LANDING   (dropship descending)
                 →  RETRIEVAL_BOARDING  (squad + player board)
                 →  RETRIEVAL_LIFTOFF   (ship rises)
                 →  RETRIEVAL_ESCAPE    (ascent gauntlet)
                 →  MISSION_COMPLETE    (stat screen)
```

---

## PHASE 1 — RETRIEVAL_CALLED (~5 seconds)

**Trigger:** Wave 5 cleared, all bugs dead, waveManager.active = false

**What happens:**
- Radio message text popup: `"RETRIEVAL CONFIRMED — ETA 90 SECONDS"`
- Screen flash — brief white
- `engine.retrievalPhase = 'called'`
- `engine.retrievalTimer = 0`
- Camera stays on player
- Bugs DO NOT spawn yet (2-second grace)
- Music cue (if implemented)

**Visual:**
- HUD: Retrieval countdown bar appears (90s → 0)
- Blinking orange beacon indicator top-right

---

## PHASE 2 — RETRIEVAL_INBOUND (~70 seconds)

**What happens:**
- FINAL SURGE begins — bugs spawn at 2x normal rate, no wave cap
- All bug types active simultaneously
- `engine.retrievalSurge = true`
- Dropship sprite appears at world edge (x = WORLD_WIDTH - 100), altitude = -200 (off-screen top)
- Dropship slowly descends and moves toward world center (x=2400)
- Dropship is INVULNERABLE in this phase
- Infantry hold positions — no new orders
- HUD countdown ticks down

**Dropship movement:**
```
targetX = WORLD_WIDTH / 2  (center of base)
targetY = GROUND_Y - 80    (hover height before landing)
speed: 120px/s horizontal, 60px/s vertical
```

**Visual:**
- Distant dropship silhouette — small, grows as it approaches
- Engine wash particles trailing behind
- Light beacon blinking on hull
- Camera occasionally pans to show dropship on horizon (brief cinematic cut, then returns to player)

---

## PHASE 3 — RETRIEVAL_LANDING (~12 seconds)

**Trigger:** Dropship reaches center X and hover Y

**What happens:**
- Dropship slows, hovers over LZ
- Dust cloud / debris particle burst on ground beneath
- Engine wash pushes bugs back slightly (radial force from center)
- Screen shake — low rumble
- Infantry begin moving toward dropship
- HUD: "BOARD NOW" flashing

**Dropship movement:**
```
Descend from GROUND_Y - 80  →  GROUND_Y - 40 (landed, gear down)
Duration: ~8 seconds
Landing gear extends (sprite frame change)
Rear ramp lowers (sprite frame change)
```

**Visual:**
- Dust particles spray outward from landing point
- Heat distortion shimmer beneath engines
- Orange landing lights activate on hull

---

## PHASE 4 — RETRIEVAL_BOARDING (~8 seconds)

**Trigger:** Dropship fully landed (y >= GROUND_Y - 42)

**What happens:**
- Infantry path to dropship rear ramp and "board" (walk into ship, disappear)
- Each infantry member boards sequentially — 1.5s apart
- Bugs still attacking — player must defend during boarding
- Player gets 5s after last infantry boards before auto-board triggers
- If player walks to ramp: instant board
- If player doesn't move: auto-board after timer

**Boarding animation:**
- Infantry sprite walks toward ramp, alpha fades at ramp threshold
- "Mac BOARDED" / "Sniper BOARDED" text popups
- Each board triggers a small cheer particle effect

---

## PHASE 5 — RETRIEVAL_LIFTOFF (~6 seconds)

**Trigger:** Player boards

**What happens:**
- Ramp closes
- Engine thrust particles BURST from engines
- Dropship begins rising (y decreases)
- Camera follows dropship upward
- Buildings, terrain slide downward as ship rises
- Bugs on ground become tiny, then invisible
- World scrolls DOWN as if ascending

**Camera:**
- Locks to dropship
- Smooth upward pan
- Parallax layers move down at different rates

---

## PHASE 6 — RETRIEVAL_ESCAPE (~8 seconds)

**The money shot.**

**What happens:**
- As dropship rises through "altitude zone" (y < 200)
- Bug projectiles arc upward — Bombardiers and Tankers fire at the ship
- Each hit: hull sparks, screen shake, ship HP ticks down (cosmetic — can't be destroyed in finale)
- "HULL INTEGRITY" bar on HUD — mostly cosmetic tension
- Ship takes visible damage: spark particles on hull
- Random chance (30%) of engine fire on one pod — adds drama
- After 8 seconds: ship clears "atmosphere" (screen goes bright, then stars visible)

**Visual climax:**
- Stars appear
- Bugs fade below
- Dropship silhouette against bright horizon
- Final engine flare

---

## MISSION_COMPLETE — Stat Screen

Replaces current simple win screen.

**Stats shown:**
- Nights survived
- Bugs killed
- Buildings standing
- Infantry survived (X/3)
- Hull integrity at extraction (%)
- Final score + bonus

**Tone:** Military debrief. Green text on dark. "MISSION COMPLETE — ALL PERSONNEL EXTRACTED"

---

## DROPSHIP VARIANTS FOR FINALE

**STANDARD** (Variant 01) — Default extraction ship. Clean olive drab. Shows up reliably.

**VETERAN** (Variant 08) — If player score > threshold or difficulty high. Battle-scarred ship. Takes more hits visually during escape. Feels earned.

**Future unlock:** Beat the game fast enough and the Heavy Gunship comes instead — guns blazing on the way down, clears a path through bugs before landing.

---

## TECHNICAL IMPLEMENTATION PLAN

### New files:
```
src/game/systems/RetrievalSystem.js   — phase state machine + dropship entity
src/game/renderer/sprites/drawDropship.js  — dropship sprite (Standard + Veteran)
```

### Modified files:
```
GameEngine.js         — new retrieval phases, check conditions, wire RetrievalSystem
WaveManager.js        — retrieval surge mode (2x spawn, all types)
drawScreens.js        — new MISSION_COMPLETE stat screen (replaces current win)
drawHUD.js            — retrieval countdown bar + "BOARD NOW" indicator
Renderer.js           — render dropship entity layer (above terrain, below UI)
constants.js          — RETRIEVAL_ETA, RETRIEVAL_SURGE_MULT, DROPSHIP_SPEED
```

### Dropship entity shape:
```js
{
  x, y,              // world position
  vx, vy,            // velocity
  phase,             // 'inbound' | 'landing' | 'landed' | 'liftoff' | 'escape'
  hp: 100,           // cosmetic hull integrity
  variant: 'standard' | 'veteran',
  rampOpen: false,
  gearDown: false,
  engineFire: false,  // random drama during escape
  sparkTimer: 0,
}
```

### RetrievalSystem state machine:
```
called     → wait 2s → inbound
inbound    → dropship reaches center hover → landing
landing    → dropship lands → boarding
boarding   → all boarded → liftoff
liftoff    → altitude reached → escape
escape     → timer done → mission_complete
```

---

## INTENSITY CURVE — FINAL 90 SECONDS

```
[0s]    Wave 5 clear — 2s calm — radio crackle
[2s]    Retrieval surge begins — bugs pour in
[20s]   Dropship visible on horizon — player sees hope
[45s]   Dropship overhead — bugs in full frenzy
[60s]   Dropship descends — dust cloud — maximum chaos
[72s]   Infantry board — player defends solo
[78s]   Player boards — engines roar
[82s]   Liftoff — world falls away
[86s]   Escape gauntlet — projectiles incoming
[94s]   Clear — stars — silence
[96s]   MISSION COMPLETE
```

---

## FEEL TARGETS

- The 90 seconds after retrieval is called should be the most intense 90 seconds in the game
- The dropship landing should feel MASSIVE — dust, shake, engine roar
- Boarding should feel bittersweet — you're leaving but the base is still there
- Liftoff should feel triumphant but not safe yet
- The escape gauntlet should make the player feel like they barely made it
- The stat screen should feel like a military debrief, not a game over screen

---

## ROHANN ART REQUIREMENTS

### Dropship sprite (STANDARD variant):
- **Size:** 160×80px, side-profile only
- **Frames:**
  - Frame 0: Inbound flight (gear up, ramp closed)
  - Frame 1: Landing (gear extending)
  - Frame 2: Landed (gear down, ramp closed)
  - Frame 3: Ramp open (boarding)
  - Frame 4: Damaged (sparks, hull marks)
- **Colours:** Olive drab base, sand accent, hazard orange, federation insignia

### Dropship sprite (VETERAN variant):
- Same frame layout as Standard
- Mismatched plates, weld patches, scorch marks
- One engine pod slightly different
- Feels like it's been through 40 missions

### Engine wash particle:
- Hot exhaust orange/blue, directional downward
- Spreads outward during hover/landing

### Landing dust cloud:
- 3-frame animated dust burst, grey-brown
- Spreads outward from landing center

---

*"The ship is coming. Hold the line."*

---
*VULCAN — Driftgate Studios*
