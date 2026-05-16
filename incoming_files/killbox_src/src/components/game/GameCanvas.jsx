import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGameState, updateGame, handleKeyDown, handleKeyUp, renderGameFrame, destroyAudio, setAudioPhase, initAudio } from '../../lib/game/engine';
import { handleZoomInput, panCameraFree } from '../../lib/game/core/cameraSystem';
import { handleMouseMove, handleMouseDown, handleMouseUp } from '../../lib/game/input';
import { GAME_STATES } from '../../lib/game/constants';
import DevAdminPanel from './DevAdminPanel';

// Parallax factors — mirrors renderer.js PARALLAX constant for display in debug
const LAYER_DEBUG_INFO = [
  { name: 'FAR SKY',        parallax: 0.00 },
  { name: 'SUN',            parallax: 0.03 },
  { name: 'FAR MOUNTAINS',  parallax: 0.06 },
  { name: 'FAR BACKGROUND', parallax: 0.12 },
  { name: 'MID TREES',      parallax: 0.25 },
  { name: 'VINES',          parallax: 0.20 },
  { name: 'FOREGROUND',     parallax: 0.48 },
  { name: 'FOG',            parallax: 0.04 },
  { name: 'WORLD (GAME)',   parallax: 1.00, zoom: true },
  { name: 'RAIN/LIGHTNING', parallax: '(screen)' },
  { name: 'GOD RAYS',       parallax: '(screen)' },
  { name: 'HUD',            parallax: '(screen)' },
];

const CAM_PAN_SPEED = 8;

export default function GameCanvas() {
  const canvasRef = useRef(null);
  const gameStateRef = useRef(null);
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const [debugInfo, setDebugInfo] = useState(null);
  const navigate = useNavigate();
  const [showDebug, setShowDebug] = useState(false);
  const [showLayerDebug, setShowLayerDebug] = useState(false);
  const [showPauseMenu, setShowPauseMenu] = useState(false);
  const isPausedRef = useRef(false);  // ref so game loop can read without re-render
  const camKeysRef = useRef({ up: false, down: false, left: false, right: false });

  const handleResume = useCallback(() => {
    isPausedRef.current = false;
    setShowPauseMenu(false);
  }, []);

  const handleMainMenu = useCallback(() => {
    isPausedRef.current = false;
    setShowPauseMenu(false);
    // Reset game state to title screen
    if (gameStateRef.current) {
      gameStateRef.current.gamePhase = 'title';
      setAudioPhase('title');
    }
  }, []);

  const initGame = useCallback(() => {
    // createGameState() reads selectedCharacter from sessionStorage.
    // Do NOT remove it here — let the engine consume it first.
    // It will be cleared after the insertion cinematic completes,
    // so returning to '/' without a selection correctly shows the title.
    gameStateRef.current = createGameState();

    // Clear the key NOW — after createGameState has read it.
    // This means a page refresh on '/' won't re-use a stale character
    // selection, but navigating here fresh from CharacterSelect works fine.
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('selectedCharacter');
    }
  }, []);

  useEffect(() => {
    initGame();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    function resize() {
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }

    resize();
    window.addEventListener('resize', resize);

    function gameLoop(timestamp) {
      const delta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      if (gameStateRef.current) {
        const gs = gameStateRef.current;

        // Arrow key camera panning (only in FREE or FOLLOW modes)
        const ck = camKeysRef.current;
        if (ck.up || ck.down || ck.left || ck.right) {
          const dx = (ck.right ? CAM_PAN_SPEED : 0) - (ck.left ? CAM_PAN_SPEED : 0);
          const dy = (ck.down ? CAM_PAN_SPEED : 0) - (ck.up ? CAM_PAN_SPEED : 0);
          panCameraFree(gs.camera, dx, dy);
        }

        if (!isPausedRef.current) updateGame(gs, Math.min(delta, 32));

        // React-router navigation signal — avoids full page reload (white flash)
        if (gs._navigateTo) {
          const dest = gs._navigateTo;
          gs._navigateTo = null;
          navigate(dest);
          return;
        }

        renderGameFrame(ctx, canvas, gs);

        // Update debug info every frame (cheap setState batched by React)
        if (showDebug) {
          setDebugInfo({
            camX: Math.round(gs.camera.x),
            camY: Math.round(gs.camera.y),
            camMode: gs.camera.mode,
            zoom: gs.camera.zoom.toFixed(2),
            playerX: Math.round(gs.player.x),
            playerY: Math.round(gs.player.y),
            phase: gs.gamePhase,
            fps: delta > 0 ? Math.round(1000 / delta) : 0,
          });
        }
      }

      animFrameRef.current = requestAnimationFrame(gameLoop);
    }

    animFrameRef.current = requestAnimationFrame(gameLoop);

    function onMouseMove(e) {
      if (gameStateRef.current) handleMouseMove(gameStateRef.current, e, canvas);
    }
    function onMouseDown(e) {
      if (gameStateRef.current) handleMouseDown(gameStateRef.current, e, canvas);
    }
    function onMouseUp(e) {
      if (gameStateRef.current) handleMouseUp(gameStateRef.current, e);
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    function onKeyDown(e) {
      // Arrow keys: camera pan (don't pass to engine)
      if (e.code === 'ArrowUp')    { camKeysRef.current.up = true;    e.preventDefault(); return; }
      if (e.code === 'ArrowDown')  { camKeysRef.current.down = true;  e.preventDefault(); return; }
      if (e.code === 'ArrowLeft')  { camKeysRef.current.left = true;  e.preventDefault(); return; }
      if (e.code === 'ArrowRight') { camKeysRef.current.right = true; e.preventDefault(); return; }

      // Toggle debug overlay
      if (e.key === '`' || e.key === '~') {
        setShowDebug(prev => !prev);
        return;
      }
      // Toggle layer parallax debug (P key)
      if (e.key === 'p' || e.key === 'P') {
        setShowLayerDebug(prev => !prev);
        return;
      }

      // ESC — toggle pause menu (only when in-game, not on title)
      if (e.code === 'Escape') {
        const gs = gameStateRef.current;
        const phase = gs ? gs.gamePhase : null;
        const inGame = phase && phase !== 'title' && phase !== 'insertion';
        if (inGame) {
          const next = !isPausedRef.current;
          isPausedRef.current = next;
          setShowPauseMenu(next);
        }
        e.preventDefault();
        return;
      }

      // Space — prevent scroll
      if (e.code === 'Space') e.preventDefault();

      if (gameStateRef.current) handleKeyDown(gameStateRef.current, e.key);
    }

    function onKeyUp(e) {
      if (e.code === 'ArrowUp')    { camKeysRef.current.up = false;    return; }
      if (e.code === 'ArrowDown')  { camKeysRef.current.down = false;  return; }
      if (e.code === 'ArrowLeft')  { camKeysRef.current.left = false;  return; }
      if (e.code === 'ArrowRight') { camKeysRef.current.right = false; return; }

      if (gameStateRef.current) handleKeyUp(gameStateRef.current, e.key);
    }

    function onWheel(e) {
      e.preventDefault();
      if (gameStateRef.current) {
        const direction = e.deltaY < 0 ? 1 : -1;
        handleZoomInput(gameStateRef.current.camera, direction);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [initGame, showDebug]);

  // ── Audio lifecycle — completely isolated from game render loop ──────────
  // Separate effect with [] deps = fires exactly once on mount, cleans up on unmount.
  // This is the ONLY place audio is initialized and destroyed.
  useEffect(() => {
    // Init audio singleton — phase is driven by the engine exclusively.
    // Do NOT call setAudioPhase() here — engine will call it when gamePhase
    // transitions. A delayed fallback covers cold-start title screen.
    initAudio();
    // 200ms delay: gives engine 1-2 frames to determine actual starting phase
    // before we default to 'title'. If engine already set a phase, this no-ops
    // (setAudioPhase is idempotent when already on the target track).
    const fallbackTimer = setTimeout(() => {
      // Only default to title if engine hasn't set a phase yet
      if (!window.__KILLBOX_AUDIO_STATE__?.currentKey) {
        setAudioPhase('title');
      }
    }, 200);
    return () => {
      clearTimeout(fallbackTimer);
      destroyAudio();
    };
  }, []); // empty deps — fires exactly once on mount

  return (
    <div className="relative w-full h-full">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: 'pixelated', cursor: 'crosshair' }}
      />

      {/* Layer parallax debug overlay (P key) */}
      {showLayerDebug && (
        <div
          className="absolute top-12 left-2 pointer-events-none"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 8,
            lineHeight: 1.9,
            color: '#88ddff',
            background: 'rgba(0,0,0,0.82)',
            padding: '8px 12px',
            border: '1px solid #88ddff44',
          }}
        >
          <div style={{ color: '#ffcc00', marginBottom: 4 }}>── LAYERS (P) ──</div>
          {LAYER_DEBUG_INFO.map((l, i) => (
            <div key={i} style={{ color: l.zoom ? '#ffaa44' : '#88ddff' }}>
              {String(i + 1).padStart(2, '0')} {l.name}
              <span style={{ color: '#aaffaa', marginLeft: 6 }}>
                ×{typeof l.parallax === 'number' ? l.parallax.toFixed(2) : l.parallax}
                {l.zoom ? ' [FULL ZOOM]' : ''}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 6, color: '#556655' }}>P = toggle</div>
        </div>
      )}

      {/* ── DEV ADMIN PANEL — layer visibility toggles ── */}
      <DevAdminPanel />

      {/* ── PAUSE MENU OVERLAY ── */}
      {showPauseMenu && (
        <div
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.78)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 999,
            fontFamily: '"Press Start 2P", monospace',
          }}
        >
          {/* Panel */}
          <div style={{
            background: 'rgba(10,14,6,0.96)',
            border: '2px solid #00ff66',
            boxShadow: '0 0 32px #00ff6644, 0 0 8px #00ff6622',
            padding: '40px 56px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
            minWidth: 320,
          }}>
            {/* Title */}
            <div style={{ color: '#00ff66', fontSize: 18, letterSpacing: 3,
              textShadow: '0 0 12px #00ff66' }}>
              PAUSED
            </div>

            <div style={{ width: '100%', height: 1, background: '#00ff6633' }} />

            {/* Resume */}
            <button
              onClick={handleResume}
              style={{
                background: 'transparent', border: '2px solid #00ff66',
                color: '#00ff66', fontFamily: '"Press Start 2P", monospace',
                fontSize: 11, padding: '12px 32px', cursor: 'pointer',
                letterSpacing: 2, width: '100%',
                boxShadow: '0 0 12px #00ff6633',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = '#00ff6622'; e.target.style.boxShadow = '0 0 20px #00ff6666'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.boxShadow = '0 0 12px #00ff6633'; }}
            >
              ▶  RESUME
            </button>

            {/* Main Menu */}
            <button
              onClick={handleMainMenu}
              style={{
                background: 'transparent', border: '2px solid #ffcc00',
                color: '#ffcc00', fontFamily: '"Press Start 2P", monospace',
                fontSize: 11, padding: '12px 32px', cursor: 'pointer',
                letterSpacing: 2, width: '100%',
                boxShadow: '0 0 12px #ffcc0033',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = '#ffcc0022'; e.target.style.boxShadow = '0 0 20px #ffcc0066'; }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.boxShadow = '0 0 12px #ffcc0033'; }}
            >
              ⌂  MAIN MENU
            </button>

            <div style={{ color: '#445544', fontSize: 7, marginTop: 4 }}>
              ESC to resume
            </div>
          </div>
        </div>
      )}

      {/* Debug overlay */}
      {showDebug && debugInfo && (
        <div
          className="absolute top-12 right-2 pointer-events-none"
          style={{
            fontFamily: '"Press Start 2P", monospace',
            fontSize: 9,
            lineHeight: 2,
            color: '#00ff66',
            background: 'rgba(0,0,0,0.72)',
            padding: '8px 12px',
            border: '1px solid #00ff6644',
          }}
        >
          <div style={{ color: '#ffcc00', marginBottom: 4 }}>── DEBUG ──</div>
          <div>FPS: {debugInfo.fps}</div>
          <div>PHASE: {debugInfo.phase}</div>
          <div style={{ marginTop: 4, color: '#88ddff' }}>─ CAMERA ─</div>
          <div>X: {debugInfo.camX}</div>
          <div>Y: {debugInfo.camY}</div>
          <div>MODE: {debugInfo.camMode}</div>
          <div>ZOOM: {debugInfo.zoom}</div>
          <div style={{ marginTop: 4, color: '#ffaa44' }}>─ PLAYER ─</div>
          <div>X: {debugInfo.playerX}</div>
          <div>Y: {debugInfo.playerY}</div>
          <div style={{ marginTop: 6, color: '#556655' }}>ARROWS = pan cam</div>
          <div style={{ color: '#556655' }}>` = toggle debug</div>
        </div>
      )}
    </div>
  );
}