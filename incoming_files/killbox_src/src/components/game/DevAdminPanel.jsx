import React, { useState, useRef, useCallback } from 'react';
import { RENDER_FLAGS, BG_OFFSETS, BG_LAYER_CATALOGUE, BG_ACTIVE_IDS, setBgLayer } from '../../lib/game/renderer';

// ── Layer definitions ──────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'background',
    label: '🌿 BG',
    color: '#44cc88',
    layers: [
      { key: 'sky',          label: 'Sky / Gradient' },
      { key: 'godRays',      label: 'God Rays' },
      { key: 'atmosphereBG', label: 'Atmosphere BG' },
      { key: 'bgFar',        label: 'BG Far (PNG)' },
      { key: 'farMountains', label: 'Proc. Mountains' },
      { key: 'farCanopy',    label: 'Proc. Far Canopy' },
      { key: 'bgMid',        label: 'BG Mid (PNG)' },
      { key: 'midTrees',     label: 'Proc. Mid Trees' },
      { key: 'vines',        label: 'Proc. Vines' },
      { key: 'bgNear',       label: 'BG Near (PNG)' },
      { key: 'fgFoliage',    label: 'Proc. FG Foliage' },
      { key: 'atmosphereFG', label: 'Atmosphere FG' },
    ],
  },
  {
    id: 'world',
    label: '🧱 WORLD',
    color: '#aabb44',
    layers: [
      { key: 'tiles',       label: 'Tiles (terrain)' },
      { key: 'trees',       label: 'Tree Sprites' },
      { key: 'foliage',     label: 'Foliage / Grass' },
      { key: 'traps',       label: 'Traps' },
      { key: 'crates',      label: 'Crates' },
      { key: 'props',       label: 'Props' },
    ],
  },
  {
    id: 'entities',
    label: '🎯 UNITS',
    color: '#dd8844',
    layers: [
      { key: 'player',      label: 'Player' },
      { key: 'squad',       label: 'Squad' },
      { key: 'hunter',      label: 'Hunter' },
      { key: 'wildlife',    label: 'Wildlife' },
    ],
  },
  {
    id: 'fx',
    label: '✨ FX',
    color: '#8844dd',
    layers: [
      { key: 'projectiles',   label: 'Projectiles' },
      { key: 'particles',     label: 'Particles' },
      { key: 'rain',          label: 'Rain / Weather' },
      { key: 'hud',           label: 'HUD' },
      { key: 'debugOverlays', label: 'Debug Overlays' },
    ],
  },
];

// Y-offset sliders for the 3 PNG parallax layers
const BG_SLIDER_DEFS = [
  { key: 'far',  label: 'Far BG',  color: '#44cc88' },
  { key: 'mid',  label: 'Mid BG',  color: '#88ccff' },
  { key: 'near', label: 'Near BG', color: '#ffaa44' },
];

const FONT = '"Press Start 2P", "Courier New", monospace';
const MIN_OFFSET = -600;
const MAX_OFFSET = 600;

function setFlag(key, val) { if (key in RENDER_FLAGS) RENDER_FLAGS[key] = val; }

export default function DevAdminPanel() {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState('background');
  const [flags, setFlags]       = useState(() => ({ ...RENDER_FLAGS }));
  const [offsets, setOffsets]   = useState({ far: 0, mid: 0, near: 0 });
  const [skyPreset, setSkyPreset] = useState(() => window._skyPreset || 'predatorNight');
  const [bgSel, setBgSel]       = useState(() => ({ ...BG_ACTIVE_IDS, struct: BG_ACTIVE_IDS.struct || 'struct_none' }));
  const posRef  = useRef({ x: 8, y: 60 });
  const [pos, setPos] = useState({ x: 8, y: 60 });

  // ── Toggle layer visibility ──────────────────────────────────────────────
  const toggle = useCallback((key) => {
    const v = !RENDER_FLAGS[key];
    setFlag(key, v);
    setFlags(f => ({ ...f, [key]: v }));
  }, []);

  const batchSet = useCallback((keys, val) => {
    keys.forEach(k => setFlag(k, val));
    setFlags(f => { const n = {...f}; keys.forEach(k => n[k] = val); return n; });
  }, []);

  const resetAll = useCallback(() => {
    Object.keys(RENDER_FLAGS).forEach(k => setFlag(k, true));
    setFlags(() => { const n = {}; Object.keys(RENDER_FLAGS).forEach(k => n[k] = true); return n; });
    // Reset offsets
    BG_OFFSETS.far = 0; BG_OFFSETS.mid = 0; BG_OFFSETS.near = 0;
    setOffsets({ far: 0, mid: 0, near: 0 });
    // Reset BG layer selections to defaults
    ['far','mid','near','struct'].forEach(l => setBgLayer(l, BG_ACTIVE_IDS[l]));
    setBgSel({ ...BG_ACTIVE_IDS });
  }, []);

  // ── Sky preset selector ─────────────────────────────────────────────────────
  const handleSkyPreset = useCallback((val) => {
    window._skyPreset = val === 'auto' ? null : val;
    setSkyPreset(val);
  }, []);

  // ── Y-offset slider ──────────────────────────────────────────────────────
  const setOffset = useCallback((key, val) => {
    const clamped = Math.round(Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, val)));
    BG_OFFSETS[key] = clamped;
    setOffsets(o => ({ ...o, [key]: clamped }));
  }, []);

  // ── BG layer hot-swap ───────────────────────────────────────────────────
  const handleBgSelect = useCallback((layer, id) => {
    setBgLayer(layer, id);
    setBgSel(s => ({ ...s, [layer]: id }));
  }, []);

  // ── Drag to reposition panel ─────────────────────────────────────────────
  const onHeaderMouseDown = useCallback((e) => {
    if (e.target.closest('[data-nodrag]')) return;
    e.preventDefault();
    const ox = e.clientX - posRef.current.x;
    const oy = e.clientY - posRef.current.y;
    const onMove = (me) => { posRef.current = { x: me.clientX - ox, y: me.clientY - oy }; setPos({ ...posRef.current }); };
    const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const section = SECTIONS.find(s => s.id === activeTab);

  return (
    <div style={{ position: 'absolute', left: pos.x, top: pos.y, zIndex: 9999, userSelect: 'none', fontFamily: FONT, fontSize: 9 }}
         onMouseDown={onHeaderMouseDown}>

      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div data-nodrag onClick={() => setOpen(o => !o)}
           style={{ display:'flex', alignItems:'center', gap:8,
                    background:'rgba(0,0,0,0.92)', border:'1px solid #44cc88',
                    borderBottom: open ? '1px solid #1a3322' : '1px solid #44cc88',
                    padding:'5px 10px', cursor:'pointer', color:'#44cc88',
                    letterSpacing:1, borderRadius: open ? '4px 4px 0 0' : 4 }}>
        <span style={{fontSize:11}}>⚙</span>
        <span>DEV PANEL</span>
        <span style={{marginLeft:'auto', color:'#336644', fontSize:7}}>{open ? '▲' : '▼'}</span>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      {open && (
        <div style={{ background:'rgba(0,0,0,0.94)', border:'1px solid #44cc88',
                      borderTop:'none', width:240, borderRadius:'0 0 4px 4px', overflow:'hidden' }}>

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid #1a3322' }}>
            {SECTIONS.map(s => (
              <button key={s.id} data-nodrag onClick={() => setActiveTab(s.id)}
                      style={{ flex:1, padding:'5px 2px', fontSize:7, fontFamily:FONT,
                               background: activeTab===s.id ? '#0d2218' : 'transparent',
                               border:'none', borderRight:'1px solid #1a3322',
                               color: activeTab===s.id ? s.color : '#336644', cursor:'pointer' }}>
                {s.label}
              </button>
            ))}
          </div>

          {/* ── Y-OFFSET SLIDERS — always visible at top of BG tab ── */}
          {activeTab === 'background' && (
            <div style={{ padding:'8px 10px 6px', borderBottom:'1px solid #1a3322' }}>
              <div style={{ color:'#556677', fontSize:7, marginBottom:6, letterSpacing:0.5 }}>
                ── LAYER Y OFFSET ──
              </div>
              {BG_SLIDER_DEFS.map(({ key, label, color }) => (
                <div key={key} style={{ marginBottom:8 }} data-nodrag>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                    <span style={{ color, fontSize:7 }}>{label}</span>
                    <span style={{ color:'#aaffaa', fontSize:7 }}>
                      {offsets[key] > 0 ? '+' : ''}{offsets[key]}px
                      {offsets[key] !== 0 && (
                        <span
                          onClick={() => setOffset(key, 0)}
                          style={{ marginLeft:6, color:'#666', cursor:'pointer', fontSize:6 }}
                          title="Reset"
                        >✕</span>
                      )}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN_OFFSET}
                    max={MAX_OFFSET}
                    step={4}
                    value={offsets[key]}
                    onChange={e => setOffset(key, Number(e.target.value))}
                    style={{
                      width:'100%',
                      accentColor: color,
                      cursor:'pointer',
                      height:12,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ── BG LAYER PICKER ────────────────────────────────────────────── */}
          {activeTab === 'background' && (
            <div style={{ padding:'8px 10px 6px', borderBottom:'1px solid #1a3322' }}>
              <div style={{ color:'#556677', fontSize:7, marginBottom:6, letterSpacing:0.5 }}>── SKY PRESET ──</div>
              <div data-nodrag style={{ marginBottom:8 }}>
                <div style={{ color:'#88ccff', fontSize:7, marginBottom:4 }}>Active Preset</div>
                <select
                  value={skyPreset}
                  onChange={e => handleSkyPreset(e.target.value)}
                  style={{ width:'100%', background:'#0d1a22', color:'#aaddff',
                           border:'1px solid #4488aa', borderRadius:3,
                           fontFamily:FONT, fontSize:7, padding:'3px 4px' }}
                >
                  <option value="auto">🌦 Auto (weather-driven)</option>
                  <option value="predatorNight">🌑 Predator Night (default)</option>
                  <option value="jungleStorm">⛈ Jungle Storm</option>
                  <option value="goldenDusk">🌅 Golden Dusk</option>
                  <option value="deepNightMist">🌫 Deep Night Mist</option>
                  <option value="bloodMoon">🩸 Blood Moon</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'background' && (
            <div style={{ padding:'8px 10px 6px', borderBottom:'1px solid #1a3322' }}>
              <div style={{ color:'#556677', fontSize:7, marginBottom:6, letterSpacing:0.5 }}>
                ── BG IMAGE SELECT ──
              </div>
              {[
                { key: 'far',  label: 'FAR Layer',  color: '#44cc88' },
                { key: 'mid',  label: 'MID Layer',  color: '#88ccff' },
                { key: 'near',   label: 'NEAR Layer',   color: '#ffaa44' },
                { key: 'struct', label: 'STRUCT Layer', color: '#ffcc44' },
              ].map(({ key, label, color }) => (
                <div key={key} style={{ marginBottom: 10 }} data-nodrag>
                  <div style={{ color, fontSize: 7, marginBottom: 4 }}>{label}</div>
                  <select
                    value={bgSel[key]}
                    onChange={e => handleBgSelect(key, e.target.value)}
                    style={{
                      width: '100%',
                      background: '#0d1a12',
                      color: '#aaffaa',
                      border: `1px solid ${color}`,
                      borderRadius: 3,
                      fontFamily: FONT,
                      fontSize: 7,
                      padding: '3px 4px',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    {(BG_LAYER_CATALOGUE[key] || []).map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* ── LAYER TOGGLE SECTION ─────────────────────────────────────── */}
          {section && (
            <>
              <div style={{ padding:'5px 10px 4px', display:'flex', alignItems:'center',
                            justifyContent:'space-between', borderBottom:'1px solid #1a3322' }}>
                <span style={{ color:section.color, fontSize:7 }}>{section.label}</span>
                <div style={{ display:'flex', gap:5 }} data-nodrag>
                  <button onClick={() => batchSet(section.layers.map(l=>l.key), true)}  style={bBtn('#44cc88')}>ON</button>
                  <button onClick={() => batchSet(section.layers.map(l=>l.key), false)} style={bBtn('#cc4444')}>OFF</button>
                </div>
              </div>

              <div style={{ padding:'4px 0 4px', maxHeight:240, overflowY:'auto' }}>
                {section.layers.map(({ key, label }) => {
                  const on = flags[key] !== false;
                  return (
                    <div key={key} data-nodrag onClick={() => toggle(key)}
                         style={{ display:'flex', alignItems:'center', gap:8,
                                  padding:'4px 10px', cursor:'pointer' }}
                         onMouseEnter={e => e.currentTarget.style.background='#0d2218'}
                         onMouseLeave={e => e.currentTarget.style.background='transparent'}>
                      {/* pill */}
                      <div style={{ width:26, height:12, borderRadius:6, flexShrink:0,
                                    background: on?'#1a6632':'#3a1a1a',
                                    border:`1px solid ${on?'#44cc88':'#663333'}`,
                                    position:'relative' }}>
                        <div style={{ position:'absolute', top:2, left:on?14:2,
                                      width:8, height:8, borderRadius:'50%',
                                      background: on?'#44cc88':'#cc4444',
                                      transition:'left 0.12s' }} />
                      </div>
                      <span style={{ color:on?'#ccffcc':'#556655', fontSize:8 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── FOOTER ──────────────────────────────────────────────────── */}
          <div style={{ padding:'4px 10px', borderTop:'1px solid #1a3322',
                        display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ color:'#334433', fontSize:7 }}>drag to move</span>
            <button data-nodrag onClick={resetAll} style={bBtn('#8866cc')}>RESET ALL</button>
          </div>
        </div>
      )}
    </div>
  );
}

function bBtn(color) {
  return {
    fontFamily: FONT, fontSize:6, padding:'2px 6px',
    background:'transparent', border:`1px solid ${color}`,
    color, cursor:'pointer', borderRadius:2,
  };
}
