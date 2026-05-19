# STAR TROOP — ROUND 2 DEEP AUDIT

## CRITICAL BUGS

### C1. DebugOverlay import — file doesn't exist
GameEngine imports `from './systems/DebugOverlay'` but no such file is in the repo.
This is a hard runtime crash on load — the entire game is broken.

### C2. Player.update uses dt step normalization but handleInput doesn't
update() does `this.x += this.vx * step` where step = dt/16.667.
But handleInput() sets `this.vx = moveX * PLAYER.SPEED` raw every frame.
At 60fps (dt≈16.667) step≈1 → fine. At 30fps (dt≈33) step≈2 → player moves 2x speed.
Inconsistent frame-rate behavior. Should use vx consistently.

### C3. getWorldMouseX() offset is wrong
`return this.mouseX + this.camera.x - CANVAS_WIDTH / 2`
camera.x IS the world-space center of screen. mouseX is screen-space (0..960).
Correct: `return this.camera.x - CANVAS_WIDTH/2 + this.mouseX`
That's the same thing — actually correct. BUT mouseY is raw screen Y which
equals world Y only because the world has no vertical camera offset. Fine for now.

### C4. Bug spawn: `new WarriorBug(spawnX)` — WaveManager calls this but
WarriorBug constructor only takes `x`. The spawn sets bug.y = GROUND_Y correctly.
But spawnX can be negative or > WORLD_WIDTH (clamp is applied after). 
The clamp `Math.max(50, Math.min(WORLD_WIDTH - 50, spawnX))` IS applied — ok.
Actually fine. Not a bug.

### C5. SquadFormation.reformFormation — sets state='follow' but slotIndex may be stale
When dawn hits, units are dispersed (state='hold', defenseX set).
reformFormation sets state back to 'follow'. But slotIndex was assigned during
initial rescue and never cleared. If units died overnight, remaining units keep
their old slot indices — gaps form in the formation and never fill.
Should call assignSlot() to repack slots on reform.

### C6. Infantry removed from array while iterating in engine update
`for (let i = infantry.length-1; i>=0; i--)` then `infantry.splice(i,1)` — 
reverse iteration is correct for splice. This is fine actually.

### C7. Player._fire muzzle position uses this.height * 0.55 but shoulder
is at -16px from feet in drawPlayer. Player.height = 32 (check constants).
0.55 * 32 = 17.6 ≈ 18px from ground. drawPlayer shoulder is at y - 16 - bob.
Close but not exact — on bob frame the muzzle can be 1px off. Negligible.

## SERIOUS ISSUES

### S1. SquadIdle references IDLE_STATES constants that may not be exported
SquadIdle uses `IDLE_STATES.ALERT` etc internally. If these are local consts
only, that's fine. But the system also reads `unit.idleState` which is set
in MobileInfantry constructor as a plain string 'idle_alert'. String mismatch
risk if IDLE_STATES object keys don't match. Need to verify.

### S2. AISystem infantry 'engage' state is set nowhere — it's checked but never assigned
updateInfantry has `case 'engage':` which reverts state. But nothing in the codebase
sets mi.state = 'engage'. It's dead code. The state machine has a phantom state.

### S3. CombatSystem projectile trail renders even when trail array is empty
`ctx.beginPath()` then loops over empty trail → calls stroke() on empty path.
Minor perf waste every frame for every projectile. Should guard with trail.length > 1.

### S4. Particle system: text particles get vy but no decay — rise forever at constant speed
`p.y += p.vy` with vy=-0.8, no friction. Text rises at constant velocity.
Should add vy *= 0.96 or similar easing so it slows and fades naturally.

### S5. Buildings: no visual damage states — they look identical at 1hp vs full hp
drawBuilding doesn't check b.hp ratio. A building at 5% hp looks brand new.
Should show cracks/damage overlay scaling with damage.

### S6. Night overlay _drawNightOverlay — flashlight cone doesn't follow aimAngle
The cone is drawn as a radial gradient centered on the player — a full circle,
not a directed cone. When aiming, the light doesn't shift toward the aim direction.
Missed opportunity for atmosphere AND gameplay readability.

### S7. WaveManager: bugs always spawn left OR right, never both simultaneously
`const side = Math.random() > 0.5 ? 1 : -1` — one side per spawn tick.
On later waves (5+) with fast spawn intervals, you still only get one-sided pressure.
Should allow two-sided spawns on wave 3+.

### S8. DayNightSystem.getTimeRemaining() — need to check implementation
Called in HUD but behavior unknown without seeing full source.

### S9. Renderer._drawNightOverlay creates radialGradient every frame
Performance waste. Should cache or only recreate when darkness changes significantly.

## MINOR / POLISH

### M1. Score never displays anywhere meaningful except game-over screen
HUD shows score in top bar but it's tiny. No satisfying score pop on kill.
Bug kill adds WARRIOR_BUG.SCORE — should show floating +score above the kill.

### M2. Grenade has no visual fuse timer on the grenade itself
The fuse spark only appears when life < 600ms. Should be visible from throw.
Player has no idea when it'll blow.

### M3. Player invulnerability timer 300ms is very short — feels unfair
300ms at 60fps = 18 frames of invuln after a hit. Bugs attack every ATTACK_RATE ms.
If ATTACK_RATE < 300ms, player can get chain-stunned. Should be 500ms minimum.

### M4. drawBuilding — buildings have no ground shadow/anchor
They float slightly above ground visually. A 2px dark shadow line underneath
would ground them significantly.

### M5. Crosshair disappears behind the pause/win/lose overlay
Crosshair is drawn before pause screen. During pause, crosshair is hidden under
the overlay. This is actually correct behavior — crosshair shouldn't show during pause.
Not a bug.

### M6. No audio at all — missed opportunity
The game is silent. Even procedural beep-boop SFX would dramatically improve feel.
Out of scope for this pass but worth noting.

### M7. SquadFormation slot dx values are always negative (behind player when facing right)
When player faces LEFT, `slot.dx * facing` flips to positive = slots appear in FRONT.
The formation correctly trails behind but the math means facing-left units bunch
in a different spatial pattern than facing-right. Acceptable but asymmetric.
