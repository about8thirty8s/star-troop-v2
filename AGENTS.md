# STAR TROOP — PROJECT BRAIN

## Identity

**Star Troop** is a true 2D side-on colony-defense action/strategy game by Driftgate Studios.

North star:

> Kingdom: New Lands clarity and pacing combined with an original brutal interstellar infantry bug siege.

Star Troop is **not** Last Hunt: Killbox. Killbox/Predator/Hunter systems, weapons, balance tables and visual doctrine are unrelated and non-authoritative here.

## Authority

- **Andrew McGrath:** Founder and sole creative authority.
- **VULCAN:** Star Troop systems, gameplay feel, rendering and side-scroller architecture.
- **Aragorn:** Studio operations and coordination.

## Current Rebuild Decision

Andrew authorized a controlled rebuild on 2026-08-08. Existing code and assets are salvage material, not protected architecture.

The first playable target is **Outpost Alpha**:

- Central Command Hub.
- Left/right Steel Barricades.
- Floodlight Sentry Tower.
- Player squad leader plus two AI troopers.
- Runner, Warrior, Hopper and Tanker alien castes.
- Complete day/build → dusk warning → night defense → dawn victory or defeat loop.

## Non-Negotiable Visual Rules

- Strict flat 2D side-on camera.
- No isometric, 3/4 or receding ground-plane perspective.
- Three parallax layers only: far, mid and near.
- True-alpha RGBA assets.
- Dark military-industrial structures with warm practical lighting.
- Burnt-orange alien frontier by day; purple-black/deep-navy siege palette at night.
- Atmospheric objects use lightweight canvas drawing and never obscure combat.
- Environmental bioluminescence maps 1:1 to world-space coordinates.
- Floating ENV ADMIN panel remains available for real-time tuning.

## Trooper Constitution

Troopers are an original armored expeditionary infantry family:

- Enclosed angular helmet.
- Narrow cyan visor.
- Large readable shoulder armor.
- Chest harness and compact backpack.
- Long original service rifle with stable muzzle anchor.
- Dark olive/gunmetal palette with restrained amber highlights.

Do not copy costumes, logos or exact weapons from existing film properties. Capture disciplined heavy-infantry readability through original designs.

## Alien Caste Constitution

- **Runner/Drone:** low, fast, six thin legs, pointed mandibles.
- **Warrior:** low/wide armored shock caste, blade forelimbs, charcoal/bone chitin.
- **Hopper:** unmistakable wings and mantis legs.
- **Tanker:** huge domed siege beetle, furnace-orange vents.

Acid/blood green is a semantic gameplay accent. Every caste must pass the one-second black-silhouette test.

## Architecture Rules

- Fixed-timestep simulation.
- Explicit game-state machine.
- Focused modules; no new god files.
- Semantic asset names; no anonymous production registries.
- One production rendering path per asset type.
- Shared world schema between game and editor.
- Hard caps and pooling for particles, projectiles and active units.
- Versioned save migration/default handling.
- Context-first interaction resolution.

## UI Constitution

Normal gameplay shows only:

- Top: `DAY/TIME | WAVE | ORE | POWER | TROOPERS`
- Bottom: `HEALTH | AMMO | GRENADES`

Debug and editor controls remain hidden unless explicitly opened.

## Repository Status

The repository currently contains multiple historical HTML builds, archived deliveries, duplicate binaries and unrelated project documents. Do not treat their presence as approval or active scope.

Authoritative rebuild record:

- `STAR_TROOP_REBUILD_AUDIT_2026-08-08.md`
- `STAR_TROOP_VISUAL_CONSTITUTION.md`
- This `AGENTS.md`

Do not delete `.codex-comms.json` or `.{project}-lock` files.

## Studio Workflow

1. Check global comms.
2. Lock Star Troop before any push.
3. Do bounded work against the current acceptance gate.
4. Unlock and log the completed work across all required channels.

Do not push if another agent holds the lock.
