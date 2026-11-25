// Drinks that a squashed bug leaves on the board. They must be clicked before they time out.
import { getDrinks, getDrink } from './registry.js';
import { addDrink, randomDrink } from './drinks.js';
import { emit } from './events.js';
import { addEffect } from './game.js';

export const DROP_TTL = 10;     // seconds of game time before an uncollected drop disappears
export const BLINK_AT = 3;      // a drop blinks for its last 3 s
export const PICK_RADIUS = 20;  // logical px
const JITTER = 8;               // +/- px around the bug's position

// Normal bug: one random drink. Boss: every drink, the reward split over them.
// Random order per drop: drink first (normal bug only), then x jitter, then y jitter.
export function dropDrinks(game, bug, def) {
  const n = getDrinks().length;
  if (!n) return [];
  const worth = (def?.reward ?? 0) * game.mods.drinkMultiplier;
  const picks = [];
  if (def?.boss) {
    const each = Math.max(1, Math.round(worth / n));
    for (const d of getDrinks()) picks.push({ drink: d.id, amount: each });
  } else {
    const id = randomDrink(game);
    if (id) picks.push({ drink: id, amount: Math.max(1, Math.round(worth)) });
  }
  const drops = [];
  for (const p of picks) {
    const x = bug.x + (game.random() * 2 - 1) * JITTER;
    const y = bug.y + (game.random() * 2 - 1) * JITTER;
    const drop = { id: game.nextId++, x, y, drink: p.drink, amount: p.amount, ttl: DROP_TTL };
    game.drops.push(drop);
    drops.push(drop);
    emit('drop:spawned', { game, drop });
  }
  return drops;
}

export function tickDrops(game, dt) {
  for (const d of game.drops) d.ttl -= dt;
  game.drops = game.drops.filter(d => d.ttl > 0);
}

export function collectDrop(game, drop) {
  const i = game.drops.indexOf(drop);
  if (i < 0) return false;
  game.drops.splice(i, 1);
  addDrink(game, drop.drink, drop.amount);
  emit('drop:collected', { game, drop });
  addEffect(game, {
    kind: 'pop', x: drop.x, y: drop.y - 8, text: `+${drop.amount}`,
    color: getDrink(drop.drink)?.color ?? '#fff', size: 14, ttl: 0.9,
  });
  return true;
}

// Collect the nearest drop within PICK_RADIUS of (x, y). Only while bugs can be on the board.
export function pickDrop(game, x, y) {
  if (game.phase !== 'wave' && game.phase !== 'bell') return null;
  let best = null, bestD = PICK_RADIUS * PICK_RADIUS;
  for (const d of game.drops) {
    const dist = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (dist <= bestD) { best = d; bestD = dist; }
  }
  if (best) collectDrop(game, best);
  return best;
}

export function clickDrop(game, view, x, y) {
  if (view?.paused) return null;
  return pickDrop(game, x, y);
}
