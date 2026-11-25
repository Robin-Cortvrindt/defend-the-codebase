import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, ringBell, chooseYearReview, CAO_WARRANTS } from '../src/engine/game.js';
import { upgradeLevel, upgradeCost, canBuy, buyUpgrade } from '../src/engine/upgrades.js';

beforeEach(async () => {
  R.resetRegistry(); clearAll();
  for (const m of ['floor', 'aircon']) R.registerUpgrade((await import(`../src/content/upgrades/${m}.js`)).default);
  R.registerWaves([{ groups: [] }]);
});

function reviewGame(warrants = 100) {
  const g = createGame(); startGame(g); g.phase = 'review'; g.warrants = warrants; return g;
}

test('floor costs 3,4,5; adds 5 max lives and heals 5; floors++', () => {
  const g = reviewGame(); g.lives = 10;
  assert.equal(upgradeCost(g, 'floor'), 3);
  assert.equal(buyUpgrade(g, 'floor'), true);
  assert.deepEqual([g.maxLives, g.lives, g.floors, g.warrants], [25, 15, 2, 97]);
  assert.equal(upgradeCost(g, 'floor'), 4);
  buyUpgrade(g, 'floor');
  assert.equal(upgradeCost(g, 'floor'), 5);
  assert.equal(g.floors, 3);
});

test('floor heal is capped at max lives', () => {
  const g = reviewGame();
  buyUpgrade(g, 'floor');
  assert.equal(g.lives, 25);
});

test('aircon costs 3,5,7, max 3, sets heatResistance level/3', () => {
  const g = reviewGame();
  assert.equal(upgradeCost(g, 'aircon'), 3); buyUpgrade(g, 'aircon');
  assert.equal(g.heatResistance, 1 / 3);
  assert.equal(upgradeCost(g, 'aircon'), 5); buyUpgrade(g, 'aircon');
  assert.equal(upgradeCost(g, 'aircon'), 7); buyUpgrade(g, 'aircon');
  assert.equal(g.heatResistance, 1);
  assert.equal(upgradeLevel(g, 'aircon'), 3);
  assert.equal(canBuy(g, 'aircon'), false);
  assert.equal(g.warrants, 85);
});

test('Review Focus 4: buy refused outside review, with too few warrants, or at max — warrants unchanged', () => {
  const g = reviewGame(2);
  assert.equal(buyUpgrade(g, 'floor'), false);
  assert.equal(g.warrants, 2);
  g.warrants = 50; g.phase = 'bell';
  assert.equal(buyUpgrade(g, 'floor'), false);
  assert.equal(g.warrants, 50);
  assert.equal(buyUpgrade(g, 'nope'), false);
});

test('Review Focus 2: a new game starts clean after upgrades', () => {
  const g = reviewGame(); buyUpgrade(g, 'floor'); buyUpgrade(g, 'aircon');
  const fresh = createGame();
  assert.deepEqual([fresh.floors, fresh.heatResistance, fresh.raise, fresh.warrants, fresh.maxLives], [1, 0, 1, 0, 20]);
  assert.deepEqual(fresh.upgrades, {});
});

test('yearly review: accept → ×1.1; raise approved → ×1.2; raise denied → unchanged', () => {
  const a = reviewGame(); a.pendingYearReview = true;
  assert.equal(chooseYearReview(a, 'accept'), 'accepted');
  assert.equal(a.mods.drinkMultiplier, 1.1);
  assert.equal(a.raise, 1.1);
  const b = reviewGame(); b.pendingYearReview = true; b.random = () => 0.2;
  assert.equal(chooseYearReview(b, 'raise'), 'approved');
  assert.equal(b.mods.drinkMultiplier, 1.2);
  const c = reviewGame(); c.pendingYearReview = true; c.random = () => 0.8;
  assert.equal(chooseYearReview(c, 'raise'), 'denied');
  assert.equal(c.mods.drinkMultiplier, 1);
  assert.equal(c.raise, 1);
});

test('Review Focus 1: bell refused while year review pending; second choice returns null', () => {
  const g = reviewGame(); g.pendingYearReview = true;
  assert.equal(ringBell(g), false);
  assert.equal(g.phase, 'review');
  chooseYearReview(g, 'accept');
  assert.equal(chooseYearReview(g, 'raise'), null);
  assert.equal(g.mods.drinkMultiplier, 1.1);
  assert.equal(ringBell(g), true);
  assert.equal(g.phase, 'wave');
});

test('yearly review result is stored so the review screen can show it', () => {
  const g = reviewGame(); g.pendingYearReview = true; g.random = () => 0.8;
  assert.equal(g.lastYearReview, null);
  chooseYearReview(g, 'raise');
  assert.equal(g.lastYearReview, 'denied');
});

test('Review Focus 4: buying at max level is refused and warrants stay', () => {
  const g = reviewGame(100);
  buyUpgrade(g, 'aircon'); buyUpgrade(g, 'aircon'); buyUpgrade(g, 'aircon');
  const warrants = g.warrants;
  assert.equal(buyUpgrade(g, 'aircon'), false);
  assert.equal(g.warrants, warrants);
});

test('Yearly review pays out the CAO in Warrants, whatever the choice', () => {
  for (const [choice, roll] of [['accept', 0.9], ['raise', 0.2], ['raise', 0.8]]) {
    const g = reviewGame(5); g.pendingYearReview = true; g.random = () => roll;
    chooseYearReview(g, choice);
    assert.equal(g.warrants, 5 + CAO_WARRANTS);
  }
  const g = reviewGame(5); g.pendingYearReview = true;
  chooseYearReview(g, 'accept'); chooseYearReview(g, 'accept');
  assert.equal(g.warrants, 5 + CAO_WARRANTS, 'paid once per review');
});
