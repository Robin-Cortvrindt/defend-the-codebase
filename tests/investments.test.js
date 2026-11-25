import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { registerTestDrinks } from './helpers/drinks.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import {
  setStorage, loadProgress, saveProgress, investmentCost, invest,
  capitalFor, awardCapital, resetProgress,
} from '../src/engine/investments.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null); registerTestDrinks();
  R.registerWaves([{ groups: [] }]);
  R.registerInvestment({ id: 'x', group: 'developers', maxLevel: 2, getCost: l => [10, 20][l], apply: (g, l) => { g.mods.damageMultiplier *= 1 + 0.1 * l; } });
});

test('capitalFor: 1/sprint, +5/quarter, +15/year', () => {
  assert.deepEqual([0, 4, 7, 9, 28].map(capitalFor), [0, 4, 12, 14, 63]);
});

test('invest deducts, raises level, saves, respects max', () => {
  saveProgress({ capital: 100, levels: {} });
  assert.equal(invest('x'), true);
  assert.deepEqual(loadProgress(), { capital: 90, levels: { x: 1 } });
  assert.equal(investmentCost('x'), 20);
  invest('x');
  assert.equal(investmentCost('x'), Infinity);
  assert.equal(invest('x'), false);
  assert.equal(loadProgress().capital, 70);
});

test('cannot invest without enough capital', () => {
  saveProgress({ capital: 5, levels: {} });
  assert.equal(invest('x'), false);
  assert.equal(loadProgress().capital, 5);
});

test('Review Focus 2: corrupt storage loads as a sane state', () => {
  for (const raw of ['not json', 'null', '{"capital":-5,"levels":{"x":99,"y":"a"}}', '{"capital":"lots","levels":null}']) {
    setStorage({ getItem: () => raw, setItem() {}, removeItem() {} });
    const p = loadProgress();
    assert.ok(Number.isFinite(p.capital) && p.capital >= 0, raw);
    assert.ok(!p.levels.x || p.levels.x <= 2, raw);
    assert.equal(p.levels.y, undefined, raw);
  }
});

test('a throwing storage behaves like empty storage', () => {
  setStorage({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} });
  assert.deepEqual(loadProgress(), { capital: 0, levels: {} });
  saveProgress({ capital: 3, levels: {} });   // must not throw
});

test('Review Focus 1: awardCapital pays once per game', () => {
  const g = createGame(); g.sprint = 9;
  assert.equal(awardCapital(g), 14);
  assert.equal(awardCapital(g), 14);
  assert.equal(g.capitalEarned, 14);
  assert.equal(loadProgress().capital, 14);
});

test('Review Focus 3+6: applyInvestments skips unknown ids and throwing applies, and runs once', () => {
  R.registerInvestment({ id: 'boom', group: 'developers', maxLevel: 1, getCost: () => 1, apply() { throw new Error('x'); } });
  saveProgress({ capital: 0, levels: { x: 2, boom: 1, gone: 3 } });
  const g = createGame(); startGame(g); startGame(g);
  assert.ok(Math.abs(g.mods.damageMultiplier - 1.2) < 1e-9);
});

test('resetProgress clears capital and levels', () => {
  saveProgress({ capital: 50, levels: { x: 1 } });
  resetProgress();
  assert.deepEqual(loadProgress(), { capital: 0, levels: {} });
});

// ---------- Task 2: developer investments ----------
import { placeDev, hireCost } from '../src/engine/devs.js';

async function registerDevInvestments() {
  for (const m of ['better-laptops', 'agile-coaching', 'bigger-monitors', 'recruitment-network']) {
    R.registerInvestment((await import(`../src/content/investments/${m}.js`)).default);
  }
  R.registerDeveloper({ id: 'r', cost: 50, damage: 6, fireRate: 4, range: 2.2 });
}
function withLevels(levels) {
  saveProgress({ capital: 0, levels });
  const g = createGame(); startGame(g); return g;
}

test('developer investments raise damage, attack speed, range and cut hiring cost', async () => {
  await registerDevInvestments();
  const g = withLevels({ 'better-laptops': 3, 'agile-coaching': 2, 'bigger-monitors': 1, 'recruitment-network': 2 });
  assert.ok(Math.abs(g.mods.damageMultiplier - 1.3) < 1e-9);
  assert.ok(Math.abs(g.mods.fireRateMultiplier - 1.16) < 1e-9);
  assert.ok(Math.abs(g.mods.rangeMultiplier - 1.05) < 1e-9);
  assert.equal(hireCost(g, 'r'), 45);
  const dev = placeDev(g, 'r', 3, 3);
  assert.equal(dev.spent, 45);
  assert.equal(g.drinks.coffee, 50 - 45);
});

test('no investments: hireCost equals the base cost; unknown type is Infinity', async () => {
  await registerDevInvestments();
  const g = withLevels({});
  assert.equal(hireCost(g, 'r'), 50);
  assert.equal(hireCost(g, 'nope'), Infinity);
});
