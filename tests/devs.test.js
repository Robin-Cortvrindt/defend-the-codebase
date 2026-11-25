import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, step } from '../src/engine/game.js';
import { placeDev, sellDev, tickDevs, grantXp, devStats, nextUpgrades, upgradeUnlocked, upgradeStatus, buyUpgrade, levelName, bugsInRange, hitBug } from '../src/engine/devs.js';
import { pointAt } from '../src/engine/map.js';
import { registerTestDrinks } from './helpers/drinks.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerDeveloper({ id: 'rb', drink: 'redbull', cost: 50, damage: 6, fireRate: 4, range: 2.2, counters: 'small' });
  R.registerDeveloper({ id: 'r', drink: 'coffee', cost: 50, damage: 6, fireRate: 4, range: 2.2, counters: 'small' });
  R.registerDeveloper({ id: 'u', drink: 'coffee', cost: 50, damage: 10, fireRate: 1, range: 2, counters: 'small', levelName: 'Base',
    upgrades: {
      level2: { id: 'two', name: 'Two', cost: 40, description: 'd', stats: { damage: 20, range: 3 } },
      level3: [
        { id: 'a', name: 'A', cost: 60, kind: 'steady', description: 'd', stats: { fireRate: 2 } },
        { id: 'b', name: 'B', cost: 70, kind: 'gamble', description: 'd' },
      ] } });
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
  assert.equal(g.drinks.coffee, 50);
  assert.ok(placeDev(g, 'r', 3, 3));
  assert.equal(placeDev(g, 'r', 3, 3), null);   // occupied
  assert.deepEqual(g.drinks, { coffee: 0, monster: 50, redbull: 50 });
  g.drinks.coffee = 49;
  assert.equal(placeDev(g, 'r', 3, 4), null);   // unaffordable
  assert.deepEqual(g.drinks, { coffee: 49, monster: 50, redbull: 50 });
  g.drinks.coffee = 0; g.drinks.redbull = 999;
  assert.equal(placeDev(g, 'r', 3, 4), null);   // wrong drink
  assert.equal(g.drinks.redbull, 999);
  assert.ok(placeDev(g, 'rb', 3, 4));
  assert.equal(g.drinks.redbull, 949);
});

test('placeDev deducts cost; sellDev refunds floor(50%)', () => {
  const g = createGame(); startGame(g);
  const d = placeDev(g, 'r', 3, 3);
  assert.equal(g.drinks.coffee, 0);
  assert.equal(sellDev(g, d), 25);
  assert.deepEqual(g.drinks, { coffee: 25, monster: 50, redbull: 50 });
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

test('kill grants reward and 1 xp; xp alone never levels up', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  const b = spawnBug(g, 'other', 300, 1);
  const w = g.warrants;
  tickDevs(g, 0.01);
  assert.equal(g.bugs.length, 0);
  assert.equal(g.warrants, w + 1);
  assert.equal(d.xp, 1);
  grantXp(g, d, 40);
  assert.equal(d.level, 0);
});

test('xpMultiplier 2 doubles xp; fireRateMultiplier 1.5 raises fire rate', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  g.mods.xpMultiplier = 2;
  grantXp(g, d, 3);
  assert.equal(d.xp, 6);
  g.mods.fireRateMultiplier = 1.5;
  assert.equal(devStats(g, d).fireRate, 6);
});

test('upgrade is gated by xp then warrants; spent grows; refund includes upgrades', () => {
  const g = waveGame(); g.drinks.coffee = 1000;
  const d = placeDev(g, 'u', 3, 3);
  assert.deepEqual(upgradeStatus(g, d, nextUpgrades(d)[0]), { ok: false, reason: 'xp' });
  assert.equal(buyUpgrade(g, d, 'two'), false);
  grantXp(g, d, 10);
  g.drinks.coffee = 39;
  assert.deepEqual(upgradeStatus(g, d, nextUpgrades(d)[0]), { ok: false, reason: 'drink' });
  g.drinks.coffee = 1000;
  assert.equal(buyUpgrade(g, d, 'two'), true);
  assert.equal(g.drinks.coffee, 960);
  assert.equal(d.level, 1);
  assert.equal(levelName(d), 'Two');
  assert.equal(d.spent, 90);
  assert.equal(sellDev(g, d), 45);
});

test('level 3 needs 30 xp, is one branch only, inherits level-2 stats', () => {
  const g = waveGame(); g.drinks.coffee = 1000;
  const d = placeDev(g, 'u', 3, 3);
  grantXp(g, d, 35);
  assert.equal(buyUpgrade(g, d, 'a'), false);            // must buy level 2 first
  assert.ok(buyUpgrade(g, d, 'two'));
  assert.ok(buyUpgrade(g, d, 'a'));
  assert.equal(buyUpgrade(g, d, 'b'), false);
  assert.deepEqual(nextUpgrades(d), []);
  const s = devStats(g, d);
  assert.equal(s.damage, 20); assert.equal(s.fireRate, 2); assert.equal(s.range, 3 * 40);
  assert.equal(g.stats.seniors, 1);
});

test('events: upgradeready fires on purchase when xp already passed the next gate', () => {
  const g = waveGame(); g.drinks.coffee = 1000;
  const d = placeDev(g, 'u', 3, 3);
  grantXp(g, d, 10); grantXp(g, d, 25);
  const ready = [];
  on('dev:upgradeready', e => ready.push(e.level));
  buyUpgrade(g, d, 'two');
  assert.deepEqual(ready, [2]);
  buyUpgrade(g, d, 'a');
  assert.deepEqual(ready, [2]);                          // maxed: nothing further to unlock
});

test('events: upgradeready on crossing a gate, levelup on purchase', () => {
  const g = waveGame(); g.drinks.coffee = 1000;
  const d = placeDev(g, 'u', 3, 3);
  const ready = [], ups = [];
  on('dev:upgradeready', e => ready.push(e.level));
  on('dev:levelup', e => ups.push([e.level, e.upgrade.id]));
  grantXp(g, d, 9); grantXp(g, d, 1); grantXp(g, d, 5);
  assert.deepEqual(ready, [1]);
  buyUpgrade(g, d, 'two');
  grantXp(g, d, 15);
  assert.deepEqual(ready, [1, 2]);
  assert.deepEqual(ups, [[1, 'two']]);
});

test('Review Focus 1: a type without upgrades has none and still fires', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  grantXp(g, d, 50);
  assert.deepEqual(nextUpgrades(d), []);
  assert.equal(upgradeUnlocked(d), false);
  assert.equal(buyUpgrade(g, d, 'two'), false);
  const b = spawnBug(g, 'other', 300);
  tickDevs(g, 0.01);
  assert.equal(b.hp, 94);
});

test('update returning false holds fire; fire hook replaces the default shot', () => {
  R.registerDeveloper({ id: 'h', cost: 10, damage: 10, fireRate: 1, range: 2, counters: 'small',
    upgrades: { level2: { id: 'h2', name: 'H2', cost: 0, description: 'd',
      update: (game, dev) => dev.state.on === true,
      fire: (game, dev, target, stats) => { for (const b of bugsInRange(game, dev, stats.range)) hitBug(game, dev, b, 5); } },
      level3: [] } });
  const g = waveGame();
  const d = placeDev(g, 'h', 3, 3); d.xp = 10; buyUpgrade(g, d, 'h2');
  const b1 = spawnBug(g, 'other', 260), b2 = spawnBug(g, 'other', 300);
  tickDevs(g, 0.01);
  assert.equal(b1.hp, 100);
  d.state.on = true; tickDevs(g, 0.01);
  assert.deepEqual([b1.hp, b2.hp], [95, 95]);
});

test('Review Focus 2: hitting an already-dead bug gives no second reward or xp', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  const b = spawnBug(g, 'other', 300, 1);
  const w = g.warrants;
  assert.equal(hitBug(g, d, b, 10), true);
  assert.equal(hitBug(g, d, b, 10), false);
  assert.equal(g.warrants, w + 1);
  assert.equal(d.xp, 1);
  assert.equal(d.kills, 1);
});

test('Review Focus 5: throwing hooks are logged and the game keeps stepping', () => {
  const boom = () => { throw new Error('boom'); };
  R.registerDeveloper({ id: 'x', cost: 10, damage: 10, fireRate: 1, range: 2, counters: 'small', modifyStats: boom,
    upgrades: { level2: { id: 'x2', name: 'X2', cost: 0, description: 'd', update: boom, fire: boom, modifyStats: boom,
      aura: { radius: 2, apply: boom } }, level3: [] } });
  const g = waveGame();
  const d = placeDev(g, 'x', 3, 3); d.xp = 10; buyUpgrade(g, d, 'x2');
  placeDev(g, 'r', 2, 3);
  spawnBug(g, 'other', 300);
  const errors = []; const orig = console.error; console.error = (...a) => errors.push(a);
  try {
    for (let i = 0; i < 5; i++) step(g, 0.1);
    assert.ok(errors.length > 0);
    assert.ok(devStats(g, d).damage > 0);
  } finally { console.error = orig; }
});

test('devFireRate scales only the named developer type', () => {
  R.registerDeveloper({ id: 'j', cost: 50, damage: 6, fireRate: 2, range: 2.2, counters: 'small' });
  const g = createGame();
  const r = { type: 'r', level: 0 }, j = { type: 'j', level: 0 };
  g.mods.devFireRate = { j: 0.5 };
  assert.equal(devStats(g, j).fireRate, 1);
  assert.equal(devStats(g, r).fireRate, 4);
});

test('Review Focus 3: sell refund after hire + upgrade is floor(50%) of spent, in the dev drink only', () => {
  const g = waveGame();
  g.drinks.coffee = 100;
  const d = placeDev(g, 'u', 3, 3);
  d.xp = 30;
  assert.ok(buyUpgrade(g, d, 'two'));
  assert.equal(d.spent, 90);
  const before = { ...g.drinks };
  assert.equal(sellDev(g, d), 45);
  assert.equal(g.drinks.coffee, before.coffee + 45);
  assert.equal(g.drinks.monster, before.monster);
  assert.equal(g.drinks.redbull, before.redbull);
});

test('dev:sold carries refund and drink', () => {
  const g = waveGame();
  const d = placeDev(g, 'rb', 3, 3);
  let ev; on('dev:sold', e => { ev = e; });
  sellDev(g, d);
  assert.equal(ev.refund, 25);
  assert.equal(ev.drink, 'redbull');
});
