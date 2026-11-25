import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, waveProgress } from '../src/engine/game.js';
import { roadmapModel } from '../src/engine/roadmap.js';
import { registerTestDrinks } from './helpers/drinks.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerBug({ id: 'b', hp: 100, speed: 0, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([{ groups: [{ bug: 'b', count: 5, interval: 1, delay: 0 }] }]);
});

const todo7 = Array(7).fill('todo');

test('between sprints: done, now and todo sprints across the year, and the way to the review', () => {
  const g = createGame(); startGame(g);
  g.sprint = 9; g.phase = 'bell';          // Year 1 · Q2 · sprint 3 is next
  const m = roadmapModel(g);
  assert.deepEqual([m.year, m.quarter, m.sprint], [1, 2, 3]);
  assert.deepEqual(m.quarters.map(q => q.label), ['Q1', 'Q2', 'Q3', 'Q4']);
  assert.deepEqual(m.quarters.map(q => q.state), ['past', 'current', 'future', 'future']);
  assert.deepEqual(m.quarters[0].sprints, Array(7).fill('done'));
  assert.deepEqual(m.quarters[1].sprints, ['done', 'done', 'now', 'todo', 'todo', 'todo', 'todo']);
  assert.deepEqual(m.quarters[2].sprints, todo7);
  assert.equal(m.nowFill, 0);
  assert.equal(m.right, '5 sprints to quarter review');
});

test('the last sprint of a quarter says 1 sprint, singular', () => {
  const g = createGame(); startGame(g);
  g.sprint = 6; g.phase = 'bell';
  assert.equal(roadmapModel(g).right, '1 sprint to quarter review');
});

test('a new year starts with an empty roadmap', () => {
  const g = createGame(); startGame(g);
  g.sprint = 28; g.phase = 'review';
  const m = roadmapModel(g);
  assert.deepEqual([m.year, m.quarter, m.sprint], [2, 1, 1]);
  assert.deepEqual(m.quarters[0].sprints, ['now', 'todo', 'todo', 'todo', 'todo', 'todo', 'todo']);
  assert.deepEqual(m.quarters.map(q => q.state), ['current', 'future', 'future', 'future']);
});

test('waveProgress counts bugs dealt with out of all bugs this sprint', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = g.spawnQueue.slice(0, 2);                  // 2 still to come
  for (let i = 0; i < 3; i++) spawnBug(g, 'b');             // 3 walked in...
  g.bugs.splice(0, 2);                                      // ...and 2 of them are gone
  assert.deepEqual(waveProgress(g), { done: 2, total: 5 });
});

test('during a sprint the roadmap shows the bug count and fills the current sprint', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = g.spawnQueue.slice(0, 2);
  for (let i = 0; i < 3; i++) spawnBug(g, 'b');
  g.bugs.splice(0, 2);
  const m = roadmapModel(g);
  assert.equal(m.right, '2 / 5 bugs');
  assert.equal(m.nowFill, 0.4);
  assert.equal(m.quarters[0].sprints[0], 'now');
});

test('a bug that splits mid-sprint raises the total and the sprint still ends at y / y', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = [];
  spawnBug(g, 'b');
  g.bugs.length = 0;                                        // squashed...
  spawnBug(g, 'b'); spawnBug(g, 'b');                       // ...into two halves
  assert.deepEqual(waveProgress(g), { done: 1, total: 3 });
  g.bugs.length = 0;
  assert.deepEqual(waveProgress(g), { done: 3, total: 3 });
});

test('waveProgress starts from zero each sprint', () => {
  const g = createGame(); startGame(g); startWave(g);
  spawnBug(g, 'b');
  g.phase = 'bell'; g.spawnQueue = []; g.bugs = [];
  startWave(g);
  assert.equal(waveProgress(g).done, 0);
  assert.equal(waveProgress(g).total, 5);
});
