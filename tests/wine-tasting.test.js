import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug } from '../src/engine/game.js';
import { placeDev, pickTarget, devStats, tickDevs } from '../src/engine/devs.js';
import { registerTestDrinks } from './helpers/drinks.js';

beforeEach(async () => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerDeveloper({ id: 'r', drink: 'coffee', cost: 50, damage: 6, fireRate: 4, range: 2.2, counters: 'small' });
  R.registerBug({ id: 'other', hp: 100, speed: 0, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([{ groups: [] }, { groups: [] }]);
  R.registerEvent((await import('../src/content/events/wine-tasting.js')).default);
});

// A developer at (260,140) with three bugs in range and one out of range.
function setup({ event = true, resistance = 0 } = {}) {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = [];
  g.activeEvent = event ? 'wine-tasting' : null;
  g.resistance['wine-tasting'] = resistance;
  const dev = placeDev(g, 'r', 6, 3);
  const bugs = [spawnBug(g, 'other', 350), spawnBug(g, 'other', 380), spawnBug(g, 'other', 420)];
  spawnBug(g, 'other', 820); // out of range
  return { g, dev, bugs, range: devStats(g, dev).range };
}

test('the event is registered with its name, text and colour, and changes no stats', () => {
  const e = R.getEvent('wine-tasting');
  assert.equal(e.name, 'Thomas organized a wine tasting');
  assert.equal(e.description, 'Developers shoot at random bugs');
  assert.equal(e.accent, '#9F1239');
  const g = createGame(); const before = JSON.stringify(g.mods);
  e.start(g); assert.equal(JSON.stringify(g.mods), before); e.end(g);
});

test('without the event: furthest bug, never tipsy, no random numbers used', () => {
  const { g, dev, bugs, range } = setup({ event: false });
  g.random = () => { throw new Error('random used'); };
  assert.deepEqual(pickTarget(g, dev, range), { target: bugs[2], tipsy: false });
});

test('wine tasting, no water cooler: every shot is tipsy and any bug in range can be picked', () => {
  const { g, dev, bugs, range } = setup();
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const { target, tipsy } = pickTarget(g, dev, range);
    assert.equal(tipsy, true);
    seen.add(target);
  }
  assert.deepEqual([...seen].sort((a, b) => a.id - b.id), bugs);
});

test('water cooler level 3: always the furthest bug, never tipsy', () => {
  const { g, dev, bugs, range } = setup({ resistance: 1 });
  for (let i = 0; i < 50; i++) assert.deepEqual(pickTarget(g, dev, range), { target: bugs[2], tipsy: false });
});

test('water cooler level 1: roughly a third of the shots are sober', () => {
  const { g, dev, range } = setup({ resistance: 1 / 3 });
  let sober = 0;
  for (let i = 0; i < 3000; i++) if (!pickTarget(g, dev, range).tipsy) sober++;
  assert.ok(sober > 800 && sober < 1200, `sober ${sober}`);
});

test('one bug in range: a tipsy shot still hits it; none in range: no target', () => {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = [];
  g.activeEvent = 'wine-tasting';
  const dev = placeDev(g, 'r', 6, 3), range = devStats(g, dev).range;
  assert.deepEqual(pickTarget(g, dev, range), { target: null, tipsy: false });
  const only = spawnBug(g, 'other', 380);
  assert.equal(pickTarget(g, dev, range).target, only);
});

test('a tipsy shot marks its attack effect tipsy; the developer is sober again afterwards', () => {
  const { g, dev } = setup();
  tickDevs(g, 0.01);
  const attack = g.effects.find(e => e.kind === 'attack');
  assert.equal(attack.tipsy, true);
  assert.ok(!dev.tipsy);
  const sober = setup({ event: false });
  tickDevs(sober.g, 0.01);
  assert.equal(sober.g.effects.find(e => e.kind === 'attack').tipsy, false);
});

test('the building draws a water cooler that fills a third per level, also next to every other upgrade', async () => {
  const { drawBuilding, BUILDING } = await import('../src/engine/building.js');
  const { recordingCtx } = await import('./stub-ctx.js');
  const waterFills = level => {
    const ctx = recordingCtx();
    drawBuilding(ctx, { floors: 1, lives: 5, maxLives: 10, time: 1, levels: { aircon: 3, heating: 3, coffee: 3, fridge: 3, generator: 3, water: level } });
    return ctx.calls.filter(c => c[0] === 'fillRect' && c[1] >= BUILDING.x && c[1] < BUILDING.x + 12 && c[2] > BUILDING.ground - 28 && c[2] < BUILDING.ground - 6).length;
  };
  const none = waterFills(0);
  assert.ok(waterFills(1) > none, 'level 1 adds the cooler');
  for (const l of [1, 2, 3]) assert.doesNotThrow(() => waterFills(l));
});
