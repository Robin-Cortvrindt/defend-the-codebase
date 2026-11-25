import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, killBug, step } from '../src/engine/game.js';
import { placeDev, sellDev, devStats } from '../src/engine/devs.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import gc, { gcFeature, gcOnKill, inJavaSquare, GC_EVERY, GC_SLOW, GC_BOSS_SLOW, GC_DURATION } from '../src/content/investments/garbage-collection.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null);
  R.registerDeveloper({ id: 'java', cost: 10, damage: 1, fireRate: 1, range: 2.4, counters: 'np' });
  R.registerDeveloper({ id: 'react', cost: 10, damage: 1, fireRate: 1, range: 2.2 });
  R.registerBug({ id: 'b', hp: 1000, speed: 40, livesLost: 1, reward: 1, radius: 5 });
  R.registerBug({ id: 'boss', hp: 1000, speed: 20, livesLost: 5, reward: 1, radius: 18, boss: true });
  R.registerWaves([{ groups: [] }]);
  R.registerInvestment(gc);
  R.registerFeature(gcFeature);
  on('bug:killed', gcOnKill);   // clearAll() dropped the module's top-level listener
});

function game() {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.warrants = 9999; g.unlocks.garbageCollection = true; return g;
}
const hire = (g, type, col, row) => { const d = placeDev(g, type, col, row); assert.ok(d, `cell (${col},${row}) must be buildable`); d.cooldown = 999; return d; };
// A 2x2 Java square next to the lane (row 1 is lane for columns 0-4; rows 2-3, columns 2-3 are buildable).
function square(g) { return [hire(g, 'java', 2, 2), hire(g, 'java', 3, 2), hire(g, 'java', 2, 3), hire(g, 'java', 3, 3)]; }
const killN = (g, dev, n) => { for (let i = 0; i < n; i++) killBug(g, spawnBug(g, 'b', 500), dev); };

test('the investment: 40, bought once, unlocks garbageCollection', () => {
  assert.deepEqual([gc.getCost(0), gc.maxLevel, gc.group], [40, 1, 'unlocks']);
  saveProgress({ capital: 0, levels: { 'garbage-collection': 1 } });
  const g = createGame(); startGame(g);
  assert.equal(g.unlocks.garbageCollection, true);
});

test('square condition: 2x2 yes; an L of three, a line of four, mixed types no', () => {
  const g = game();
  const a = hire(g, 'java', 2, 2), b = hire(g, 'java', 3, 2), c = hire(g, 'java', 2, 3);
  assert.equal(inJavaSquare(g, a), false);                 // L of three
  const r = hire(g, 'react', 3, 3);
  assert.equal(inJavaSquare(g, a), false);                 // fourth is React
  sellDev(g, r); const d = hire(g, 'java', 3, 3);
  for (const x of [a, b, c, d]) assert.equal(inJavaSquare(g, x), true);
  const g2 = game();
  const line = [6, 7, 8, 9].map(col => hire(g2, 'java', col, 0));
  assert.equal(line.some(x => inJavaSquare(g2, x)), false); // line of four
});

test('every 10th kill by a squared Java slows bugs in its range by 50% (bosses 25%), not outside', () => {
  const g = game(); const [dev] = square(g);
  const near = spawnBug(g, 'b', 100), boss = spawnBug(g, 'boss', 110), far = spawnBug(g, 'b', 550);
  assert.ok(Math.hypot(near.x - dev.x, near.y - dev.y) <= devStats(g, dev).range);
  assert.ok(Math.hypot(far.x - dev.x, far.y - dev.y) > devStats(g, dev).range);
  killN(g, dev, GC_EVERY - 1);
  assert.equal(near.slow, 1);
  killN(g, dev, 1);
  assert.equal(GC_EVERY, 10);
  assert.equal(near.slow, GC_SLOW); assert.equal(GC_SLOW, 0.5);
  assert.equal(boss.slow, GC_BOSS_SLOW); assert.equal(GC_BOSS_SLOW, 0.75);
  assert.equal(far.slow, 1);
});

test('the slow wears off after 1.5 s; a second pause resets the timer without stacking', () => {
  const g = game(); const [dev] = square(g);
  const bug = spawnBug(g, 'b', 100);
  killN(g, dev, 10);
  assert.equal(GC_DURATION, 1.5);
  step(g, 1.0); assert.equal(bug.slow, 0.5);
  killN(g, dev, 10);                                        // second pause at t = 1.0
  assert.equal(bug.slow, 0.5);                              // no stacking
  step(g, 1.0); assert.equal(bug.slow, 0.5);                // t = 2.0: old timer would have ended
  step(g, 0.6); assert.equal(bug.slow, 1);                  // t = 2.6 > 2.5
});

test('kills outside a square do not count; selling one breaks the square', () => {
  const g = game(); const devs = square(g);
  const bug = spawnBug(g, 'b', 100);
  killN(g, devs[0], 5);
  sellDev(g, devs[3]);
  killN(g, devs[0], 10);
  assert.equal(bug.slow, 1);
});

test('without the unlock nothing happens', () => {
  const g = game(); g.unlocks.garbageCollection = false;
  const [dev] = square(g); const bug = spawnBug(g, 'b', 100);
  killN(g, dev, 10);
  assert.equal(bug.slow, 1);
});
