# SKATEBALL AUDIT ROUND 2
## Date: 2026-06-04

## 🔴 CRITICAL — still broken from last session

### AI-1: New P2 AI never landed — old code still live
L937-974 is the OLD AI block. The new patrol timer / shot timer / ramp jump logic 
from previous session was written but never replaced this block (the commit replaced 
a different version of the file that diverged). P2 AI still:
- Only shoots from keydown event (also still alive at L1390-1410)
- Patrol is `600 + sin(t/1400)*100` — never goes near ramps or hoop
- Jump is random `0.003` — no ramp awareness
- There's ALSO a separate setInterval at L1462-1488 shooting every 3.5-5.5s
  but from WRONG position (ball.x at pickup point, not current P2 position)

### AI-2: P2 AI pickup requires lastTouchPlayerId !== 2 
But after P2 shoots and ball goes LOOSE from floor bounce, lastTouchPlayerId=2.
P2 can NEVER pick up its own rebound from the floor. Dead ball scenario.
Fix: allow P2 to pick up LOOSE balls after 0.8s regardless of lastTouch.

### AI-3: grind popup STILL fires outside if(p1.grinding) (L1329)
The previous fix went into a commit that got overwritten. Still broken.

### AI-4: Double P2 shot systems — keydown AND setInterval
L1390-1410: P2 shoots in keydown (only when P1 presses a key)
L1462-1488: P2 shoots via setInterval (correct approach but wrong ball.x source)
Two systems fighting. Remove keydown one. Fix setInterval to use p2.x as shot origin.

## 🔴 CRITICAL — new issues found

### B-1: Ball scored state persists — never transitions after timeout
After scoring, ball.state = SCORED. After 1200ms a NEW ball is created in ballRef.
But `setBallDisplay` updates the display. However the ballRef update is in setTimeout
which closes over stale `p1Ref.current.x` at time of score. If P1 has moved, 
wrong position. Also: if matchOver fires during the timeout, ball reset still runs.
Fix: guard the setTimeout callback with matchOver check.

### B-2: Ball follows P2 when P2 holds it — but ball is at wrong height
`ball.y = p2.y - 38` — P2's y is foot position, -38 = ball at chest. Fine.
But when P2 is airborne, this looks correct. When on ramp, p2.y changes with ramp.
Not a bug per se, but ball wobbles slightly at ramp junctions. Fine for now.

### B-3: Shot charge leaks between possessions
If P1 charges shot, ball gets stolen (F key), shotChargeRef doesn't reset.
When P1 gets ball back, isChargingRef.current is still false (so won't fire),
but shotChargeRef.current holds old value. Minor but messy.
Fix: reset shotChargeRef on ball possession change.

## 🟡 GAMEPLAY ISSUES

### G-1: Dunk eligibility check hardcodes HOOPS.right
checkDunkEligibility is called with HOOPS.right always. Fine for P1. 
But reason strings are confusing when P1 is on the left side of court.
Fix: check if P1 is actually within dunk range of right hoop, give better reason text.

### G-2: P1 can shoot at wrong hoop (left hoop scores are rejected but silently)
If P1 shoots at left hoop (ball goes left), isValidScore = false, nothing happens.
Ball just becomes a rebound. No popup to tell P1 "WRONG HOOP!"
Fix: when isValidScore=false, show "WRONG BASKET!" popup briefly.

### G-3: Match win at 21 but score can overshoot
finalPoints can be up to 15 in one shot. Score can go 19→34.
addScore should cap at 21 (or whatever the win threshold is).
Check matchSystem.js.

### G-4: P1 speed cap inconsistent with ramp speed
vx capped at 680 on ramp but max normal speed is ~400*dt≈400px/s.
On ramp descent P1 can reach 680, then jump off ramp at 680px/s horizontal.
This launches P1 across the entire arena instantly. Need air-entry speed cap.
Fix: when transitioning from grounded to airborne, clamp vx to ±420.

### G-5: Combo drops too easily
tickCombo drops on landing. Every time P1 lands from any jump, combo resets.
Should only drop if player has been grounded for >0.5s without a trick or grind.
Makes combos feel pointless — they vanish the moment you land.

### G-6: Steal range (58px) never works in practice
P1 moves at ~400px/s, P2 AI moves at ~340px/s. They pass through each other 
at 740px/s relative speed. 58px window = ~78ms to press F. Way too short.
Fix: extend to 80px range, and give a 0.3s grace window after entering range.

## 🟢 FEEL / POLISH

### P-1: Shot arc preview uses wrong color per quality
Arc always shows in white/default. Should be green=PERFECT, yellow=GOOD, red=BAD.

### P-2: Grind direction — K held while MOVING LEFT on a right-to-left rail
Works fine going right. Going left: vx is negative, ramp physics applies slope boost.
May fling P1 left at max speed through grind. Cap grind vx at ±400.

### P-3: Ball shadow doesn't track to ramp surfaces
Ball shadow is hardcoded at y=329. When ball bounces on ramp, shadow is in wrong place.
Use getSurfaceY(ball.x) for shadow Y.

### P-4: SkaterAvatar renders above Hoops (zIndex 15 > hoop z)
Skaters walk "in front of" hoops which look wrong. Hoops should be z:25.

### P-5: ArenaFloorMarkings renders center court markings under police car
Police car is positioned at center. Center court markings overlap weirdly.
Minor visual issue — remove center circle from floor markings (or offset it).

### P-6: matchSystem addScore doesn't cap at win score
Score can go 19 → 34. Should call checkWin after adding and cap final displayed score.

### P-7: "FIND A RAIL!" popup on every K press when not grinding
Too noisy. Only show it if player has been near a rail recently (within 2s).
Otherwise just silently ignore.
