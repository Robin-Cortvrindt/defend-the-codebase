// Unlock: Garbage collection.
// Four Java developers in a 2x2 square run a garbage collector: every 10th kill by one of them
// triggers a GC pause that slows the bugs in its range by 50% for 1.5 s (bosses only 25%).
// Built like the other unlocks: one investment + one feature, gated on game.unlocks.
import { registerInvestment, registerFeature } from '../../engine/registry.js';
import { on } from '../../engine/events.js';
import { addEffect } from '../../engine/game.js';
import { devStats } from '../../engine/devs.js';
import { ordinal } from '../../engine/effects.js';
import { getBug } from '../../engine/registry.js';

export const GC_EVERY = 10;
export const GC_SLOW = 0.5;        // speed factor for regular bugs
export const GC_BOSS_SLOW = 0.75;  // bosses are only slowed by 25%
export const GC_DURATION = 1.5;    // seconds
const GREY = '#94A3B8';

const investment = {
  id: 'garbage-collection',
  name: 'Garbage collection',
  description: 'Four Java developers in a 2x2 square: every 10th kill slows nearby bugs',
  group: 'unlocks',
  maxLevel: 1,
  getCost() { return 40; },
  apply(game) { game.unlocks.garbageCollection = true; },
  describeEffect(game, dev) { return inJavaSquare(game, dev) ? { group: 'team', text: `every ${ordinal(GC_EVERY)} kill slows bugs nearby` } : null; },
  effectText() { return 'Java 2x2 squares: GC pause every 10th kill'; },
};

// Is this Java developer one corner of a 2x2 square of Java developers?
export function inJavaSquare(game, dev) {
  if (dev?.type !== 'java') return false;
  const java = (c, r) => game.devs.some(d => d.type === 'java' && d.col === c && d.row === r);
  for (const [dc, dr] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
    const c = dev.col + dc, r = dev.row + dr;   // top-left corner of a candidate square
    if (java(c, r) && java(c + 1, r) && java(c, r + 1) && java(c + 1, r + 1)) return true;
  }
  return false;
}

function gcPause(game, dev) {
  const range = devStats(game, dev).range;
  for (const bug of game.bugs) {
    if (Math.hypot(bug.x - dev.x, bug.y - dev.y) > range) continue;
    const factor = getBug(bug.type)?.boss ? GC_BOSS_SLOW : GC_SLOW;
    if (!bug.gcSlow) { bug.gcSlow = factor; bug.slow *= factor; }   // no stacking: only the timer resets
    bug.gcUntil = game.time + GC_DURATION;
  }
  addEffect(game, { kind: 'ring', x: dev.x, y: dev.y, color: GREY, ttl: 0.6 });
  addEffect(game, { kind: 'pop', x: dev.x, y: dev.y - 24, text: 'GC', color: GREY, size: 12, ttl: 0.8 });
}

export function gcOnKill({ game, dev }) {
  if (!game?.unlocks?.garbageCollection || !inJavaSquare(game, dev)) return;
  dev.gcKills = (dev.gcKills || 0) + 1;
  if (dev.gcKills % GC_EVERY === 0) gcPause(game, dev);
}
on('bug:killed', gcOnKill);

export const gcFeature = {
  id: 'garbage-collection',
  // End GC slows on time (game.time only runs while the game is going).
  update(game) {
    for (const bug of game.bugs) {
      if (bug.gcSlow && game.time >= bug.gcUntil) { bug.slow /= bug.gcSlow; bug.gcSlow = 0; }
    }
  },
  // Thin grey outline on Java developers that are part of a square.
  draw(ctx, game) {
    if (!game.unlocks?.garbageCollection) return;
    ctx.strokeStyle = GREY;
    ctx.lineWidth = 1.5;
    for (const d of game.devs) if (inJavaSquare(game, d)) ctx.strokeRect(d.x - 18, d.y - 18, 36, 36);
  },
};

registerInvestment(investment);
registerFeature(gcFeature);
export default investment;
