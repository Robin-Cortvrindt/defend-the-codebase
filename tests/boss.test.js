import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, step, getSprintDef } from '../src/engine/game.js';

beforeEach(() => {
  R.resetRegistry(); clearAll();
  R.registerBug({ id: 'b', hp: 10, speed: 10, livesLost: 1, reward: 1, radius: 5 });
  R.registerBug({ id: 'boss', hp: 100, speed: 10, livesLost: 5, reward: 20, radius: 18 });
  R.registerWaves([
    { boss: 'boss', groups: [{ bug: 'b', count: 3, interval: 1, delay: 0 }] },
    { boss: 'boss', groups: [{ bug: 'b', count: 1, interval: 1, delay: 0 }] },
  ]);
});

test('the boss is queued once, after the last regular bug', () => {
  const g = createGame(); startGame(g); startWave(g);
  const bosses = g.spawnQueue.filter(s => s.bug === 'boss');
  assert.equal(bosses.length, 1);
  assert.equal(g.spawnQueue.at(-1).bug, 'boss');
  assert.ok(g.spawnQueue.at(-1).t > g.spawnQueue.at(-2).t);
});

test('the boss actually spawns during the wave', () => {
  const g = createGame(); startGame(g); startWave(g);
  const spawned = []; on('bug:spawned', ({ bug }) => spawned.push(bug.type));
  for (let i = 0; i < 20 * 10; i++) step(g, 0.05);
  assert.deepEqual(spawned, ['b', 'b', 'b', 'boss']);
});

test('generated sprints after the hand-made waves keep the boss', () => {
  assert.equal(getSprintDef(5).boss, 'boss');
});

test('a wave without a boss queues no boss', () => {
  R.registerWaves([{ groups: [{ bug: 'b', count: 2, interval: 1 }] }]);
  const g = createGame(); startGame(g); startWave(g);
  assert.ok(g.spawnQueue.every(s => s.bug === 'b'));
});
