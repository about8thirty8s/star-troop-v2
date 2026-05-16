// LAST HUNT: KILLBOX - Renderer
import { TILE_SIZE, TILE, WORLD_WIDTH, WORLD_HEIGHT, COLORS, TRAP_TYPES, GAME_STATES } from './constants';
import { TRAP_LIST } from './traps';
import { renderHelicopter } from './helicopter';
import { renderSquad } from './squad';
import { renderFallingTrees } from './trees';
import { initMenuVFX, updateMenuVFX, renderMenuVFX } from './menuVFX';
import { renderWildlife } from './wildlife';
import { renderCrate } from './crates';
import { WEAPONS_CONFIG } from './config/weapons.config';
import { renderThermalOverlay } from './thermal';
import { renderFoliage } from './foliage/foliageSystem';
import { renderProp } from './foliage/propSystem';
import { getGrenadeTrajectoryPoints, renderGrenadeArc } from './grenadeSystem';
import { renderTreeVariant } from './foliage/treeVariantRenderer';
import { renderSquadDebugOverlay, renderHunterDebugOverlay } from './ai/squadDebug';
import {
  initAtmosphere, updateAtmosphere,
  renderAtmosphereBG, renderAtmosphereFG, getWeatherBlends, getLightningFlash,
} from './atmosphere';
import { renderFarMountainsScreenSpace, renderMidTreesScreenSpace, renderVinesScreenSpace } from './renderer/parallaxLayers';

// Module-level atmosphere init flag
let _atmosInitW = 0, _atmosInitH = 0;

// ── VULCAN DEV: RENDER_FLAGS — toggled by admin panel in GameCanvas ──────────
// Exported so the React layer can mutate them directly (no re-render needed).
export const RENDER_FLAGS = {
  // Sky / atmosphere
  sky:             true,
  godRays:         true,
  atmosphereBG:    true,
  atmosphereFG:    true,

  // Parallax background image layers
  bgFar:           true,   // imported PNG — distant jungle silhouette
  bgMid:           true,   // mid-distance trees / ruins
  bgNear:          true,   // near foreground vines

  // Procedural parallax layers
  farMountains:    false,  // OFF by default — PNG layers replace procedural mountains
  farCanopy:       false,  // OFF by default — bgMid PNG replaces procedural canopy
  midTrees:        false,  // OFF by default — bgNear PNG replaces procedural palms
  vines:           false,  // OFF by default — PNG layers provide vine detail
  fgFoliage:       false,  // OFF by default — bgNear PNG replaces procedural FG foliage

  // World gameplay
  tiles:           true,
  trees:           true,
  traps:           true,
  foliage:         true,
  props:           true,
  crates:          true,
  projectiles:     true,
  particles:       true,

  // Characters
  player:          true,
  hunter:          true,
  squad:           true,
  wildlife:        true,

  // FX
  rain:            true,
  hud:             true,
  debugOverlays:   true,
};

// ── VULCAN DEV: BG_OFFSETS — Y offset per layer in pixels (mutated by admin panel) ─
// Positive = move down, Negative = move up. Range: -H to +H (clamped in renderer).
export const BG_OFFSETS = {
  far:  0,   // far PNG layer Y offset
  mid:  0,   // mid PNG layer Y offset
  near: 0,   // near PNG layer Y offset
};


// ── VULCAN Killbox — Procedural tile painter ────────────────────────────────
// No external spritesheet dependency. All tiles are painted with fillRect/stroke.
// This guarantees tiles are always visible regardless of image loading.

// Pseudo-random hash for per-tile variation (deterministic from tile coords)
function _th(x, y, seed) {
  let h = (x * 374761393 + y * 1234567 + seed * 99999) | 0;
  h = ((h ^ (h >>> 13)) * 1540483477) | 0;
  return ((h ^ (h >>> 15)) >>> 0) / 0xFFFFFFFF;
}

// Draw a procedural tile — rich pixel art, no image dependency
function _drawTile(ctx, tIdx, px, py, T, x, y) {
  // Deterministic hash — no random(), no flicker, different per tile position
  const h  = ((x * 7919 + y * 6271 + tIdx * 1031) & 0x7fff) / 0x7fff;
  const h2 = ((x * 6271 + y * 1031 + tIdx * 7919) & 0x7fff) / 0x7fff;
  const h3 = ((x * 1031 + y * 7919 + tIdx * 6271) & 0x7fff) / 0x7fff;

  switch (tIdx) {

    // ── DIRT variants 0/1/2 (surface / mid / deep) ────────────────────────────
    case 0:
    case 1:
    case 2: {
      // Very dark earth — reference shows near-black soil #12090304
      const r0 = tIdx===2 ? 34 : tIdx===1 ? 44 : 58;
      const g0 = tIdx===2 ? 16 : tIdx===1 ? 22 : 30;
      const b0 = tIdx===2 ?  5 : tIdx===1 ?  7 : 10;
      ctx.fillStyle = `rgb(${r0},${g0},${b0})`;
      ctx.fillRect(px, py, T, T);

      // Warm earth vein — narrow horizontal strata line
      const vr = tIdx===2 ? 52 : 72;
      ctx.fillStyle = `rgba(${vr},${Math.floor(vr*0.5)},${Math.floor(vr*0.15)},0.7)`;
      const vy = py + 2 + Math.floor(h * 9);
      ctx.fillRect(px + Math.floor(h2 * 3), vy, Math.floor(5 + h3 * 8), 1);

      // Second thin strata
      if (h > 0.5) {
        ctx.fillStyle = `rgba(${vr-8},${Math.floor((vr-8)*0.45)},2,0.45)`;
        ctx.fillRect(px + Math.floor(h3 * 4), py + 8 + Math.floor(h2 * 5), Math.floor(4 + h * 6), 1);
      }

      // Embedded micro-pebble (very subtle)
      if (h3 > 0.82) {
        const pr = 38 + Math.floor(h * 18);
        ctx.fillStyle = `rgb(${pr},${Math.floor(pr*0.9)},${Math.floor(pr*0.8)})`;
        ctx.fillRect(px + Math.floor(h * 11), py + Math.floor(h2 * 10), 2, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(px + Math.floor(h * 11) + 1, py + Math.floor(h2 * 10) + 1, 1, 1);
      }

      // Root crack — dark vertical hairline
      if (h > 0.7 && tIdx < 2) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(px + Math.floor(h * 12), py + Math.floor(h2 * 4), 1, 4 + Math.floor(h3 * 5));
      }
      break;
    }

    // ── GRASS surface cap (case 3) ─────────────────────────────────────────────
    // Only drawn on the top face of grass/dirt surface tiles
    case 3: {
      // Dark earth body — same as dirt but with green top band
      ctx.fillStyle = 'rgb(48,26,10)';
      ctx.fillRect(px, py, T, T);

      // Earth strata
      ctx.fillStyle = 'rgba(80,42,14,0.55)';
      ctx.fillRect(px + Math.floor(h2*5), py + 5 + Math.floor(h3*7), Math.floor(5+h*6), 1);

      // Grass surface — 4 sub-pixel layers from dark→bright
      // Layer 1 — deepest dark green fringe
      ctx.fillStyle = 'rgb(18,44,8)';
      ctx.fillRect(px, py, T, 4);
      // Layer 2
      ctx.fillStyle = 'rgb(30,64,12)';
      ctx.fillRect(px, py, T, 3);
      // Layer 3
      ctx.fillStyle = 'rgb(42,84,16)';
      ctx.fillRect(px, py, T, 2);
      // Layer 4 — surface highlight strip
      ctx.fillStyle = 'rgb(56,108,22)';
      ctx.fillRect(px, py, T, 1);

      // Bright blade accent dots
      ctx.fillStyle = 'rgb(72,138,28)';
      if (h  > 0.28) ctx.fillRect(px + Math.floor(h  * 13), py, 1, 1);
      if (h2 > 0.44) ctx.fillRect(px + Math.floor(h2 * 11), py, 1, 1);
      if (h3 > 0.62) ctx.fillRect(px + Math.floor(h3 * 14), py, 1, 1);
      if (h  > 0.75) ctx.fillRect(px + Math.floor(h  *  8), py, 1, 1);
      break;
    }

    // ── STONE — ancient jungle ruins ──────────────────────────────────────────
    case 4: {
      // Dark charcoal stone — reference ~#2e3038 with variation
      const sv = Math.floor(h * 16);
      const sr = 44 + sv; const sg = 46 + sv; const sb = 52 + sv;
      ctx.fillStyle = `rgb(${sr},${sg},${sb})`;
      ctx.fillRect(px, py, T, T);

      // Block definition — horizontal mortar line (every tile = one "stone block")
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px, py, T, 1);           // top mortar
      ctx.fillRect(px, py+T-1, T, 1);       // bottom mortar

      // Vertical mortar — offset alternating columns
      const vOff = (x % 2 === 0) ? 0 : Math.floor(T/2);
      ctx.fillRect(px + vOff, py, 1, T);

      // Top edge highlight (light source from above-left)
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(px+1, py+1, T-2, 1);
      ctx.fillRect(px+1, py+1, 1, T-2);

      // Moss on stone — reference shows heavy green coverage
      if (h3 > 0.40) {
        // Patchy moss blob
        ctx.fillStyle = `rgba(${20+Math.floor(h*8)},${55+Math.floor(h2*20)},${8+Math.floor(h3*6)},${(0.35+h*0.3).toFixed(2)})`;
        const mw = Math.floor(3 + h2 * 8);
        ctx.fillRect(px + Math.floor(h * (T - mw)), py + Math.floor(h3 * 8), mw, 2 + Math.floor(h2*3));
      }

      // Deep crack
      if (h > 0.72) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(px + Math.floor(h2*10) + 2, py + 2, 1, Math.floor(6+h3*6));
      }
      break;
    }

    // ── STONE MOSSY — heavier coverage (surface/transition stones) ─────────────
    case 5: {
      const sv2 = Math.floor(h * 12);
      const sr2 = 42 + sv2; const sg2 = 48 + sv2; const sb2 = 46 + sv2;
      ctx.fillStyle = `rgb(${sr2},${sg2},${sb2})`;
      ctx.fillRect(px, py, T, T);

      // Block mortar
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(px, py, T, 1);
      const vOff2 = (x % 2 === 0) ? Math.floor(T*0.4) : Math.floor(T*0.7);
      ctx.fillRect(px + vOff2, py, 1, T);

      // Heavy moss — top 6px nearly solid green
      ctx.fillStyle = `rgb(${14+Math.floor(h*6)},${48+Math.floor(h2*22)},${8+Math.floor(h3*8)})`;
      ctx.fillRect(px, py, T, 2);
      ctx.fillStyle = `rgba(${18+Math.floor(h*8)},${58+Math.floor(h2*18)},${10+Math.floor(h3*6)},0.75)`;
      ctx.fillRect(px, py+2, T, 3);
      // Patchy lower moss
      ctx.fillStyle = `rgba(16,50,8,${(0.3+h3*0.3).toFixed(2)})`;
      if (h > 0.35) ctx.fillRect(px + Math.floor(h2*4), py+5, Math.floor(4+h*8), 3);

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(px+1, py+1, T-2, 1);
      break;
    }

    // ── WOOD planks ────────────────────────────────────────────────────────────
    case 6: {
      // Warm dark amber — reference shows ~#6a3a10
      const wr = 76 + Math.floor(h * 24);
      const wg = Math.floor(wr * 0.50);
      const wb = Math.floor(wr * 0.16);
      ctx.fillStyle = `rgb(${wr},${wg},${wb})`;
      ctx.fillRect(px, py, T, T);

      // Top highlight
      ctx.fillStyle = `rgba(${wr+40},${wg+20},${wb+8},0.18)`;
      ctx.fillRect(px+1, py+1, T-2, 1);

      // Grain lines
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px, py + Math.floor(h*3)+1, T, 1);
      ctx.fillRect(px, py + Math.floor(h*3)+7, T, 1);

      // Plank joint shadow at edges
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(px, py+T-2, T, 2);

      // Knot
      if (h3 > 0.84) {
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        const kx = px + Math.floor(h*10)+1;
        const ky = py + Math.floor(h2*7)+2;
        ctx.fillRect(kx, ky, 3, 3);
        ctx.fillRect(kx+1, ky+1, 1, 1);
      }
      break;
    }

    // ── LEAVES ─────────────────────────────────────────────────────────────────
    case 7: {
      ctx.fillStyle = '#162808';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#224a10';
      ctx.fillRect(px+1, py+1, 6, 5);
      ctx.fillRect(px+8, py+2, 6, 5);
      ctx.fillStyle = '#306416';
      if (h  > 0.35) ctx.fillRect(px+Math.floor(h*8),  py+Math.floor(h2*5), 4, 2);
      if (h2 > 0.55) ctx.fillRect(px+Math.floor(h2*9), py+1, 3, 3);
      ctx.fillStyle = '#407a1c';
      if (h3 > 0.65) ctx.fillRect(px+Math.floor(h3*11), py+Math.floor(h*4), 2, 2);
      break;
    }

    // ── MUD ────────────────────────────────────────────────────────────────────
    case 8: {
      ctx.fillStyle = 'rgb(18,12,6)';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = 'rgba(10,8,4,0.6)';
      if (h > 0.30) ctx.fillRect(px+Math.floor(h*9), py+Math.floor(h2*9), Math.floor(4+h3*6), 3);
      ctx.fillStyle = 'rgba(70,50,18,0.12)';
      if (h3 > 0.68) ctx.fillRect(px+Math.floor(h3*8), py+Math.floor(h*6), 4, 1);
      break;
    }

    // ── METAL ──────────────────────────────────────────────────────────────────
    case 9: {
      ctx.fillStyle = '#1c2228';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(px, py, T, 2); ctx.fillRect(px, py, 2, T);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(px, py+T-2, T, 2); ctx.fillRect(px+T-2, py, 2, T);
      if (h > 0.62) {
        ctx.fillStyle = 'rgba(70,25,8,0.38)';
        ctx.fillRect(px+Math.floor(h*11), py+2, 2, Math.floor(7+h2*7));
      }
      break;
    }

    // ── WATER ──────────────────────────────────────────────────────────────────
    case 10: {
      ctx.fillStyle = '#081620';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = 'rgba(16,48,80,0.55)';
      ctx.fillRect(px, py, T, T);
      const wt = Math.floor(Date.now() / 300) % T;
      ctx.fillStyle = 'rgba(60,130,200,0.22)';
      ctx.fillRect(px + ((Math.floor(h*T)+wt)%T), py+2, 5, 1);
      ctx.fillRect(px + ((Math.floor(h2*T)+wt+9)%T), py+8, 3, 1);
      break;
    }

    // ── CRATE ──────────────────────────────────────────────────────────────────
    case 11: {
      ctx.fillStyle = '#5e3e18';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#321e08';
      ctx.fillRect(px,py,T,2); ctx.fillRect(px,py+T-2,T,2);
      ctx.fillRect(px,py,2,T); ctx.fillRect(px+T-2,py,2,T);
      ctx.fillRect(px+6,py+2,2,T-4); ctx.fillRect(px+2,py+6,T-4,2);
      ctx.fillStyle = 'rgba(190,140,70,0.18)';
      ctx.fillRect(px+2,py+2,3,3);
      break;
    }

    // ── BRIDGE ─────────────────────────────────────────────────────────────────
    case 12: {
      ctx.fillStyle = '#4e2e10';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#2e1806';
      ctx.fillRect(px,py,T,2); ctx.fillRect(px,py+5,T,2);
      ctx.fillRect(px,py+10,T,2); ctx.fillRect(px,py+T-2,T,2);
      ctx.fillStyle = 'rgba(160,100,40,0.14)';
      ctx.fillRect(px+1,py+2,T-2,2);
      break;
    }

    // ── VINE ───────────────────────────────────────────────────────────────────
    case 13: {
      ctx.fillStyle = '#0a1806';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#183408';
      ctx.fillRect(px+6, py, 3, T);
      ctx.fillStyle = '#224a0e';
      if (h  > 0.28) ctx.fillRect(px+1, py+Math.floor(h*9)+1, 5, 3);
      if (h2 > 0.38) ctx.fillRect(px+9, py+Math.floor(h2*10)+2, 5, 3);
      ctx.fillStyle = '#306014';
      if (h3 > 0.58) ctx.fillRect(px+2, py+Math.floor(h3*13)+1, 4, 2);
      break;
    }

    // ── TIMBER_LADDER ──────────────────────────────────────────────────────────
    default: {
      ctx.fillStyle = '#200e04';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#4a2808';
      ctx.fillRect(px+1, py, 3, T);
      ctx.fillRect(px+T-4, py, 3, T);
      ctx.fillStyle = '#6a3c14';
      for (let r = 1; r < T; r += 4) ctx.fillRect(px+2, py+r, T-4, 2);
      break;
    }
  }
}


// ── Surface detail sprites (ground decoration layer) ────────────────────────
// Surface detail sprites: fully procedural — no image dependency

// ── Tree variant sprites ──────────────────────────────────────────────────────
const _TREE_SPRITES_URL = 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/379b13ecc_generated_image.png';
const _treeSpriteImg = new Image();
_treeSpriteImg.src = _TREE_SPRITES_URL;

// ── VULCAN Biome — Full BG layer catalogue ────────────────────────────────────
// Every generated asset ever used, available for real-time hot-swap from DevPanel.
// FAR = kept (Storm Canopy). MID+NEAR defaulted back to previous group.
export const BG_LAYER_CATALOGUE = {
  far: [
    { id: 'far_v1', label: 'Storm Canopy (current)', url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/7a9bb8c83_generated_image.png' },
    { id: 'far_v2', label: 'Dark Gnarled V2',        url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/6a3b6b372_generated_image.png' },
    { id: 'far_v3', label: 'Parallax Original',      url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/5019d218f_killbox_bg_parallax.png' },
    { id: 'far_v4', label: 'Flame Silhouette',        url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/d8ff3e70b_generated_image.png' },
    { id: 'far_v5', label: 'Biome V1 Original',      url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/536f95c82_generated_image.png' },
    { id: 'far_v6', label: 'Alt A',                  url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/029a50533_generated_image.png' },
    { id: 'far_v7', label: 'Alt B',                  url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/6166b6e7d_generated_image.png' },
    { id: 'far_v8', label: '★ Far Mist (keyed)',    url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/279efb7e8_bg_parallax_01_far_mist.png' },
  ],
  mid: [
    { id: 'mid_v1', label: 'Dark Trees V3',           url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/6e191a798_generated_image.png' },
    { id: 'mid_v2', label: 'Jungle Trees V2 ★ prev',  url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/e7160ad06_generated_image.png' },
    { id: 'mid_v3', label: 'Alpha BG Mid',            url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/00091df56_killbox_bg_mid.png' },
    { id: 'mid_v4', label: 'Original Mid A',          url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/d4b7eaca5_generated_image.png' },
    { id: 'mid_v5', label: 'Biome V1 Mid',            url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/d79985a67_generated_image.png' },
    { id: 'mid_v6', label: '★ Mid Trees (keyed)',   url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/90589ef0f_bg_parallax_02_mid_trees.png' },
    { id: 'mid_v8', label: '★ Mid Trees (demagenta)',url: 'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/3ead65446_mid_trees_fixed.png' },
    { id: 'mid_v7', label: '★ Ground Fog (keyed)',  url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/a922a32b8_bg_parallax_03_ground_fog.png' },
    { id: 'mid_v9', label: '★ Ground Fog (blue mist)',url: 'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/abf588bcb_ground_fog_fixed.png' },
  ],
  near: [
    { id: 'near_v1', label: 'Vines V2',              url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/c0089d67b_generated_image.png' },
    { id: 'near_v2', label: 'Original Near ★ prev',  url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/4c93339d8_generated_image.png' },
    { id: 'near_v3', label: 'Biome V1 Near',         url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/80f56b250_generated_image.png' },
    { id: 'near_v4', label: '★ Ground Fog (keyed)', url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/a922a32b8_bg_parallax_03_ground_fog.png' },
    { id: 'near_v5', label: '★ Ground Fog (blue mist)',url: 'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/abf588bcb_ground_fog_fixed.png' },
  ],
  struct: [
    { id: 'struct_none',  label: 'None',                    url: '' },
    { id: 'struct_ruins', label: '★ Ruins + Stakes + Fence', url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/8f8c85f46_struct_ruins_stakes_fence.png' },
    { id: 'struct_wood',  label: '★ Wood Platforms',         url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/ac2276727_struct_wood_platforms.png' },
    { id: 'struct_camp',  label: '★ Camp Props',             url: 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/6d3febbdf_struct_camp_props.png' },
  ],
};

// Active selection per layer — mutated by DevPanel. FAR kept, MID+NEAR = prev group.
export const BG_ACTIVE_IDS = { far: 'far_v8', mid: 'mid_v8', near: 'near_v5', struct: 'struct_none' };

// Hot-swap a layer at runtime — called by DevPanel dropdowns
export function setBgLayer(layer, id) {
  const options = BG_LAYER_CATALOGUE[layer];
  if (!options) return;
  const entry = options.find(o => o.id === id);
  if (!entry) return;
  BG_ACTIVE_IDS[layer] = id;
  if (_bgImages[layer]) {
    _bgImages[layer].src = entry.url;
  } else {
    _bgImages[layer] = new Image();
    _bgImages[layer].src = entry.url;
  }
}

const _bgImages = { far: null, mid: null, near: null };

// ── Title screen background plate — loaded once, persists ────────────────────
let _titleBgImg = null;
const TITLE_BG_URL = 'https://media.base44.com/images/public/6a07d557e104123d6d54764f/7acf53a9b_generated_image.png';
function _getTitleBg() {
  if (!_titleBgImg) {
    _titleBgImg = new Image();
    _titleBgImg.src = TITLE_BG_URL;
  }
  return _titleBgImg;
}
function _loadBgImages() {
  // Load active layer for each slot from catalogue
  for (const layer of ['far', 'mid', 'near', 'struct']) {
    if (!_bgImages[layer]) {
      const activeId = BG_ACTIVE_IDS[layer];
      const entry = BG_LAYER_CATALOGUE[layer]?.find(o => o.id === activeId)
                 || BG_LAYER_CATALOGUE[layer]?.[0];
      if (entry) {
        _bgImages[layer] = new Image();
        _bgImages[layer].src = entry.url;
      }
    }
  }
}

// ── Parallax layer config — each factor is how much of camera movement the layer uses ──
// 0 = pinned to screen, 1.0 = moves with world, >1 = faster than world
const PARALLAX = {
  farSky:       0.0,   // sky gradient — never moves
  sun:          0.03,  // sun drifts almost imperceptibly
  farMountains: 0.06,
  farBackground:0.12,
  midTrees:     0.25,
  vines:        0.20,
  foreground:   0.48,
  fog:          0.04,  // fog barely moves relative to camera
};

// Background layers use a "soft zoom" so they scale with the camera but far less aggressively
// softZoom(zoom) → a gentle scale factor that barely changes even on full zoom-in
function softZoom(zoom) { return 1 + (zoom - 1) * 0.18; }


// ── Wood chunk pickup renderer — stacked log-end faces ────────────────────────
function renderWoodPickups(ctx, woodPickups, camX, camY, zoom) {
  // NOTE: called inside the world-space ctx transform (scale+translate already applied)
  // Draw directly in world coords — no additional transform needed.
  if (!woodPickups || !woodPickups.length) return;

  for (const wp of woodPickups) {
    if (wp.collected) continue;

    const cx = wp.x;
    const cy = wp.y;
    const R  = 7; // log end-face radius in px

    // Log end-face: concentric rings like real cut wood
    // Outer bark ring
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#4a2e0e';
    ctx.fill();

    // Sapwood ring
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = '#7a4f20';
    ctx.fill();

    // Heartwood ring
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#9a6830';
    ctx.fill();

    // Core
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = '#6a4018';
    ctx.fill();

    // Grain lines — 3 radial cracks
    ctx.strokeStyle = '#3a1e08';
    ctx.lineWidth = 0.8;
    for (let a = 0; a < 3; a++) {
      const ang = (a / 3) * Math.PI * 2 + 0.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * R * 0.15, cy + Math.sin(ang) * R * 0.15);
      ctx.lineTo(cx + Math.cos(ang) * R * 0.85, cy + Math.sin(ang) * R * 0.85);
      ctx.stroke();
    }

    // Pickup glow ring when on ground
    if (wp.landed) {
      const pulse = Math.sin(Date.now() * 0.004) * 0.25 + 0.55;
      ctx.globalAlpha = pulse * 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffcc66';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();
}

export function renderGame(ctx, canvas, gameState) {
  const { 
    world, player, hunter, traps, projectiles, particles,
    firePatches, helicopter, treeEntities,
    camera, phase, prepTimer, score, trapSelect, gamePhase,
    wildlife, thermalMode, research, squad, crates, foliage, props, grenadeThrow, mouseWorld,
    woodPickups,
  } = gameState;

  const W = canvas.width;
  const H = canvas.height;

  ctx.imageSmoothingEnabled = false;

  // Init / reinit atmosphere on first frame or resize
  if (_atmosInitW !== W || _atmosInitH !== H) {
    initAtmosphere(W, H);
    _atmosInitW = W; _atmosInitH = H;
  }
  if (gamePhase !== GAME_STATES.TITLE) {
    updateAtmosphere(W, H, 1);
  }

  const camX = camera.x;
  const camY = camera.y;
  const zoom  = camera.zoom || 1;
  const timeOfDay = (Date.now() % 120000) / 120000;

  // ── LAYER 1: Sky gradient — pure screen-space, never moves ──────────────────
  if (RENDER_FLAGS.sky) renderSky(ctx, W, H, timeOfDay, camX);

  // ── LAYER 2–5: Parallax backgrounds — screen-space with soft zoom ────────────
  // These render BEFORE the world transform so they are never affected by game zoom.
  if (gamePhase !== GAME_STATES.TITLE) {
    renderParallaxScreenSpace(ctx, camX, camY, W, H, timeOfDay, zoom);
  }

  // ── Storm darkness / lightning flash — screen space ──────────────────────────
  if (gamePhase !== GAME_STATES.TITLE && gamePhase !== GAME_STATES.INSERTION) {
    if (RENDER_FLAGS.atmosphereBG) renderAtmosphereBG(ctx, W, H, camX, camY);
  }

  // Screen shake offset — applied to canvas before zoom transform so it affects everything
  const shakeOx = gameState.screenShake ? (gameState.screenShake.ox || 0) : 0;
  const shakeOy = gameState.screenShake ? (gameState.screenShake.oy || 0) : 0;

  ctx.save();
  // ── LAYER 6: World gameplay — full zoom transform ────────────────────────────
  // Shake offset applied FIRST at screen-space (before zoom) so it shakes visually
  // but camera.x/y remains stable for correct mouse→world conversion.
  if (shakeOx !== 0 || shakeOy !== 0) ctx.translate(shakeOx, shakeOy);
  ctx.scale(zoom, zoom);
  ctx.translate(-camX, -camY);

  // World tiles
  if (RENDER_FLAGS.tiles) renderTiles(ctx, world.tiles, camX, camY, W, H, zoom);

  // Surface detail scatter — moss, roots, ferns, pebbles on top of terrain
  if (RENDER_FLAGS.tiles) renderSurfaceDetails(ctx, world.tiles, world, camX, camY, W, H, zoom);

  // Falling / fallen trees (under entities)
  if (treeEntities) renderFallingTrees(ctx, treeEntities);
  // Wood chunk pickups — stacked log end-faces on terrain
  if (woodPickups && woodPickups.length) renderWoodPickups(ctx, woodPickups, camX, camY, zoom);

  // Tree variant sprites (decorative background)
  if (gameState.treeVariants) {
    for (const variant of gameState.treeVariants) {
      if (RENDER_FLAGS.trees) renderTreeVariant(ctx, variant, camera);
    }
  }

  // Traps
  if (RENDER_FLAGS.traps) renderTraps(ctx, traps);

  // Weapon crates
  if (crates) {
    for (const crate of crates) {
      renderCrate(ctx, crate, camera);
    }
  }

  // Resource nodes
  renderResourceNodes(ctx, world.resourceNodes);

  // Projectiles
  if (RENDER_FLAGS.projectiles) renderProjectiles(ctx, projectiles);

  // Player — skip until helicopter has handed off position
  if (RENDER_FLAGS.player && player.alive && !(player.inInsertion && !player.isOnRope)) renderPlayer(ctx, player);

  // Grenade trajectory arc (world-space, inside zoom transform)
  if (grenadeThrow && grenadeThrow.active && player.alive) {
    const arcPoints = getGrenadeTrajectoryPoints(player, grenadeThrow, world.tiles, W, H, camera);
    renderGrenadeArc(ctx, arcPoints, camera);
  }

  // Hunter
  if (RENDER_FLAGS.hunter && hunter && (hunter.alive || hunter.selfDestruct)) renderHunter(ctx, hunter);

  // Fire patches
  if (firePatches && firePatches.length > 0) renderFire(ctx, firePatches);

  // Wildlife
  if (wildlife) renderWildlife(ctx, wildlife, thermalMode);

  // Particles
  if (RENDER_FLAGS.particles) renderParticles(ctx, particles);

  // Plasma reticle (world-space, over everything)
  if (hunter && hunter.alive && hunter.aiState === 'attack' && hunter.mode === 'plasma') {
    renderPlasmaReticle(ctx, hunter);
  }

  // Helicopter (renders rope + body in world space)
  // During insertion, always render (skip cull) — helicopter must be visible while zooming
  if (helicopter && !helicopter.done) {
    if (gamePhase === GAME_STATES.INSERTION) {
      // Skip culling entirely during insertion cinematic
      renderHelicopter(ctx, helicopter);
    } else {
      // Normal gameplay: cull based on viewport
      const viewW = W / zoom;
      const viewH = H / zoom;
      const cullPadding = 100;
      const heliInView = helicopter.x + 65 > camX - cullPadding &&
                         helicopter.x - 65 < camX + viewW + cullPadding &&
                         helicopter.y - 65 > camY - cullPadding &&
                         helicopter.y + 50 < camY + viewH + cullPadding;
      if (heliInView) renderHelicopter(ctx, helicopter);
    }
  }

  // Squad members
  if (squad && squad.length > 0) {
    if (RENDER_FLAGS.squad) renderSquad(ctx, squad);
    // Debug overlay (shows AI decisions, jump reasons, cooldowns)
    ctx.restore(); // Exit world transform to render debug in screen space
    if (RENDER_FLAGS.debugOverlays) renderSquadDebugOverlay(ctx, squad, camera);
    if (RENDER_FLAGS.debugOverlays && hunter) renderHunterDebugOverlay(ctx, hunter, camera);
    ctx.save(); // Re-enter world transform for remaining world elements
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);
  }

  // Foliage (destructible plants)
  if (foliage && foliage.length > 0) {
    for (const f of foliage) {
      if (RENDER_FLAGS.foliage) renderFoliage(ctx, f, camX, camY);
    }
  }

  // Props (rocks, logs, etc.)
  if (props && props.length > 0) {
    for (const p of props) {
      renderProp(ctx, p, camX, camY);
    }
  }

  // Leaf resource tiles from fallen canopies
  if (gameState.leafTiles && gameState.leafTiles.length > 0) {
    for (const leafTile of gameState.leafTiles) {
      if (leafTile.collected) continue;
      
      // Draw as a small green leaf/canopy square
      ctx.fillStyle = '#2e6a2e';
      ctx.fillRect(leafTile.x, leafTile.y, leafTile.w, leafTile.h);
      
      // Leaf texture detail
      ctx.fillStyle = '#3a8a2a';
      ctx.fillRect(leafTile.x + 2, leafTile.y + 2, 6, 6);
      ctx.fillRect(leafTile.x + 10, leafTile.y + 6, 4, 4);
      
      // Highlight pulse
      const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 0.3;
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#4aa028';
      ctx.fillRect(leafTile.x + 1, leafTile.y + 1, leafTile.w - 2, leafTile.h - 2);
      ctx.globalAlpha = 1;
    }
  }

  ctx.restore();

  // ── LAYER 8: God rays — screen-space, anchored to sun ────────────────────────
  if (gamePhase !== GAME_STATES.TITLE && gamePhase !== GAME_STATES.INSERTION) {
    if (RENDER_FLAGS.godRays) renderGodRaysScreenSpace(ctx, camX, camY, W, H, timeOfDay, zoom);
  }

  // ── LAYER 8: FG atmosphere (rain, lightning bolt, fog) — pure screen space ───
  if (gamePhase !== GAME_STATES.TITLE && gamePhase !== GAME_STATES.INSERTION) {
    if (RENDER_FLAGS.atmosphereFG) renderAtmosphereFG(ctx, W, H, camX, camY);
  }

  // ── Aim crosshair (screen-space, over world) ──────────────────────────────
  if (gameState.mouseWorld && player.weaponState && player.weaponState.current && gamePhase !== GAME_STATES.TITLE && gamePhase !== GAME_STATES.INSERTION) {
    const sx = (gameState.mouseWorld.x - camX) * zoom;
    const sy = (gameState.mouseWorld.y - camY) * zoom;
    const bloom = Math.max(6, 6 + (player.weaponState.recoilBloom || 0) * 220);
    ctx.save();
    ctx.strokeStyle = '#00ff88';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.85;
    // Crosshair lines
    const gap = 4;
    const arm = 7;
    ctx.beginPath();
    ctx.moveTo(sx - bloom - arm, sy); ctx.lineTo(sx - bloom - gap, sy);
    ctx.moveTo(sx + bloom + gap, sy); ctx.lineTo(sx + bloom + arm, sy);
    ctx.moveTo(sx, sy - bloom - arm); ctx.lineTo(sx, sy - bloom - gap);
    ctx.moveTo(sx, sy + bloom + gap); ctx.lineTo(sx, sy + bloom + arm);
    ctx.stroke();
    // Centre dot
    ctx.fillStyle = '#00ff88';
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Thermal overlay (full-screen, after world restore)
  if (thermalMode && gamePhase !== 'title' && gamePhase !== 'insertion') {
    renderThermalOverlay(ctx, W, H, gameState);
    // Render wildlife in thermal — must use same zoom transform as main world pass
    if (wildlife) {
      ctx.save();
      ctx.scale(zoom, zoom);
      ctx.translate(-camera.x, -camera.y);
      renderWildlife(ctx, wildlife, true);
      ctx.restore();
    }
  }

  // Underwater overlay — only if player is actually in water tiles
  if (player.isInWater && !thermalMode) {
    ctx.fillStyle = 'rgba(50,100,150,0.25)';
    ctx.fillRect(0, 0, W, H);
    // Caustic ripple effect
    if (Math.sin(Date.now() * 0.002) > 0.7) {
      ctx.fillStyle = 'rgba(80,140,180,0.08)';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(W / 2 + Math.sin(Date.now() * 0.001 + i) * 100, H / 2 + Math.cos(Date.now() * 0.001 + i) * 100, 80 + i * 20, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // Mud overlay on screen — heavy coat = strong dirt vignette
  if (player.mudAmount > 0.5 && !thermalMode) {
    const mudAlpha = Math.min(0.38, (player.mudAmount - 0.5) * 0.76);
    ctx.fillStyle = `rgba(30,20,8,${mudAlpha})`;
    ctx.fillRect(0, 0, W, H);
    // Extra concealment indicator at high mud
    if (player.mudAmount >= 0.85) {
      ctx.fillStyle = 'rgba(40,180,60,0.18)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // Mud meter (bottom-left, HUNT phase only)
  if (gamePhase === GAME_STATES.HUNT && player.mudAmount > 0.01) {
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(10, H - 30, 80, 8);
    ctx.strokeStyle = '#7a5a2a';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, H - 30, 80, 8);
    // Mud bar fill
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(10, H - 30, 80 * player.mudAmount, 8);
    // Label
    ctx.fillStyle = '#9a7a4a';
    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillText('MUD', 12, H - 22);
    // Remaining seconds
    const mudSecsRemaining = Math.ceil(player.mudTimer / 60);
    ctx.fillText(`${mudSecsRemaining}s`, 50, H - 22);
  }

  // HUD
  if (RENDER_FLAGS.hud) renderHUD(ctx, W, H, player, hunter, phase, prepTimer, score, trapSelect, gamePhase, helicopter, research, grenadeThrow);
}

function renderSky(ctx, W, H, timeOfDay, camX) {
  // ── Sky preset definitions ────────────────────────────────────────────────
  // Each preset has: gradient stops, cloud config, star/moon visibility,
  // sun params, ambient glow colour
  const SKY_PRESETS = {
    // 0: PREDATOR NIGHT — current look, dark oppressive storm, purple-black
    predatorNight: {
      grad: [
        [0.00, '#080810'],
        [0.18, '#0d0e18'],
        [0.38, '#10121e'],
        [0.58, '#0e1418'],
        [0.78, '#0a1210'],
        [1.00, '#060d08'],
      ],
      ambientGlow: [60, 50, 120],   // purple tint ambient glow
      showStars: true, starCount: 180, starAlpha: 0.85,
      showMoon: true, moonX: 0.72, moonY: 0.14, moonPhase: 0.82,
      showSun: false,
      cloudLayers: [
        { count: 6,  yMin: 0.03, yMax: 0.14, speedMult: 0.7, wMin: 0.18, wMax: 0.32, alpha: 0.12, r:28, g:26, b:44 },
        { count: 9,  yMin: 0.10, yMax: 0.22, speedMult: 0.5, wMin: 0.22, wMax: 0.40, alpha: 0.09, r:20, g:18, b:36 },
        { count: 5,  yMin: 0.20, yMax: 0.32, speedMult: 0.3, wMin: 0.28, wMax: 0.50, alpha: 0.14, r:14, g:14, b:26 },
      ],
      shootingStars: true,
      lightningGlow: true,
    },

    // 1: JUNGLE STORM — bruised purple-green, heavy cloud coverage
    jungleStorm: {
      grad: [
        [0.00, '#060810'],
        [0.20, '#0a0c16'],
        [0.42, '#0e1018'],
        [0.62, '#0c1414'],
        [0.82, '#081210'],
        [1.00, '#050c08'],
      ],
      ambientGlow: [40, 80, 60],
      showStars: false,
      showMoon: false,
      showSun: false,
      cloudLayers: [
        { count: 10, yMin: 0.02, yMax: 0.18, speedMult: 1.4, wMin: 0.24, wMax: 0.44, alpha: 0.22, r:24, g:28, b:40 },
        { count: 8,  yMin: 0.14, yMax: 0.28, speedMult: 1.0, wMin: 0.28, wMax: 0.52, alpha: 0.18, r:18, g:22, b:32 },
        { count: 6,  yMin: 0.24, yMax: 0.38, speedMult: 0.7, wMin: 0.32, wMax: 0.56, alpha: 0.28, r:12, g:16, b:24 },
      ],
      shootingStars: false,
      lightningGlow: true,
    },

    // 2: GOLDEN DUSK — amber horizon, deep purple zenith, Predator movie look
    goldenDusk: {
      grad: [
        [0.00, '#0c0814'],
        [0.22, '#1a0e20'],
        [0.45, '#2a1218'],
        [0.65, '#3a1e10'],
        [0.80, '#4a2e0a'],
        [0.92, '#3a2208'],
        [1.00, '#0e1008'],
      ],
      ambientGlow: [200, 80, 20],
      showStars: true, starCount: 80, starAlpha: 0.45,
      showMoon: false,
      showSun: true, sunX: 0.62, sunY: 0.72,
      sunColor: [255, 140, 40],
      sunHaloColor: [255, 80, 10],
      sunRadius: 0.032,
      cloudLayers: [
        { count: 7,  yMin: 0.04, yMax: 0.20, speedMult: 0.6, wMin: 0.16, wMax: 0.30, alpha: 0.18, r:80, g:40, b:20 },
        { count: 5,  yMin: 0.16, yMax: 0.32, speedMult: 0.4, wMin: 0.22, wMax: 0.40, alpha: 0.14, r:60, g:30, b:15 },
      ],
      shootingStars: false,
      lightningGlow: false,
    },

    // 3: DEEP NIGHT MIST — near pure black, heavy ground fog, stars crisp
    deepNightMist: {
      grad: [
        [0.00, '#04050c'],
        [0.25, '#060810'],
        [0.50, '#080c12'],
        [0.72, '#080e0e'],
        [0.88, '#060c0a'],
        [1.00, '#040806'],
      ],
      ambientGlow: [20, 30, 60],
      showStars: true, starCount: 240, starAlpha: 0.95,
      showMoon: true, moonX: 0.55, moonY: 0.12, moonPhase: 0.95,
      showSun: false,
      cloudLayers: [
        { count: 4,  yMin: 0.06, yMax: 0.18, speedMult: 0.25, wMin: 0.14, wMax: 0.26, alpha: 0.06, r:16, g:16, b:28 },
        { count: 3,  yMin: 0.18, yMax: 0.28, speedMult: 0.18, wMin: 0.18, wMax: 0.32, alpha: 0.05, r:10, g:12, b:22 },
      ],
      groundMist: true,
      shootingStars: true,
      lightningGlow: false,
    },

    // 4: BLOOD MOON — deep crimson-black, apocalyptic, Hunter approaching
    bloodMoon: {
      grad: [
        [0.00, '#060408'],
        [0.20, '#0e0608'],
        [0.42, '#140810'],
        [0.62, '#18060c'],
        [0.80, '#140808'],
        [1.00, '#080608'],
      ],
      ambientGlow: [120, 10, 20],
      showStars: true, starCount: 140, starAlpha: 0.70,
      showMoon: true, moonX: 0.60, moonY: 0.15, moonPhase: 1.0,
      moonTint: [220, 40, 20],
      showSun: false,
      cloudLayers: [
        { count: 8,  yMin: 0.04, yMax: 0.20, speedMult: 0.8, wMin: 0.20, wMax: 0.38, alpha: 0.16, r:40, g:10, b:18 },
        { count: 6,  yMin: 0.16, yMax: 0.30, speedMult: 0.5, wMin: 0.24, wMax: 0.44, alpha: 0.22, r:28, g:6, b:14 },
      ],
      shootingStars: false,
      lightningGlow: true,
    },
  };

  // ── Active preset — driven by atmosphere weather state ──────────────────────
  // Pull current weather blends to pick / interpolate preset
  let presetName = 'predatorNight';
  try {
    const blends = getWeatherBlends();
    const storm = blends.storm || 0;
    const clear = blends.clear || 0;
    // Override via global skyPresetOverride if set from Dev Panel
    if (typeof window !== 'undefined' && window._skyPreset) {
      presetName = window._skyPreset;
    } else if (storm > 0.6) {
      presetName = 'jungleStorm';
    } else if (storm > 0.2) {
      presetName = 'predatorNight';
    } else {
      presetName = 'deepNightMist';
    }
  } catch(e) { /* getWeatherBlends not available yet */ }

  const P = SKY_PRESETS[presetName] || SKY_PRESETS.predatorNight;
  const now = Date.now();
  const t = now * 0.001;  // seconds

  // ── 1. Sky gradient ─────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  for (const [stop, col] of P.grad) grad.addColorStop(stop, col);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── 2. Ambient glow — diffuse light source behind clouds ────────────────────
  const [ar, ag, ab] = P.ambientGlow;
  const glowX = W * 0.55 + Math.sin(t * 0.08) * 40;
  const glowGrad = ctx.createRadialGradient(glowX, H * 0.10, 0, glowX, H * 0.18, W * 0.52);
  glowGrad.addColorStop(0,   `rgba(${ar},${ag},${ab},0.10)`);
  glowGrad.addColorStop(0.4, `rgba(${ar},${ag},${ab},0.04)`);
  glowGrad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, W, H * 0.65);

  // ── 3. Stars — deterministic positions, twinkle, rotating field ─────────────
  if (P.showStars) {
    // Stars stored as module-level singleton to avoid re-creation each frame
    if (!renderSky._stars || renderSky._stars.length !== P.starCount) {
      renderSky._stars = Array.from({ length: P.starCount }, (_, i) => {
        const angle = (i / P.starCount) * Math.PI * 2;
        const dist  = 0.1 + ((i * 7919 + 3141) % 8192) / 8192 * 0.9;
        const size  = i % 18 === 0 ? 2 : 1;
        const twinkleSpeed = 0.5 + ((i * 6271) % 1000) / 1000 * 2.5;
        const baseAlpha    = 0.3 + ((i * 1031) % 1000) / 1000 * 0.7;
        // Star colour: mostly white-blue, occasional warm white
        const warm = i % 11 === 0;
        return { angle, dist, size, twinkleSpeed, baseAlpha, twinkleOffset: i * 0.7,
                 r: warm ? 255 : 200 + (i%55), g: warm ? 220 : 200 + (i%40), b: warm ? 160 : 255 };
      });
      renderSky._starRotation = 0;
    }
    renderSky._starRotation += 0.00008;  // very slow drift

    const starAlpha = P.starAlpha;
    const cx = W * 0.5, cy = H * 0.22;
    const spread = Math.min(W, H) * 0.55;

    ctx.save();
    renderSky._stars.forEach(s => {
      const rotated = s.angle + renderSky._starRotation;
      const sx = cx + Math.cos(rotated) * s.dist * spread;
      const sy = cy + Math.sin(rotated) * s.dist * spread * 0.45;
      if (sy < 0 || sy > H * 0.55) return;  // clip to sky zone
      const twinkle = 0.4 + Math.sin(t * s.twinkleSpeed + s.twinkleOffset) * 0.6;
      const a = starAlpha * twinkle * s.baseAlpha;
      ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${a.toFixed(2)})`;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), s.size, s.size);
      // Tiny cross flare on brightest stars
      if (s.size === 2 && a > 0.5) {
        ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${(a*0.35).toFixed(2)})`;
        ctx.fillRect(Math.floor(sx)-1, Math.floor(sy), 4, 1);
        ctx.fillRect(Math.floor(sx), Math.floor(sy)-1, 1, 3);
      }
    });
    ctx.restore();
  }

  // ── 4. Shooting stars ────────────────────────────────────────────────────────
  if (P.shootingStars) {
    if (!renderSky._shootingStars) renderSky._shootingStars = [];
    if (!renderSky._nextShootTimer) renderSky._nextShootTimer = 6 + Math.random() * 10;
    renderSky._nextShootTimer -= 0.016;
    if (renderSky._nextShootTimer <= 0 && P.showStars) {
      renderSky._nextShootTimer = 5 + Math.random() * 12;
      renderSky._shootingStars.push({
        x: Math.random() * W, y: Math.random() * H * 0.3,
        vx: 180 + Math.random() * 120, vy: 60 + Math.random() * 80,
        len: 80 + Math.random() * 120, life: 1.0, maxLife: 1.0,
        alpha: 0.6 + Math.random() * 0.4,
      });
    }
    renderSky._shootingStars = renderSky._shootingStars.filter(s => {
      s.x += s.vx * 0.016; s.y += s.vy * 0.016; s.life -= 0.016 / 0.8;
      if (s.life <= 0 || s.x > W + 100) return false;
      const a = (s.life / s.maxLife) * s.alpha * (P.starAlpha || 0.8);
      const tailX = s.x - (s.vx / Math.hypot(s.vx, s.vy)) * s.len * (1 - s.life/s.maxLife) * 0.5;
      const tailY = s.y - (s.vy / Math.hypot(s.vx, s.vy)) * s.len * (1 - s.life/s.maxLife) * 0.5;
      const sg = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      sg.addColorStop(0, `rgba(255,255,220,${a.toFixed(2)})`);
      sg.addColorStop(1, 'rgba(255,255,200,0)');
      ctx.strokeStyle = sg;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(tailX, tailY); ctx.stroke();
      return true;
    });
  }

  // ── 5. Moon ──────────────────────────────────────────────────────────────────
  if (P.showMoon) {
    const mx = W * P.moonX, my = H * P.moonY;
    const moonR = Math.min(W, H) * 0.036;
    const [mr, mg, mb] = P.moonTint || [230, 222, 185];

    // Moon glow halo
    const mGlow = ctx.createRadialGradient(mx, my, moonR*0.5, mx, my, moonR*3.5);
    mGlow.addColorStop(0,   `rgba(${mr},${mg},${mb},0.18)`);
    mGlow.addColorStop(0.5, `rgba(${mr},${mg},${mb},0.05)`);
    mGlow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = mGlow;
    ctx.fillRect(mx-moonR*4, my-moonR*4, moonR*8, moonR*8);

    // Pixel moon body — row-by-row for pixel art feel
    const steps = Math.ceil(moonR * 2);
    for (let i = 0; i <= steps; i++) {
      const ry = my - moonR + i * (moonR*2/steps);
      const dist = ry - my;
      const hw = Math.sqrt(Math.max(0, moonR*moonR - dist*dist));
      // Crescent shadow (phase)
      const shadowX = mx + moonR * (P.moonPhase * 0.8 - 0.4);
      ctx.fillStyle = `rgba(${mr},${mg},${mb},0.92)`;
      ctx.fillRect(Math.floor(mx-hw), Math.floor(ry), Math.ceil(hw*2), Math.max(1, Math.ceil(moonR*2/steps)));
      // Shadow overlay for crescent effect
      const shadowHW = Math.sqrt(Math.max(0, moonR*moonR*0.7*0.7 - dist*dist));
      if (shadowHW > 0) {
        const shadowStart = P.moonPhase > 0.5 ? shadowX - shadowHW : mx - shadowHW;
        ctx.fillStyle = 'rgba(0,0,0,0.88)';
        ctx.fillRect(Math.floor(shadowStart), Math.floor(ry), Math.ceil(shadowHW*2), Math.max(1, Math.ceil(moonR*2/steps)));
      }
    }
    // Crater dots
    ctx.fillStyle = `rgba(${mr-50},${mg-50},${mb-45},0.55)`;
    ctx.fillRect(Math.floor(mx - moonR*0.3), Math.floor(my - moonR*0.2), 3, 3);
    ctx.fillRect(Math.floor(mx + moonR*0.2), Math.floor(my + moonR*0.1), 2, 2);
    ctx.fillRect(Math.floor(mx - moonR*0.1), Math.floor(my + moonR*0.3), 2, 2);
  }

  // ── 6. Sun (dusk preset) ─────────────────────────────────────────────────────
  if (P.showSun) {
    const sx = W * P.sunX, sy = H * P.sunY;
    const sunR = Math.min(W,H) * P.sunRadius;
    const [sr, sg, sb] = P.sunColor || [255, 180, 60];
    const [hr, hg, hb] = P.sunHaloColor || [255, 80, 10];

    // Halo glow
    const haloR = sunR * 4.5;
    const sunGlow = ctx.createRadialGradient(sx, sy, sunR*0.5, sx, sy, haloR);
    sunGlow.addColorStop(0,   `rgba(${sr},${sg},${sb},0.55)`);
    sunGlow.addColorStop(0.25,`rgba(${hr},${hg},${hb},0.30)`);
    sunGlow.addColorStop(0.6, `rgba(${hr},${hg},${hb},0.10)`);
    sunGlow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sx-haloR, sy-haloR, haloR*2, haloR*2);

    // Pixel sun body
    const steps = Math.ceil(sunR*2);
    for (let i = 0; i <= steps; i++) {
      const ry = sy - sunR + i * (sunR*2/steps);
      const dist = ry - sy;
      const hw = Math.sqrt(Math.max(0, sunR*sunR - dist*dist));
      const frac = i/steps;
      const r2 = Math.round(sr * (1-frac) + hr * frac);
      const g2 = Math.round(sg * (1-frac) + hg * frac);
      const b2 = Math.round(sb * (1-frac) + hb * frac);
      ctx.fillStyle = `rgb(${r2},${g2},${b2})`;
      ctx.fillRect(Math.floor(sx-hw), Math.floor(ry), Math.ceil(hw*2), Math.max(1, Math.ceil(sunR*2/steps)));
    }

    // Horizon colour column below sun
    const colGrad = ctx.createLinearGradient(sx, sy+sunR, sx, H*0.62);
    colGrad.addColorStop(0, `rgba(${sr},${Math.floor(sg*0.6)},${Math.floor(sb*0.3)},0.28)`);
    colGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = colGrad;
    ctx.fillRect(sx-sunR*2, sy+sunR, sunR*4, H*0.62 - sy - sunR);
  }

  // ── 7. Multi-layer pixel clouds ──────────────────────────────────────────────
  if (!renderSky._clouds || renderSky._lastPreset !== presetName) {
    renderSky._clouds = P.cloudLayers.map(cfg => 
      Array.from({ length: cfg.count }, (_, i) => ({
        x: Math.random(),
        y: cfg.yMin + Math.random() * (cfg.yMax - cfg.yMin),
        w: cfg.wMin + Math.random() * (cfg.wMax - cfg.wMin),
        h: 0.010 + Math.random() * 0.022,
        speed: (0.00008 + Math.random() * 0.00012) * cfg.speedMult,
        alpha: cfg.alpha * (0.7 + Math.random() * 0.6),
        cfg,
      }))
    );
    renderSky._lastPreset = presetName;
  }

  // Drift clouds
  renderSky._clouds.forEach((layer, li) => {
    layer.forEach(c => {
      c.x += c.speed;
      if (c.x > 1.6) c.x = -0.6;
    });
  });

  // Draw clouds — 3 horizontal ellipse blobs per cloud, stacked
  renderSky._clouds.forEach((layer, li) => {
    layer.forEach(c => {
      const { r, g, b } = c.cfg;
      const cx = c.x * W, cy = c.y * H;
      const cw = c.w * W,  ch = c.h * H;
      // Multi-blob cloud shape
      const blobs = [
        { ox: 0,      ow: cw,       oh: ch,       a: c.alpha },
        { ox: cw*0.22, ow: cw*0.65, oh: ch*0.75,  a: c.alpha*0.75 },
        { ox:-cw*0.18, ow: cw*0.55, oh: ch*0.65,  a: c.alpha*0.60 },
      ];
      blobs.forEach(b2 => {
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.99,b2.a).toFixed(2)})`;
        // Pixel-art ellipse: render as stacked rectangles
        const rw = b2.ow * 0.5, rh = b2.oh * 0.5;
        const bx = cx + b2.ox, by = cy;
        const pxRows = Math.max(2, Math.ceil(rh * 2));
        for (let row = 0; row < pxRows; row++) {
          const dy = -rh + row * (rh*2/pxRows);
          const hw2 = Math.sqrt(Math.max(0, rw*rw - dy*dy*(rw*rw/(rh*rh))));
          ctx.fillRect(Math.floor(bx-hw2), Math.floor(by+dy), Math.ceil(hw2*2), Math.max(1, Math.ceil(rh*2/pxRows)));
        }
      });
    });
  });

  // ── 8. Ground mist (deepNightMist preset) ───────────────────────────────────
  if (P.groundMist) {
    const mistY = H * 0.68;
    const mistGrad = ctx.createLinearGradient(0, mistY-20, 0, mistY+70);
    mistGrad.addColorStop(0,   'rgba(8,18,12,0)');
    mistGrad.addColorStop(0.35,'rgba(10,22,14,0.16)');
    mistGrad.addColorStop(1,   'rgba(6,14,10,0.08)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, mistY-20, W, 90);
  }

  // ── 9. Lightning atmosphere flash ───────────────────────────────────────────
  if (P.lightningGlow) {
    try {
      const blends = getWeatherBlends();
      if (blends.storm > 0.1) {
        const ltFlash = getLightningFlash?.() || 0;
        if (ltFlash > 0.02) {
          ctx.fillStyle = `rgba(200,220,255,${(ltFlash * 0.08).toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
        }
      }
    } catch(e) {}
  }
}

// ── Screen-space parallax renderer ──────────────────────────────────────────
// All layers draw in screen coordinates (0,0 = top-left of canvas).
// Layer X position = -((camX * parallaxFactor) % period)   — no zoom scaling.
// Soft zoom scales layer sizes very gently so they feel cohesive with the world.
function renderParallaxScreenSpace(ctx, camX, camY, W, H, tod, zoom) {
  _loadBgImages();
  const sz = softZoom(zoom);

  // Helper: draw a bg image layer tiled/stretched to fill screen width,
  // anchored to bottom at yAnchor, scrolling at parallaxFactor of camX.
  function drawBgLayer(img, parallaxFactor, yAnchorFrac, heightFrac, alpha, blendMode) {
    if (!img || !img.complete || !img.naturalWidth) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (blendMode) ctx.globalCompositeOperation = blendMode;

    const layerH = H * heightFrac * sz;
    const layerW = layerH * (img.naturalWidth / img.naturalHeight);
    const anchorY = H * yAnchorFrac;  // where bottom of image lands
    const drawY   = anchorY - layerH;

    // Parallax scroll offset
    const scrollX = -(camX * parallaxFactor) % layerW;

    // Tile horizontally so no gap appears when scrolling
    const tilesNeeded = Math.ceil(W / layerW) + 2;
    const startTile   = Math.floor(scrollX / layerW) - 1;

    for (let t = startTile; t < startTile + tilesNeeded; t++) {
      const dx = t * layerW + (scrollX % layerW);
      ctx.drawImage(img, dx, drawY, layerW, layerH);
    }
    ctx.restore();
  }

  // ── FAR BG — distant storm silhouettes, parallax 0.06 ────────────────────
  if (RENDER_FLAGS.bgFar) {
    drawBgLayer(_bgImages.far, 0.06, 0.92, 0.82, 0.90, null);
  }

  // ── Procedural far mountains / distant canopy horizon (fallback proc layer) ──
  if (RENDER_FLAGS.farMountains) {
    renderFarMountainsScreenSpace(ctx, camX, camY, W, H, tod, sz);
  }

  // ── MID BG — large trees, ruins, midground, parallax 0.18 ────────────────
  if (RENDER_FLAGS.bgMid) {
    drawBgLayer(_bgImages.mid, 0.18, 0.96, 0.88, 0.92, null);
  }

  // ── MID procedural trees (behind gameplay but in front of mid image) ──────
  if (RENDER_FLAGS.midTrees) {
    renderMidTreesScreenSpace(ctx, camX, camY, W, H, tod, sz);
  }

  // ── NEAR BG — foreground vines, fog, close atmospheric elements ──────────
  if (RENDER_FLAGS.bgNear) {
    drawBgLayer(_bgImages.near, 0.32, 1.02, 0.72, 0.78, null);
  }

  // ── STRUCT overlay — keyed art sheets (camp props, ruins, wood platforms) ──
  if (RENDER_FLAGS.bgNear && _bgImages.struct && _bgImages.struct.complete && _bgImages.struct.naturalWidth > 0) {
    const sEntry = BG_LAYER_CATALOGUE.struct?.find(o => o.id === BG_ACTIVE_IDS.struct);
    if (sEntry && sEntry.url) {
      drawBgLayer(_bgImages.struct, 0.30, 1.0, 0.75, 1.0, 'source-over');
    }
  }

  // ── NEAR procedural vines ────────────────────────────────────────────────
  if (RENDER_FLAGS.vines) {
    renderVinesScreenSpace(ctx, camX, camY, W, H, sz);
  }

  // ── Ground fog layer — slow drift, anchored near terrain top ─────────────
  {
    const fogY = H * 0.72;
    const fogGrad = ctx.createLinearGradient(0, fogY - 40, 0, fogY + 60);
    fogGrad.addColorStop(0,   'rgba(8,16,8,0)');
    fogGrad.addColorStop(0.4, 'rgba(10,20,12,0.18)');
    fogGrad.addColorStop(1,   'rgba(8,14,8,0.08)');
    ctx.fillStyle = fogGrad;
    ctx.fillRect(0, fogY - 40, W, 100);
  }
}

function _drawMountain(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w * 0.38, y - h);
  ctx.lineTo(x + w * 0.55, y - h * 0.85);
  ctx.lineTo(x + w, y);
  ctx.fill();
}

function _drawJungleSilhouette(ctx, x, y, h, detail) {
  // Trunk
  ctx.fillRect(x - 3, y - h * 0.6, 5, h * 0.6);
  // Canopy blobs
  for (let j = 0; j < 3; j++) {
    ctx.beginPath();
    ctx.arc(x + (j - 1) * 12, y - h * (0.7 + j * 0.08), 14 + j * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function _drawPalmSilhouette(ctx, x, y, h) {
  // Trunk — slight lean
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + h * 0.12, y - h);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.stroke();
  // Palm fronds
  for (let j = 0; j < 5; j++) {
    const ang = (j / 5) * Math.PI - Math.PI * 0.15;
    const flen = 18 + Math.sin(j * 1.3) * 8;
    ctx.beginPath();
    ctx.moveTo(x + h * 0.12, y - h);
    ctx.lineTo(
      x + h * 0.12 + Math.cos(ang) * flen,
      y - h + Math.sin(ang) * flen * 0.5
    );
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function _drawForegroundLeafClump(ctx, x, y, s) {
  for (let j = 0; j < 4; j++) {
    const ox = (j - 1.5) * s * 0.4;
    const oy = Math.sin(j * 1.1) * s * 0.25;
    ctx.beginPath();
    ctx.ellipse(x + ox, y + oy, s * 0.55, s * 0.32, -0.4 + j * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Surface detail scatter — decorative sprites on top of exposed ground tiles
function renderSurfaceDetails(ctx, tiles, world, camX, camY, W, H, zoom) {
  const T = TILE_SIZE;
  const viewW = W / zoom;
  const startX = Math.max(0, Math.floor(camX / T) - 1);
  const endX   = Math.min(WORLD_WIDTH,  Math.ceil((camX + viewW) / T) + 1);
  const startY = Math.max(1, Math.floor(camY / T) - 1);
  const endY   = Math.min(WORLD_HEIGHT-1, Math.ceil((camY + (H/zoom)) / T) + 1);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = tiles[y][x];
      if (tile === TILE.AIR) continue;
      const topFree = tiles[y-1]?.[x] === TILE.AIR;
      if (!topFree) continue;

      const px = x * T;
      const py = y * T;
      // Deterministic hash — never flickers
      const h  = ((x * 7919 + y * 6271) & 0x7fff) / 0x7fff;
      const h2 = ((x * 6271 + y * 1031) & 0x7fff) / 0x7fff;
      const h3 = ((x * 1031 + y * 7919) & 0x7fff) / 0x7fff;
      const hi = (x * 7919 + y * 6271) & 0x7fff;  // integer version

      // ── Grass blade clusters (every grass/dirt surface tile) ────────────────
      if (tile === TILE.GRASS || tile === TILE.DIRT) {
        const bladeCount = 2 + (hi % 3);
        for (let b = 0; b < bladeCount; b++) {
          const bHashX = ((x*3517 + y*2311 + b*1789) & 0x7fff) / 0x7fff;
          const bHashY = ((x*2311 + y*1789 + b*3517) & 0x7fff) / 0x7fff;
          const bHashL = ((x*1789 + y*3517 + b*2311) & 0x7fff) / 0x7fff;
          const bx = px + 1 + Math.floor(bHashX * (T-4));
          const bh = 5 + Math.floor(bHashY * 8);
          const lean = Math.floor(bHashL * 5) - 2;
          const shade = b % 3 === 0 ? '#1e4a0c' : b % 3 === 1 ? '#2e6010' : '#4e8e1e';
          ctx.strokeStyle = shade;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, py);
          ctx.lineTo(bx + lean, py - bh);
          ctx.stroke();
        }
      }

      // ── Fern fronds (grass tiles, ~1 in 6) ─────────────────────────────────
      if (tile === TILE.GRASS && hi % 6 === 0) {
        const fx = px + 1 + Math.floor(h2 * 9);
        ctx.strokeStyle = '#164a08';
        ctx.lineWidth = 1;
        // Left frond
        ctx.beginPath(); ctx.moveTo(fx+3,py); ctx.quadraticCurveTo(fx-2,py-8,fx-6,py-14); ctx.stroke();
        // Right frond
        ctx.beginPath(); ctx.moveTo(fx+3,py); ctx.quadraticCurveTo(fx+8,py-8,fx+12,py-14); ctx.stroke();
        // Centre stalk
        ctx.beginPath(); ctx.moveTo(fx+3,py); ctx.lineTo(fx+3,py-15); ctx.stroke();
        // Leaflets on fronds
        ctx.strokeStyle = '#245e10';
        for (let f = 1; f < 4; f++) {
          const t2 = f/4;
          ctx.beginPath();
          ctx.moveTo(fx - Math.floor(t2*4), py - Math.floor(t2*11));
          ctx.lineTo(fx - Math.floor(t2*4) - 4, py - Math.floor(t2*11) - 3);
          ctx.stroke();
        }
      }

      // ── Mossy rocks (dirt/stone/grass, ~1 in 7) ─────────────────────────────
      if (hi % 7 === 0 && (tile === TILE.DIRT || tile === TILE.STONE || tile === TILE.GRASS)) {
        const rx = px + Math.floor(h2 * 7) + 1;
        const rw = 7 + Math.floor(h3 * 7);
        const rh = 5 + Math.floor(h * 5);
        // Rock shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(rx+1, py-rh+4, rw, rh-1);
        // Rock body
        const rv = 38 + Math.floor(h * 22);
        ctx.fillStyle = `rgb(${rv},${Math.floor(rv*0.95)},${Math.floor(rv*0.88)})`;
        ctx.fillRect(rx, py-rh+2, rw, rh);
        // Top highlight
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(rx+1, py-rh+2, rw-2, 2);
        // Moss cap — lush green matching reference
        ctx.fillStyle = `rgba(${14+Math.floor(h*8)},${52+Math.floor(h2*24)},${8+Math.floor(h3*8)},0.8)`;
        ctx.fillRect(rx+1, py-rh+2, rw-2, 3);
        ctx.fillStyle = `rgba(20,62,10,0.5)`;
        ctx.fillRect(rx+2, py-rh+5, Math.floor(rw*0.6), 2);
      }

      // ── Root tendrils on dirt/stone (1 in 9) ───────────────────────────────
      if (hi % 9 === 0 && (tile === TILE.DIRT || tile === TILE.STONE)) {
        ctx.strokeStyle = `rgba(${52+Math.floor(h2*28)},${24+Math.floor(h*16)},${6},0.7)`;
        ctx.lineWidth = 1;
        const rx = px + Math.floor(h * T * 0.75);
        ctx.beginPath();
        ctx.moveTo(rx, py);
        ctx.quadraticCurveTo(rx + Math.floor(h3*8)-4, py-6, rx + Math.floor(h2*10)-5, py-13);
        ctx.stroke();
        if (h2 > 0.45) {
          ctx.beginPath();
          ctx.moveTo(rx, py-5);
          ctx.lineTo(rx + Math.floor(h*6)-3, py-9);
          ctx.stroke();
        }
      }

      // ── Mushroom cluster (damp tiles, ~1 in 19) ─────────────────────────────
      if (hi % 19 === 0) {
        const mx = px + 2 + Math.floor(h2 * 9);
        ctx.fillStyle = '#a8988a'; ctx.fillRect(mx, py-5, 2, 5);
        ctx.fillStyle = hi%3===0 ? '#7a2010' : '#aa3e20';
        ctx.fillRect(mx-2, py-8, 6, 3);
        ctx.fillStyle = 'rgba(255,240,200,0.6)';
        ctx.fillRect(mx-1, py-8, 1, 1); ctx.fillRect(mx+2, py-7, 1, 1);
        if (h3 > 0.55) {
          ctx.fillStyle = '#988878'; ctx.fillRect(mx+7, py-3, 1, 3);
          ctx.fillStyle = '#6a1c0c'; ctx.fillRect(mx+6, py-5, 3, 2);
        }
      }

      // ── Pebble scatter (stone/dirt, ~1 in 5) ───────────────────────────────
      if (hi % 5 === 0 && (tile === TILE.STONE || tile === TILE.DIRT)) {
        for (let p = 0; p < 2; p++) {
          const ph  = ((x*3517 + y*2311 + p*1789) & 0x7fff) / 0x7fff;
          const ph2 = ((x*2311 + y*1789 + p*3517) & 0x7fff) / 0x7fff;
          const ps  = 2 + Math.floor(ph * 3);
          const pv  = 44 + Math.floor(ph * 26);
          ctx.fillStyle = `rgb(${pv},${Math.floor(pv*0.94)},${Math.floor(pv*0.88)})`;
          ctx.fillRect(px + Math.floor(ph * (T-ps)), py - ps + T - 1, ps, ps);
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(px + Math.floor(ph * (T-ps)), py - ps + T - 1, ps, 1);
        }
      }

      // ── Bamboo stalks (grass, ~1 in 11) ─────────────────────────────────────
      if (tile === TILE.GRASS && hi % 11 === 0) {
        const bx = px + Math.floor(h2 * 11) + 1;
        const bHeight = 20 + Math.floor(h3 * 16);
        ctx.fillStyle = '#264a10';
        ctx.fillRect(bx, py-bHeight, 3, bHeight);
        ctx.fillStyle = '#162e08';
        for (let n = 5; n < bHeight; n += 6) ctx.fillRect(bx, py-n, 3, 1);
        ctx.strokeStyle = '#306012';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx+1,py-bHeight); ctx.lineTo(bx+7,py-bHeight-6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(bx+1,py-bHeight); ctx.lineTo(bx-5,py-bHeight-5); ctx.stroke();
      }

      // ── Hanging vine tendrils from wood/bridge tiles ─────────────────────────
      if ((tile === TILE.WOOD || tile === TILE.BRIDGE) && hi % 5 === 0) {
        const vx = px + Math.floor(h2 * 12) + 1;
        const vlen = 9 + Math.floor(h3 * 14);
        ctx.strokeStyle = 'rgba(20,48,10,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(vx, py+T); ctx.lineTo(vx + Math.floor(h*4)-2, py+T+vlen); ctx.stroke();
        ctx.fillStyle = '#1e4208';
        ctx.fillRect(vx-1, py+T+Math.floor(vlen*0.55), 3, 2);
      }

      // ── Stone ruin fragment on stone surface ─────────────────────────────────
      if (tile === TILE.STONE && hi % 13 === 0) {
        const sw = 6 + Math.floor(h2 * 8);
        const sf = 28 + Math.floor(h * 16);
        ctx.fillStyle = `rgba(${sf},${sf+2},${sf+6},0.8)`;
        ctx.fillRect(px + Math.floor(h3 * 7), py-5, sw, 5);
        ctx.fillStyle = 'rgba(18,48,8,0.55)';
        ctx.fillRect(px + Math.floor(h3 * 7)+1, py-5, Math.floor(sw*0.55), 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(px + Math.floor(h3 * 7), py-1, sw, 1);
      }
    }
  }
}


function renderTiles(ctx, tiles, camX, camY, W, H, zoom) {
  const viewW = W / zoom;
  const viewH = H / zoom;
  const startX = Math.max(0, Math.floor(camX / TILE_SIZE) - 2);
  const endX   = Math.min(WORLD_WIDTH,  Math.ceil((camX + viewW) / TILE_SIZE) + 2);
  const startY = Math.max(0, Math.floor(camY / TILE_SIZE) - 2);
  const endY   = Math.min(WORLD_HEIGHT, Math.ceil((camY + viewH) / TILE_SIZE) + 2);
  const T = TILE_SIZE;

  const isSolidTile = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= WORLD_WIDTH || ty >= WORLD_HEIGHT) return true;
    return tiles[ty][tx] !== TILE.AIR;
  };

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = tiles[y][x];
      if (tile === TILE.AIR) continue;

      const px = x * T;
      const py = y * T;

      // Deterministic hashes — 0..0x7fff range, normalised
      const h  = ((x * 7919 + y * 6271) & 0x7fff) / 0x7fff;
      const h2 = ((x * 6271 + y * 1031) & 0x7fff) / 0x7fff;

      const topExposed   = !isSolidTile(x, y - 1);
      const botExposed   = !isSolidTile(x, y + 1);
      const leftExposed  = !isSolidTile(x - 1, y);
      const rightExposed = !isSolidTile(x + 1, y);
      const depth = y;  // 0 = top of world, increases downward

      // ── Depth darkening — heavier deeper you go ─────────────────────────────
      // Reference: surface is medium dark, underground is near-black
      // Starts darkening from row 8, maxes at 60% at very deep
      const darkenAlpha = depth > 20 ? Math.min(0.28, (depth - 20) * 0.022) : 0;

      switch (tile) {

        // ── GRASS tile ─────────────────────────────────────────────────────────
        // Grass in Killbox = earth body with green top surface only when top is exposed
        case TILE.GRASS: {
          // Earth body — varies by depth
          const dIdx = depth > 16 ? 2 : depth > 9 ? 1 : (h > 0.5 ? 0 : 1);
          _drawTile(ctx, dIdx, px, py, T, x, y);
          if (darkenAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${darkenAlpha.toFixed(2)})`;
            ctx.fillRect(px, py, T, T);
          }

          if (topExposed) {
            // Draw grass surface cap
            _drawTile(ctx, 3, px, py, T, x, y);

            // Multi-layer grass blades rising above tile
            // Back layer — darkest, tallest
            for (let bx = 0; bx < T; bx += 3) {
              const bh = 5 + ((h*100 + bx*7) % 5 | 0);
              ctx.fillStyle = '#1a3a0c';
              ctx.fillRect(px + bx, py - bh, 1, bh);
            }
            // Mid layer
            for (let bx = 1; bx < T; bx += 4) {
              const bh = 7 + ((h*100 + bx*5) % 5 | 0);
              ctx.fillStyle = '#2a5214';
              ctx.fillRect(px + bx, py - bh, 1, bh);
              ctx.fillStyle = '#3a6e1a';
              ctx.fillRect(px + bx, py - bh, 1, 2);
            }
            // Front tips — brightest green, shortest
            for (let bx = 0; bx < T; bx += 5) {
              const bh = 4 + ((h*100 + bx*3) % 4 | 0);
              ctx.fillStyle = '#4e8e1e';
              ctx.fillRect(px + bx + 1, py - bh, 1, 2);
              ctx.fillStyle = '#62ae26';
              ctx.fillRect(px + bx + 1, py - bh, 1, 1);
            }

            // Moss blob on surface
            if ((h*100|0) % 4 === 0) {
              ctx.fillStyle = 'rgba(18,44,6,0.55)';
              ctx.fillRect(px + ((h2*100|0) % 8), py, 4 + ((h*100|0)%5), 3);
            }
          }

          // Exposed left face — dark earth cliff
          if (leftExposed) {
            ctx.fillStyle = 'rgb(40,20,8)';
            ctx.fillRect(px, py, 2, T);
            // Root tendrils
            if ((h*100|0) % 5 === 0) {
              ctx.fillStyle = 'rgb(30,14,5)';
              ctx.fillRect(px, py+3, 3, 1);
              ctx.fillRect(px, py+9, 2, 1);
            }
          }
          if (rightExposed) {
            ctx.fillStyle = 'rgb(40,20,8)';
            ctx.fillRect(px+T-2, py, 2, T);
          }
          break;
        }

        // ── DIRT tile ──────────────────────────────────────────────────────────
        case TILE.DIRT: {
          const dIdx = depth > 18 ? 2 : depth > 10 ? 1 : (h > 0.5 ? 0 : 1);
          _drawTile(ctx, dIdx, px, py, T, x, y);
          if (darkenAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${darkenAlpha.toFixed(2)})`;
            ctx.fillRect(px, py, T, T);
          }

          // Embedded rock fragment
          if ((h*100|0) % 7 === 0) {
            const rv = 30 + ((h2*100|0) % 18);
            ctx.fillStyle = `rgb(${rv},${rv-2},${rv})`;
            ctx.fillRect(px+2, py+4, 5+((h*100|0)%4), 4);
            ctx.fillStyle = `rgba(255,255,255,0.05)`;
            ctx.fillRect(px+2, py+4, 5+((h*100|0)%4), 1);
          }

          // Exposed face — strata lines visible on cliff
          if (leftExposed) {
            ctx.fillStyle = 'rgb(36,18,6)';
            ctx.fillRect(px, py, 2, T);
            ctx.fillStyle = 'rgba(44,20,6,0.5)';
            const strataY2 = py + 2 + ((h2*100|0)%10);
            ctx.fillRect(px, strataY2, 3, 1);
          }
          if (rightExposed) {
            ctx.fillStyle = 'rgb(36,18,6)';
            ctx.fillRect(px+T-2, py, 2, T);
          }
          if (botExposed) {
            // Underside — dark shadow fringe
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(px, py+T-3, T, 3);
          }
          break;
        }

        // ── STONE tile ────────────────────────────────────────────────────────
        case TILE.STONE: {
          // Use mossy variant for upper stone, plain for deep
          const sIdx = (depth < 14 && (h > 0.35)) ? 5 : 4;
          _drawTile(ctx, sIdx, px, py, T, x, y);
          if (darkenAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${darkenAlpha.toFixed(2)})`;
            ctx.fillRect(px, py, T, T);
          }

          // Top face — crack detail when exposed to surface
          if (topExposed && (h*100|0) % 15 === 0) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(px+3, py+3, 5, 1);
            ctx.fillRect(px+5, py+5, 4, 1);
          }

          // Bright face highlight (facing left = lit)
          if (leftExposed) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.fillRect(px, py, 2, T);
          }
          // Deep shadow face (facing right)
          if (rightExposed) {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(px+T-2, py, 2, T);
          }
          // Bottom underside shadow
          if (botExposed) {
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(px, py+T-3, T, 3);
          }
          break;
        }

        // ── WOOD tile ─────────────────────────────────────────────────────────
        case TILE.WOOD: {
          _drawTile(ctx, 6, px, py, T, x, y);
          if (darkenAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${darkenAlpha.toFixed(2)})`;
            ctx.fillRect(px, py, T, T);
          }
          if (leftExposed)  { ctx.fillStyle='rgb(30,14,4)'; ctx.fillRect(px,py+1,2,T-2); }
          if (rightExposed) { ctx.fillStyle='rgb(22,10,3)'; ctx.fillRect(px+T-2,py+1,2,T-2); }
          break;
        }

        case TILE.LEAVES:     { _drawTile(ctx, 7,  px, py, T, x, y); break; }
        case TILE.WATER:      { _drawTile(ctx, 10, px, py, T, x, y); break; }

        case TILE.MUD:
        case TILE.MUD_EDGE: {
          _drawTile(ctx, 8, px, py, T, x, y);
          if (darkenAlpha > 0) {
            ctx.fillStyle = `rgba(0,0,0,${darkenAlpha.toFixed(2)})`;
            ctx.fillRect(px, py, T, T);
          }
          break;
        }

        case TILE.METAL:        { _drawTile(ctx, 9,  px, py, T, x, y); break; }
        case TILE.CRATE:        { _drawTile(ctx, 11, px, py, T, x, y); break; }
        case TILE.BRIDGE:       { _drawTile(ctx, 12, px, py, T, x, y); break; }
        case TILE.VINE:         { _drawTile(ctx, 13, px, py, T, x, y); break; }
        case TILE.TIMBER_LADDER:{ _drawTile(ctx, 14, px, py, T, x, y); break; }

        default: {
          ctx.fillStyle = '#3a0028';
          ctx.fillRect(px, py, T, T);
        }
      }
    }
  }
}




function renderTraps(ctx, traps) {
  for (const trap of traps) {
    if (trap.destroyed) continue;
    
    const { x, y, w, h, type, triggered, animFrame } = trap;
    
    ctx.globalAlpha = triggered ? Math.max(0.3, 1 - animFrame / 60) : 0.9;
    
    switch (type) {
      case 'PUNJI':
        ctx.fillStyle = '#8a6a3a';
        for (let i = 0; i < 5; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * 7, y + h);
          ctx.lineTo(x + i * 7 + 3, y);
          ctx.lineTo(x + i * 7 + 6, y + h);
          ctx.fill();
        }
        break;
      case 'TRIPWIRE':
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(x, y + h - 4);
        ctx.lineTo(x + w, y + h - 4);
        ctx.stroke();
        ctx.setLineDash([]);
        // Small explosive
        ctx.fillStyle = '#aa3333';
        ctx.fillRect(x + w - 6, y + h - 8, 6, 6);
        break;
      case 'FALLING_LOG':
        if (!triggered) {
          ctx.fillStyle = COLORS.WOOD;
          ctx.fillRect(x, y, w + 10, 8);
          // Rope
          ctx.strokeStyle = '#8a7a4a';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(x + w / 2, y);
          ctx.lineTo(x + w / 2, y - 20);
          ctx.stroke();
        } else {
          const dropY = Math.min(animFrame * 3, 40);
          ctx.fillStyle = COLORS.WOOD;
          ctx.fillRect(x, y + dropY, w + 10, 8);
        }
        break;
      case 'SNARE':
        ctx.strokeStyle = '#8a7a4a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h - 5, 10, 0, Math.PI * 2);
        ctx.stroke();
        break;
      case 'BOULDER':
        ctx.fillStyle = COLORS.STONE;
        ctx.beginPath();
        const boulderY = triggered ? y + Math.min(animFrame * 2, 30) : y;
        ctx.arc(x + w / 2, boulderY + 12, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.arc(x + w / 2 - 3, boulderY + 9, 4, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'TREE_CRUSH':
        if (!triggered) {
          ctx.fillStyle = COLORS.WOOD;
          ctx.fillRect(x + w / 2 - 4, y, 8, h + 20);
          ctx.fillStyle = COLORS.LEAVES;
          ctx.beginPath();
          ctx.arc(x + w / 2, y - 5, 18, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const fallAngle = Math.min(animFrame * 0.05, Math.PI / 2);
          ctx.save();
          ctx.translate(x + w / 2, y + h + 20);
          ctx.rotate(fallAngle);
          ctx.fillStyle = COLORS.WOOD;
          ctx.fillRect(-4, -(h + 20), 8, h + 20);
          ctx.fillStyle = COLORS.LEAVES;
          ctx.beginPath();
          ctx.arc(0, -(h + 25), 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        break;
      case 'EXPLOSIVE':
        ctx.fillStyle = '#884422';
        ctx.fillRect(x + 4, y + h - 12, w - 8, 10);
        ctx.fillStyle = '#cc3333';
        ctx.fillRect(x + w / 2 - 3, y + h - 14, 6, 4);
        // Fuse
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y + h - 14);
        ctx.quadraticCurveTo(x + w / 2 + 5, y + h - 22, x + w / 2 + 10, y + h - 18);
        ctx.stroke();
        break;
      case 'CLAYMORE':
        ctx.fillStyle = '#4a5a3a';
        ctx.fillRect(x + 4, y + h - 10, w - 8, 8);
        ctx.fillStyle = '#ccaa33';
        ctx.fillRect(x + w / 2 - 4, y + h - 12, 8, 3);
        ctx.fillStyle = '#333';
        ctx.font = '6px monospace';
        ctx.fillText('☠', x + w / 2 - 3, y + h - 4);
        break;
    }
    
    ctx.globalAlpha = 1;
  }
}

function renderResourceNodes(ctx, nodes) {
  for (const node of nodes) {
    if (node.looted) continue;
    // Glowing pickup indicator
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(node.x + 8, node.y - 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function renderProjectiles(ctx, projectiles) {
  for (const proj of projectiles) {
    if (proj.stuck && proj.type === 'arrow') {
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(proj.angle);
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-8, -1, 16, 2);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(6, -2, 3, 4);
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.rotate(proj.angle);

    if (proj.type === 'hand_grenade') {
      // Pixel grenade body
      ctx.fillStyle = '#3a5a2a';
      ctx.fillRect(-4, -4, 8, 8);
      // Safety lever
      ctx.fillStyle = '#8a7a3a';
      ctx.fillRect(-3, -5, 2, 2);
      // Fuse blink when close to detonation
      if (proj.fuseTimer < 1.0) {
        const blink = Math.floor(Date.now() / 120) % 2;
        ctx.fillStyle = blink ? '#ff2200' : '#ffaa00';
        ctx.fillRect(-1, -6, 3, 3);
      }
      ctx.restore();
      continue;
    } else if (proj.type === 'arrow') {
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(-8, -1, 16, 2);
      // Arrowhead
      ctx.fillStyle = '#aaa';
      ctx.beginPath();
      ctx.moveTo(8, -3);
      ctx.lineTo(12, 0);
      ctx.lineTo(8, 3);
      ctx.fill();
      // Fletching
      ctx.fillStyle = '#cc4444';
      ctx.fillRect(-8, -2, 4, 1);
      ctx.fillRect(-8, 1, 4, 1);
    } else if (proj.type === 'explosive_arrow') {
      // Explosive arrow: shaft + red tip + glow
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(-8, -1, 16, 2);
      // Explosive warhead (red + glow)
      ctx.shadowColor = '#ff3300';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff5500';
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(14, 0);
      ctx.lineTo(8, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Fletching (orange)
      ctx.fillStyle = '#ff8833';
      ctx.fillRect(-8, -2, 4, 1);
      ctx.fillRect(-8, 1, 4, 1);
    } else if (proj.type === 'plasma') {
      // Plasma glow
      ctx.shadowColor = '#00ffaa';
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#00ffaa';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (proj.type === 'gl_round') {
      // Poncho GL round — fat olive drab shell, tumbles on arc
      ctx.fillStyle = '#4a5a28';
      ctx.fillRect(-5, -3, 10, 6);
      ctx.fillStyle = '#2a3a18';
      ctx.fillRect(4, -2, 3, 4);
      ctx.fillStyle = '#b87040';
      ctx.fillRect(0, -3, 2, 6);
      const glint = Math.abs(Math.sin(Date.now() * 0.02));
      ctx.fillStyle = `rgba(220,200,120,${(glint * 0.5).toFixed(2)})`;
      ctx.fillRect(1, -2, 1, 4);
    } else if (proj.type === 'gl_round') {
      // Poncho's grenade launcher round — fat cylindrical shell, tumbles in arc
      // proj.angle already tracks velocity direction from physics
      ctx.fillStyle = '#4a5a28';  // olive drab body
      ctx.fillRect(-5, -3, 10, 6);
      // Nose cone — darker tip
      ctx.fillStyle = '#2a3a18';
      ctx.fillRect(4, -2, 3, 4);
      // Copper driving band
      ctx.fillStyle = '#b87040';
      ctx.fillRect(0, -3, 2, 6);
      // Spin glint
      const glint = Math.abs(Math.sin(Date.now() * 0.02));
      ctx.fillStyle = `rgba(220,200,120,${glint * 0.5})`;
      ctx.fillRect(1, -2, 1, 4);
    }
    ctx.restore();
  }
}

// Per-character body configs (mirrors characters.config.js body block)
const CHAR_BODY = {
  mac:    { bw: 14, bh: 26, sw: 16, hw: 9,  hh: 9,  ls: 6, gear: 'bandolier',      hgear: 'boonie',  weapY: -8 },
  ponchi: { bw: 13, bh: 22, sw: 13, hw: 8,  hh: 8,  ls: 5, gear: 'demo_pack',       hgear: 'helmet',  weapY: -7 },
  annie:  { bw: 10, bh: 24, sw: 11, hw: 7,  hh: 8,  ls: 4, gear: 'vest',            hgear: 'bandana', weapY: -9 },
  blaze:  { bw: 17, bh: 28, sw: 20, hw: 10, hh: 9,  ls: 7, gear: 'ammo_belt',       hgear: 'wrap',    weapY: -6 },
};
const CHAR_COLORS = {
  mac:    { body: '#5a3a2a', vest: '#7a4a1a', head: '#c9a876', hat: '#4a3a18' },
  ponchi: { body: '#2a4a5a', vest: '#3a5a6a', head: '#c9a876', hat: '#5a5a5a' },
  annie:  { body: '#3a5a2a', vest: '#5a7a4a', head: '#c9a876', hat: '#cc3333' },
  blaze:  { body: '#6a3a18', vest: '#8a5a2a', head: '#c9a876', hat: '#3a2a18' },
};

function _drawCharacterGear(ctx, gear, hgear, h, hw, hh, colors, bw, bh) {
  // Gear details drawn after body in character-translated space (origin = centre-bottom)
  switch (gear) {
    case 'bandolier':
      // Diagonal strap from shoulder to hip
      ctx.strokeStyle = '#4a3a18';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-bw/2 + 2, -bh + 4); ctx.lineTo(bw/2 - 2, -bh/2); ctx.stroke();
      // Ammo loops on strap
      ctx.fillStyle = '#8a7a3a';
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(-bw/2 + 3 + i * 4, -bh + 6 + i * 4, 2, 3);
      }
      break;
    case 'demo_pack':
      // Square pack on back
      ctx.fillStyle = '#2a3a4a';
      ctx.fillRect(bw/2 - 2, -bh + 3, 5, 8);
      // Grenade belt
      ctx.fillStyle = '#cc8833';
      ctx.fillRect(-bw/2, -bh/2 - 1, bw + 2, 2);
      // Grenade bumps
      ctx.fillStyle = '#aa6622';
      for (let i = 0; i < 3; i++) ctx.fillRect(-bw/2 + 1 + i * 4, -bh/2 - 2, 3, 2);
      break;
    case 'vest':
      // Chest plate lines
      ctx.fillStyle = '#4a6a3a';
      ctx.fillRect(-bw/2, -bh + 4, bw, 2);
      ctx.fillRect(-bw/2, -bh/2, bw, 2);
      // Pouches
      ctx.fillStyle = '#3a5a2a';
      ctx.fillRect(-bw/2 + 1, -bh + 7, 3, 4);
      ctx.fillRect(bw/2 - 4, -bh + 7, 3, 4);
      break;
    case 'ammo_belt':
      // Heavy ammo belt over shoulder
      ctx.strokeStyle = '#6a5a1a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-bw/2, -bh + 2); ctx.lineTo(bw/2, -bh/2 + 2); ctx.stroke();
      // Belt rounds (big)
      ctx.fillStyle = '#cc9933';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-bw/2 + 1 + i * 5, -bh + 3 + i * 3, 3, 5);
      }
      // Forearm wrap
      ctx.fillStyle = '#5a4a2a';
      ctx.fillRect(bw/2 - 1, -bh + 14, 4, 6);
      break;
  }
  // Head gear
  switch (hgear) {
    case 'boonie':
      // Wide boonie hat
      ctx.fillStyle = colors.hat;
      ctx.fillRect(-hw/2 - 2, -h - hh + 1, hw + 4, 3);
      ctx.fillRect(-hw/2, -h - hh - 1, hw, hh + 1);
      break;
    case 'helmet':
      ctx.fillStyle = '#4a4a3a';
      ctx.beginPath();
      ctx.ellipse(0, -h - hh/2, hw/2 + 2, hh/2 + 2, 0, Math.PI, 0);
      ctx.fill();
      // Chinstrap line
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-hw/2 - 1, -h - hh/2); ctx.lineTo(-hw/2, -h + 2); ctx.stroke();
      break;
    case 'bandana':
      // Red bandana — the most distinct head detail
      ctx.fillStyle = '#cc2222';
      ctx.fillRect(-hw/2 - 1, -h - hh + 1, hw + 2, 4);
      // Knot on side
      ctx.fillRect(hw/2, -h - hh + 2, 3, 3);
      break;
    case 'wrap':
      // Head wrap (cloth folds)
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(-hw/2 - 1, -h - hh - 1, hw + 2, hh + 2);
      ctx.fillStyle = '#4a3a22';
      ctx.fillRect(-hw/2, -h - hh + 2, hw, 2);
      ctx.fillRect(-hw/2, -h - hh + 5, hw, 2);
      break;
  }
}

function _drawMuzzleFlash(ctx, weaponId, muzzleX, muzzleY, frame) {
  // pixel-art style — no smooth blobs
  const t = Date.now();
  ctx.save();
  ctx.translate(muzzleX, muzzleY);

  switch (weaponId) {
    case 'm60': {
      // Long yellow-orange side burst
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(0, -3, 14, 6);
      ctx.fillStyle = '#ff8800';
      ctx.fillRect(12, -2, 8, 4);
      ctx.fillStyle = '#ffff88';
      ctx.fillRect(0, -1, 6, 2);
      // Brass casing eject downward
      if (frame % 2 === 0) {
        ctx.fillStyle = '#cc9933';
        ctx.fillRect(-4, 3, 3, 2);
      }
      break;
    }
    case 'grenade_launcher': {
      // Short smoke puff + orange pop
      ctx.fillStyle = '#ff6600';
      ctx.fillRect(0, -5, 10, 10);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(8, -3, 6, 6);
      // Smoke blobs (grey squares)
      ctx.fillStyle = 'rgba(180,170,160,0.7)';
      ctx.fillRect(-2, -7, 8, 5);
      ctx.fillRect(4, -9, 6, 4);
      ctx.fillRect(1, -4, 12, 4);
      break;
    }
    case 'm16_m203': {
      // Sharp compact rifle flash
      ctx.fillStyle = '#ffffaa';
      ctx.fillRect(0, -2, 8, 4);
      ctx.fillStyle = '#ffcc44';
      ctx.fillRect(6, -3, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -1, 4, 2);
      break;
    }
    case 'minigun': {
      // Rotating strobe flash cone — wide multi-spike
      const rot = (t * 0.03) % (Math.PI * 2);
      ctx.rotate(rot * 0.1);  // slight rotation
      ctx.fillStyle = '#ffee22';
      ctx.fillRect(0, -6, 18, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -2, 10, 4);
      // Spike jets at angles
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(14, -8, 6, 3);
      ctx.fillRect(14, 5, 6, 3);
      ctx.fillRect(16, -2, 8, 4);
      // Smoke buildup rect
      ctx.fillStyle = 'rgba(140,130,120,0.5)';
      ctx.fillRect(-4, -5, 6, 10);
      break;
    }
    default: {
      ctx.fillStyle = '#ffdd44';
      ctx.fillRect(0, -2, 8, 4);
    }
  }
  ctx.restore();
}

function renderPlayer(ctx, player) {
  const { x, y, w, h, facing, state, frame, bowDrawn, bowPower, bowAngle, attacking, attackTimer, mudAmount } = player;
  const charId = player.characterId || 'annie';
  const cb = CHAR_BODY[charId] || CHAR_BODY.annie;
  const cc = CHAR_COLORS[charId] || CHAR_COLORS.annie;
  const bw = cb.bw, bh = cb.bh, sw = cb.sw;
  const hw = cb.hw, hh = cb.hh, ls = cb.ls;

  ctx.save();
  ctx.translate(x + w / 2, y + h);
  if (facing < 0) ctx.scale(-1, 1);

  // Body — character-specific width/height
  ctx.fillStyle = cc.body;
  ctx.fillRect(-bw/2, -bh, bw, bh - ls);
  // Shoulder bulk
  ctx.fillStyle = cc.vest;
  ctx.fillRect(-sw/2, -bh, sw, 6);

  // Legs
  const legOff = state === 'run' ? Math.sin(frame * Math.PI / 2) * 4 : 0;
  ctx.fillStyle = COLORS.PLAYER_DARK;
  ctx.fillRect(-ls/2 - 1, -ls, Math.floor(ls/2) + 1, ls);
  ctx.fillRect(1, -ls + legOff, Math.floor(ls/2) + 1, ls);

  // Head
  ctx.fillStyle = cc.head;
  ctx.fillRect(-hw/2, -bh - hh, hw, hh);
  // Eye
  ctx.fillStyle = '#222';
  ctx.fillRect(hw/2 - 3, -bh - hh + 3, 2, 2);

  // Character-specific gear + head gear
  _drawCharacterGear(ctx, cb.gear, cb.hgear, bh, hw, hh, cc, bw, bh);

  // Mud coating overlay — full mud makes player nearly invisible
  if (mudAmount > 0.01) {
    // At full mud, alpha nearly 1.0 = complete coverage
    const mudAlpha = Math.min(0.97, mudAmount * 1.05);
    ctx.globalAlpha = mudAlpha;
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(-bw/2, -bh, bw, bh - ls);  // body
    ctx.fillRect(-hw/2, -bh - hh, hw, hh);   // head
    ctx.fillRect(-sw/2, -bh, sw, 6);          // shoulders
    ctx.globalAlpha = 1;

    // Dripping mud on heavy coat
    if (mudAmount > 0.7 && frame % 8 === 0) {
      for (let i = 0; i < 2; i++) {
        ctx.fillStyle = 'rgba(42,26,10,0.8)';
        ctx.fillRect((Math.random() - 0.5) * bw - 0.5, -bh + Math.random() * bh, 1, 3);
      }
    }
  }

  // Arms & weapon
  const weaponId = player.characterConfig?.weaponId || player.weaponState?.current;
  if (attacking) {
    const swingAngle = (12 - attackTimer) / 12 * Math.PI * 0.7 - 0.3;
    ctx.save();
    ctx.translate(bw/2 - 2, cb.weapY - 2);
    ctx.rotate(swingAngle);
    ctx.fillStyle = '#aaaaaa';
    ctx.fillRect(0, -1, 18, 3);
    ctx.fillStyle = '#666';
    ctx.fillRect(-2, -2, 4, 5);
    ctx.restore();
  } else if (bowDrawn) {
    ctx.save();
    ctx.translate(bw/2 - 2, cb.weapY - 2);
    ctx.rotate(bowAngle);
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 12, -1, 1); ctx.stroke();
    const pull = Math.min(bowPower / 15, 1) * 8;
    ctx.strokeStyle = '#aaa'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12 * Math.cos(-1), 12 * Math.sin(-1));
    ctx.lineTo(-pull, 0);
    ctx.lineTo(12 * Math.cos(1), 12 * Math.sin(1));
    ctx.stroke();
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(-pull, -1, 16 + pull, 2);
    ctx.restore();
  } else if (player.weaponState?.current) {
    // Draw equipped weapon silhouette
    _drawWeaponCarry(ctx, player.weaponState.current, cb.weapY, bw);
  } else {
    ctx.fillStyle = cc.head;
    ctx.fillRect(bw/2 - 2, -bh + 8, 3, 8);
  }

  // Active weapon firing — muzzle flash
  if (player.weaponState?.isSpendingAmmo || player._muzzleFlashTimer > 0) {
    const muzzleX = bw/2 + (cb.muzzleXOffset || 16) - bw/2;
    const muzzleY = cb.weapY;
    _drawMuzzleFlash(ctx, player.weaponState.current, muzzleX + bw/2, muzzleY, frame);
  }

  if (state === 'crouch') {
    ctx.fillStyle = COLORS.MUD;
    ctx.fillRect(-bw/2 - 1, -ls/2, bw + 2, 3);
  }

  ctx.restore();
}

function _drawWeaponCarry(ctx, weaponId, weapY, bw) {
  const ox = bw/2 - 2;
  ctx.save();
  ctx.translate(ox, weapY);
  switch (weaponId) {
    case 'm60':
      // Long barrel, bipod
      ctx.fillStyle = '#4a4a3a';
      ctx.fillRect(0, -1, 22, 3);
      ctx.fillStyle = '#3a3a2a';
      ctx.fillRect(18, -2, 2, 5);  // bipod leg hint
      ctx.fillRect(20, -2, 2, 5);
      break;
    case 'grenade_launcher':
      // Short fat barrel
      ctx.fillStyle = '#4a4a3a';
      ctx.fillRect(0, -2, 14, 5);
      ctx.fillStyle = '#6a5a3a';
      ctx.fillRect(10, -3, 4, 7);  // launcher tube
      break;
    case 'm16_m203':
      // M16 with under-barrel tube
      ctx.fillStyle = '#4a4a3a';
      ctx.fillRect(0, -1, 18, 2);  // rifle
      ctx.fillStyle = '#3a5a3a';
      ctx.fillRect(4, 1, 10, 3);   // M203 tube
      break;
    case 'minigun':
      // Wide multi-barrel
      ctx.fillStyle = '#5a5a4a';
      ctx.fillRect(0, -4, 16, 8);
      ctx.fillStyle = '#3a3a2a';
      ctx.fillRect(2, -3, 2, 6);
      ctx.fillRect(6, -3, 2, 6);
      ctx.fillRect(10, -3, 2, 6);
      // Handle/grip below
      ctx.fillStyle = '#4a3a2a';
      ctx.fillRect(-2, 3, 6, 4);
      break;
    default:
      ctx.fillStyle = '#4a4a3a';
      ctx.fillRect(0, -1, 14, 2);
  }
  ctx.restore();
}

function renderHunter(ctx, hunter) {
  const { x, y, w, h, facing, frame, cloaked, cloakFlicker, hitFlash, aiState, mode, selfDestruct, selfDestructTimer, alive } = hunter;

  ctx.save();
  ctx.translate(x + w / 2, y + h);
  if (facing < 0) ctx.scale(-1, 1);

  if (cloaked) {
    // Shimmer distortion — draw body with offset layers at low alpha
    const shimmerOff = Math.sin(Date.now() * 0.015) * 2;
    ctx.globalAlpha = cloakFlicker * 0.6;
    ctx.fillStyle = 'rgba(140,220,255,0.25)';
    ctx.fillRect(-10 + shimmerOff, -h, 20, h);
    ctx.globalAlpha = cloakFlicker * 0.4;
    ctx.fillStyle = 'rgba(80,180,255,0.15)';
    ctx.fillRect(-10 - shimmerOff, -h + 2, 20, h - 2);
    // Faint outline so player knows it's there
    ctx.globalAlpha = cloakFlicker * 0.5;
    ctx.strokeStyle = 'rgba(180,240,255,0.6)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-9, -h, 18, h);
    ctx.globalAlpha = 1;
    ctx.restore();
    return;
  }

  if (hitFlash > 0 && hitFlash % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }

  // Body
  ctx.fillStyle = selfDestruct ? (selfDestructTimer % 10 < 5 ? '#ff3333' : COLORS.HUNTER_BODY) : COLORS.HUNTER_BODY;
  ctx.fillRect(-8, -h, 16, h - 8);

  // Legs (armored)
  ctx.fillStyle = '#3a3a2a';
  const legOff = aiState === 'approach' ? Math.sin(frame * Math.PI / 2) * 5 : 0;
  ctx.fillRect(-7, -8, 5, 8);
  ctx.fillRect(2, -8 + legOff, 5, 8);

  // Head / mask
  ctx.fillStyle = COLORS.HUNTER_MASK;
  ctx.fillRect(-6, -h - 4, 12, 10);
  // Dreadlocks
  ctx.fillStyle = '#2a2a2a';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-6 + i * 4, -h + 6, 2, 8 + Math.sin(frame + i) * 2);
  }
  // Eyes (red glow)
  ctx.fillStyle = '#ff3300';
  ctx.fillRect(-3, -h, 2, 2);
  ctx.fillRect(2, -h, 2, 2);

  // Shoulder cannon (plasma mode)
  if (mode === 'plasma') {
    ctx.fillStyle = '#5a5a4a';
    ctx.fillRect(3, -h - 2, 12, 5);
    ctx.fillStyle = '#00ffaa';
    ctx.fillRect(14, -h - 1, 3, 3);
  }

  // Arm blades (ground mode)
  if (mode === 'ground') {
    ctx.fillStyle = '#cccccc';
    ctx.fillRect(6, -h + 12, 14, 2);
    ctx.fillRect(6, -h + 15, 12, 2);
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function renderParticles(ctx, particles) {
  for (const p of particles) {
    const fadeStart = p.type === 'tracer' ? 3 : 15;
    ctx.globalAlpha = Math.min(1, p.life / fadeStart);

    if (p.type === 'glow' || p.type === 'shimmer') {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
    }

    ctx.fillStyle = p.color;

    if (p.type === 'tracer') {
      // Draw as a bright line segment in the direction of travel
      const angle = p.angle !== undefined ? p.angle : Math.atan2(p.vy, p.vx);
      const len = p.size || 10;
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = Math.min(1, p.life / 4);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - Math.cos(angle) * len, p.y - Math.sin(angle) * len);
      ctx.stroke();
      ctx.restore();
    } else if (p.type === 'smoke') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'muzzleFlash') {
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (p.type === 'spark') {
      ctx.fillRect(p.x, p.y, p.size, p.size);
    } else if (p.type === 'casing') {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - 1, p.size, 2);
    } else {
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

function renderFire(ctx, firePatches) {
  for (const f of firePatches) {
    const intensity = Math.min(1, f.life / 80);
    ctx.globalAlpha = 0.6 * intensity;
    // Outer glow
    const grad = ctx.createRadialGradient(
      f.x + TILE_SIZE / 2, f.y + TILE_SIZE / 2, 0,
      f.x + TILE_SIZE / 2, f.y + TILE_SIZE / 2, TILE_SIZE
    );
    grad.addColorStop(0, '#ffcc00');
    grad.addColorStop(0.5, '#ff4400');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(f.x - TILE_SIZE / 2, f.y - TILE_SIZE / 2, TILE_SIZE * 2, TILE_SIZE * 2);
  }
  ctx.globalAlpha = 1;
}

function renderPlasmaReticle(ctx, hunter) {
  const { plasmaLockTimer, plasmaReticleX, plasmaReticleY } = hunter;
  const lockPct = Math.min(plasmaLockTimer / 90, 1);
  const size = 24 - lockPct * 10;
  const blink = plasmaLockTimer > 70 && Math.floor(Date.now() / 80) % 2;

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = blink ? '#ffffff' : '#ff2200';
  ctx.lineWidth = 1.5;

  // Corner brackets
  const b = size;
  const bLen = 8;
  const cx = plasmaReticleX, cy = plasmaReticleY;
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(cx + sx * b, cy + sy * b - sy * bLen);
    ctx.lineTo(cx + sx * b, cy + sy * b);
    ctx.lineTo(cx + sx * b - sx * bLen, cy + sy * b);
    ctx.stroke();
  });

  // Center dot
  ctx.fillStyle = blink ? '#ffffff' : '#ff2200';
  ctx.beginPath();
  ctx.arc(cx, cy, 2, 0, Math.PI * 2);
  ctx.fill();

  // Lock ring
  if (lockPct > 0.5) {
    ctx.globalAlpha = (lockPct - 0.5) * 2 * 0.7;
    ctx.beginPath();
    ctx.arc(cx, cy, b * 1.2, 0, Math.PI * 2 * lockPct);
    ctx.stroke();
  }

  ctx.restore();
}

// Screen-space god rays — anchored to sun position, no world-transform involved
function renderGodRaysScreenSpace(ctx, camX, camY, W, H, tod, zoom) {
  const blends = getWeatherBlends();
  const storm = blends.storm;
  const rayStrength = (1 - storm * 0.85) * 0.055;
  if (rayStrength < 0.004) return;

  // Sun screen-space position mirrors the sun drawn in renderSky
  const baseSunX = W * 0.72;
  const sunScreenX = baseSunX - (camX * PARALLAX.sun);
  const sunScreenY = H * 0.22;

  ctx.save();
  const t = Date.now() * 0.0006;
  
  // Radial god rays fanning out from sun center
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 1.5 - Math.PI * 0.25;  // spread 180° arc above sun
    const pulse = Math.sin(t + i * 1.1) * 0.012 + rayStrength;
    
    // Ray extends from sun outward to screen edge
    const rayLen = Math.max(W, H) * 1.2;
    const endX = sunScreenX + Math.cos(angle) * rayLen;
    const endY = sunScreenY + Math.sin(angle) * rayLen;
    
    // Gradient from sun to ray end
    const rayGrad = ctx.createLinearGradient(sunScreenX, sunScreenY, endX, endY);
    rayGrad.addColorStop(0,    `rgba(255,240,180,${pulse * 0.8})`);
    rayGrad.addColorStop(0.3,  `rgba(255,210,100,${pulse * 0.4})`);
    rayGrad.addColorStop(1,    'transparent');
    
    ctx.fillStyle = rayGrad;
    ctx.globalAlpha = 1;
    
    // Ray wedge from sun center
    const width = 24 + Math.sin(t * 0.002 + i) * 8;
    ctx.beginPath();
    ctx.moveTo(sunScreenX, sunScreenY);
    ctx.lineTo(
      sunScreenX + Math.cos(angle - width / rayLen) * rayLen,
      sunScreenY + Math.sin(angle - width / rayLen) * rayLen
    );
    ctx.lineTo(
      sunScreenX + Math.cos(angle + width / rayLen) * rayLen,
      sunScreenY + Math.sin(angle + width / rayLen) * rayLen
    );
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function renderHUD(ctx, W, H, player, hunter, phase, prepTimer, score, trapSelect, gamePhase, helicopter, research, grenadeThrow) {
  // ── INSERTION phase — minimal cinematic HUD ──
  if (gamePhase === GAME_STATES.INSERTION) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H - 36, W, 36);
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#c0d0a0';
    const captions = ['CENTRAL AMERICA — 1988', 'INSERTION POINT: GRID 447', 'LOCATE THE HUNTER. SURVIVE.'];
    const idx = helicopter ? (
      helicopter.state === 'approach' ? 0 :
      helicopter.state === 'hover' || helicopter.state === 'rope_drop' ? 1 : 2
    ) : 2;
    ctx.fillText(captions[idx], W / 2 - 120, H - 14);
    return;
  }
  // Background bar
  ctx.fillStyle = COLORS.HUD_BG;
  ctx.fillRect(0, 0, W, 40);

  ctx.font = '10px "Press Start 2P", monospace';

  // Health bar
  ctx.fillStyle = COLORS.HUD_TEXT;
  ctx.fillText('LIFE', 10, 14);
  ctx.fillStyle = '#333';
  ctx.fillRect(60, 6, 80, 10);
  const healthPct = player.health / player.maxHealth;
  ctx.fillStyle = healthPct > 0.5 ? COLORS.HUD_GREEN : healthPct > 0.25 ? COLORS.HUD_YELLOW : COLORS.HUD_RED;
  ctx.fillRect(60, 6, 80 * healthPct, 10);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 6, 80, 10);

  // Score
  ctx.fillStyle = COLORS.HUD_YELLOW;
  ctx.fillText(`SCORE ${String(score).padStart(6, '0')}`, W - 230, 14);

  // Research points
  if (research) {
    ctx.fillStyle = '#88ddff';
    ctx.fillText(`RP ${research.points}`, W - 230, 28);
  }

  // Active tool indicator
  const toolLabel = player.activeTool === 'shovel' ? 'SHOVEL' : 'MACHETE';
  ctx.fillStyle = player.activeTool === 'shovel' ? '#cc8833' : '#aabbaa';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillText(`TOOL: ${toolLabel}`, W - 120, 14);
  ctx.fillStyle = '#888';
  ctx.font = '7px "Press Start 2P", monospace';
  ctx.fillText('[3/4 or C]', W - 120, 22);
  ctx.font = '10px "Press Start 2P", monospace';

  // Weapon HUD
  if (player.weaponState.current && gamePhase !== GAME_STATES.PREP) {
    const weaponConfig = WEAPONS_CONFIG[player.weaponState.current];
    const ammo = `${player.weaponState.ammoInMag}/${player.weaponState.ammoReserve}`;
    ctx.fillStyle = '#ffaa33';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText(weaponConfig.displayName, W - 130, 28);
    ctx.fillText(ammo, W - 130, 36);
    if (player.weaponState.isReloading) {
      ctx.fillStyle = '#ff6666';
      ctx.fillText('RELOAD', W - 60, 28);
    }
  }

  // Grenade charge indicator
  if (grenadeThrow && grenadeThrow.active) {
    const pct = grenadeThrow.power;
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = '#ff8833';
    ctx.fillText('GRENADE', W / 2 - 34, H - 54);
    ctx.fillStyle = '#333';
    ctx.fillRect(W / 2 - 36, H - 48, 72, 8);
    ctx.fillStyle = pct > 0.8 ? '#ff3300' : pct > 0.5 ? '#ff8800' : '#ffcc00';
    ctx.fillRect(W / 2 - 36, H - 48, Math.floor(72 * pct), 8);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(W / 2 - 36, H - 48, 72, 8);
  }

  // Bow ammo display
  if (player.bowDrawn || (gamePhase === GAME_STATES.PREP && player.explosiveArrowCount > 0)) {
    ctx.fillStyle = player.bowAmmoType === 'explosive_arrow' ? '#ff6644' : '#88ccff';
    ctx.font = '8px "Press Start 2P", monospace';
    const ammoLabel = player.bowAmmoType === 'explosive_arrow' ? 'EXP ARROWS' : 'ARROWS';
    ctx.fillText(`${ammoLabel}: ${player.explosiveArrowCount || '∞'}`, W - 130, 44);
  }

  // Phase timer
  if (gamePhase === GAME_STATES.PREP) {
    const mins = Math.floor(prepTimer / 60);
    const secs = Math.floor(prepTimer % 60);
    ctx.fillStyle = prepTimer < 30 ? COLORS.HUD_RED : COLORS.HUD_TEXT;
    ctx.fillText(`PREP ${mins}:${String(secs).padStart(2, '0')}`, W / 2 - 50, 14);
  } else if (gamePhase === GAME_STATES.HUNT) {
    ctx.fillStyle = COLORS.HUD_RED;
    ctx.fillText('⚠ HUNTER ACTIVE', W / 2 - 70, 14);
  }

  // Hunter health (when visible)
  if (hunter && hunter.alive && !hunter.cloaked && gamePhase === GAME_STATES.HUNT) {
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.fillText('HUNTER', 10, 34);
    ctx.fillStyle = '#333';
    ctx.fillRect(80, 26, 100, 8);
    const hpPct = hunter.health / hunter.maxHealth;
    ctx.fillStyle = '#00ff66';
    ctx.fillRect(80, 26, 100 * hpPct, 8);
    ctx.strokeStyle = '#888';
    ctx.strokeRect(80, 26, 100, 8);
  }

  // Self destruct warning
  if (hunter && hunter.selfDestruct) {
    const blink = Math.floor(Date.now() / 200) % 2;
    if (blink) {
      ctx.fillStyle = '#ff0000';
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText('⚠ SELF DESTRUCT - RUN! ⚠', W / 2 - 140, H / 2 - 30);
    }
  }

  // Resource bar (bottom)
  if (gamePhase === GAME_STATES.PREP) {
    ctx.fillStyle = COLORS.HUD_BG;
    ctx.fillRect(0, H - 50, W, 50);
    
    ctx.font = '8px "Press Start 2P", monospace';
    const resources = player.resources;
    const resNames = ['wood', 'rope', 'stone', 'mud', 'explosives', 'metal'];
    const resColors = ['#8a6a3a', '#8a7a4a', '#6a6a6a', '#4a3a20', '#cc3333', '#6a7a6a'];
    
    resNames.forEach((r, i) => {
      const rx = 10 + i * (W / 6);
      ctx.fillStyle = resColors[i];
      ctx.fillRect(rx, H - 42, 8, 8);
      ctx.fillStyle = COLORS.HUD_TEXT;
      ctx.fillText(`${r.slice(0, 4).toUpperCase()} ${resources[r]}`, rx + 12, H - 34);
    });

    // Trap selector
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.fillText('TRAP:', 10, H - 16);
    const trapName = TRAP_TYPES[TRAP_LIST[trapSelect]]?.name || 'None';
    ctx.fillStyle = COLORS.HUD_YELLOW;
    ctx.fillText(trapName, 60, H - 16);
    ctx.fillStyle = '#888';
    ctx.fillText('[Q/E] switch  [T] place  [C] tool  [V] thermal', W / 2 - 60, H - 16);
  }

  // Game over / victory
  if (gamePhase === GAME_STATES.VICTORY) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#00ff66';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText('HUNTER ELIMINATED', W / 2 - 170, H / 2 - 20);
    ctx.fillStyle = COLORS.HUD_YELLOW;
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText(`SCORE: ${String(score).padStart(6, '0')}`, W / 2 - 80, H / 2 + 20);
    ctx.fillStyle = '#888';
    ctx.fillText('Press ENTER to play again', W / 2 - 130, H / 2 + 50);
  }

  if (gamePhase === GAME_STATES.DEFEAT) {
    ctx.fillStyle = 'rgba(80,0,0,0.8)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff3333';
    ctx.font = '20px "Press Start 2P", monospace';
    ctx.fillText('YOU WERE HUNTED', W / 2 - 150, H / 2 - 20);
    ctx.fillStyle = '#888';
    ctx.font = '12px "Press Start 2P", monospace';
    ctx.fillText('Press ENTER to try again', W / 2 - 120, H / 2 + 20);
  }

  if (gamePhase === GAME_STATES.TITLE) {
    // ── Init VFX once ──
    if (!renderHUD._vfxInit) {
      initMenuVFX(W, H);
      renderHUD._vfxInit = true;
      renderHUD._vfxW = W;
      renderHUD._vfxH = H;
    }
    // Re-init if canvas was resized
    if (renderHUD._vfxW !== W || renderHUD._vfxH !== H) {
      initMenuVFX(W, H);
      renderHUD._vfxW = W;
      renderHUD._vfxH = H;
    }
    updateMenuVFX(W, H, 1);

    // ── Background plate — cinematic image cover, fallback to dark fill ──
    const _tbg = _getTitleBg();
    if (_tbg.complete && _tbg.naturalWidth > 0) {
      // Cover-fit: fill entire canvas, crop edges as needed
      const imgAR = _tbg.naturalWidth / _tbg.naturalHeight;
      const canAR = W / H;
      let dw, dh, dx, dy;
      if (imgAR > canAR) {
        dh = H; dw = H * imgAR; dx = (W - dw) / 2; dy = 0;
      } else {
        dw = W; dh = W / imgAR; dx = 0; dy = (H - dh) / 2;
      }
      ctx.globalAlpha = 0.88;
      ctx.drawImage(_tbg, dx, dy, dw, dh);
      ctx.globalAlpha = 1.0;
    } else {
      // Not loaded yet — deep jungle dark
      ctx.fillStyle = '#050a04';
      ctx.fillRect(0, 0, W, H);
    }

    // ── VFX: background layer (behind UI) ──
    renderMenuVFX(ctx, W, H, 'bg');

    // ── Dark vignette ──
    const vig = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ── Title text ──
    ctx.fillStyle = '#00ff66';
    ctx.font = '24px "Press Start 2P", monospace';
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 18;
    ctx.fillText('LAST HUNT', W / 2 - 110, H / 2 - 60);
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.HUD_YELLOW;
    ctx.font = '16px "Press Start 2P", monospace';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 10;
    ctx.fillText('K I L L B O X', W / 2 - 95, H / 2 - 30);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#aabbaa';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillText('Build traps. Hunt the hunter.', W / 2 - 140, H / 2 + 20);

    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.fillText('Press ENTER or click to select character', W / 2 - 180, H / 2 + 60);

    ctx.fillStyle = '#556655';
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillText('A/D Move  SPACE Jump  S Crouch  F Machete', W / 2 - 185, H / 2 + 90);
    ctx.fillText('G Grenade (hold/release)  Z Shovel  C Tool  V Thermal', W / 2 - 205, H / 2 + 105);
    ctx.fillText('1 Pistol  2 Primary  Q/E Traps  T Place  X Dig', W / 2 - 195, H / 2 + 120);

    // ── VFX: foreground layer (passes in front of UI) ──
    renderMenuVFX(ctx, W, H, 'fg');
  }
}