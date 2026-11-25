// Pickup model for the sims: the bot can't click, so each drop is collected with probability PICKUP,
// PICKUP_DELAY seconds of game time after it lands (if it is still on the board by then: the goblin may have it).
//   --pickup <p>   chance 0..1 (default 1, also when missing or not a number). The pickup rolls are seeded per game (trackPickups(game, seed)), so a given game seed gives the same rolls; game randomness is seeded by the caller.
import { on } from '../src/engine/events.js';
import { collectDrop, FLIGHT } from '../src/engine/drops.js';

export const PICKUP_DELAY = 1;
const flag = process.argv.indexOf('--pickup');
const value = flag >= 0 ? Number(process.argv[flag + 1]) : NaN;
export const PICKUP = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;   // missing or not a number: 1

const pending = new WeakMap();   // game -> { t, queue: [{ at, drop }], rng }
export const mulberry32 = a => () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// One global listener for the whole process; it only touches games registered through trackPickups.
on('drop:spawned', ({ game, drop }) => {
  const s = pending.get(game);
  if (s && s.rng() < PICKUP) s.queue.push({ at: s.t + FLIGHT + PICKUP_DELAY, drop });
});

// seed: the game's trial seed; the pickup stream is derived from it so it never shares draws with game.random.
export function trackPickups(game, seed = 0) {
  pending.set(game, { t: 0, queue: [], rng: mulberry32((seed ^ 0x9E3779B9) >>> 0) });
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
