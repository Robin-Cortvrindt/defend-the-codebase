// Tiny event bus. Features listen here instead of editing the engine.
const listeners = new Map();

export function on(name, fn) {
  if (!listeners.has(name)) listeners.set(name, new Set());
  listeners.get(name).add(fn);
  return () => listeners.get(name)?.delete(fn);
}

export function emit(name, data) {
  const set = listeners.get(name);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(data); } catch (err) { console.error(`[events] listener for "${name}" failed`, err); }
  }
}

export function clearAll() { listeners.clear(); }
