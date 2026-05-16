# LAST HUNT: KILLBOX
## Product Development Document — v1.0
### DRIFTGATE STUDIOS — INTERNAL DOCUMENT — CONFIDENTIAL
#### Side Scroller Division | Prepared by VULCAN | May 2026

---

![Cover Art](https://media.base44.com/images/public/6a07d557e104123d6d54764f/2ec7b4eec_generated_image.png)

---

## EXECUTIVE SUMMARY

**Last Hunt: Killbox** is Driftgate Studios' flagship side-scroller — a cinematic, systemic, destructible-world survival game where a small squad of elite soldiers must survive being hunted by an apex extraterrestrial predator across a procedurally generated jungle environment.

The game fuses the tension of asymmetric predator-prey gameplay, the emergent creativity of sandbox destruction, the addictive loop of roguelite progression, and the visceral feel of classic side-scrolling action. It is not a clone of anything that exists. It is its own thing.

It is dangerous. It is beautiful. It is extraordinarily fun.

**Genre:** Side-scrolling Survival Sandbox / Roguelite
**Tone:** Predator meets Broforce meets Dead Cells meets Terraria meets Noita
**Platform Target:** PC (Primary), Console (Secondary)
**Multiplayer:** Yes — co-op, 1-4 players
**Engine:** Custom Canvas2D / JavaScript (Base44 + React), targeting native port

---

## SECTION 1 — WHAT IS LAST HUNT: KILLBOX?

![Helicopter Insertion](https://media.base44.com/images/public/6a07d557e104123d6d54764f/d3b295272_generated_image.png)

A squad of mercenaries is inserted by helicopter into a remote jungle killzone. Their objective: survive. Their enemy: a single alien apex predator with active camouflage, plasma weaponry, thermal vision, and lethal melee capability.

The soldiers have limited time before the hunter becomes fully active. They must use that prep time to harvest resources from the destructible world, build traps, establish defensive positions, and choose their loadout. Then the hunt begins.

The hunter is faster, stronger, and harder to see than anything the squad has faced. But the jungle itself is a weapon — if the soldiers are smart enough to use it.

Every run is different. Every death is a lesson. Every victory is earned.

---

## SECTION 2 — CORE EXPERIENCE PILLARS

### Pillar 1: FEEL FIRST
Every mechanic must feel elite before it ships. Movement, shooting, destruction, traversal — all must pass the "does this feel incredible?" test before anything else matters.

### Pillar 2: EMERGENT SANDBOX
The world is a toolkit. Trees fall. Terrain craters. Fire spreads. Mud suppresses heat signatures. Water washes off camouflage. The player creates their own moments — not scripted ones.

### Pillar 3: ASYMMETRIC TENSION
One hunter. Multiple survivors. The power gap is real. The comeback is always possible. The tension never fully releases. This is not fair — it is balanced.

### Pillar 4: ROGUELITE REPLAYABILITY
No two runs identical. Procedural world generation. Randomized loadouts. Unlockable characters and abilities. Meta-progression between runs. The loop pulls players back relentlessly.

### Pillar 5: CINEMATIC IDENTITY
Every session begins with a helicopter insertion sequence. Every death is readable. Every moment of emergence — a tree falling on the hunter, a trap chain-reaction, a desperate escape — should feel like it belongs in a film.

---

## SECTION 3 — AUDIT: DRIFTGATE ENGINE ECOSYSTEM

![World Generation](https://media.base44.com/images/public/6a07d557e104123d6d54764f/2a79b14cd_generated_image.png)

After a full audit of all active Driftgate repositories, the following high-value systems have been identified across the studio's codebase:

### Systems Inventory

| System | Best Implementation | Repo | Maturity |
|---|---|---|---|
| **Sky / Day-Night Cycle** | PixelSkyEngine + SkySystem | follow-the-white-rabbit | ★★★★★ |
| **Volumetric Light / God Rays** | VolumetricLightPass | danger-close-v2 | ★★★★★ |
| **Bioluminescence** | BioluminescencePass | danger-close-v2 | ★★★★☆ |
| **Destructible Terrain** | DestructibleTerrainSystem | follow-the-white-rabbit | ★★★☆☆ |
| **Tree Destruction / Harvest** | TreeHarvestSystem + FoliageSystem | danger-close-v2 | ★★★★☆ |
| **Falling Trees** | FALLING_TREES_IMPLEMENTATION | danger-close-v2 | ★★★☆☆ |
| **Weather System** | WeatherManager + RainSystem | danger-close-v2 | ★★★★☆ |
| **Render Pipeline (pass-based)** | RenderPipeline + passes/* | danger-close-v2 | ★★★★★ |
| **Day/Night Tint Pass** | DayNightPass | danger-close-v2 | ★★★★☆ |
| **Player State Machine** | PlayerStateMachine + PlayerStates | danger-close-v2 | ★★★★★ |
| **Movement Config** | MovementStateConfig | danger-close-v2 | ★★★★☆ |
| **Squad AI** | squadBehaviors.js | last-hunt-killbox | ★★★☆☆ |
| **Camera System** | cameraSystem.js + camera.config.js | last-hunt-killbox | ★★★☆☆ |
| **Foliage / Props** | foliageSystem + propSystem | last-hunt-killbox | ★★★★☆ |
| **Weapon System** | weapons.js + weapons.config.js | last-hunt-killbox | ★★★★☆ |
| **Physics (tiles)** | physics.js | last-hunt-killbox | ★★★★☆ |
| **Cinematic Characters** | cold-wake character system | cold-wake | ★★★★☆ |
| **Audio / Radio System** | AudioBus + RadioPlayer | danger-close-v2 | ★★★★☆ |
| **Helicopter System** | helicopter.js + HelicopterSystem | last-hunt-killbox + convoy67 | ★★★★☆ |
| **Fog of War** | FogOfWarPass | danger-close-v2 | ★★★★☆ |
| **Fire System** | physics.js (updateFire) | last-hunt-killbox | ★★★☆☆ |
| **Grenade / Explosion** | grenadeSystem.js + createExplosion | last-hunt-killbox | ★★★★☆ |

### Consolidation Recommendation

**Danger Close v2 has the most mature render pipeline in the studio.** Its pass-based rendering architecture (RenderPipeline + individual render passes) is production-grade, readable, and extensible. It is the gold standard.

**Follow The White Rabbit has the best sky system.** PixelSkyEngine is genuinely excellent — multi-layer volumetric clouds, dynamic palette blending, pixel-grid snapping. This should be ported directly into Last Hunt.

**Last Hunt: Killbox has the best tile-based physics and world simulation.** The existing physics.js, worldGen.js, and destruction system are the right foundation for a Terraria-style sandbox game.

**Recommendation: Do NOT consolidate to a single engine yet.** Instead, selectively port the best systems into Last Hunt. Specifically:

1. Port the **PixelSkyEngine** (FTWR) → Last Hunt atmosphere layer
2. Port the **VolumetricLightPass + DayNightPass** (DC2) → Last Hunt render system
3. Port the **BioluminescencePass + WeatherManager** (DC2) → Last Hunt atmosphere
4. Port the **PlayerStateMachine** (DC2) → Replace Last Hunt's simple state tracking
5. Port the **AudioBus** (DC2) → Last Hunt audio system
6. Keep Last Hunt's tile physics as the world foundation — nothing else matches it

This is not a rewrite. It is a selective systems upgrade. The tile world is sacred. Don't touch it.

---

## SECTION 4 — CURRENT STATE ASSESSMENT

![Weapon Arsenal](https://media.base44.com/images/public/6a07d557e104123d6d54764f/ff89ac866_generated_image.png)

### What's Working

- ✅ Core tile world — solid, modular, correct foundation
- ✅ Destruction system — conceptually excellent, has bugs to fix
- ✅ Weapon variety — good range, distinct designs
- ✅ Hunter system — cloaking, thermal, plasma — all present
- ✅ Squad system — AI exists and has structure
- ✅ Config separation — all tunable values in config files (rare, valuable)
- ✅ Helicopter insertion — cinematic foundation is there
- ✅ Mud camouflage — genuinely original stealth mechanic
- ✅ Resource/trap system — smart design, needs polish
- ✅ Modular architecture — files are separated, not monolithic

### What Needs Fixing (Phase 1)

- ❌ Movement floaty — gravity 0.5 too weak (fixed: now 0.65)
- ❌ Jump inconsistent — power -6 too weak (fixed: now -8.5)
- ❌ Tool state overlap — machete/shovel/pistol bleeding into each other
- ❌ Tree destruction bugs — duplication, splitting artifacts
- ❌ Camera culling — assets disappearing at zoom boundaries
- ❌ Squad bunny hopping — AI pathfinding needs surgery
- ❌ Hunter readability — player can't tell why they died
- ❌ Shooting feedback — insufficient recoil, muzzle flash, juice

### What's Missing (Future Phases)

- ⬜ Sky system (PixelSkyEngine port)
- ⬜ Day/night cycle
- ⬜ Weather system
- ⬜ Volumetric lighting
- ⬜ Bioluminescence
- ⬜ Roguelite meta-progression
- ⬜ Character unlock system
- ⬜ Multiplayer
- ⬜ Sound design
- ⬜ Biome variety
- ⬜ Underground cave layer

---

## SECTION 5 — GAME DESIGN DETAIL

![Trap Network](https://media.base44.com/images/public/6a07d557e104123d6d54764f/38f9de309_generated_image.png)

### The Core Loop

```
INSERTION → PREP PHASE → HUNT BEGINS → SURVIVE / ESCAPE → RESULTS → UNLOCK → REPEAT
```

**Insertion:** Cinematic helicopter drop. Squad rappels into the jungle. Sets tone, introduces world, establishes stakes.

**Prep Phase (3 minutes):** Gather wood, stone, rope. Build traps. Establish patrol routes. Choose positions. Every second matters.

**Hunt Phase:** Hunter activates. The clock resets. Survival becomes the only objective. Use traps, use terrain, use each other.

**Escape:** Get to the extraction point alive. Harder than it sounds.

**Results:** Score breakdown. Resources. Kills. Traps triggered. Time survived.

**Meta Unlock:** Permanent character upgrades, new trap types, weapon unlocks, new biomes.

### The Hunter

The Hunter is not balanced. That is intentional.

The Hunter is faster, can cloak, has thermal vision, can climb any surface, has a plasma cannon that one-shots. The Hunter is designed to be terrifying.

What the Hunter cannot do: see through mud camouflage. Detect motionless targets easily. Survive a well-placed trap chain. Predict emergent physics outcomes.

The jungle is the equalizer. Not the soldiers' guns — the jungle.

### Destruction as Gameplay

Every tree can fall. Every tree that falls changes the battlefield. A fallen tree is:
- A new platform
- A new barrier
- A new hazard
- A new resource

A terrain explosion creates:
- A crater (new defensive position)
- A fire (spreads, creates no-go zones)
- A debris field (cover)
- A terrain scar (permanent alteration)

The world is never the same after 10 minutes of play. This is the soul of the game.

### Trap System

Eight trap types across three tiers:

| Tier | Traps |
|---|---|
| Light | Punji Spikes, Tripwire |
| Medium | Falling Log, Rope Snare, Boulder Trap |
| Heavy | Tree Crusher, Explosive Trap, Claymore |

Traps chain. A tripwire triggers a falling log which crushes through a rope bridge which drops boulders. Engineering creative chains is a core skill expression.

---

## SECTION 6 — PHASE ROADMAP

![Roguelite Map](https://media.base44.com/images/public/6a07d557e104123d6d54764f/b5e68bde1_generated_image.png)

### Phase 1 — CORE FEEL STABILIZATION (Current)
*Make the game feel elite before expanding it*

- [x] Movement hardening (gravity, speed, jump, coyote, buffer)
- [ ] Tool state machine fix
- [ ] Shooting feel (recoil, muzzle flash, trails, shell eject)
- [ ] Destruction bug fixes (tree fracture, log platforms)
- [ ] Camera hardening (culling, insertion state machine)
- [ ] Squad AI (cover usage, pathfinding, no bunny hop)
- [ ] Hunter readability (cloak shimmer, plasma warning, telegraph)
- [ ] Performance audit (no god files, particle caps)

**Exit Criteria:** Every core mechanic passes the "feels incredible" test.

### Phase 2 — ATMOSPHERE UPGRADE
*Port the best visual systems from across the Driftgate ecosystem*

- [ ] PixelSkyEngine integration (day/night, volumetric clouds, god rays)
- [ ] VolumetricLightPass port (jungle god rays)
- [ ] DayNightPass integration
- [ ] BioluminescencePass (night atmosphere)
- [ ] WeatherManager port (rain, lightning, storm events)
- [ ] Fire system upgrade (more behavior, visual polish)
- [ ] Mud camouflage visual polish
- [ ] AudioBus integration + ambient sound design
- [ ] Music system (dynamic, state-responsive)

**Exit Criteria:** The world feels alive. Every screenshot is beautiful.

### Phase 3 — ROGUELITE SYSTEMS
*Build the loop that keeps players coming back*

- [ ] Run meta-progression architecture
- [ ] Character unlock system (6 base characters)
- [ ] Ability unlock tree per character
- [ ] Randomized world generation seeds
- [ ] Biome variety (jungle / ruins / caves / river delta)
- [ ] Underground cave layer (new vertical dimension)
- [ ] Difficulty tiers (Hunter skill scaling)
- [ ] Score + leaderboard system
- [ ] Death recap (how you died, replay)

**Exit Criteria:** Players lose and immediately want to run again.

### Phase 4 — MULTIPLAYER
*The game becomes social*

- [ ] 1-4 player co-op (online)
- [ ] Network architecture decision (WebSocket / P2P / rollback)
- [ ] Hunter AI scaling for player count
- [ ] Asymmetric mode: 1 player AS the Hunter (vs 3 soldiers)
- [ ] Drop-in/drop-out co-op
- [ ] Shared resource system
- [ ] Voice proximity chat (optional)

**Exit Criteria:** Co-op session is as good or better than solo.

### Phase 5 — CONTENT EXPANSION
*The world gets bigger*

- [ ] Biome 2: Ruins (ancient stone temples)
- [ ] Biome 3: Underground Caves
- [ ] Biome 4: River Delta (flood mechanics)
- [ ] Hunter variants (different hunter types, different abilities)
- [ ] Boss encounters (special scenario runs)
- [ ] Weapon tier 2 unlocks
- [ ] Advanced trap types
- [ ] Narrative mission layer (optional story campaign)

---

## SECTION 7 — MVP DEFINITION

![Multiplayer Co-op](https://media.base44.com/images/public/6a07d557e104123d6d54764f/6dbe7694e_generated_image.png)

The MVP is the smallest version of Last Hunt that is genuinely fun and demonstrably original.

### MVP Scope

**World:**
- Single biome (jungle)
- Procedurally generated (seeded)
- Full destructible tile terrain
- Day/night cycle
- Weather (rain + storm)

**Player:**
- 1 playable character (unlockable others post-MVP)
- Full movement system (walk, run, crouch, jump, double jump, climb)
- 4 weapons: Pistol, M16, Bow, Machete + Shovel
- Mud camouflage mechanic

**Squad:**
- 3 AI squadmates
- Cover usage, formation movement
- Revive mechanic

**Traps:**
- 5 trap types (Punji, Tripwire, Falling Log, Snare, Explosive)
- Resource harvest to build

**Hunter:**
- 1 Hunter type
- Cloak + thermal + plasma + melee
- Reads the terrain and responds to player actions

**Meta:**
- No meta-progression at MVP (single run to test loop)
- Score and death recap
- Seeded run sharing (share your run code)

**Multiplayer:**
- Not in MVP — single player only

**Platforms:**
- Browser (Base44 hosted)
- Downloadable build (Electron wrapper)

### MVP Success Criteria

> A stranger plays Last Hunt for the first time, survives 8 minutes, dies horribly, says "one more run," and genuinely doesn't know why they died until they think about it.

That's the bar. That's the MVP.

---

## SECTION 8 — DEMO BUILD

![Escape Sequence](https://media.base44.com/images/public/6a07d557e104123d6d54764f/db8b93f17_generated_image.png)

The demo is the sales tool. It is a curated, polished slice — not a vertical build.

### Demo Scope

**One handcrafted level:** Carefully designed jungle map. Not procedural. Perfectly paced.

**Duration:** 15-25 minutes per run.

**Content:**
- Full insertion cinematic
- Prep phase (3 minutes)
- Hunt phase (escalating tension)
- One scripted Hunter "reveal" moment (the cloak drops for 2 seconds — pure terror)
- Escape sequence (timed, helicopter extraction)
- One unlockable character teased (locked but visible)

**Visual quality:** Phase 2 atmosphere systems active. The demo is beautiful.

**Feel:** Every mechanic passed Phase 1 stabilization. The demo feels elite.

### Demo Distribution Strategy

- Itch.io (free, builds community)
- Steam Next Fest (timed, maximum visibility)
- Press / influencer builds (Markiplier tier content)
- GDC showcase consideration

---

## SECTION 9 — MULTIPLAYER ARCHITECTURE CONSIDERATIONS

![Squad AI Tactics](https://media.base44.com/images/public/6a07d557e104123d6d54764f/b0d4f4b0d_generated_image.png)

Multiplayer is Phase 4 but the architecture decisions need to be made now.

### Recommended Approach: Authoritative Server + Client Prediction

Given the physics-heavy destructible world, a peer-to-peer model will struggle with terrain sync. Recommended:

- **Server:** Lightweight Node.js authority (terrain state, entity positions)
- **Client:** Client-side prediction for local player (no input lag feel)
- **Sync:** Event-based terrain destruction (tile changes broadcast as events, not state diffs)
- **Rollback:** Input rollback for player vs player collision resolution

### Asymmetric Mode: Hunter vs Soldiers

One player controls the Hunter. Three players are soldiers. This is the endgame mode — the social experience that makes Last Hunt a streaming phenomenon.

The Hunter player sees the thermal view. The soldiers see normal view. They communicate on different information. Emergent drama guaranteed.

### Network Foundation

Before multiplayer work begins, the engine needs:
1. Entity position serialization (not currently structured for this)
2. Terrain state serialization (tile array delta compression)
3. EventBus network bridge (current eventBus is local-only, needs network layer)

This is 2-3 months of engineering work. Do not start until Phase 1-3 are solid.

---

## SECTION 10 — SKY & ATMOSPHERE PORT PLAN

![Sky System](https://media.base44.com/images/public/6a07d557e104123d6d54764f/278e304f3_generated_image.png)

The PixelSkyEngine from Follow The White Rabbit is the best sky system in the Driftgate codebase. It needs to be ported into Last Hunt as Phase 2 priority #1.

### PixelSkyEngine Features (FTWR)
- 4-phase day/night cycle (dawn, day, dusk, night)
- Palette interpolation per phase (horizon, zenith, sun, glow, ray, cloud, haze)
- Multi-layer cloud system (3 layers: cirrus, cumulus, storm)
- Pixel-grid snapping (aesthetic consistency)
- Star field with rotation + shooting stars
- Storm intensity system with lightning bolts
- God rays / light shaft rendering

### Integration Plan

1. Extract `PixelSkyEngine.jsx` and `SkySystem.js` from FTWR
2. Create `src/lib/game/atmosphere/skySystem.js` in Last Hunt
3. Connect to existing `atmosphere.js` and `atmosphere.config.js`
4. Drive sky time from game clock (prep phase = dusk, hunt phase = night)
5. Connect weather events to sky state (storm on Hunter spawn?)
6. Port VolumetricLightPass as Canvas2D equivalent for god rays

### The Emotional Design Intent

Prep phase is dusk — golden, warm, deceptively safe.
Hunt phase begins at full dark — the sky shifts as the Hunter activates.
Bioluminescence activates at night — beautiful but eerie.
Storm events escalate at peak tension moments.

The sky tells the player how they should feel. Always.

---

## SECTION 11 — MONETIZATION STRATEGY

![Ancient Ruins](https://media.base44.com/images/public/6a07d557e104123d6d54764f/a2bf8f84d_generated_image.png)

Last Hunt is a premium game. Not free-to-play. Not battle-pass. Not live-service.

### Pricing Model

**Base Game:** $19.99 USD
**Deluxe Edition:** $29.99 USD (base + OST + art book + exclusive character skin)

### DLC Strategy (Post-Launch)

- **Biome Pack 1:** New biome (Underground Caves) + 2 new Hunter types — $7.99
- **Biome Pack 2:** River Delta biome + flood mechanics — $7.99
- **Character Pack:** 3 new playable characters with unique abilities — $5.99
- **Narrative Campaign:** Optional story layer, 8 missions — $9.99

### What We Will Never Do

- No loot boxes
- No pay-to-win
- No battle pass
- No NFTs
- No predatory mobile port

This is a game made by people who love games, sold to people who love games.

---

## SECTION 12 — COMPETITIVE LANDSCAPE

![Weather Storm](https://media.base44.com/images/public/6a07d557e104123d6d54764f/043430962_generated_image.png)

### Closest Comparisons

| Game | What We Share | Where We Differ |
|---|---|---|
| **Broforce** | 2D side-scroller, destruction, co-op chaos | We are darker, more systemic, one persistent enemy |
| **Dead Cells** | Tight movement, roguelite loop, feel-first design | We have sandbox world, co-op, asymmetric threat |
| **Terraria** | Destructible tile world, sandbox exploration | We are combat-focused, narrative-framed, not survival builder |
| **Noita** | Physics sandbox, emergent destruction | We are more accessible, co-op, character-driven |
| **Huntdown** | Pixel art action, tight feel | We have persistence, world destruction, multiplayer |
| **Hunt: Showdown** | Asymmetric hunter/hunted tension | We are 2D, destructible, roguelite, more accessible |

### The White Space

There is no 2D side-scrolling asymmetric destruction sandbox roguelite with co-op. That sentence describes Last Hunt: Killbox. The white space is real.

---

## SECTION 13 — TECHNICAL ARCHITECTURE SUMMARY

![Underground Caves](https://media.base44.com/images/public/6a07d557e104123d6d54764f/c8815741c_generated_image.png)

### Current Stack

- **Runtime:** Browser (Canvas2D) — Vite + React shell
- **World:** Tile-based 2D array (dynamic, fully destructible)
- **Physics:** Custom tile-collision physics (moveEntity, checkCollision, applyGravity)
- **Rendering:** Single canvas, manual draw order
- **Config:** Fully separated config files per system
- **Events:** EventBus (local pub/sub)
- **State:** Mutable game state object passed through update functions

### Recommended Upgrades (Phase 2+)

- **Rendering:** Move to pass-based render pipeline (port DC2 RenderPipeline architecture)
- **Sky:** PixelSkyEngine integration (FTWR port)
- **Audio:** AudioBus integration (DC2 port)
- **State:** Consider lightweight state machine library for Hunter and Squad AI
- **Performance:** OffscreenCanvas for terrain rendering (main thread relief)

### What NOT to Change

- The tile physics system — it is correct and working
- The config file architecture — this is the studio's best practice
- The EventBus — local pub/sub is perfect for a single-player canvas game
- The modular file structure — do not consolidate into giant files

---

## SECTION 14 — STUDIO RESOURCING

### Current Resources (Estimated)

- **VULCAN (AI):** Architecture, game design, code review, system design, documentation
- **Aragorn (AI):** Engineering execution, bug fixes, feature implementation
- **Andrew McGrath:** Creative direction, concept, vision, final approval

### What's Needed for Phase 3+

- **Sound designer:** Foley, ambient, dynamic music system
- **Pixel artist:** Character animation sheets, environment tiles, particle VFX
- **QA:** Once multiplayer begins — systematic playtesting
- **Community manager:** Steam page, Discord, launch coordination

---

## SECTION 15 — SUCCESS METRICS

![Dawn Victory](https://media.base44.com/images/public/6a07d557e104123d6d54764f/e83aac51a_generated_image.png)

### Phase 1 Exit Metrics
- Movement feels like Dead Cells (internal test: 10 people, 8 say "this feels great")
- Zero tool state overlap bugs
- Hunter is readable (player knows why they died 80%+ of the time)
- 60fps stable on mid-range hardware

### Demo Success Metrics
- Average session length: 20+ minutes
- Return rate: 60%+ play a second run
- Wishlist conversion: 40%+ of demo players wishlist on Steam
- Streamer pickup: At least 3 streamers over 50k subs play organically

### Launch Success Metrics
- 10,000 units in first 30 days
- 80%+ positive Steam reviews
- Active Discord community (2,000+ members)
- At least one viral "emergent gameplay" video (trap chain, impossible escape, etc.)

---

## APPENDIX A — ARTWORK REFERENCE

The following artworks represent the visual identity of Last Hunt: Killbox.

### World & Atmosphere
![Sky System](https://media.base44.com/images/public/6a07d557e104123d6d54764f/278e304f3_generated_image.png)
*Day/Night Sky System — The world breathes*

![Bioluminescent River](https://media.base44.com/images/public/6a07d557e104123d6d54764f/50321de44_generated_image.png)
*Bioluminescent River — Night atmosphere*

![Weather Storm](https://media.base44.com/images/public/6a07d557e104123d6d54764f/043430962_generated_image.png)
*Storm System — Nature as a weapon*

![Ancient Ruins](https://media.base44.com/images/public/6a07d557e104123d6d54764f/a2bf8f84d_generated_image.png)
*Ancient Ruins Biome — Future content*

![Underground Caves](https://media.base44.com/images/public/6a07d557e104123d6d54764f/c8815741c_generated_image.png)
*Underground Cave System — Phase 5 biome*

### Characters & Combat
![Character Select](https://media.base44.com/images/public/6a07d557e104123d6d54764f/53079353f_generated_image.png)
*Character Selection — Six unique operators*

![Hunter Alien](https://media.base44.com/images/public/6a07d557e104123d6d54764f/386f69f27_generated_image.png)
*The Hunter — Apex predator*

![M60 Combat](https://media.base44.com/images/public/6a07d557e104123d6d54764f/ea71477d8_generated_image.png)
*Combat Feel — Every weapon distinct*

![Plasma Attack](https://media.base44.com/images/public/6a07d557e104123d6d54764f/9f5bdc395_generated_image.png)
*Plasma Cannon — Unavoidable terror*

![Thermal Vision](https://media.base44.com/images/public/6a07d557e104123d6d54764f/bc0f368c2_generated_image.png)
*Thermal Vision — Hunter's perspective*

### Systems & Gameplay
![Trap Network](https://media.base44.com/images/public/6a07d557e104123d6d54764f/38f9de309_generated_image.png)
*Trap Engineering — Player creativity as defence*

![Tree Destruction](https://media.base44.com/images/public/6a07d557e104123d6d54764f/2efd5a819_generated_image.png)
*Destruction System — Trees are weapons*

![Explosion](https://media.base44.com/images/public/6a07d557e104123d6d54764f/ffd01c427_generated_image.png)
*Terrain Destruction — Permanent world alteration*

![Mud Stealth](https://media.base44.com/images/public/6a07d557e104123d6d54764f/99802af95_generated_image.png)
*Mud Camouflage — Suppressed heat signature*

![World Generation](https://media.base44.com/images/public/6a07d557e104123d6d54764f/2a79b14cd_generated_image.png)
*World Generation — Every run different*

### Multiplayer & Social
![Co-op](https://media.base44.com/images/public/6a07d557e104123d6d54764f/6dbe7694e_generated_image.png)
*Co-op Mode — 1-4 players*

![Squad AI](https://media.base44.com/images/public/6a07d557e104123d6d54764f/b0d4f4b0d_generated_image.png)
*Squad AI — Feels human*

### Cinematic Moments
![Insertion](https://media.base44.com/images/public/6a07d557e104123d6d54764f/d3b295272_generated_image.png)
*Helicopter Insertion — Every session begins here*

![Escape](https://media.base44.com/images/public/6a07d557e104123d6d54764f/db8b93f17_generated_image.png)
*Extraction Sequence — Earned survival*

![Victory](https://media.base44.com/images/public/6a07d557e104123d6d54764f/e83aac51a_generated_image.png)
*Victory — The rarest feeling in the game*

### Identity
![Logo](https://media.base44.com/images/public/6a07d557e104123d6d54764f/ac2cb4bf3_generated_image.png)
*LAST HUNT: KILLBOX — The brand*

![Cover](https://media.base44.com/images/public/6a07d557e104123d6d54764f/2ec7b4eec_generated_image.png)
*Cover Art — The promise*

---

## CLOSING STATEMENT

Last Hunt: Killbox is not a prototype. It is not a proof of concept. It is not a jam game.

It is the first game in a possible franchise. It is the game that establishes Driftgate Studios as a serious developer capable of building original, systemic, beautiful experiences that people remember.

The foundation is strong. The idea is original. The execution is what wins.

We build weird things. We make them incredible.

---

*Document prepared by VULCAN — President, Side Scroller Division — Driftgate Studios*
*Classification: INTERNAL CONFIDENTIAL*
*Version: 1.0 | May 2026*

