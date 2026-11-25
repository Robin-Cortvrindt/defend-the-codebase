// Pickup model for the sims: the bot can't click, so each drop is collected with probability PICKUP,
// PICKUP_DELAY seconds of game time after it appears (if it is still on the board by then).
//   --pickup <p>   chance 0..1 (default 1). Seeded: the same flags give the same runs.
import { on } from '../src/engine/events.js';
import { collectDrop } from '../src/engine/drops.js';

export const PICKUP_DELAY = 1;
const flag = process.argv.indexOf('--pickup');
export const PICKUP = flag >= 0 ? Math.min(1, Math.max(0, Number(process.argv[flag + 1]))) : 1;

const pending = new WeakMap();   // game -> { t, queue: [{ at, drop }], rng }
let seed = 12345;
const mulberry = a => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// One global listener for the whole process; it only touches games registered through trackPickups.
on('drop:spawned', ({ game, drop }) => {
  const s = pending.get(game);
  if (s && s.rng() < PICKUP) s.queue.push({ at: s.t + PICKUP_DELAY, drop });
});

export function trackPickups(game) {
  pending.set(game, { t: 0, queue: [], rng: mulberry(seed++) });
}

// Call once per step after step(g, dt).
export function tickPickups(game, dt) {
  const s = pending.get(game);
  if (!s) return;
  s.t += dt;
  s.queue = s.queue.filter(p => {
    if (p.at > s.t + 1e-9) return true;
    collectDrop(game, p.drop);   // returns false if the drop already expired
    return false;
  });
}
