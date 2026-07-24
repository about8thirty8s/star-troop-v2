"""
VULCAN SPRITE SHEET GENERATOR v1.0
Generates pixel-perfect sprite sheets with true alpha transparency.
Star Troop — Starship Troopers × Kingdom: New Lands aesthetic
"""
from PIL import Image, ImageDraw
import os

# ═══════════════════════════════════════════════════════════════════════════
# PALETTE
# ═══════════════════════════════════════════════════════════════════════════

# Trooper
T_DARK   = (24, 25, 31, 255)    # darkest armor
T_ARMOR  = (35, 38, 46, 255)    # main armor
T_ARMHL  = (53, 58, 70, 255)    # armor highlight
T_BOOT   = (22, 22, 24, 255)    # boots
T_RIFLE  = (40, 41, 47, 255)    # rifle body
T_RIFHL  = (72, 77, 88, 255)    # rifle highlight
T_STRAP  = (48, 51, 60, 255)    # chest strap
T_VISOR  = (0, 221, 255, 255)   # visor cyan
T_VISOR_D= (0, 140, 200, 255)   # visor dim
T_SKIN   = (180, 140, 100, 255) # neck skin
T_FLASH  = (255, 255, 200, 255) # muzzle flash core
T_FLASH_Y= (255, 220, 60, 255)  # flash yellow
T_FLASH_O= (255, 140, 10, 255)  # flash orange
T_TRANSP = (0, 0, 0, 0)         # transparent

# Warrior Bug
WB_DARK  = (21, 14, 4, 255)
WB_CHIT  = (44, 26, 7, 255)
WB_MID   = (65, 38, 16, 255)
WB_HI    = (94, 56, 24, 255)
WB_EDGE  = (122, 76, 34, 255)
WB_CLAW  = (26, 16, 5, 255)
WB_EYE   = (255, 136, 0, 255)
WB_EYE_G = (255, 204, 68, 255)
WB_LEG   = (37, 21, 8, 255)
WB_LEG_H = (61, 34, 16, 255)

# Hopper Bug
HB_DARK  = (26, 26, 8, 255)
HB_BODY  = (46, 46, 14, 255)
HB_MID   = (62, 58, 20, 255)
HB_HI    = (90, 84, 30, 255)
HB_EDGE  = (122, 112, 40, 255)
HB_LEG   = (40, 40, 16, 255)
HB_EYE   = (0, 255, 136, 255)
HB_EYE_G = (170, 255, 204, 255)
HB_WING  = (180, 210, 160, 140)

# ═══════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═══════════════════════════════════════════════════════════════════════════

def new_sprite(w, h):
    """Create a transparent sprite canvas."""
    return Image.new('RGBA', (w, h), T_TRANSP)

def px(img, draw, x, y, w, h, color):
    """Draw a filled rectangle of pixels."""
    if x < 0 or y < 0 or x + w > img.size[0] or y + h > img.size[1]:
        return
    draw.rectangle([x, y, x + w - 1, y + h - 1], fill=color)

def scale_up(img, factor):
    """Scale up by integer factor using nearest-neighbor."""
    w, h = img.size
    return img.resize((w * factor, h * factor), Image.NEAREST)

# ═══════════════════════════════════════════════════════════════════════════
# TROOPER SPRITES  (32x48 base, 4x scale = 128x192 per frame)
# ═══════════════════════════════════════════════════════════════════════════

def draw_trooper_base(img, draw, frame_offset_x=0):
    """Draw the base trooper body (parts that don't change between frames)."""
    ox = frame_offset_x
    
    # Boots
    px(img, draw, 4+ox, 42, 3, 2, T_BOOT)
    px(img, draw, 11+ox, 42, 3, 2, T_BOOT)
    
    # Legs (upper)
    px(img, draw, 4+ox, 32, 3, 10, T_ARMOR)
    px(img, draw, 11+ox, 32, 3, 10, T_ARMOR)
    px(img, draw, 4+ox, 32, 3, 1, T_ARMHL)  # leg top highlight
    px(img, draw, 11+ox, 32, 3, 1, T_ARMHL)
    
    # Torso
    px(img, draw, 4+ox, 20, 10, 12, T_ARMOR)
    px(img, draw, 4+ox, 20, 10, 1, T_ARMHL)  # chest top
    px(img, draw, 6+ox, 24, 1, 4, T_STRAP)   # chest strap L
    px(img, draw, 11+ox, 24, 1, 4, T_STRAP)  # chest strap R
    
    # Shoulder pads
    px(img, draw, 0+ox, 16, 4, 6, T_ARMHL)
    px(img, draw, 14+ox, 16, 4, 6, T_ARMHL)
    
    # Head/helmet
    px(img, draw, 6+ox, 4, 6, 14, T_ARMOR)
    px(img, draw, 4+ox, 8, 2, 6, T_ARMOR)    # helmet side
    px(img, draw, 12+ox, 8, 2, 6, T_ARMOR)
    px(img, draw, 6+ox, 4, 6, 1, T_ARMHL)    # helmet top
    
    # Visor slit
    px(img, draw, 8+ox, 10, 4, 2, T_VISOR)
    
    # Neck
    px(img, draw, 8+ox, 18, 2, 2, T_SKIN)

def draw_trooper_idle(img, draw, frame, ox=0):
    """Idle animation — 6 frames of subtle breathing."""
    breath = [0, 0, 1, 1, 1, 0][frame]  # vertical bob
    
    draw_trooper_base(img, draw, ox)
    
    # Arms — holding rifle at hip
    px(img, draw, 12+ox, 20, 2, 6, T_ARMOR)  # right arm
    px(img, draw, 2+ox, 20, 2, 6, T_ARMOR)   # left arm
    
    # Rifle — steady
    rx = 10 + ox
    ry = 22 + breath
    px(img, draw, rx, ry, 6, 1, T_RIFLE)       # barrel
    px(img, draw, rx+5, ry, 1, 1, T_RIFHL)    # muzzle
    px(img, draw, rx, ry+1, 3, 1, T_RIFLE)    # stock
    px(img, draw, rx+1, ry-1, 2, 1, T_RIFHL)  # top rail
    
    # Subtle visor glow on frames 2,3
    if frame in [2, 3]:
        px(img, draw, 7+ox, 9, 6, 4, (*T_VISOR[:3], 60))

def draw_trooper_walk(img, draw, frame, ox=0):
    """Walk animation — 8 frames of full leg cycle."""
    # Leg offsets: alternating forward/back
    # 8-frame walk cycle: frames 0-3 = right leg forward, 4-7 = left leg forward
    leg_offsets = [
        (0, 0), (-1, 1), (-2, 2), (-1, 1),  # right forward
        (0, 0), (1, -1), (2, -2), (1, -1),   # left forward
    ]
    l_off, r_off = leg_offsets[frame]
    
    # Redraw legs with offset
    # Clear default legs area
    px(img, draw, 4+ox, 32, 3, 12, T_TRANSP)
    px(img, draw, 11+ox, 32, 3, 12, T_TRANSP)
    
    # Left leg
    px(img, draw, 4+ox+l_off, 32, 3, 10, T_ARMOR)
    px(img, draw, 4+ox+l_off, 42, 3, 2, T_BOOT)
    px(img, draw, 4+ox+l_off, 32, 3, 1, T_ARMHL)
    
    # Right leg
    px(img, draw, 11+ox+r_off, 32, 3, 10, T_ARMOR)
    px(img, draw, 11+ox+r_off, 42, 3, 2, T_BOOT)
    px(img, draw, 11+ox+r_off, 32, 3, 1, T_ARMHL)
    
    # Torso with slight lean
    lean = [0, 0, 1, 0, 0, 0, 0, 0][frame]
    draw_trooper_base(img, draw, ox)
    # Redraw torso shifted
    px(img, draw, 4+ox, 32, 3, 12, T_TRANSP)
    px(img, draw, 11+ox, 32, 3, 12, T_TRANSP)
    px(img, draw, 4+ox+l_off, 32, 3, 10, T_ARMOR)
    px(img, draw, 4+ox+l_off, 42, 3, 2, T_BOOT)
    px(img, draw, 4+ox+l_off, 32, 3, 1, T_ARMHL)
    px(img, draw, 11+ox+r_off, 32, 3, 10, T_ARMOR)
    px(img, draw, 11+ox+r_off, 42, 3, 2, T_BOOT)
    px(img, draw, 11+ox+r_off, 32, 3, 1, T_ARMHL)
    
    # Arms — swinging
    arm_l = [0, -1, -1, 0, 0, 1, 1, 0][frame]
    arm_r = [0, 1, 1, 0, 0, -1, -1, 0][frame]
    px(img, draw, 2+ox, 20+arm_l, 2, 6, T_ARMOR)
    px(img, draw, 12+ox, 20+arm_r, 2, 6, T_ARMOR)
    
    # Rifle — bobs with walk
    rx = 10 + ox
    ry = 22 + [0, 0, 1, 1, 0, 0, 1, 1][frame]
    px(img, draw, rx, ry, 6, 1, T_RIFLE)
    px(img, draw, rx+5, ry, 1, 1, T_RIFHL)
    px(img, draw, rx, ry+1, 3, 1, T_RIFLE)
    px(img, draw, rx+1, ry-1, 2, 1, T_RIFHL)

def draw_trooper_shoot(img, draw, frame, ox=0):
    """Shoot animation — 6 frames of rifle recoil + muzzle flash."""
    draw_trooper_base(img, draw, ox)
    
    # Arms — braced for recoil
    px(img, draw, 12+ox, 19, 2, 7, T_ARMOR)
    px(img, draw, 2+ox, 20, 2, 6, T_ARMOR)
    
    # Rifle — recoil kick (frames 0-2 recoiling, 3-5 recovering)
    recoil = [0, 2, 3, 2, 1, 0][frame]
    rx = 10 + ox - recoil
    ry = 22
    px(img, draw, rx, ry, 6, 1, T_RIFLE)
    px(img, draw, rx+5, ry, 1, 1, T_RIFHL)
    px(img, draw, rx, ry+1, 3, 1, T_RIFLE)
    px(img, draw, rx+1, ry-1, 2, 1, T_RIFHL)
    
    # Muzzle flash (frames 0-3, peak at 1)
    if frame in [0, 1, 2, 3]:
        intensity = [0.6, 1.0, 0.8, 0.4][frame]
        mx = rx + 6  # muzzle position
        my = ry
        
        # Core flash
        a = int(255 * intensity)
        px(img, draw, mx, my-1, 2, 3, (*T_FLASH[:3], a))
        px(img, draw, mx+1, my-2, 2, 5, (*T_FLASH_Y[:3], int(a*0.8)))
        px(img, draw, mx+2, my-3, 3, 7, (*T_FLASH_O[:3], int(a*0.5)))
        
        # Star spikes
        if frame in [1, 2]:
            # Up
            px(img, draw, mx, my-5, 1, 4, (*T_FLASH_Y[:3], a))
            # Right
            px(img, draw, mx+4, my, 4, 1, (*T_FLASH_Y[:3], int(a*0.7)))
            # Diagonal
            px(img, draw, mx+3, my-3, 2, 2, (*T_FLASH_O[:3], int(a*0.4)))
        
        # Beam tracer
        if frame in [0, 1]:
            beam_a = int(180 * intensity)
            for bx in range(mx + 5, min(mx + 20, 32)):
                beam_a = max(0, beam_a - 12)
                px(img, draw, bx, my, 1, 1, (*T_FLASH_Y[:3], beam_a))

# ═══════════════════════════════════════════════════════════════════════════
# WARRIOR BUG SPRITES (64x40 base, 4x scale = 256x160 per frame)
# ═══════════════════════════════════════════════════════════════════════════

def draw_warrior_bug(img, draw, frame, ox=0):
    """8-frame crawl animation."""
    # Leg phase: each pair moves in sequence
    leg_phases = [
        (0, -2, 0, 2),   # frame 0
        (1, -1, 1, -1),  # frame 1
        (2, 0, 2, -2),   # frame 2
        (1, 1, 1, -1),   # frame 3
        (0, 2, 0, -2),   # frame 4
        (-1, 1, -1, -1), # frame 5
        (-2, 0, -2, 2),  # frame 6
        (-1, -1, -1, 1), # frame 7
    ]
    body_bob = [0, -1, -1, 0, 0, -1, -1, 0][frame]
    p1, p2, p3, p4 = leg_phases[frame]
    
    # Legs — 3 pairs, each pair has offset
    # Pair 1 (front)
    for ly in [32, 32]:
        px(img, draw, 2+ox, 28+body_bob, 2, 6+p1, WB_LEG)
        px(img, draw, 2+ox, 28+body_bob, 2, 1, WB_LEG_H)
    px(img, draw, 58+ox, 28+body_bob, 2, 6+p4, WB_LEG)
    px(img, draw, 58+ox, 28+body_bob, 2, 1, WB_LEG_H)
    
    # Pair 2 (mid)
    px(img, draw, 8+ox, 26+body_bob, 2, 5+p2, WB_LEG)
    px(img, draw, 52+ox, 26+body_bob, 2, 5+p3, WB_LEG)
    
    # Pair 3 (rear)
    px(img, draw, 14+ox, 28+body_bob, 2, 6-p1, WB_LEG)
    px(img, draw, 46+ox, 28+body_bob, 2, 6-p2, WB_LEG)
    
    # Abdomen (back half)
    px(img, draw, 32+ox, 14+body_bob, 24, 16, WB_DARK)
    px(img, draw, 32+ox, 14+body_bob, 24, 12, WB_CHIT)
    px(img, draw, 32+ox, 14+body_bob, 24, 4, WB_MID)
    px(img, draw, 38+ox, 16+body_bob, 12, 2, WB_HI)  # carapace highlight
    
    # Segmented ridges
    for seg in range(3):
        sx_seg = 34 + seg * 7
        px(img, draw, sx_seg+ox, 14+body_bob, 1, 16, WB_DARK)
    
    # Thorax (mid section)
    px(img, draw, 14+ox, 12+body_bob, 20, 18, WB_CHIT)
    px(img, draw, 14+ox, 12+body_bob, 20, 6, WB_MID)
    px(img, draw, 16+ox, 14+body_bob, 16, 2, WB_HI)
    
    # Head
    px(img, draw, 0+ox, 14+body_bob, 16, 16, WB_CHIT)
    px(img, draw, 0+ox, 14+body_bob, 16, 5, WB_MID)
    px(img, draw, 2+ox, 16+body_bob, 12, 2, WB_HI)
    
    # Mandible claws — slight forward sweep
    claw_off = [0, 1, 2, 1, 0, -1, -2, -1][frame]
    px(img, draw, 0+ox, 18+body_bob+claw_off, 3, 2, WB_CLAW)
    px(img, draw, 0+ox, 24+body_bob+claw_off, 2, 3, WB_CLAW)
    px(img, draw, 0+ox, 16+body_bob, 2, 1, WB_EDGE)
    px(img, draw, 0+ox, 27+body_bob, 2, 1, WB_EDGE)
    
    # Eyes — glowing amber
    eye_glow = [0.7, 0.85, 1.0, 0.85, 0.7, 0.85, 1.0, 0.85][frame]
    a = int(255 * eye_glow)
    px(img, draw, 4+ox, 18+body_bob, 3, 2, (*WB_EYE[:3], a))
    px(img, draw, 8+ox, 18+body_bob, 3, 2, (*WB_EYE[:3], a))
    px(img, draw, 4+ox, 18+body_bob, 1, 1, (*WB_EYE_G[:3], int(a*0.7)))
    px(img, draw, 8+ox, 18+body_bob, 1, 1, (*WB_EYE_G[:3], int(a*0.7)))

# ═══════════════════════════════════════════════════════════════════════════
# HOPPER BUG SPRITES (56x48 base, 4x scale = 224x192 per frame)
# ═══════════════════════════════════════════════════════════════════════════

def draw_hopper_bug(img, draw, frame, ox=0):
    """8-frame flight/hover animation."""
    hover_y = [0, -1, -2, -1, 0, -1, -2, -1][frame]
    wing_phase = [0, 0.25, 0.5, 0.75, 1.0, 0.75, 0.5, 0.25][frame]  # 0=up, 1=down
    
    # Wing spread — varies with flap
    wing_up = int(8 * (1.0 - wing_phase))  # height when up
    wing_down = int(6 * wing_phase)  # extension when down
    wing_alpha = int(100 + 80 * abs(wing_phase - 0.5) * 2)
    
    # Upper wings
    for wy in range(wing_up):
        wa = max(40, wing_alpha - wy * 8)
        px(img, draw, 16+ox, 8+hover_y-wing_up+wy, 24, 1, (*HB_WING[:3], wa))
    
    # Lower wings
    for wy in range(wing_down):
        wa = max(40, wing_alpha - wy * 8)
        px(img, draw, 18+ox, 20+hover_y+wing_down+wy, 20, 1, (*HB_WING[:3], wa))
    
    # Wing veins
    if wing_up > 2:
        px(img, draw, 20+ox, 6+hover_y, 16, 1, (*HB_EDGE[:3], 100))
    if wing_down > 2:
        px(img, draw, 22+ox, 24+hover_y, 12, 1, (*HB_EDGE[:3], 80))
    
    # Legs — tucked
    px(img, draw, 14+ox, 28+hover_y, 2, 8, HB_LEG)
    px(img, draw, 40+ox, 28+hover_y, 2, 8, HB_LEG)
    px(img, draw, 20+ox, 30+hover_y, 2, 6, HB_LEG)
    px(img, draw, 34+ox, 30+hover_y, 2, 6, HB_LEG)
    
    # Abdomen — segmented
    px(img, draw, 24+ox, 20+hover_y, 12, 18, HB_DARK)
    px(img, draw, 25+ox, 20+hover_y, 10, 18, HB_BODY)
    px(img, draw, 25+ox, 20+hover_y, 10, 4, HB_MID)
    for seg in range(4):
        px(img, draw, 25+ox, 22+seg*4+hover_y, 10, 1, HB_DARK)
    
    # Thorax
    px(img, draw, 14+ox, 14+hover_y, 18, 14, HB_BODY)
    px(img, draw, 14+ox, 14+hover_y, 18, 5, HB_MID)
    px(img, draw, 16+ox, 16+hover_y, 14, 2, HB_HI)
    
    # Head
    px(img, draw, 10+ox, 6+hover_y, 14, 12, HB_BODY)
    px(img, draw, 10+ox, 6+hover_y, 14, 4, HB_MID)
    
    # Compound eyes — glowing green
    eye_glow = [0.7, 0.85, 1.0, 0.85, 0.7, 0.85, 1.0, 0.85][frame]
    a = int(255 * eye_glow)
    px(img, draw, 12+ox, 10+hover_y, 4, 4, (*HB_EYE[:3], a))
    px(img, draw, 20+ox, 10+hover_y, 4, 4, (*HB_EYE[:3], a))
    px(img, draw, 12+ox, 10+hover_y, 2, 2, (*HB_EYE_G[:3], int(a*0.7)))
    px(img, draw, 20+ox, 10+hover_y, 2, 2, (*HB_EYE_G[:3], int(a*0.7)))
    
    # Antennae
    ant_sway = [0, 1, 2, 1, 0, -1, -2, -1][frame]
    # Draw as thin lines
    for ay in range(4):
        ax1 = 14 + ox + ant_sway
        ax2 = 20 + ox + ant_sway
        if 0 <= ax1 < 56 and 0 <= ax2 < 56:
            px(img, draw, ax1, 4+hover_y-ay, 1, 1, (*HB_MID[:3], 200))
            px(img, draw, ax2, 4+hover_y-ay, 1, 1, (*HB_MID[:3], 200))

# ═══════════════════════════════════════════════════════════════════════════
# SPRITE SHEET ASSEMBLY
# ═══════════════════════════════════════════════════════════════════════════

SCALE = 4  # pixel scale factor

# ── TROOPER SHEET ──
# Layout: 8 cols × 3 rows
# Row 0: idle (6 frames, cols 0-5, cols 6-7 empty)
# Row 1: walk (8 frames, cols 0-7)
# Row 2: shoot (6 frames, cols 0-5, cols 6-7 empty)
TROOPER_FRAME_W = 32
TROOPER_FRAME_H = 48
TROOPER_COLS = 8
TROOPER_ROWS = 3

trooper_sheet = Image.new('RGBA', 
    (TROOPER_FRAME_W * TROOPER_COLS * SCALE, TROOPER_FRAME_H * TROOPER_ROWS * SCALE),
    T_TRANSP)

# Row 0: Idle
for f in range(6):
    frame_img = new_sprite(TROOPER_FRAME_W, TROOPER_FRAME_H)
    draw = ImageDraw.Draw(frame_img)
    draw_trooper_idle(frame_img, draw, f, 0)
    scaled = scale_up(frame_img, SCALE)
    trooper_sheet.paste(scaled, (f * TROOPER_FRAME_W * SCALE, 0), scaled)

# Row 1: Walk
for f in range(8):
    frame_img = new_sprite(TROOPER_FRAME_W, TROOPER_FRAME_H)
    draw = ImageDraw.Draw(frame_img)
    draw_trooper_walk(frame_img, draw, f, 0)
    scaled = scale_up(frame_img, SCALE)
    trooper_sheet.paste(scaled, (f * TROOPER_FRAME_W * SCALE, TROOPER_FRAME_H * SCALE), scaled)

# Row 2: Shoot
for f in range(6):
    frame_img = new_sprite(TROOPER_FRAME_W, TROOPER_FRAME_H)
    draw = ImageDraw.Draw(frame_img)
    draw_trooper_shoot(frame_img, draw, f, 0)
    scaled = scale_up(frame_img, SCALE)
    trooper_sheet.paste(scaled, (f * TROOPER_FRAME_W * SCALE, TROOPER_FRAME_H * 2 * SCALE), scaled)

trooper_out = 'incoming_files/trooper_sheet_final.png'
trooper_sheet.save(trooper_out)
print(f'✅ Trooper sheet: {trooper_sheet.size} → {trooper_out}')

# ── WARRIOR BUG SHEET ──
# Layout: 8 cols × 1 row (crawl cycle)
WB_FRAME_W = 64
WB_FRAME_H = 40
WB_COLS = 8
WB_ROWS = 1

warrior_sheet = Image.new('RGBA',
    (WB_FRAME_W * WB_COLS * SCALE, WB_FRAME_H * WB_ROWS * SCALE),
    T_TRANSP)

for f in range(8):
    frame_img = new_sprite(WB_FRAME_W, WB_FRAME_H)
    draw = ImageDraw.Draw(frame_img)
    draw_warrior_bug(frame_img, draw, f, 0)
    scaled = scale_up(frame_img, SCALE)
    warrior_sheet.paste(scaled, (f * WB_FRAME_W * SCALE, 0), scaled)

warrior_out = 'incoming_files/warrior_sheet_final.png'
warrior_sheet.save(warrior_out)
print(f'✅ Warrior sheet: {warrior_sheet.size} → {warrior_out}')

# ── HOPPER BUG SHEET ──
# Layout: 8 cols × 1 row (flight cycle)
HB_FRAME_W = 56
HB_FRAME_H = 48
HB_COLS = 8
HB_ROWS = 1

hopper_sheet = Image.new('RGBA',
    (HB_FRAME_W * HB_COLS * SCALE, HB_FRAME_H * HB_ROWS * SCALE),
    T_TRANSP)

for f in range(8):
    frame_img = new_sprite(HB_FRAME_W, HB_FRAME_H)
    draw = ImageDraw.Draw(frame_img)
    draw_hopper_bug(frame_img, draw, f, 0)
    scaled = scale_up(frame_img, SCALE)
    hopper_sheet.paste(scaled, (f * HB_FRAME_W * SCALE, 0), scaled)

hopper_out = 'incoming_files/hopper_sheet_final.png'
hopper_sheet.save(hopper_out)
print(f'✅ Hopper sheet: {hopper_sheet.size} → {hopper_out}')

# ── COMPOSITE PREVIEW ──
preview_w = max(trooper_sheet.size[0], warrior_sheet.size[0], hopper_sheet.size[0])
preview_h = trooper_sheet.size[1] + warrior_sheet.size[1] + hopper_sheet.size[1] + 80
preview = Image.new('RGBA', (preview_w, preview_h), (26, 13, 5, 255))
pdraw = ImageDraw.Draw(preview)

y = 10
pdraw.text((10, y), "TROOPER — 8 cols × 3 rows (idle 6f / walk 8f / shoot 6f)", fill=(249, 115, 22))
y += 20
preview.paste(trooper_sheet, (0, y), trooper_sheet)
y += trooper_sheet.size[1] + 20

pdraw.text((10, y), "WARRIOR BUG — 8 cols × 1 row (crawl 8f)", fill=(249, 115, 22))
y += 20
preview.paste(warrior_sheet, (0, y), warrior_sheet)
y += warrior_sheet.size[1] + 20

pdraw.text((10, y), "HOPPER BUG — 8 cols × 1 row (flight 8f)", fill=(249, 115, 22))
y += 20
preview.paste(hopper_sheet, (0, y), hopper_sheet)

preview.save('incoming_files/sprite_sheets_final_preview.png')
print(f'\n✅ Preview composite saved')
print('All sprite sheets generated!')
