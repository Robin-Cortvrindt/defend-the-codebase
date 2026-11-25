import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import { placeDev, sellDev } from '../src/engine/devs.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import crossFunctional, { crossFunctionalFeature, teamCounts, isBalanced, BALANCED_BONUS } from '../src/content/investments/cross-functional.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null);
  for (const id of ['react', 'java', 'dotnet']) R.registerDeveloper({ id, cost: 10, damage: 1, fireRate: 1, range: 2 });
  R.registerWaves([{ groups: [] }]);
  R.registerInvestment(crossFunctional);
  R.registerFeature(crossFunctionalFeature);
});

function game() { const g = createGame(); startGame(g); g.warrants = 9999; g.unlocks.crossFunctional = true; return g; }
const hire = (g, type, col) => placeDev(g, type, col, 3);
const near = (a, b) => Math.abs(a - b) < 1e-9;

test('the investment costs 40, is bought once and sets the unlock flag', () => {
  assert.equal(crossFunctional.getCost(0), 40);
  assert.equal(crossFunctional.maxLevel, 1);
  assert.equal(crossFunctional.group, 'unlocks');
  saveProgress({ capital: 0, levels: { 'cross-functional': 1 } });
  const g = createGame(); startGame(g);
  assert.equal(g.unlocks.crossFunctional, true);
});

test('balanced means equal React, Java and .NET counts, at least one each', () => {
  const g = game();
  assert.equal(isBalanced(g), false);                      // 0-0-0
  hire(g, 'react', 0); hire(g, 'java', 1);
  assert.equal(isBalanced(g), false);                      // 1-1-0
  hire(g, 'dotnet', 2);
  assert.deepEqual(teamCounts(g), { react: 1, java: 1, dotnet: 1 });
  assert.equal(isBalanced(g), true);                       // 1-1-1
  hire(g, 'react', 3);
  assert.equal(isBalanced(g), false);                      // 2-1-1
  hire(g, 'java', 5); hire(g, 'dotnet', 6);
  assert.equal(isBalanced(g), true);                       // 2-2-2
});

test('balanced team: +25% attack speed, removed exactly when it breaks', () => {
  const g = game();
  hire(g, 'react', 0); hire(g, 'java', 1); const d = hire(g, 'dotnet', 2);
  crossFunctionalFeature.update(g, 0.05);
  assert.equal(BALANCED_BONUS, 1.25);
  assert.ok(near(g.mods.fireRateMultiplier, 1.25));
  crossFunctionalFeature.update(g, 0.05);                  // no double apply
  assert.ok(near(g.mods.fireRateMultiplier, 1.25));
  sellDev(g, d);
  crossFunctionalFeature.update(g, 0.05);
  assert.ok(near(g.mods.fireRateMultiplier, 1));
});

test('stacks with another fire-rate change in between (CEO, heating out)', () => {
  const g = game();
  hire(g, 'react', 0); hire(g, 'java', 1); const d = hire(g, 'dotnet', 2);
  crossFunctionalFeature.update(g, 0.05);
  g.mods.fireRateMultiplier *= 1.5;                        // CEO starts
  sellDev(g, d); crossFunctionalFeature.update(g, 0.05);   // team breaks
  g.mods.fireRateMultiplier /= 1.5;                        // CEO ends
  assert.ok(near(g.mods.fireRateMultiplier, 1));
});

test('without the unlock nothing happens', () => {
  const g = game(); g.unlocks.crossFunctional = false;
  hire(g, 'react', 0); hire(g, 'java', 1); hire(g, 'dotnet', 2);
  crossFunctionalFeature.update(g, 0.05);
  assert.equal(g.mods.fireRateMultiplier, 1);
});

test('switching on shows a "Balanced team" banner once', () => {
  const g = game();
  hire(g, 'react', 0); hire(g, 'java', 1); hire(g, 'dotnet', 2);
  crossFunctionalFeature.update(g, 0.05); crossFunctionalFeature.update(g, 0.05);
  assert.equal(g.effects.filter(e => e.kind === 'banner' && e.title === 'Balanced team').length, 1);
});
