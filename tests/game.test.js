import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, ringBell, step, spawnBug } from '../src/engine/game.js';
import { PATH_LENGTH } from '../src/engine/map.js';

beforeEach(() => {
  R.resetRegistry(); clearAll();
  R.registerBug({ id: 'b', hp: 10, speed: 100, livesLost: 2, reward: 3, radius: 5 });
  R.registerWaves([
    { groups: [{ bug: 'b', count: 3, interval: 1, delay: 0 }] },
    { groups: [{ bug: 'b', count: 1, interval: 1, delay: 0 }] },
  ]);
});

const run = (g, secs) => { for (let i = 0; i < secs * 20; i++) step(g, 0.05); };

test('startWave spawns the configured count over time', () => {
  const g = createGame(); startGame(g); startWave(g);
  let spawned = 0; on('bug:spawned', () => spawned++);
  run(g, 2.6);
  assert.equal(spawned, 3);
  assert.equal(g.phase, 'wave');
});

test('bug that reaches the end leaks and costs livesLost', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = [];
  spawnBug(g, 'b', PATH_LENGTH - 1);
  let leaked = 0; on('bug:leaked', () => leaked++);
  step(g, 0.05);
  assert.equal(leaked, 1);
  assert.equal(g.lives, 18);
});

test('clearing a wave pays 20+5*n, moves to bell, increments wave', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = [];
  const before = g.warrants;
  step(g, 0.05);
  assert.equal(g.phase, 'bell');
  assert.equal(g.wave, 1);
  assert.equal(g.warrants, before + 25);
});

test('ringBell starts next wave', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = []; step(g, 0.05);
  let rung = 0; on('bell:rung', () => rung++);
  ringBell(g);
  assert.equal(rung, 1);
  assert.equal(g.phase, 'wave');
});

test('clearing the last wave → won and emits game:won', () => {
  const g = createGame(); startGame(g); g.wave = 1; startWave(g);
  g.spawnQueue = []; g.bugs = [];
  let won = 0; on('game:won', () => won++);
  step(g, 0.05);
  assert.equal(g.phase, 'won'); assert.equal(won, 1);
});

test('Review Focus 3: last life lost on last bug of final wave → lost, not won; no bell', () => {
  const g = createGame(); startGame(g); g.wave = 1; startWave(g);
  g.spawnQueue = []; g.bugs = []; g.lives = 2;
  spawnBug(g, 'b', PATH_LENGTH - 1);
  let won = 0, cleared = 0; on('game:won', () => won++); on('wave:cleared', () => cleared++);
  step(g, 0.05);
  assert.equal(g.phase, 'lost'); assert.equal(won, 0); assert.equal(cleared, 0);
});

test('bugSpeedMultiplier 0.5 halves distance travelled', () => {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.bugs = [];
  g.mods.bugSpeedMultiplier = 0.5;
  const bug = spawnBug(g, 'b', 0);
  step(g, 0.05);
  assert.equal(bug.distance, 2.5);
});
