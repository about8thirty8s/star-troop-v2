# STAR TROOP — FORENSIC AUDIT & CONTROLLED REBUILD MAP

**Date:** 2026-08-08  
**Owner:** Andrew McGrath  
**Primary agent:** VULCAN  
**Decision:** Controlled rebuild authorized. Existing implementation is salvage material, not protected architecture.

## Identity Correction

Star Troop is a true 2D side-on colony-defense action/strategy game. It is not Last Hunt: Killbox and must contain no Predator/Hunter, cloak, thermal vision, bow, machete, shovel, or Killbox combat-balance doctrine.

North star: Kingdom: New Lands clarity and pacing combined with an original brutal interstellar infantry bug siege.

## Audit Evidence

### Repository

- Public editor repository size: approximately 1.5 GB after shallow clone.
- 1,879 tracked files.
- 1,589 PNG files, 30 HTML files, 15 ZIP archives.
- Multiple embedded editor variants around 32 MB each.
- `incoming_files/` is tracked and contains approximately 597 MB of source deliveries, archives, video, audio and duplicate art.
- Shallow `.git` pack is approximately 607 MB, indicating severe historical binary churn.
- Active slim editor is a 5,066-line monolithic HTML file.
- Repository contains unrelated Killbox documents and functions.

### Live Base44 App

- Published screenshot has strong atmosphere but poor hierarchy and game identity.
- Trooper silhouette does not read as disciplined mobile infantry.
- Controls and launch options are low-contrast and overlap the scene.
- Menu presentation is visually stronger than the demonstrated game loop.
- Main playable state and public level editor are separate implementations with no reliable single source of truth.

### Public Level Editor

Useful systems:
- Three live parallax slots.
- Day/night celestial cycle.
- Weather and sand particles.
- Terrain paint, fill, import/export.
- Structure placement.
- Demo battle AI.
- Floating ENV panel.
- Camera zoom/pan.

Critical defects:
- 5,066-line god file fuses UI, assets, weather, terrain, AI, structures, combat and rendering.
- Duplicate procedural and painted rendering paths create inconsistent visual quality.
- More than 300 tile assets are referenced from a generic numbered registry.
- Troopers and bugs disappear into high-detail vegetation.
- Current Warrior and Hopper art lacks a coherent caste language.
- No complete Tanker/Plasma/Brain caste pipeline.
- Terrain reads as repetitive brick strata rather than alien geology.
- Searchlights and aerial background craft are not consistently anchored to world entities.
- Editor panels consume too much gameplay viewport width.
- Empty startup canvas looks broken until auto-fill/demo is triggered.

## Salvage Map

### Preserve and Extract

- Fixed timestep / frame timing.
- Camera transform and zoom clamps.
- Three-layer parallax math.
- Day/night timing and celestial transitions.
- Lightweight weather particle concepts.
- Export/import data shape where valid.
- Trooper target acquisition and basic bug pursuit logic.
- Unit cache invalidation and particle/glow pooling patterns.
- ENV ADMIN live tuning concept.

### Replace or Quarantine

- All Killbox/Predator documentation and active references.
- Monolithic HTML as long-term architecture.
- Generic numbered asset registry without semantic names.
- Mixed procedural boxes and detailed PNG rendering in the same production path.
- Existing trooper visual identity.
- Existing two-frame/generic bug caste visuals.
- Repetitive brick terrain family.
- Unanchored searchlights.
- Editor-first launch flow.
- Duplicate archives, videos, incoming deliveries and obsolete HTML variants in production source.

## New Art Constitution

### Troopers

Original expeditionary infantry family:
- Enclosed angular helmets.
- Narrow cyan visor.
- Large readable shoulder armor.
- Chest harness and compact backpack.
- Long original service rifle with stable muzzle anchor.
- Dark olive/gunmetal palette with restrained amber highlights.
- Shared proportions and animation anchors across player and AI.

### Alien Castes

- Runner/Drone: low, fast, six thin legs, pointed mandibles.
- Warrior: low/wide armored shock caste, blade forelimbs, charcoal/bone chitin.
- Hopper: unmistakable wings and mantis legs.
- Tanker: huge domed siege beetle, furnace-orange vents.
- Acid/blood green is a semantic accent, not decorative saturation.

Every unit must pass the one-second black-silhouette test.

### World

- Strict flat side-on camera.
- No isometric walls or receding ground-plane lines.
- Three parallax layers: far mesas, mid dead forest/ruins, near military silhouettes.
- Burnt-orange day; purple-black/deep-navy night.
- Dark military-industrial structures with warm practical lights.
- Foreground atmosphere never obscures combat.

## Controlled Rebuild Sequence

1. **Pass 1 — Outpost Alpha vertical slice**
   - Playable game is main route.
   - Central Command Hub, two barricades, one sentry tower.
   - Player + two AI troopers.
   - Runner, Warrior, Hopper, Tanker.
   - Day/build -> dusk warning -> night defense -> dawn or defeat.

2. **Pass 2 — Rendering and asset pipeline**
   - Semantic asset registry.
   - Unified production render path.
   - Sprite anchors and animation state contracts.
   - Searchlights attached to tower entities.

3. **Pass 3 — Editor migration**
   - Modular editor consumes the same world schema and asset registry as the game.
   - Remove duplicate simulation/render logic.
   - Retain ENV ADMIN and import/export.

4. **Pass 4 — Repository purge**
   - Move source deliveries out of tracked production repository.
   - Remove obsolete embedded HTML builds and archives.
   - Rewrite history only after a verified backup and Andrew approval.

## Hard Gates

- Main preview boots directly into a playable game.
- No active Killbox/Hunter contamination.
- One complete day/night result loop.
- Troopers and four alien castes are visually distinct.
- Stable side-on camera and consistent world scale.
- No console errors or duplicate animation loops.
- Capped particles/projectiles/entities.
- Editor and game converge on one schema before new content expansion.

## Reference Art Decision

Generated concept references are approved only for trooper armor, enemy caste silhouette and palette language. The generated fortification perspective is rejected because it drifts into 3/4 diorama geometry. Camera and structure perspective must be enforced by code and orthographic side elevations.

## Pass 2 Live Validation — 2026-08-08 17:47 AEST

### Accepted

- Direct playable launch remains intact.
- Trooper silhouettes and internal armor definition are materially improved.
- Hub, barricades and floodlight tower now share a coherent military-industrial family.
- Terrain has visible crust/mid/deep geology.
- Defeat state triggers correctly after the automated night assault.
- HUD state updates correctly: wave, power, trooper count, HP and score.

### Rejected / Correction Required

1. **Duplicate giant planets:** two nearly identical large spheres appear simultaneously in the day scene. This reads as duplicated layer content rather than intentional astronomy. Retain one dominant planet; any secondary moon must differ strongly in scale, position and phase visibility.
2. **Incorrect night/defeat palette:** the observed defeat frame uses a saturated teal/cyan sky instead of the locked purple-black/deep-navy night constitution. Replace teal with controlled navy/purple values and preserve warm base lighting.
3. **Hard parallax seams:** far mountain silhouettes terminate in obvious rectangular horizontal edges across the viewport. Layer canvases must extend below the terrain horizon or clip behind the gameplay ground without visible rectangles.
4. **Destroyed structures vanish completely:** the Command Hub, walls and tower disappear at defeat, leaving an empty baseline. Destroyed structures must persist as side-on wreck/rubble states with embers/smoke, preserving battle history and clarifying why the player lost.

### Additional Tuning

- HUD typography remains small at embedded preview scale and needs another legibility pass.
- The world remains overly orange-monochrome during day; introduce restrained gunmetal/cool shadow separation without violating the palette.
- Ensure Tanker and other surviving aliens remain readable against the defeat palette.

**Pass 2 verdict:** Architecture passes. Graphical overhaul is materially improved but not accepted as final until the four correction items above are verified live.
