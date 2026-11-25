import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import { buyUpgrade, upgradeCost, resistanceTo } from '../src/engine/upgrades.js';

const UPGRADES = ['aircon', 'heating', 'coffee', 'fridge', 'generator', 'water'];
const EVENTS = ['heat-wave', 'heating-out', 'no-coffee', 'no-redbull', 'prod-down', 'wine-tasting'];
const COUNTERS = { aircon: 'heat-wave', heating: 'heating-out', coffee: 'no-coffee', fridge: 'no-redbull', generator: 'prod-down', water: 'wine-tasting' };
let defs = {};

beforeEach(async () => {
  R.resetRegistry(); clearAll(); defs = {};
  for (const id of UPGRADES) R.registerUpgrade((await import(`../src/content/upgrades/${id}.js`)).default);
  for (const id of EVENTS) { const m = await import(`../src/content/events/${id}.js`); defs[id] = m.default; R.registerEvent(m.default); }
});

const reviewGame = () => { const g = createGame(); startGame(g); g.phase = 'review'; g.warrants = 100; return g; };

test('every event has exactly one counter-upgrade (3 levels, 3/5/7 warrants)', () => {
  for (const [up, ev] of Object.entries(COUNTERS)) {
    assert.equal(R.getUpgrade(up).counters, ev, up);
    const g = reviewGame();
    assert.deepEqual([upgradeCost(g, up), (buyUpgrade(g, up), upgradeCost(g, up)), (buyUpgrade(g, up), upgradeCost(g, up))], [3, 5, 7], up);
    buyUpgrade(g, up);
    assert.equal(resistanceTo(g, ev), 1, up);
    assert.equal(buyUpgrade(g, up), false, `${up} max 3`);
  }
});

test('air conditioning still sets game.heatResistance (old name kept)', () => {
  const g = reviewGame(); buyUpgrade(g, 'aircon');
  assert.equal(g.heatResistance, 1 / 3);
  assert.equal(resistanceTo(g, 'heat-wave'), 1 / 3);
});

function runEvent(id, level) {
  const g = createGame();
  if (level) g.resistance[id] = level / 3;
  if (id === 'heat-wave') g.heatResistance = level / 3;
  const before = JSON.stringify(g.mods);
  defs[id].start(g);
  const during = structuredClone(g.mods);
  defs[id].end(g);
  assert.equal(JSON.stringify(g.mods), before, `${id} level ${level} restores mods exactly`);
  return during;
}

test('heating is out: only developers slow down (half fire rate), a sixth less per level, none at level 3', () => {
  const d0 = runEvent('heating-out', 0);
  assert.equal(d0.fireRateMultiplier, 0.5);
  assert.equal(d0.timeScale, 1, 'bugs keep their speed');
  assert.equal(d0.bugSpeedMultiplier, 1, 'bugs keep their speed');
  assert.ok(Math.abs(runEvent('heating-out', 1).fireRateMultiplier - 2 / 3) < 1e-9);
  assert.equal(runEvent('heating-out', 3).fireRateMultiplier, 1);
});

test('heat wave: only bugs speed up, developers are untouched', () => {
  const d = runEvent('heat-wave', 0);
  assert.equal(d.bugSpeedMultiplier, 1.5);
  assert.equal(d.fireRateMultiplier, 1);
  assert.equal(d.timeScale, 1);
});

test('out of coffee / Red Bull: Java / .NET at half speed, none at level 3', () => {
  assert.equal(runEvent('no-coffee', 0).devFireRate.java, 0.5);
  assert.equal(runEvent('no-coffee', 3).devFireRate.java ?? 1, 1);
  assert.equal(runEvent('no-redbull', 0).devFireRate.dotnet, 0.5);
  assert.ok(Math.abs(runEvent('no-redbull', 2).devFireRate.dotnet - 5 / 6) < 1e-9);
});

test('PROD is down: flashlight grows 40% per generator level; level 3 keeps the lights on', async () => {
  const { flashlightRadius } = await import('../src/content/events/prod-down.js');
  const g = createGame();
  const base = flashlightRadius(g);
  g.resistance['prod-down'] = 1 / 3;
  assert.ok(Math.abs(flashlightRadius(g) - base * 1.4) < 1e-9);
  g.resistance['prod-down'] = 1;
  assert.equal(flashlightRadius(g), Infinity);
});
