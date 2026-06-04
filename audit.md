# SKATEBALL — FULL AUDIT FINDINGS
## Date: 2026-06-04

---

## 🔴 CRITICAL BUGS

### 1. AI shot fires on keydown event (wrong loop)
P2 AI shot is inside `handleKey` (keydown listener) not the game loop.
Result: P2 only shoots when the human presses a key. If P1 does nothing, P2 never shoots.
**Fix:** Move P2 shot logic into the main game loop tick.

### 2. P2 AI never jumps onto ramp
AI jump logic: `Math.random() < 0.003` per frame = ~0.18/s at 60fps.
On ramp P2 just runs into the wall because no ramp-jump logic exists for AI.
**Fix:** AI should jump when approaching ramp base (x < 200 or x > 760) moving toward wall.

### 3. Ball reset gives ball to scorer (should give to OTHER team)
`newBall.ownerId = scoringPlayer === 1 ? 2 : 1` — this IS correct actually.
But the ball spawns AT THE SCORER's position, not at center court.
If scorer is near ramp, ball spawns on ramp where P2 can't reach it.
**Fix:** Ball always resets to center court (x=480, y=GROUND_Y-38).

### 4. P2 shot uses `Math.random() < 0.006` per keydown — not per frame
Same issue as #1. P2 shots are extremely rare and tied to P1 input.
**Fix:** Move to game loop with proper shot timer (AI shoots every 4-8s when near hoop).

### 5. Grind triggers GRIND! popup even when not grinding (K pressed anywhere)
`addPopup('GRIND!', ...)` is outside the `if (p1.grinding)` check.
So pressing K while flat shows GRIND! with no actual grind.
**Fix:** Move popup inside the `if (p1.grinding)` block.

### 6. Dunk eligibility check uses `HOOPS.right` hardcoded
If P1 is on the left side of court, dunk still targets right hoop.
Dunk should target nearest hoop that P1 is eligible to score in.
Actually P1 always scores in right hoop, so this is fine — but the proximity check
in `checkDunkEligibility` may use wrong distance. **Audit.**

### 7. Ball spin accumulates without bounds
`ball.spin` is updated but never reset. After long matches it becomes a huge number.
`rotate(${spin})` still works visually (CSS wraps), but it's a memory/state leak.
**Fix:** Clamp spin to 0-360.

### 8. `triggerCelebration` called twice on valid score
L1073 calls it for non-dunk shots. L1049 calls it for dunks. BOTH paths then reach L1073.
Non-dunk: `triggerCelebration` fires once (fine).
Dunk: L1049 fires it, then falls through to L1073 and fires AGAIN.
**Fix:** The dunk branch already handles celebration. Wrap L1073 in `if (!isDunkScore)`.

### 9. ShotMeter not shown during charge
`setShowShotMeter(true)` fires but ShotMeter render may be below arena z-index.
Check z-index layering in the HUD.

### 10. Timer keeps running after matchOver
`matchRef.current.matchOver` stops the game loop from processing input,
but `updateTimer` is called regardless — timer continues after match ends.
**Fix:** Gate `updateTimer` behind `!match.matchOver`.

---

## 🟡 GAMEPLAY ISSUES

### 11. P2 AI only patrols center — never uses ramps
AI targetX oscillates `600 + Math.sin(t/1400)*100` — never goes past x=700.
Ramps start at x=790. AI never reaches ramp.
**Fix:** Occasionally send AI to ramp (random patrol point including ramp zones).

### 12. Combo multiplier never displayed live in HUD
`p1Combo` in HudScoreboard receives `Math.round(comboData.multiplier)` but the
combo only activates when `comboData.active === true`. When no tricks, multiplier = 1.
**Fix:** Show combo as active chain length, not multiplier value.

### 13. No steal mechanic — P1 can never take ball from P2
Ball transfer only happens when P2 misses a shot and ball becomes LOOSE.
P1 has no steal button. Against AI this means P2 holds ball forever if AI doesn't shoot.
**Fix:** Add steal on `f` key — close proximity (within 40px) + small chance based on balance stat.

### 14. Jump buffer missing
If player presses Space just before landing, jump is ignored.
**Fix:** 8-frame jump buffer (standard platformer).

### 15. Shot charge releases on key-up correctly, but arc preview stays visible
When shot fires, `setArcPreview(null)` should clear it. Check if timing causes flicker.

### 16. Police car hit zone is center-of-court (±80px) — too small, too specific
Players almost never grind over the police car because it's in the dead center.
**Fix:** Widen hit zone to ±160px, reduce damage to 3 per grind (more hits = more satisfying destruction).

### 17. Hype multiplier not applied visually to score popup
`hypeMult` is calculated but the popup only shows `+X`. If hype gives 2x, player doesn't see it.
**Fix:** Show `HYPE x2! +X` in popup when hypeMult > 1.

---

## 🟢 FEEL / POLISH IMPROVEMENTS

### 18. Landing feels dead — no squash/stretch
When player lands from a big jump, no visual feedback.
**Fix:** CSS `scaleY(0.85)` for 80ms on land, then spring back. Already have `transition`.

### 19. Ramp speed boost makes AI get stuck in corner
If AI ever reaches ramp, ramp physics accelerates it into the wall at full speed.
**Fix:** AI should jump when within 60px of either wall.

### 20. No ball wobble when loose on ground
Loose ball just sits. Should still have a tiny vertical bounce (it's a basketball).
**Fix:** Small damped oscillation in ball.y when LOOSE on floor.

### 21. Commentary fires too infrequently
Lines are called but debounce may be killing them. Check commentary system.

### 22. No visual for ball possession transfer
Ball teleports to new owner's hand with no animation.
**Fix:** Ball lerps to hand position over 3 frames instead of instant snap.

### 23. Debug mode overlay partially overlaps game view
Move debug overlay to a corner with higher z-index.

---

## PRIORITY ORDER
1. Fix AI shot loop (critical — AI is mostly broken)
2. Fix double celebration call (critical — fires confetti twice)
3. Fix grind popup outside check
4. Fix timer after matchOver
5. Ball reset to center court
6. Add steal mechanic (F key)
7. Jump buffer
8. AI ramp avoidance + patrol variety
9. Hype multiplier in popup
10. Landing squash
