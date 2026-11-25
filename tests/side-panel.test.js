import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { createGame } from '../src/engine/game.js';
import sidePanel, { buildingInfo, buildingRows, upgradeSummary, devCounts } from '../src/content/features/side-panel.js';

let g;

beforeEach(() => {
  R.resetRegistry();
  R.registerUpgrade({ id: 'floor', name: 'Add a floor', description: '+5 production', maxLevel: Infinity, getCost: () => 5, apply() {} });
  R.registerUpgrade({ id: 'aircon', name: 'Air conditioning', description: 'Counters: heat wave', maxLevel: 3, getCost: () => 3, apply() {} });
  R.registerUpgrade({ id: 'coffee', name: 'Coffee bar', description: 'Counters: out of coffee', maxLevel: 3, getCost: () => 3, apply() {} });
  R.registerDeveloper({ id: 'react', name: 'React', accent: '#2563EB', cost: 50, damage: 5, fireRate: 2, range: 2, counters: 'typo' });
  R.registerDeveloper({ id: 'java', name: 'Java', accent: '#EA580C', cost: 75, damage: 10, fireRate: 1, range: 2, counters: 'nullpointer' });
  g = createGame();
});

test('buildingInfo reads floors, lives and warrants', () => {
  g.floors = 3; g.lives = 17; g.maxLives = 25; g.warrants = 6;
  assert.deepEqual(buildingInfo(g), { floors: 3, lives: 17, maxLives: 25, warrants: 6 });
});

test('buildingRows skips the floor upgrade and reports levels', () => {
  g.upgrades.coffee = 2;
  assert.deepEqual(buildingRows(g), [
    { id: 'aircon', name: 'Air conditioning', description: 'Counters: heat wave', level: 0, maxLevel: 3 },
    { id: 'coffee', name: 'Coffee bar', description: 'Counters: out of coffee', level: 2, maxLevel: 3 },
  ]);
});

test('upgradeSummary adds up levels and maximums', () => {
  g.upgrades.aircon = 1; g.upgrades.coffee = 2;
  assert.deepEqual(upgradeSummary(g), { levels: 3, max: 6 });
});

test('devCounts counts developers per type in registry order, including zero', () => {
  g.devs = [{ type: 'java' }, { type: 'java' }];
  assert.deepEqual(devCounts(g), [
    { id: 'react', name: 'React', accent: '#2563EB', count: 0 },
    { id: 'java', name: 'Java', accent: '#EA580C', count: 2 },
  ]);
});

test('the feature draws without a DOM and without throwing', () => {
  assert.doesNotThrow(() => { sidePanel.init(g); sidePanel.draw({}, g); });
});
