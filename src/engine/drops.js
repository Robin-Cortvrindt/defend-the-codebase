// Drinks that a squashed bug leaves on the board. Each one flies to a random free floor cell, then must be
// clicked before it times out; one click on a drop sweeps up every drop around it.
import { getDrinks, getDrink } from './registry.js';
import { addDrink, randomDrink } from './drinks.js';
import { emit } from './events.js';
import { addEffect, sprintInfo, SPRINTS_PER_QUARTER } from './game.js';
import { isBuildable, cellCenter, COLS, ROWS } from './map.js';

export const DROP_TTL = 10;     // seconds of game time before an uncollected drop disappears
export const BLINK_AT = 3;      // a drop blinks for its last 3 s
export const PICK_RADIUS = 20;  // logical px: how close a click must be to a drop
export const SWEEP_RADIUS = 48; // logical px: a hit then collects every drop this close to the click
export const FLIGHT = 0.5;      // seconds a drop flies from the bug to its landing spot (its ttl starts on landing)
const JITTER = 8;               // +/- px around the landing cell's centre

// The bell card (style.css .bell-overlay) covers the bottom-right corner between sprints: up to half the
// board wide and two rows high. Drops never land there, or they couldn't be clicked.
export const underBellCard = (col, row) => col >= COLS / 2 && row >= ROWS - 2;

// A random free floor cell (buildable, no developer, not under the bell card) for a drop, its centre +/- JITTER.
// Random order: cell, then x jitter, then y jitter. No free cell: lands where the bug died.
export function landingSpot(game, fromX, fromY) {
  const free = [];
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      if (isBuildable(col, row) && !underBellCard(col, row) && !game.devs.some(d => d.col === col && d.row === row)) free.push([col, row]);
    }
  }
  let { x, y } = { x: fromX, y: fromY };
  if (free.length) ({ x, y } = cellCenter(...free[Math.min(free.length - 1, Math.floor(game.random() * free.length))]));
  return { x: x + (game.random() * 2 - 1) * JITTER, y: y + (game.random() * 2 - 1) * JITTER };
}

export const isLanded = drop => !(drop.flight > 0);

// The closest drop that has landed, or null.
export function nearestDrop(game, x, y) {
  let best = null, bestD = Infinity;
  for (const d of game.drops) {
    if (!isLanded(d)) continue;
    const dist = (d.x - x) ** 2 + (d.y - y) ** 2;
    if (dist < bestD) { best = d; bestD = dist; }
  }
  return best;
}

// Normal bug: one random drink. Boss: every drink, the reward split over them.
// Random order per drop: drink first (normal bug only), then its landing spot (see landingSpot).
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
    const { x, y } = landingSpot(game, bug.x, bug.y);
    const drop = { id: game.nextId++, x, y, fromX: bug.x, fromY: bug.y, flight: FLIGHT, drink: p.drink, amount: p.amount, ttl: DROP_TTL };
    game.drops.push(drop);
    drops.push(drop);
    emit('drop:spawned', { game, drop });
  }
  return drops;
}

export function tickDrops(game, dt) {
  for (const d of game.drops) {
    let left = dt;
    if (d.flight > 0) { const f = Math.min(d.flight, left); d.flight -= f; left -= f; }
    d.ttl -= left;
  }
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

// The goblin takes a drop: gone, nothing paid.
export function stealDrop(game, drop) {
  const i = game.drops.indexOf(drop);
  if (i < 0) return false;
  game.drops.splice(i, 1);
  emit('drop:stolen', { game, drop });
  addEffect(game, { kind: 'pop', x: drop.x, y: drop.y - 8, text: `-${drop.amount}`, color: '#F87171', size: 14, ttl: 0.9 });
  return true;
}

// A click that lands on a drop (within PICK_RADIUS) collects every drop within SWEEP_RADIUS
// of the click. Returns how many were collected. Only while bugs can be on the board.
export function pickDrop(game, x, y) {
  if (game.phase !== 'wave' && game.phase !== 'bell') return 0;
  const near = r => d => isLanded(d) && (d.x - x) ** 2 + (d.y - y) ** 2 <= r * r;
  if (!game.drops.some(near(PICK_RADIUS))) return 0;
  const swept = game.drops.filter(near(SWEEP_RADIUS));
  for (const d of swept) collectDrop(game, d);
  return swept.length;
}

export function clickDrop(game, view, x, y) {
  if (view?.paused) return 0;
  return pickDrop(game, x, y);
}

// Seconds until the quarter's closing review can start, while the last sprint of a quarter
// is only waiting for its drops (see checkEnd in game.js). 0 when it is not holding.
export function quarterHoldLeft(game) {
  if (game.phase !== 'wave' || game.bugs.length || game.spawnQueue.length || !game.drops.length) return 0;
  if (sprintInfo(game.sprint).sprint !== SPRINTS_PER_QUARTER) return 0;
  return Math.max(...game.drops.map(d => (d.flight || 0) + d.ttl));
}
