import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug } from '../src/engine/game.js';
import { placeDev, sellDev, tickDevs, grantXp, devStats } from '../src/engine/devs.js';
import { pointAt } from '../src/engine/map.js';

beforeEach(() => {
  R.resetRegistry(); clearAll();
  R.registerDeveloper({ id: 'r', cost: 50, damage: 6, fireRate: 4, range: 2.2, counters: 'small' });
  R.registerBug({ id: 'small', hp: 100, speed: 0, livesLost: 1, reward: 1, radius: 5 });
  R.registerBug({ id: 'other', hp: 100, speed: 0, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([{ groups: [] }, { groups: [] }]);
});

function waveGame() {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; return g;
}

test('Review Focus 2: placeDev refuses path, PROD, occupied, off-grid, unaffordable', () => {
  const g = createGame(); startGame(g);
  assert.equal(placeDev(g, 'r', 0, 1), null);   // path
  assert.equal(placeDev(g, 'r', 15, 3), null);  // PROD
  assert.equal(placeDev(g, 'r', -1, 0), null);  // off-grid
  assert.equal(placeDev(g, 'nope', 3, 3), null); // unknown type
  assert.equal(g.warrants, 100);
  assert.ok(placeDev(g, 'r', 3, 3));
  assert.equal(placeDev(g, 'r', 3, 3), null);   // occupied
  assert.equal(g.warrants, 50);
  g.warrants = 49;
  assert.equal(placeDev(g, 'r', 3, 4), null);   // unaffordable
  assert.equal(g.warrants, 49);
});

test('placeDev deducts cost; sellDev refunds floor(50%)', () => {
  const g = createGame(); startGame(g);
  const d = placeDev(g, 'r', 3, 3);
  assert.equal(g.warrants, 50);
  assert.equal(sellDev(g, d), 25);
  assert.equal(g.warrants, 75);
  assert.equal(g.devs.length, 0);
});

test('targets furthest-along bug in range, ignores out-of-range', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3); // centre (140,140); range 88px
  const near = spawnBug(g, 'other', 260);   // (180,140) on the vertical leg
  const further = spawnBug(g, 'other', 300); // (180,180)
  const far = spawnBug(g, 'other', 700);     // out of range
  tickDevs(g, 0.01);
  assert.equal(further.hp, 94);
  assert.equal(near.hp, 100);
  assert.equal(far.hp, 100);
});

test('counter hit deals double damage', () => {
  const g = waveGame();
  placeDev(g, 'r', 3, 3);
  const b = spawnBug(g, 'small', 300);
  tickDevs(g, 0.01);
  assert.equal(b.hp, 88);
});

test('kill grants reward and 1 xp; levels at 10 and 30', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  const b = spawnBug(g, 'other', 300, 1);
  const w = g.warrants;
  tickDevs(g, 0.01);
  assert.equal(g.bugs.length, 0);
  assert.equal(g.warrants, w + 1);
  assert.equal(d.xp, 1);
  const ups = []; on('dev:levelup', e => ups.push(e.level));
  grantXp(g, d, 9);
  assert.equal(d.level, 1);
  grantXp(g, d, 20);
  assert.equal(d.level, 2);
  assert.deepEqual(ups, [1, 2]);
  assert.equal(g.stats.seniors, 1);
});

test('xpMultiplier 2 doubles xp; fireRateMultiplier 1.5 raises fire rate; level boosts damage', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  g.mods.xpMultiplier = 2;
  grantXp(g, d, 3);
  assert.equal(d.xp, 6);
  g.mods.fireRateMultiplier = 1.5;
  assert.equal(devStats(g, d).fireRate, 6);
  d.level = 1;
  assert.equal(devStats(g, d).damage, 7.5);
});
