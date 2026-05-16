// AI MEMORY SYSTEM — LAST HUNT: KILLBOX
// Short-term episodic memory for Hunter and Squad.
// Entries expire over time. Used for adaptive decision-making.

const DEFAULT_TTL = 8.0;   // seconds before memory fades
const MAX_ENTRIES = 24;     // per-entity cap

export function createMemory() {
  return { entries: [], gameTime: 0 };
}

export function tickMemory(mem, dt) {
  mem.gameTime += dt;
  // Expire old entries
  for (let i = mem.entries.length - 1; i >= 0; i--) {
    if (mem.gameTime > mem.entries[i].expiresAt) {
      mem.entries.splice(i, 1);
    }
  }
}

export function remember(mem, type, data, ttl = DEFAULT_TTL, confidence = 1.0) {
  // Update existing entry of same type if present
  const existing = mem.entries.find(e => e.type === type);
  if (existing) {
    Object.assign(existing, data);
    existing.confidence = Math.max(existing.confidence, confidence);
    existing.expiresAt = mem.gameTime + ttl;
    existing.updatedAt = mem.gameTime;
    return;
  }
  if (mem.entries.length >= MAX_ENTRIES) mem.entries.shift();
  mem.entries.push({
    type,
    ...data,
    confidence,
    createdAt: mem.gameTime,
    updatedAt: mem.gameTime,
    expiresAt: mem.gameTime + ttl,
  });
}

export function recall(mem, type) {
  return mem.entries.find(e => e.type === type) || null;
}

export function recallAll(mem, type) {
  return mem.entries.filter(e => e.type === type);
}

export function forget(mem, type) {
  const i = mem.entries.findIndex(e => e.type === type);
  if (i >= 0) mem.entries.splice(i, 1);
}

// Degrade confidence over time for a specific memory
export function degradeConfidence(mem, type, rate = 0.1, dt = 1/60) {
  const e = recall(mem, type);
  if (e) e.confidence = Math.max(0, e.confidence - rate * dt);
}

// ─── HUNTER MEMORY HELPERS ──────────────────────────────────────────────────

export function hunterSawPlayer(mem, px, py) {
  remember(mem, 'LAST_SEEN_PLAYER', { x: px, y: py }, 12.0, 1.0);
}

export function hunterHeardSound(mem, sx, sy, source) {
  remember(mem, 'HEARD_SOUND', { x: sx, y: sy, source }, 6.0, 0.5);
}

export function hunterSawTrap(mem, tx, ty, trapId) {
  remember(mem, `TRAP_${trapId}`, { x: tx, y: ty }, 60.0, 1.0);
}

export function hunterSawFire(mem, fx, fy) {
  remember(mem, 'FIRE_ZONE', { x: fx, y: fy }, 8.0, 0.9);
}

export function hunterKilledSquadmate(mem, sx, sy) {
  remember(mem, 'KILLED_SQUADMATE', { x: sx, y: sy }, 20.0, 1.0);
}

export function hunterNotedPlayerTunnel(mem, tx, ty) {
  remember(mem, 'PLAYER_TUNNELS', { x: tx, y: ty, count: (recall(mem, 'PLAYER_TUNNELS')?.count || 0) + 1 }, 45.0, 0.8);
}

export function hunterNotedPlayerTree(mem, tx, ty) {
  remember(mem, 'PLAYER_USES_TREES', { x: tx, y: ty }, 30.0, 0.7);
}

// ─── SQUAD MEMORY HELPERS ───────────────────────────────────────────────────

export function squadSawHunter(mem, hx, hy) {
  remember(mem, 'LAST_SEEN_HUNTER', { x: hx, y: hy }, 10.0, 0.85);
}

export function squadHeardHunter(mem, hx, hy) {
  remember(mem, 'LAST_HEARD_HUNTER', { x: hx, y: hy }, 5.0, 0.4);
}

export function squadNotesDanger(mem, dx, dy, source) {
  remember(mem, `DANGER_${source}`, { x: dx, y: dy, source }, 8.0, 0.7);
}
