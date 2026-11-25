// Random events: at most one per wave, rolled when the wave starts and ended when it's over.
// Each event is its own content file (registerEvent). Named this way so it doesn't clash with the event bus.
import { getEvents, getEvent } from './registry.js';
import { emit } from './events.js';
import { addEffect } from './game.js';

export const EVENT_CHANCE = 0.25;

function safe(id, fn) {
  try { fn(); return true; } catch (e) { console.error(`[event ${id}]`, e); return false; }
}

export function rollEvent(game) {
  if (game.activeEvent || game.wave < 1) return null;
  if (game.random() >= EVENT_CHANCE) return null;
  const pool = getEvents().filter(e => (e.minWave ?? 2) <= game.wave + 1 && (e.weight ?? 1) > 0);
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + (e.weight ?? 1), 0);
  let r = game.random() * total;
  let def = pool[pool.length - 1];
  for (const e of pool) { r -= e.weight ?? 1; if (r < 0) { def = e; break; } }
  if (!safe(def.id, () => def.start(game))) return null;
  game.activeEvent = def.id;
  addEffect(game, { kind: 'banner', title: def.name, text: def.description, accent: def.accent ?? '#EA580C', ttl: 3 });
  emit('event:start', { game, event: def });
  return def;
}

export function endEvent(game) {
  if (!game.activeEvent) return;
  const def = getEvent(game.activeEvent);
  game.activeEvent = null;
  if (def) safe(def.id, () => def.end?.(game));
  emit('event:end', { game, event: def });
}
