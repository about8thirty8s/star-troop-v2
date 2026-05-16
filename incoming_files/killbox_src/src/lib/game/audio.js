// KILLBOX AUDIO SYSTEM V6 — VULCAN
// ─────────────────────────────────────────────────────────────────────────────
// Complete rewrite of V5. Root cause of double-music:
//   V5 had multiple singleton guards that could all be bypassed by StrictMode's
//   mount→destroy→remount cycle, leaving zombie state that allowed two play()
//   calls to co-exist on tab-switch.
//
// V6 philosophy: ONE Audio element, ONE state object, ONE visibilitychange
//   listener, ONE play() guard. Everything keyed to window globals so no
//   module-level state can diverge between React component instances.
//
// Tab-switch guard: _resumeAudio() checks el.paused before calling play().
//   If it's already playing, do nothing. Period.
// ─────────────────────────────────────────────────────────────────────────────

const TRACKS = {
  MENU:   'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/25c08084d_055af0bf6_JungleHuntMenu.mp3',
  HUNT_A: 'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/dc2cb1da9_fdd836ddb_HunterintheCanopy.mp3',
  HUNT_B: 'https://base44.app/api/apps/6a07d557e104123d6d54764f/files/mp/public/6a07d557e104123d6d54764f/97390f526_eb095b451_JungleHuntMenu1.mp3',
};

const PHASE_TRACK = {
  title:     'MENU',
  insertion: 'MENU',
  prep:      'MENU',
  hunt:      null,   // resolved below — alternates HUNT_A / HUNT_B
  victory:   'MENU',
  defeat:    'MENU',
};

const VOLUME           = 0.55;
const FADE_STEPS       = 20;
const FADE_INTERVAL_MS = 20;   // 400ms total fade

// ── The only state that matters ───────────────────────────────────────────────
// All state lives on window so React remounts can't create divergent copies.
//
//   window.__KB_EL__       — the single HTMLAudioElement (null when destroyed)
//   window.__KB_CUR__      — current track key string ('MENU', 'HUNT_A', etc.)
//   window.__KB_TARGET__   — target track key (may differ while fading)
//   window.__KB_PAUSED__   — true when tab hidden
//   window.__KB_FADE__     — setInterval id for active fade (null if none)
//   window.__KB_TOGGLE__   — hunt track toggle boolean
//   window.__KB_LISTENER__ — true when visibilitychange is attached
//   window.__KB_PLAYING__  — true when play() has been called and not paused
//                            THE single source of truth for "is music live"

function _el()      { return window.__KB_EL__ || null; }
function _cur()     { return window.__KB_CUR__ || null; }
function _target()  { return window.__KB_TARGET__ || null; }
function _paused()  { return !!window.__KB_PAUSED__; }
function _playing() { return !!window.__KB_PLAYING__; }

function _stopFade() {
  if (window.__KB_FADE__) {
    clearInterval(window.__KB_FADE__);
    window.__KB_FADE__ = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export function initAudio() {
  // If element already exists — just make sure listener is attached and bail.
  // Do NOT recreate element, do NOT reset state, do NOT call play().
  if (window.__KB_EL__) {
    _attachListener();
    return;
  }

  console.log('[AUDIO V6] init');
  const el = new Audio();
  el.loop   = true;
  el.volume = 0;

  window.__KB_EL__      = el;
  window.__KB_CUR__     = null;
  window.__KB_TARGET__  = null;
  window.__KB_PAUSED__  = document.hidden;
  window.__KB_FADE__    = null;
  window.__KB_TOGGLE__  = false;
  window.__KB_PLAYING__ = false;

  _attachListener();
}

export function setAudioPhase(phase) {
  const el = _el();
  if (!el) return;

  let key = PHASE_TRACK[phase] || 'MENU';
  if (phase === 'hunt') {
    window.__KB_TOGGLE__ = !window.__KB_TOGGLE__;
    key = window.__KB_TOGGLE__ ? 'HUNT_A' : 'HUNT_B';
  }

  if (window.__KB_TARGET__ === key) return;  // already targeting this — no-op
  window.__KB_TARGET__ = key;
  _applyTarget();
}

export function setMusicVolume(vol) {
  const el = _el();
  if (el) el.volume = Math.max(0, Math.min(1, vol));
}

export function destroyAudio() {
  console.log('[AUDIO V6] destroyed');
  _stopFade();
  _removeListener();

  const el = _el();
  if (el) {
    el.pause();
    el.src = '';
  }

  // Hard-null the element — next initAudio() will create a fresh one
  window.__KB_EL__      = null;
  window.__KB_PLAYING__ = false;
  // Keep __KB_CUR__, __KB_TARGET__, __KB_PAUSED__ etc. — they'll be reset on next init
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL
// ─────────────────────────────────────────────────────────────────────────────

function _applyTarget() {
  const el     = _el();
  const target = _target();
  if (!el || !target) return;

  const cur = _cur();
  if (cur === target) {
    // Same track — make sure it's playing if tab is visible
    if (!_paused() && !_playing()) _fadeIn();
    return;
  }

  // Different track — fade out then swap
  if (el.volume > 0 && !el.paused) {
    _fadeOut(() => _loadAndPlay(target));
  } else {
    _loadAndPlay(target);
  }
}

function _loadAndPlay(key) {
  const el = _el();
  if (!el) return;

  const url = TRACKS[key];
  if (!url) return;

  _stopFade();
  window.__KB_PLAYING__ = false;
  el.pause();
  el.currentTime = 0;
  el.src         = url;
  el.volume      = 0;
  window.__KB_CUR__ = key;

  if (_paused() || document.hidden) return;  // tab hidden — don't play yet
  _fadeIn();
}

function _fadeIn() {
  _stopFade();
  const el = _el();
  if (!el) return;
  if (_paused() || document.hidden) return;  // safety: never play on hidden tab

  // THE play guard — if already playing at target volume, do nothing
  if (_playing() && !el.paused && el.volume >= VOLUME * 0.9) return;

  el.volume = 0;
  if (el.paused) {
    el.play().catch(_autoplayRetry);
    window.__KB_PLAYING__ = true;
  }

  const step = VOLUME / FADE_STEPS;
  window.__KB_FADE__ = setInterval(() => {
    const e = _el();
    if (!e) { _stopFade(); return; }
    e.volume = Math.min(VOLUME, e.volume + step);
    if (e.volume >= VOLUME) {
      e.volume = VOLUME;
      _stopFade();
    }
  }, FADE_INTERVAL_MS);
}

function _fadeOut(onDone) {
  _stopFade();
  const el = _el();
  if (!el || el.paused || el.volume === 0) { onDone(); return; }

  const startVol = el.volume;
  const step     = startVol / FADE_STEPS;
  window.__KB_FADE__ = setInterval(() => {
    const e = _el();
    if (!e) { _stopFade(); onDone(); return; }
    e.volume = Math.max(0, e.volume - step);
    if (e.volume <= 0) {
      _stopFade();
      onDone();
    }
  }, FADE_INTERVAL_MS);
}

// ── Visibility ────────────────────────────────────────────────────────────────

function _onVisibilityChange() {
  if (document.hidden) {
    _stopFade();
    window.__KB_PAUSED__ = true;
    window.__KB_PLAYING__ = false;
    const el = _el();
    if (el && !el.paused) {
      el.pause();
      console.log('[AUDIO V6] paused — tab hidden');
    }
  } else {
    if (!window.__KB_PAUSED__) return;  // wasn't paused — do nothing
    window.__KB_PAUSED__ = false;
    const el = _el();
    if (!el) return;
    // Only resume if element exists, has a source, and is actually paused
    if (el.paused && el.src && el.src !== window.location.href) {
      console.log('[AUDIO V6] resumed — tab visible');
      _fadeIn();
    }
  }
}

function _attachListener() {
  if (window.__KB_LISTENER__) return;  // already attached
  document.addEventListener('visibilitychange', _onVisibilityChange);
  window.__KB_LISTENER__ = true;
}

function _removeListener() {
  document.removeEventListener('visibilitychange', _onVisibilityChange);
  window.__KB_LISTENER__ = false;
}

// ── Autoplay retry ────────────────────────────────────────────────────────────
function _autoplayRetry(err) {
  console.warn('[AUDIO V6] autoplay blocked — waiting for interaction', err?.message || '');

  function retry() {
    window.removeEventListener('click',   retry);
    window.removeEventListener('keydown', retry);
    const el = _el();
    if (!el || _paused() || document.hidden) return;
    if (_playing() && !el.paused) return;  // already playing — don't double-fire
    _fadeIn();
  }

  window.addEventListener('click',   retry, { once: true });
  window.addEventListener('keydown', retry, { once: true });
}
