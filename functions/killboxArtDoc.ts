Deno.serve(async (req) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>KILLBOX — Biome Visual Overhaul v1 — Driftgate Art Direction</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
  :root{--dg-black:#080a08;--dg-dark:#0f130e;--dg-card:#141a12;--dg-border:#1e2a1a;--dg-green:#3a7a2a;--dg-lime:#7abf3a;--dg-red:#c03a2a;--dg-orange:#d4621a;--dg-gold:#c89a2a;--dg-text:#c8d4c0;--dg-muted:#6a7a62;--dg-white:#e8f0e0;}
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:var(--dg-black);color:var(--dg-text);font-family:'Inter',sans-serif;font-size:15px;line-height:1.7;}
  .page{max-width:1200px;margin:0 auto;padding:0 40px 120px;}
  .cover{background:var(--dg-dark);border-bottom:2px solid var(--dg-lime);padding:60px 40px 50px;display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:20px;max-width:1200px;margin:0 auto;}
  .cover-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.25em;color:var(--dg-lime);text-transform:uppercase;margin-bottom:12px;}
  .cover-title{font-family:'Bebas Neue',sans-serif;font-size:72px;line-height:.9;color:var(--dg-white);letter-spacing:.04em;}
  .cover-title span{color:var(--dg-lime);}
  .cover-sub{font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--dg-orange);letter-spacing:.1em;margin-top:6px;}
  .cover-right{text-align:right;}
  .cover-stamp{border:2px solid var(--dg-red);padding:8px 18px;font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.18em;color:var(--dg-red);text-transform:uppercase;transform:rotate(2deg);display:inline-block;margin-bottom:16px;}
  .cover-meta p{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--dg-muted);letter-spacing:.12em;line-height:2;text-transform:uppercase;text-align:right;}
  .cover-meta strong{color:var(--dg-text);}
  .ba-wrap{background:#000;border:1px solid var(--dg-border);border-radius:4px;overflow:hidden;margin:40px 0;}
  .ba-img{width:100%;display:block;}
  .ba-caption{padding:14px 20px;background:var(--dg-card);border-top:1px solid var(--dg-border);font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--dg-muted);letter-spacing:.1em;display:flex;justify-content:space-between;}
  .ba-caption strong{color:var(--dg-lime);}
  .divider{height:1px;background:linear-gradient(to right,transparent,var(--dg-border),transparent);margin:56px 0;}
  .divider-thick{height:2px;background:linear-gradient(to right,var(--dg-green),var(--dg-lime),var(--dg-green));margin:72px 0;}
  .section-header{display:flex;gap:20px;align-items:flex-start;margin-bottom:36px;}
  .section-num{font-family:'Bebas Neue',sans-serif;font-size:64px;line-height:1;color:var(--dg-border);min-width:70px;margin-top:-6px;}
  .section-eyebrow{font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.22em;color:var(--dg-lime);text-transform:uppercase;margin-bottom:4px;}
  .section-title{font-family:'Bebas Neue',sans-serif;font-size:40px;letter-spacing:.06em;color:var(--dg-white);line-height:1;}
  .section-desc{font-size:13px;color:var(--dg-muted);font-style:italic;margin-top:6px;}
  .asset-card{background:var(--dg-card);border:1px solid var(--dg-border);border-radius:4px;overflow:hidden;margin-bottom:24px;}
  .asset-card-header{padding:16px 20px;border-bottom:1px solid var(--dg-border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;}
  .asset-name{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.08em;color:var(--dg-white);}
  .asset-badges{display:flex;gap:6px;flex-wrap:wrap;}
  .badge{display:inline-block;padding:3px 10px;border-radius:2px;font-size:10px;font-family:'JetBrains Mono',monospace;letter-spacing:.1em;font-weight:600;}
  .badge-lime{background:rgba(122,191,58,.15);color:var(--dg-lime);border:1px solid var(--dg-green);}
  .badge-gold{background:rgba(200,154,42,.15);color:var(--dg-gold);border:1px solid #8a6a1a;}
  .badge-red{background:rgba(192,58,42,.15);color:#f07060;border:1px solid var(--dg-red);}
  .badge-grey{background:rgba(106,122,98,.12);color:var(--dg-muted);border:1px solid var(--dg-muted);}
  .asset-img{width:100%;display:block;background:#000;}
  .asset-body{padding:16px 20px;}
  .asset-desc{font-size:13px;color:var(--dg-text);margin-bottom:12px;}
  .spec-list{list-style:none;}
  .spec-list li{font-size:12px;font-family:'JetBrains Mono',monospace;color:var(--dg-muted);padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04);display:flex;gap:8px;}
  .spec-list li:last-child{border-bottom:none;}
  .spec-list li::before{content:'→';color:var(--dg-lime);flex-shrink:0;}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:20px;}
  .layer-stack{margin:32px 0;}
  .layer-row{display:flex;align-items:stretch;margin-bottom:6px;}
  .layer-num{font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--dg-lime);width:48px;display:flex;align-items:center;justify-content:center;background:rgba(122,191,58,.08);border:1px solid var(--dg-border);border-right:none;flex-shrink:0;}
  .layer-content{flex:1;padding:14px 20px;background:var(--dg-card);border:1px solid var(--dg-border);border-right:none;}
  .layer-name{font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.08em;color:var(--dg-white);}
  .layer-detail{font-size:12px;color:var(--dg-muted);margin-top:2px;}
  .layer-rule{width:200px;padding:14px 16px;background:var(--dg-dark);border:1px solid var(--dg-border);font-size:11px;font-family:'JetBrains Mono',monospace;color:var(--dg-muted);flex-shrink:0;}
  .layer-rule.rule-lock{border-left:3px solid var(--dg-red);color:#f07060;}
  .layer-rule.rule-art{border-left:3px solid var(--dg-lime);color:var(--dg-lime);}
  .composite-wrap{background:#000;border:2px solid var(--dg-lime);border-radius:4px;overflow:hidden;margin:32px 0;box-shadow:0 0 60px rgba(122,191,58,.1);}
  .composite-img{width:100%;display:block;}
  .composite-caption{padding:16px 24px;background:var(--dg-card);border-top:2px solid var(--dg-lime);display:flex;justify-content:space-between;align-items:center;}
  .composite-label{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:.08em;color:var(--dg-lime);}
  .composite-meta{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--dg-muted);text-align:right;letter-spacing:.12em;}
  .impl-block{background:#0a0f09;border:1px solid var(--dg-border);border-left:3px solid var(--dg-lime);border-radius:0 4px 4px 0;padding:20px 24px;margin:20px 0;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--dg-text);line-height:1.8;}
  .impl-block .lbl{color:var(--dg-lime);font-size:10px;letter-spacing:.2em;text-transform:uppercase;margin-bottom:10px;display:block;}
  .quote-block{border-left:4px solid var(--dg-lime);padding:18px 24px;background:var(--dg-card);margin:28px 0;border-radius:0 4px 4px 0;}
  .quote-text{font-size:16px;font-style:italic;color:var(--dg-white);line-height:1.6;}
  .quote-src{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--dg-muted);margin-top:10px;letter-spacing:.15em;text-transform:uppercase;}
  .warning-block{background:rgba(192,58,42,.08);border:1px solid var(--dg-red);border-radius:4px;padding:18px 24px;margin:20px 0;}
  .warning-title{font-family:'Bebas Neue',sans-serif;font-size:18px;color:#f07060;letter-spacing:.08em;margin-bottom:8px;}
  .dg-table{width:100%;border-collapse:collapse;margin:20px 0;font-size:13px;}
  .dg-table th{background:var(--dg-border);color:var(--dg-lime);font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.15em;text-transform:uppercase;padding:10px 16px;text-align:left;}
  .dg-table td{padding:10px 16px;border-bottom:1px solid var(--dg-border);color:var(--dg-text);}
  .dg-table tr:nth-child(even) td{background:rgba(255,255,255,.02);}
  .dg-table td:first-child{font-weight:600;color:var(--dg-white);}
  .doc-footer{margin-top:80px;padding:36px 0;border-top:1px solid var(--dg-border);display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;}
  .footer-logo{font-family:'Bebas Neue',sans-serif;font-size:24px;letter-spacing:.12em;color:var(--dg-lime);}
  .footer-logo span{color:var(--dg-muted);font-size:11px;display:block;font-family:'JetBrains Mono',monospace;letter-spacing:.2em;}
  .footer-meta p{font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--dg-muted);letter-spacing:.1em;line-height:2;text-align:right;}
  p{margin-bottom:12px;} .mt16{margin-top:16px;} .mt24{margin-top:24px;} .mt32{margin-top:32px;}
  @media(max-width:700px){.grid-2{grid-template-columns:1fr;}.layer-rule{display:none;}.page{padding:0 16px 80px;}.cover{padding:40px 16px 36px;}.cover-title{font-size:48px;}}
</style>
</head>
<body>

<div class="cover">
  <div>
    <div class="cover-eyebrow">Driftgate Studios · Side Scroller Division · Art Direction Document</div>
    <div class="cover-title">KILLBOX<br><span>BIOME VISUAL</span><br>OVERHAUL</div>
    <div class="cover-sub">v1.0 — From Prototype Blocks to Cinematic Jungle</div>
  </div>
  <div class="cover-right">
    <div class="cover-stamp">Internal Confidential</div>
    <div class="cover-meta">
      <p>Prepared by: <strong>VULCAN</strong></p>
      <p>Division: <strong>Side Scroller</strong></p>
      <p>Phase: <strong>1 — Art Direction</strong></p>
      <p>Date: <strong>May 2026</strong></p>
      <p>Status: <strong>Art Assets Generated</strong></p>
    </div>
  </div>
</div>

<div class="page">
<div class="divider-thick"></div>

<div class="section-header">
  <div class="section-num">00</div>
  <div>
    <div class="section-eyebrow">The Brief</div>
    <div class="section-title">Before / After — The Target</div>
    <div class="section-desc">Andrew's reference: the exact transformation we are building toward</div>
  </div>
</div>

<div class="ba-wrap">
  <img class="ba-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/cfbe9aa44_Screenshot2026-05-16133236.png" alt="Before After Reference"/>
  <div class="ba-caption"><strong>REFERENCE: Andrew's Before/After Concept</strong><span>TOP = CURRENT · BOTTOM = TARGET</span></div>
</div>

<div class="warning-block">
  <div class="warning-title">⚠ Critical Architecture Warning</div>
  <p>The AFTER image is gorgeous and it is also a trap. Bake that visual complexity into the gameplay terrain layer and you destroy destructibility, tunneling, and procedural generation. <strong style="color:#f07060;">Do NOT do that.</strong> The solution is a layered system — background art in background layers, gameplay terrain stays modular, props sit as separate entities on top. Looks identical. Stays fully destructible.</p>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">01</div>
  <div>
    <div class="section-eyebrow">System Architecture</div>
    <div class="section-title">The 6-Layer Art Stack</div>
    <div class="section-desc">How the visual system looks incredible AND stays fully destructible</div>
  </div>
</div>

<div class="layer-stack">
  <div class="layer-row"><div class="layer-num">6</div><div class="layer-content"><div class="layer-name">FAR BACKGROUND — Atmosphere</div><div class="layer-detail">Distant jungle silhouettes, mountains, storm sky. Parallax 15%.</div></div><div class="layer-rule rule-art">PURE ART — No gameplay data</div></div>
  <div class="layer-row"><div class="layer-num">5</div><div class="layer-content"><div class="layer-name">MID BACKGROUND — Depth</div><div class="layer-detail">Giant background trees, ruins, waterfalls, god rays. Parallax 40%.</div></div><div class="layer-rule rule-art">PURE ART — No gameplay data</div></div>
  <div class="layer-row"><div class="layer-num">4</div><div class="layer-content"><div class="layer-name">NEAR BACKGROUND — Atmosphere FX</div><div class="layer-detail">Foreground vines, fog wisps, fireflies, rain. Parallax 70%.</div></div><div class="layer-rule rule-art">PURE ART — Particle system</div></div>
  <div class="layer-row"><div class="layer-num">3</div><div class="layer-content"><div class="layer-name">GAMEPLAY TERRAIN — Tiles</div><div class="layer-detail">THE SACRED LAYER. Dirt variants, stone variants, wood platforms. Fully destructible. Fully tileable. Fully modular.</div></div><div class="layer-rule rule-lock">⚠ DO NOT BAKE ART<br>Must stay modular</div></div>
  <div class="layer-row"><div class="layer-num">2</div><div class="layer-content"><div class="layer-name">SURFACE PROPS — Dressing</div><div class="layer-detail">Ferns, roots, rocks, skulls, military debris. Sit ON TOP of terrain. Destroyable individually.</div></div><div class="layer-rule rule-lock">SEPARATE ENTITIES<br>Not baked into tiles</div></div>
  <div class="layer-row"><div class="layer-num">1</div><div class="layer-content"><div class="layer-name">GAMEPLAY ENTITIES — Foreground</div><div class="layer-detail">Player, squad, hunter, traps, trees, projectiles. Always renders above all background layers.</div></div><div class="layer-rule rule-lock">GAMEPLAY LAYER<br>Physics + collision</div></div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">02</div>
  <div>
    <div class="section-eyebrow">Target Aesthetic</div>
    <div class="section-title">Full Scene Composite</div>
    <div class="section-desc">The complete target look — all layers combined</div>
  </div>
</div>

<div class="composite-wrap">
  <img class="composite-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/ac28a7171_generated_image.png" alt="Full Scene Composite"/>
  <div class="composite-caption">
    <div class="composite-label">TARGET SCENE — All Layers Active</div>
    <div class="composite-meta">PREDATOR + ODDWORLD + FLASHBACK<br>PIXEL ART JUNGLE SURVIVAL SANDBOX</div>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">03</div>
  <div>
    <div class="section-eyebrow">Layer 3 — Gameplay Terrain</div>
    <div class="section-title">Terrain Tile Overhaul</div>
    <div class="section-desc">The sacred layer. Rich, modular, destructible. Still tileable. Still readable.</div>
  </div>
</div>

<div class="grid-2">
  <div class="asset-card">
    <div class="asset-card-header"><div class="asset-name">Dirt Tile Variants</div><div class="asset-badges"><span class="badge badge-lime">TILEABLE</span><span class="badge badge-lime">DESTRUCTIBLE</span><span class="badge badge-gold">PRIORITY 1</span></div></div>
    <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/f1fae3492_generated_image.png" alt="Dirt Tiles"/>
    <div class="asset-body">
      <p class="asset-desc">7 variants replacing the single flat brown dirt block. Triggered by depth, moisture, and post-destruction state.</p>
      <ul class="spec-list"><li>Standard dark earth — base tile, deep brown #3d2410</li><li>Root-threaded — thin pale roots weaving through</li><li>Muddy dirt — wetter, darker, post-rain state</li><li>Rocky dirt — small embedded stone inclusions</li><li>Grass-cap — top surface tile with grass lip + hanging roots</li><li>Damaged — rough edges, post-explosion state</li><li>Stone-embedded — cobble inclusions for stone transition</li></ul>
    </div>
  </div>
  <div class="asset-card">
    <div class="asset-card-header"><div class="asset-name">Stone / Ancient Rock Tiles</div><div class="asset-badges"><span class="badge badge-lime">TILEABLE</span><span class="badge badge-lime">DESTRUCTIBLE</span><span class="badge badge-gold">PRIORITY 1</span></div></div>
    <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/26deae15e_generated_image.png" alt="Stone Tiles"/>
    <div class="asset-body">
      <p class="asset-desc">Replaces the flat grey checkerboard. 7 variants of mossy ancient stone. Reads as ruins embedded in jungle terrain.</p>
      <ul class="spec-list"><li>Standard mossy stone — dark grey-green, moss patches</li><li>Cracked stone — deep fissure lines, structural damage</li><li>Wet stone — darker surface, slight sheen</li><li>Root-cracked — thick roots bursting through tile joints</li><li>Rubble — broken edges, post-impact state</li><li>Underground stone — damp, darker, deep layer</li><li>Ancient carved — faint worn relief, lost temple feel</li></ul>
    </div>
  </div>
</div>

<div class="grid-2 mt16">
  <div class="asset-card">
    <div class="asset-card-header"><div class="asset-name">Grass / Ground Cover</div><div class="asset-badges"><span class="badge badge-lime">TILEABLE</span><span class="badge badge-gold">PRIORITY 2</span></div></div>
    <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/2a6a37d0e_generated_image.png" alt="Grass Tiles"/>
    <div class="asset-body">
      <p class="asset-desc">Replaces the bright lime-green grass cap with dark, dense, dangerous-looking jungle ground cover.</p>
      <ul class="spec-list"><li>Dense jungle grass cap — dark #2a4a1a, short thick blades</li><li>Tall grass fringe — taller blades, some bent</li><li>Mud surface — wet dark brown, footprint impressions</li><li>Moss carpet — flat textured blue-green moss mat</li><li>Disturbed soil — dug-up loose dirt (post-shovel)</li><li>Ash ground — post-fire state, dark grey</li><li>Leaf litter — fallen brown-orange leaves</li></ul>
    </div>
  </div>
  <div class="asset-card">
    <div class="asset-card-header"><div class="asset-name">Wood Platform Tiles</div><div class="asset-badges"><span class="badge badge-lime">TILEABLE</span><span class="badge badge-lime">DESTRUCTIBLE</span><span class="badge badge-gold">PRIORITY 2</span></div></div>
    <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/57aa91cf0_generated_image.png" alt="Wood Tiles"/>
    <div class="asset-body">
      <p class="asset-desc">Rich wood grain tile variants for built platforms, bridges, and structures.</p>
      <ul class="spec-list"><li>Standard plank — horizontal grain, dark oak #3a2010</li><li>Aged wood — greying, slight moss at edges</li><li>Wet wood — darker, water-darkened state</li><li>Damaged wood — cracks, splinters, nail heads exposed</li><li>Jungle-grown — vines beginning to overtake the planks</li><li>Rope-lashed log platform — round logs with rope joins</li><li>Bamboo platform — pale bamboo green-tan, node joints</li></ul>
    </div>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">04</div>
  <div>
    <div class="section-eyebrow">Tree System Overhaul</div>
    <div class="section-title">Modular Tree Architecture</div>
    <div class="section-desc">Goodbye lollipop trees. The system stays destructible — it just looks real now.</div>
  </div>
</div>

<div class="asset-card">
  <div class="asset-card-header"><div class="asset-name">Modular Tree Component Set</div><div class="asset-badges"><span class="badge badge-lime">DESTRUCTIBLE</span><span class="badge badge-lime">MODULAR</span><span class="badge badge-lime">PRESERVES PHYSICS</span><span class="badge badge-gold">PRIORITY 1</span></div></div>
  <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/15e5f0e2e_generated_image.png" alt="Tree Components"/>
  <div class="asset-body">
    <p class="asset-desc">Trees rebuilt as modular component assemblies. Chopping, falling physics, and leaf harvesting systems completely preserved. Only the visual representation changes.</p>
    <div class="grid-2 mt16">
      <ul class="spec-list"><li>Trunk base — wide, gnarled, surface roots splaying outward</li><li>Mid trunk — bark grain + moss patches</li><li>Upper trunk — fork point into branch structure</li><li>Canopy — wide irregular silhouette, layered leaf masses</li><li>Hanging vines — draped from branches</li></ul>
      <ul class="spec-list"><li>Damaged trunk state — axe cuts, splinter marks visible</li><li>Fallen log state — horizontal, usable platform</li><li>Stump state — remains after full chop</li><li>Canopy burst — leaf explosion particle set</li><li>Root system — visible underground root spread</li></ul>
    </div>
    <div class="impl-block mt16"><span class="lbl">Implementation Note — Critical</span>The existing TreeHarvestSystem and tree fall physics MUST NOT be touched during visual upgrade. Only the render function changes: instead of drawing a rectangle for trunk and a square for canopy, draw the component sprites at correct relative positions. All collision, chopping, falling, and leaf-burst systems remain on existing tile/entity data.</div>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">05</div>
  <div>
    <div class="section-eyebrow">Layer 2 — Surface Dressing</div>
    <div class="section-title">Jungle Prop Library</div>
    <div class="section-desc">What transforms "terrain" into "alive, dangerous jungle"</div>
  </div>
</div>

<div class="grid-2">
  <div class="asset-card">
    <div class="asset-card-header"><div class="asset-name">Surface Foliage &amp; Debris Props</div><div class="asset-badges"><span class="badge badge-lime">SEPARATE ENTITIES</span><span class="badge badge-gold">PRIORITY 2</span></div></div>
    <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/f35c1c967_generated_image.png" alt="Surface Props"/>
    <div class="asset-body">
      <p class="asset-desc">Props that sit ON TOP of terrain tiles as separate entities. NOT baked in. Can be destroyed or used as cover.</p>
      <ul class="spec-list"><li>Dense fern cluster, large jungle leaf cluster</li><li>Mossy rock — small, rounded cover object</li><li>Skull half-buried in dirt</li><li>Broken military crate, ammo box (partially buried)</li><li>Rusty canteen, ground puddle with reflection</li><li>Hanging vine loop, root cluster from ground</li><li>Jungle flower cluster, spider web</li></ul>
    </div>
  </div>
  <div class="asset-card">
    <div class="asset-card-header"><div class="asset-name">Military Camp Props</div><div class="asset-badges"><span class="badge badge-lime">SEPARATE ENTITIES</span><span class="badge badge-gold">PRIORITY 2</span></div></div>
    <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/4e33c8eb7_generated_image.png" alt="Military Camp Props"/>
    <div class="asset-body">
      <p class="asset-desc">Military camp props for player-built base areas and world dressing. Establishes that humans were here — and something is coming.</p>
      <ul class="spec-list"><li>Olive-drab canvas tent (side view, camouflage netting)</li><li>Wooden crate stack (stencilled military markings)</li><li>Burning torch on stake — dynamic light source</li><li>Campfire ring with embers</li><li>Radio equipment table, rolled bedroll</li><li>Sandbag wall (2 layers, defensive structure)</li><li>Hanging lantern — glowing warm yellow light</li></ul>
    </div>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">06</div>
  <div>
    <div class="section-eyebrow">Trap Visual Language</div>
    <div class="section-title">Trap Prop Set</div>
    <div class="section-desc">Identifiable to the player. Subtle enough to surprise the Hunter.</div>
  </div>
</div>

<div class="asset-card">
  <div class="asset-card-header"><div class="asset-name">Armed Trap Visuals</div><div class="asset-badges"><span class="badge badge-lime">GAMEPLAY ENTITIES</span><span class="badge badge-lime">PLAYER READABLE</span><span class="badge badge-red">HUNTER READABLE — BARELY</span><span class="badge badge-gold">PRIORITY 1</span></div></div>
  <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/9adf5a8e0_generated_image.png" alt="Trap Visuals"/>
  <div class="asset-body">
    <p class="asset-desc">Trap props in armed state. Player sees clearly. Hunter AI detects with difficulty. New players learn trap positions by dying to them.</p>
    <div class="grid-2 mt16">
      <ul class="spec-list"><li>Punji spike pit — bamboo stakes, blood-stained tips</li><li>Hanging log deadfall — suspended log + visible tripwire</li><li>Rope snare — camouflaged loop on ground</li></ul>
      <ul class="spec-list"><li>Wooden spike wall — angled stakes + vine camouflage</li><li>Tripwire — thin wire between stakes, slight glint</li><li>Explosive claymore — hidden in bush, detonator wire</li></ul>
    </div>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">07</div>
  <div>
    <div class="section-eyebrow">Layers 4, 5, 6 — Background</div>
    <div class="section-title">Parallax Background Stack</div>
    <div class="section-desc">Where the atmosphere lives. The black void dies here.</div>
  </div>
</div>

<div class="asset-card">
  <div class="asset-card-header"><div class="asset-name">Far Background — Atmosphere Layer</div><div class="asset-badges"><span class="badge badge-grey">PARALLAX 15%</span><span class="badge badge-lime">PURE ART</span></div></div>
  <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/536f95c82_generated_image.png" alt="Far Background"/>
  <div class="asset-body"><p class="asset-desc">Replaces the pure black void. Darkest, most atmospheric layer. Distant jungle silhouettes, mountains through haze, storm clouds building. Scrolls at 15% camera speed. The world has depth now.</p></div>
</div>

<div class="asset-card mt16">
  <div class="asset-card-header"><div class="asset-name">Mid Background — Depth Layer</div><div class="asset-badges"><span class="badge badge-grey">PARALLAX 40%</span><span class="badge badge-lime">PURE ART</span><span class="badge badge-gold">PRIORITY 1</span></div></div>
  <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/d79985a67_generated_image.png" alt="Mid Background"/>
  <div class="asset-body">
    <p class="asset-desc">The layer that makes the most visual impact. Giant background tree trunks, ancient ruins, a waterfall, and god rays piercing from upper right. This single layer transforms the game from void to ancient dangerous jungle.</p>
    <ul class="spec-list mt16"><li>Massive tree trunks in mid-distance — creates sense of scale</li><li>Ancient stone ruins — lore without words</li><li>God rays from upper right — cinematic warmth in darkness</li><li>Waterfall — audio hook for Phase 2 sound design</li><li>Dense undergrowth silhouettes — depth, obscures Hunter movement</li></ul>
  </div>
</div>

<div class="asset-card mt16">
  <div class="asset-card-header"><div class="asset-name">Near Background — Atmosphere FX Layer</div><div class="asset-badges"><span class="badge badge-grey">PARALLAX 70%</span><span class="badge badge-lime">PARTICLE SYSTEM</span></div></div>
  <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/80f56b250_generated_image.png" alt="Near Background"/>
  <div class="asset-body">
    <p class="asset-desc">The closest background layer — alive with particles and atmospheric effects. Foreground vines, fog pooling in valleys, fireflies in dark areas, rain streaks. This layer breathes.</p>
    <ul class="spec-list mt16"><li>Large hanging vines at left/right screen edges — framing device</li><li>Ground fog wisps in low terrain areas — dynamic, rolls slowly</li><li>Fireflies — tiny glowing particles in dark zones</li><li>Rain streaks — integrates with existing rain system</li><li>Large leaves entering from top corners — sense of canopy above</li></ul>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">08</div>
  <div>
    <div class="section-eyebrow">Underground System</div>
    <div class="section-title">Underground Visual Overhaul</div>
    <div class="section-desc">Currently a dirt rectangle. Should feel claustrophobic, ancient, terrifying.</div>
  </div>
</div>

<div class="asset-card">
  <div class="asset-card-header"><div class="asset-name">Underground Tile &amp; Prop Set</div><div class="asset-badges"><span class="badge badge-lime">TILEABLE</span><span class="badge badge-lime">DESTRUCTIBLE</span><span class="badge badge-gold">PRIORITY 2</span><span class="badge badge-red">FUTURE: HUNTER CAN DIG HERE</span></div></div>
  <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/033871843_generated_image.png" alt="Underground Tiles"/>
  <div class="asset-body">
    <p class="asset-desc">Deep underground tiles and props. Claustrophobic. Ancient. The deeper you dig, the older it feels. Bioluminescent mushrooms provide subtle light.</p>
    <div class="grid-2 mt16">
      <ul class="spec-list"><li>Deep underground dirt — very dark #1a0f07</li><li>Underground stone — near-black, faint mineral veins</li><li>Wet underground wall — moisture seep marks</li><li>Root-invaded underground — thick pale roots through walls</li></ul>
      <ul class="spec-list"><li>Bioluminescent mushroom cluster — pale blue-green glow</li><li>Rusted military helmet half-buried</li><li>Ancient pottery shard embedded in wall</li><li>Underground puddle — dark reflective surface</li></ul>
    </div>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">09</div>
  <div>
    <div class="section-eyebrow">Particle &amp; Effect System</div>
    <div class="section-title">Atmospheric Particles</div>
    <div class="section-desc">The micro-detail that makes the world feel alive between events</div>
  </div>
</div>

<div class="asset-card">
  <div class="asset-card-header"><div class="asset-name">Full Particle Sprite Sheet</div><div class="asset-badges"><span class="badge badge-lime">RUNTIME PARTICLES</span><span class="badge badge-gold">PRIORITY 2</span></div></div>
  <img class="asset-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/8510eeb9a_generated_image.png" alt="Particle Sheet"/>
  <div class="asset-body">
    <p class="asset-desc">Complete particle sprite set: rain drops, splashes, firefly glows, falling leaves, ember sparks, fog wisps, leaf burst (tree chop), dirt clods (explosions), smoke puffs, blood spray, muzzle flash, bullet trails, shell casings.</p>
    <div class="impl-block mt16"><span class="lbl">Implementation Note</span>Integrates with existing particle system in physics.js and grenadeSystem.js. Replace current coloured-dot particles with sprite-based particles from this sheet. Firefly and fog particles are ambient — spawn on a slow timer in dark areas near water. Leaf burst replaces current tree-chop particle emission.</div>
  </div>
</div>

<div class="divider"></div>

<div class="section-header">
  <div class="section-num">10</div>
  <div>
    <div class="section-eyebrow">For Aragorn</div>
    <div class="section-title">Implementation Priority Order</div>
    <div class="section-desc">The exact sequence to implement this without breaking anything. Follow this order.</div>
  </div>
</div>

<table class="dg-table">
  <thead><tr><th>#</th><th>Task</th><th>Files</th><th>Priority</th><th>Breaks Anything?</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>Add parallax background render system — 3 layers</td><td>new backgroundRenderer.js</td><td><span class="badge badge-red">CRITICAL FIRST</span></td><td>No. Renders before terrain.</td></tr>
    <tr><td>2</td><td>Load and render far background at parallax 0.15</td><td>backgroundRenderer.js</td><td><span class="badge badge-gold">HIGH</span></td><td>No.</td></tr>
    <tr><td>3</td><td>Load and render mid background at parallax 0.4</td><td>backgroundRenderer.js</td><td><span class="badge badge-gold">HIGH</span></td><td>No.</td></tr>
    <tr><td>4</td><td>Replace terrain tile render with variant tile sprites</td><td>worldRenderer.js tile section</td><td><span class="badge badge-gold">HIGH</span></td><td>No. Visual only — tile ID unchanged.</td></tr>
    <tr><td>5</td><td>Replace tree render with modular component sprites</td><td>treeRenderer.js render</td><td><span class="badge badge-gold">HIGH</span></td><td>No. Physics unchanged — render only.</td></tr>
    <tr><td>6</td><td>Add surface prop scatter on terrain gen</td><td>worldGen.js post-gen pass + propRenderer.js</td><td><span class="badge badge-lime">MEDIUM</span></td><td>Add as separate post-gen pass only.</td></tr>
    <tr><td>7</td><td>Replace particle dot sprites with sprite sheet</td><td>physics.js particle section</td><td><span class="badge badge-lime">MEDIUM</span></td><td>No. Additive — replace color with sprite.</td></tr>
    <tr><td>8</td><td>Add near background ambient particles (fireflies, fog)</td><td>new ambientParticles.js</td><td><span class="badge badge-grey">LOW</span></td><td>No. Purely additive.</td></tr>
    <tr><td>9</td><td>Underground tile variant rendering (depth-based)</td><td>worldRenderer.js tile section</td><td><span class="badge badge-grey">LOW</span></td><td>No. Visual only.</td></tr>
    <tr><td>10</td><td>Trap prop sprites integration</td><td>traps.js render section</td><td><span class="badge badge-grey">LOW</span></td><td>No. Visual only — trap logic unchanged.</td></tr>
  </tbody>
</table>

<div class="warning-block mt24">
  <div class="warning-title">⚠ Anti-Drift Lock for Aragorn</div>
  <p>DO NOT modify physics.js collision detection. DO NOT alter worldGen.js tile ID assignments. DO NOT touch destruction systems. DO NOT rewrite any game loop systems. This is a VISUAL LAYER task only. If you find yourself touching tile physics, collision masks, or the tree fall system — stop. You are drifting. Return to the renderer only.</p>
</div>

<div class="divider"></div>

<div class="composite-wrap mt32">
  <img class="composite-img" src="https://media.base44.com/images/public/6a07d557e104123d6d54764f/ac28a7171_generated_image.png" alt="Full Scene"/>
  <div class="composite-caption">
    <div class="composite-label">Same mechanics. Same systems. A completely different world.</div>
    <div class="composite-meta">DRIFTGATE STUDIOS — BUILD WEIRD THINGS. MAKE THEM INCREDIBLE.</div>
  </div>
</div>

<div class="doc-footer">
  <div><div class="footer-logo">DRIFTGATE STUDIOS<span>SIDE SCROLLER DIVISION</span></div></div>
  <div class="footer-meta"><p>KILLBOX BIOME VISUAL OVERHAUL v1.0</p><p>AUTHOR: VULCAN — DIVISION PRESIDENT</p><p>DATE: MAY 2026 · INTERNAL CONFIDENTIAL</p></div>
</div>

</div>
</body>
</html>`;
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
