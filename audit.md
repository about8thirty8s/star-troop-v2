# STAR TROOP — DEEP AUDIT

## CRITICAL (crashes / breaks gameplay)
C1. FXSystem.spawnBugDeath missing — every bug kill throws runtime error
C2. drawPlayer gun never rotates with aimAngle — visual disconnect
C3. SquadFormation gets lastTime (performance.now ms) not game time — drift math broken
C4. Lifepod spawns MI at GROUND_Y-12, unit floats briefly
C5. Formation sets unit.x directly while physics sets x += vx — ownership conflict
C6. Win condition edge case — may never fire cleanly after wave 5

## SERIOUS (bad feel / broken mechanics)  
S1. Camera look-ahead 160px lurch on direction change
S2. Friendly projectiles never hit buildings
S3. (same as C2) Gun horizontal while cursor is angled
S4. MI bullet life 600ms too long — bullets fly 6000px off world
S5. No direction sense for off-screen threats
S7. Flashlight hardcoded radius, doesn't follow aimAngle
S8. playerStopTimer double-updated by Formation + Idle

## MINOR (polish)
M1. Grenade aimed down hits ground immediately
M2. Dead bug splice timing vs fade timing off by a frame
M4. Bug spawn margin 200px too close — pop-in visible
M5. No feedback when can't afford building
M6. Infantry has no HP indicator — silent deaths
