// ─── EVENT BUS ────────────────────────────────────────────────────────────────
// Lightweight publish/subscribe for decoupled system communication.
// Systems emit events; other systems listen without direct coupling.
//
// Usage:
//   import { emit, on, off } from './core/eventBus';
//   on('EXPLOSION', ({ x, y, radius }) => { ... });
//   emit('EXPLOSION', { x: 100, y: 200, radius: 50 });

const _listeners = {};

export function on(event, handler) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(handler);
}

export function off(event, handler) {
  if (!_listeners[event]) return;
  _listeners[event] = _listeners[event].filter(h => h !== handler);
}

export function emit(event, data = {}) {
  const handlers = _listeners[event];
  if (!handlers) return;
  for (const h of handlers) h(data);
}

export function clearAll() {
  for (const key of Object.keys(_listeners)) delete _listeners[key];
}

// ─── GAME EVENT CATALOGUE ────────────────────────────────────────────────────
// Document all events here so modders know what's available.
//
// TREE_FELL        { treeId, x, y }
// EXPLOSION        { x, y, radius }
// TRAP_TRIGGERED   { trap, hunter }
// TRAP_CHAIN       { trap }
// PLAYER_HIT       { damage, source }
// HUNTER_HIT       { damage, stun }
// HUNTER_DEAD      {}
// PLAYER_DEAD      {}
// HARVEST          { nodeType, x, y }
// TILE_DESTROYED   { tx, ty, tileType }
// MUD_COAT         { duration }
// PHASE_CHANGE     { from, to }
// INSERTION_DONE   {}