import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, step } from '../src/engine/game.js';

const cold = () => ({
  id: 'cold', name: 'Cold', description: 'x',
  start: g => { g.mods.timeScale *= 0.5; },
  end: g => { g.mods.timeScale /= 0.5; },
});

beforeEach(() => {
  R.resetRegistry(); clearAll();
  R.registerBug({ id: 'b', hp: 10, speed: 100, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([
    { groups: [{ bug: 'b', count: 1, interval: 1, delay: 0 }] },
    { groups: [{ bug: 'b', count: 1, interval: 1, delay: 0 }] },
    { groups: [{ bug: 'b', count: 1, interval: 1, delay: 0 }] },
  ]);
  R.registerEvent(cold());
});

// Game ready to start wave index `wave` with a scripted random sequence (last value repeats).
function gameAt(wave, rolls) {
  const g = createGame(); startGame(g);
  g.wave = wave;
  let i = 0;
  g.random = () => rolls[Math.min(i++, rolls.length - 1)];
  return g;
}
const clearWave = g => { g.spawnQueue = []; g.bugs = []; step(g, 0.05); };

test('no event on wave 1', () => {
  const g = gameAt(0, [0]);
  startWave(g);
  assert.equal(g.activeEvent, null);
});

test('event fires on wave 2 when the roll is under 0.25', () => {
  const g = gameAt(1, [0]);
  let started = 0; on('event:start', () => started++);
  startWave(g);
  assert.equal(g.activeEvent, 'cold');
  assert.equal(g.mods.timeScale, 0.5);
  assert.ok(g.effects.some(e => e.kind === 'banner' && e.title === 'Cold'));
  assert.equal(started, 1);
});

test('no event when the roll is 0.25 or more', () => {
  const g = gameAt(1, [0.25]);
  startWave(g);
  assert.equal(g.activeEvent, null);
});

test('minWave is respected', () => {
  R.resetRegistry();
  R.registerBug({ id: 'b', hp: 10, speed: 100, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([{ groups: [] }, { groups: [{ bug: 'b', count: 1 }] }]);
  R.registerEvent({ ...cold(), minWave: 5 });
  const g = gameAt(1, [0]);
  startWave(g);
  assert.equal(g.activeEvent, null);
});

test('weight picks proportionally', () => {
  R.registerEvent({ ...cold(), id: 'heavy', weight: 3 });
  const g = gameAt(1, [0, 0.3]);
  startWave(g);
  assert.equal(g.activeEvent, 'heavy');
});

test('event ends when the wave is cleared', () => {
  const g = gameAt(1, [0]);
  let ended = 0; on('event:end', () => ended++);
  startWave(g);
  clearWave(g);
  assert.equal(g.phase, 'bell');
  assert.equal(g.activeEvent, null);
  assert.equal(g.mods.timeScale, 1);
  assert.equal(ended, 1);
});

test('event ends when the game is lost', () => {
  const g = gameAt(1, [0]);
  startWave(g);
  g.lives = 0;
  step(g, 0.05);
  assert.equal(g.phase, 'lost');
  assert.equal(g.activeEvent, null);
  assert.equal(g.mods.timeScale, 1);
});

test('event ends when the last wave is won', () => {
  const g = gameAt(2, [0]);
  startWave(g);
  assert.equal(g.activeEvent, 'cold');
  clearWave(g);
  assert.equal(g.phase, 'won');
  assert.equal(g.activeEvent, null);
});

test('throwing start leaves no active event and end is never called', () => {
  R.resetRegistry();
  R.registerBug({ id: 'b', hp: 10, speed: 100, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([{ groups: [] }, { groups: [{ bug: 'b', count: 1 }] }, { groups: [] }]);
  let endCalled = false;
  R.registerEvent({ id: 'boom', name: 'Boom', description: 'x', start() { throw new Error('boom'); }, end() { endCalled = true; } });
  const orig = console.error; console.error = () => {};
  try {
    const g = gameAt(1, [0]);
    startWave(g);
    assert.equal(g.activeEvent, null);
    assert.equal(g.phase, 'wave');
    clearWave(g);
    assert.equal(endCalled, false);
  } finally { console.error = orig; }
});

test('restart gives a clean game', () => {
  const g = createGame();
  assert.equal(g.activeEvent, null);
  assert.equal(g.mods.timeScale, 1);
  assert.deepEqual(g.mods.devFireRate, {});
});
