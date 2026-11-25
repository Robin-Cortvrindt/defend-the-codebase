import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, killBug } from '../src/engine/game.js';
import { HALF_GAP } from '../src/content/bugs/merge-conflict.js';
import { registerTestDrinks, totalDrinks, collectAll } from './helpers/drinks.js';
import { COLLECT_MULT } from '../src/engine/drops.js';

// The content file registers on import; keep its definitions and re-register them per test.
const DEFS = ['merge-conflict', 'merge-conflict-half'].map(id => R.getBug(id));

beforeEach(() => {
  R.resetRegistry(); clearAll();
  registerTestDrinks();
  for (const d of DEFS) R.registerBug(d);
  R.registerWaves([{ hp: 2, groups: [] }]);
});

function game() { const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; return g; }
const noop = () => {};
const ctx = new Proxy({}, { get: () => noop, set: () => true });

test('merge conflict splits into two halves, ours and theirs, a little apart', () => {
  const g = game();
  const spawned = []; on('bug:spawned', ({ bug }) => spawned.push(bug));
  killBug(g, spawnBug(g, 'merge-conflict', 300));
  const halves = g.bugs.filter(b => b.type === 'merge-conflict-half');
  assert.equal(halves.length, 2);
  assert.deepEqual(halves.map(b => b.side), ['ours', 'theirs']);
  assert.deepEqual(halves.map(b => b.distance), [300, 300 - HALF_GAP]);
  assert.equal(halves[0].maxHp, R.getBug('merge-conflict-half').hp * 2, 'halves scale with the wave like any bug');
  assert.equal(spawned.length, 3);
});

test('halves die for good, and a split at the start never lands before the path', () => {
  const g = game();
  killBug(g, spawnBug(g, 'merge-conflict', 0));
  assert.ok(g.bugs.every(b => b.distance >= 0));
  for (const half of [...g.bugs]) killBug(g, half);
  assert.equal(g.bugs.length, 0);
});

test('merge conflict drops its own reward plus one per half', () => {
  const g = game(); const w = totalDrinks(g);
  killBug(g, spawnBug(g, 'merge-conflict', 300));
  for (const half of [...g.bugs]) killBug(g, half);
  collectAll(g);
  const r = id => R.getBug(id).reward;
  assert.equal(totalDrinks(g) - w, (r('merge-conflict') + 2 * r('merge-conflict-half')) * COLLECT_MULT);
});

test('the icons draw with and without a bug', () => {
  for (const d of DEFS) {
    d.drawIcon(ctx, d.radius);
    d.drawIcon(ctx, d.radius, { side: 'theirs' });
  }
});
