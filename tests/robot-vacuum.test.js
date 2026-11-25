import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave } from '../src/engine/game.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import { registerTestDrinks } from './helpers/drinks.js';
import { stubCtx } from './stub-ctx.js';
import vacuum, { vacuumFeature, VACUUM_SPEEDS, DOCK } from '../src/content/investments/robot-vacuum.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null); registerTestDrinks();
  R.registerWaves([{ groups: [] }]);
  R.registerInvestment(vacuum);
  R.registerFeature(vacuumFeature);
});

function game(level = 1) {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = [];
  g.unlocks.vacuum = level;
  vacuumFeature.init(g);
  return g;
}
const drop = (id, x, y, extra = {}) => ({ id, x, y, drink: 'coffee', amount: 4, ttl: 10, ...extra });
const run = (g, seconds, dt = 0.05) => { for (let t = 0; t < seconds; t += dt) vacuumFeature.update(g, dt); };

test('the investment: 40/30/50, 3 levels, an unlock that sets the vacuum level', () => {
  assert.deepEqual([vacuum.getCost(0), vacuum.getCost(1), vacuum.getCost(2), vacuum.getCost(3)], [40, 30, 50, Infinity]);
  assert.deepEqual([vacuum.id, vacuum.maxLevel, vacuum.group], ['robot-vacuum', 3, 'unlocks']);
  assert.deepEqual(VACUUM_SPEEDS, [70, 100, 130]);
  assert.equal(vacuum.effectText(2), 'Robot vacuum: 100 px/s');
  saveProgress({ capital: 0, levels: { 'robot-vacuum': 2 } });
  const g = createGame(); startGame(g);
  assert.equal(g.unlocks.vacuum, 2);
});

test('off without the investment', () => {
  const g = game(0);
  g.drops.push(drop(1, DOCK.x + 5, DOCK.y));
  run(g, 5);
  assert.equal(g.drops.length, 1);
});

test('drives to the nearest landed drop and collects it, drinks paid', () => {
  const g = game(1);
  const near = drop(1, DOCK.x + 60, DOCK.y), far = drop(2, 600, 20);
  g.drops.push(far, near);
  run(g, 1.2);
  assert.deepEqual(g.drops, [far]);
  assert.equal(g.drinks.coffee, 104);
});

test('faster per level: 7 / 10 / 13 px in 0.1 s', () => {
  for (const [level, px] of [[1, 7], [2, 10], [3, 13]]) {
    const g = game(level);
    g.drops.push(drop(1, DOCK.x + 300, DOCK.y));
    vacuumFeature.update(g, 0.1);
    assert.ok(Math.abs(g.vacuum.x - (DOCK.x + px)) < 1e-9, `level ${level}`);
  }
});

test('returns to the dock and parks when the floor is clean', () => {
  const g = game(3);
  g.vacuum.x = 300; g.vacuum.y = 150;
  run(g, 5);
  assert.deepEqual([g.vacuum.x, g.vacuum.y, g.vacuum.moving], [DOCK.x, DOCK.y, false]);
});

test('ignores drops still in the air', () => {
  const g = game(3);
  g.drops.push(drop(1, DOCK.x + 5, DOCK.y, { flight: 0.5 }));
  run(g, 0.4);
  assert.equal(g.drops.length, 1);
});

test('Review Focus 3: init puts it back at the dock', () => {
  const g = game(1);
  g.vacuum.x = 400;
  vacuumFeature.init(g);
  assert.deepEqual([g.vacuum.x, g.vacuum.y], [DOCK.x, DOCK.y]);
});

test('only moves during a sprint', () => {
  const g = game(3);
  g.phase = 'review';
  g.drops.push(drop(1, DOCK.x + 100, DOCK.y));
  run(g, 1);
  assert.equal(g.vacuum.x, DOCK.x);
});

test('draws without throwing, parked or driving', () => {
  const g = game(1);
  assert.doesNotThrow(() => vacuumFeature.drawUnder(stubCtx(), g));
  g.vacuum.moving = true;
  assert.doesNotThrow(() => vacuumFeature.drawUnder(stubCtx(), g));
});
