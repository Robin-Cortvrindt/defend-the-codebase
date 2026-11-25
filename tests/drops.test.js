import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerTestDrinks } from './helpers/drinks.js';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, step, spawnBug, killBug, quitRun } from '../src/engine/game.js';
import { tickDrops, clickDrop, pickDrop, collectDrop, quarterHoldLeft, nearestDrop, stealDrop, isLanded, landingSpot, DROP_TTL, DROP_RANGE, FLIGHT, PICK_RADIUS, SWEEP_RADIUS, COLLECT_MULT } from '../src/engine/drops.js';
import { on } from '../src/engine/events.js';
import { placeDev } from '../src/engine/devs.js';
import { cellAt, isBuildable, COLS, ROWS } from '../src/engine/map.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerBug({ id: 'b', hp: 10, speed: 100, reward: 3, radius: 5 });
  R.registerBug({ id: 'boss', hp: 1, speed: 1, reward: 30, boss: true, radius: 5 });
  R.registerWaves([{ groups: [{ bug: 'b', count: 1 }] }]);
});

function waveGame() {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.random = () => 0.5;
  return g;
}

test('a normal kill leaves one drop; balances unchanged until collected', () => {
  const g = waveGame(); g.random = () => 0;
  killBug(g, spawnBug(g, 'b'));
  assert.equal(g.drops.length, 1);
  assert.equal(g.drops[0].drink, 'coffee');
  assert.equal(g.drops[0].amount, 3);
  assert.equal(g.drops[0].ttl, DROP_TTL);
  assert.equal(g.drinks.coffee, 100);
});

test('a boss kill leaves one drop per drink, 10 each', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'boss'));
  assert.deepEqual(g.drops.map(d => [d.drink, d.amount]), [['coffee', 10], ['monster', 10], ['redbull', 10]]);
});

test('drops expire after 10 s without paying', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'b'));
  tickDrops(g, FLIGHT + 9.9);
  assert.equal(g.drops.length, 1);
  tickDrops(g, 0.2);
  assert.equal(g.drops.length, 0);
  assert.deepEqual(g.drinks, { coffee: 100, monster: 100, redbull: 100 });
});

test('clicks are ignored while paused; otherwise collect', () => {
  const g = waveGame(); g.random = () => 0;
  killBug(g, spawnBug(g, 'b'));
  tickDrops(g, FLIGHT);
  const { x, y } = g.drops[0];
  assert.equal(clickDrop(g, { paused: true }, x, y), 0);
  assert.equal(g.drops.length, 1);
  assert.equal(clickDrop(g, { paused: false }, x, y), 1);
  assert.equal(g.drops.length, 0);
  assert.equal(g.drinks.coffee, 100 + 3 * COLLECT_MULT);
});

test('a click 25 px away picks nothing', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'b'));
  tickDrops(g, FLIGHT);
  const { x, y } = g.drops[0];
  assert.equal(pickDrop(g, x + 25, y), 0);
  assert.ok(PICK_RADIUS < 25);
  assert.equal(g.drops.length, 1);
});

test('one click on a drop sweeps up every drop nearby; farther drops stay', () => {
  const g = waveGame();
  g.drops.push({ id: 1, x: 100, y: 100, drink: 'coffee', amount: 1, ttl: 10 });
  g.drops.push({ id: 2, x: 104, y: 100, drink: 'monster', amount: 2, ttl: 10 });
  g.drops.push({ id: 3, x: 100, y: 100 + SWEEP_RADIUS - 1, drink: 'redbull', amount: 3, ttl: 10 });
  g.drops.push({ id: 4, x: 100 + SWEEP_RADIUS + 1, y: 100, drink: 'coffee', amount: 4, ttl: 10 });
  assert.equal(pickDrop(g, 100, 100), 3);
  assert.deepEqual(g.drops.map(d => d.id), [4]);
  assert.deepEqual(g.drinks, { coffee: 100 + 1 * COLLECT_MULT, monster: 100 + 2 * COLLECT_MULT, redbull: 100 + 3 * COLLECT_MULT });
});

test('the sweep only starts when the click hits a drop', () => {
  const g = waveGame();
  g.drops.push({ id: 1, x: 100, y: 100, drink: 'coffee', amount: 1, ttl: 10 });
  assert.ok(PICK_RADIUS < 30 && SWEEP_RADIUS > 30);
  assert.equal(pickDrop(g, 130, 100), 0, 'within the sweep zone but not on a drop');
  assert.equal(g.drops.length, 1);
});

test('no pickups outside wave / bell', () => {
  const g = createGame(); startGame(g);
  g.drops.push({ id: 1, x: 5, y: 5, drink: 'coffee', amount: 1, ttl: 10 });
  assert.equal(pickDrop(g, 5, 5), 0);
  assert.equal(collectDrop(g, { id: 9 }), false);
});

test('Review Focus 4: last sprint of a quarter holds for drops', () => {
  const g = waveGame(); g.sprint = 6;
  killBug(g, spawnBug(g, 'b'));
  step(g, 0.05);
  assert.equal(g.phase, 'wave');
  for (let i = 0; i < 220; i++) step(g, 0.05);
  assert.equal(g.phase, 'review');
});

test('quarterHoldLeft: seconds until the last drop expires, only in the holding state', () => {
  const g = waveGame(); g.sprint = 6;
  assert.equal(quarterHoldLeft(g), 0);                    // no drops
  killBug(g, spawnBug(g, 'b'));
  assert.equal(quarterHoldLeft(g), DROP_TTL + FLIGHT);   // Review Focus 4: flight time counts
  tickDrops(g, 4);
  assert.equal(quarterHoldLeft(g), DROP_TTL + FLIGHT - 4);
  g.drops.push({ id: 99, x: 0, y: 0, drink: 'coffee', amount: 1, ttl: 8 });
  assert.equal(quarterHoldLeft(g), 8);                    // the longest-lived drop
  g.bugs.push({}); assert.equal(quarterHoldLeft(g), 0);   // bugs remain
  g.bugs.length = 0; g.spawnQueue = [{}]; assert.equal(quarterHoldLeft(g), 0);   // spawns remain
  g.spawnQueue = []; g.phase = 'bell'; assert.equal(quarterHoldLeft(g), 0);
  g.phase = 'wave'; g.sprint = 5; assert.equal(quarterHoldLeft(g), 0);   // not the last sprint of the quarter
});

test('quarter hold releases when the last drop is collected', () => {
  const g = waveGame(); g.sprint = 6;
  killBug(g, spawnBug(g, 'b'));
  step(g, 0.05);
  assert.equal(g.phase, 'wave');
  assert.ok(quarterHoldLeft(g) > 0);
  collectDrop(g, g.drops[0]);
  assert.equal(quarterHoldLeft(g), 0);
  step(g, 0.05);
  assert.equal(g.phase, 'review');
});

test('quarter hold also applies on sprint index 13 (end of quarter 2)', () => {
  const g = waveGame(); g.sprint = 13;
  killBug(g, spawnBug(g, 'b'));
  step(g, 0.05);
  assert.equal(g.phase, 'wave');
  assert.ok(quarterHoldLeft(g) > 0);
  collectDrop(g, g.drops[0]);
  step(g, 0.05);
  assert.equal(g.phase, 'review');
});

test('an ordinary sprint goes to bell with the drop still on the board', () => {
  const g = waveGame(); g.sprint = 0;
  killBug(g, spawnBug(g, 'b'));
  step(g, 0.05);
  assert.equal(g.phase, 'bell');
  assert.equal(g.drops.length, 1);
  step(g, 1);
  assert.equal(g.drops.length, 1);
  assert.ok(g.drops[0].ttl < DROP_TTL);
});

test('Review Focus 5: quitting and losing clear drops; startGame resets them', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'b'));
  quitRun(g);
  assert.deepEqual(g.drops, []);
  const h = waveGame();
  killBug(h, spawnBug(h, 'b'));
  h.lives = 0; step(h, 0.05);
  assert.equal(h.phase, 'lost');
  assert.deepEqual(h.drops, []);
  const f = createGame(); f.drops.push({ id: 1 }); startGame(f);
  assert.deepEqual(f.drops, []);
});

// ---- scattered loot ----
test('a drop lands on a free floor cell, never the lane, PROD or a developer; it flies from the bug', () => {
  R.registerDeveloper({ id: 'd', drink: 'coffee', cost: 1, damage: 1, fireRate: 1, range: 1 });
  const g = waveGame(); g.drinks.coffee = 9999;
  let seed = 7; g.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const dev = placeDev(g, 'd', 3, 3); assert.ok(dev);
  for (let i = 0; i < 200; i++) {
    const bug = spawnBug(g, 'b', 100);
    const { x: bx, y: by } = bug;
    const [d] = [killBug(g, bug), g.drops[g.drops.length - 1]].slice(1);
    const { col, row } = cellAt(d.x, d.y);
    assert.ok(isBuildable(col, row), `cell ${col},${row}`);
    assert.ok(!(col === 3 && row === 3), 'not under the developer');
    assert.deepEqual([d.fromX, d.fromY], [bx, by]);
    assert.equal(d.flight, FLIGHT);
  }
});

test('flying drops cannot be picked, swept, stolen or found; the 10 s start on landing', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'b'));
  const d = g.drops[0];
  assert.equal(isLanded(d), false);
  assert.equal(pickDrop(g, d.x, d.y), 0);
  assert.equal(nearestDrop(g, d.x, d.y), null);
  tickDrops(g, FLIGHT);
  assert.equal(isLanded(d), true);
  assert.equal(d.ttl, DROP_TTL);
  assert.equal(nearestDrop(g, d.x, d.y), d);
});

test('nearestDrop picks the closest landed drop', () => {
  const g = waveGame();
  g.drops.push({ id: 1, x: 100, y: 100, drink: 'coffee', amount: 1, ttl: 10 });
  g.drops.push({ id: 2, x: 300, y: 100, drink: 'coffee', amount: 1, ttl: 10 });
  g.drops.push({ id: 3, x: 251, y: 100, drink: 'coffee', amount: 1, ttl: 10, flight: 0.3 });
  assert.equal(nearestDrop(g, 250, 100).id, 2);
  assert.equal(nearestDrop(g, 120, 100).id, 1);
});

test('stealDrop removes a drop without paying and emits drop:stolen', () => {
  const g = waveGame();
  const d = { id: 1, x: 100, y: 100, drink: 'coffee', amount: 5, ttl: 10 };
  g.drops.push(d);
  const seen = []; on('drop:stolen', e => seen.push(e.drop));
  assert.equal(stealDrop(g, d), true);
  assert.deepEqual(g.drops, []);
  assert.deepEqual(seen, [d]);
  assert.equal(g.drinks.coffee, 100);
  assert.equal(stealDrop(g, d), false);
  const by = []; on('drop:collected', e => by.push(e.by));
  g.drops.push({ id: 2, x: 100, y: 100, drink: 'coffee', amount: 1, ttl: 10 });
  pickDrop(g, 100, 100);
  assert.deepEqual(by, ['player'], 'a click counts as the player picking it up');
});

test('Review Focus 5: no free cell left, the drop lands where the bug died', () => {
  R.registerDeveloper({ id: 'd', drink: 'coffee', cost: 1, damage: 1, fireRate: 1, range: 1 });
  const g = waveGame(); g.drinks.coffee = 99999;
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (isBuildable(c, r)) placeDev(g, 'd', c, r);
  const bug = spawnBug(g, 'b', 100);
  const { x, y } = bug;
  killBug(g, bug);
  const d = g.drops[0];
  assert.ok(Math.abs(d.x - x) <= 8 && Math.abs(d.y - y) <= 8);
});

test('drops never land under the bell card in the bottom-right corner', () => {
  const g = waveGame();
  let seed = 11; g.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 300; i++) {
    killBug(g, spawnBug(g, 'b', 100));
    const { col, row } = cellAt(g.drops.at(-1).x, g.drops.at(-1).y);
    assert.ok(!(col >= COLS / 2 && row >= ROWS - 2), `cell ${col},${row} is under the bell card`);
  }
});

test('a drop lands within DROP_RANGE of the bug that dropped it (plus jitter)', () => {
  const g = waveGame();
  let seed = 13; g.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) {
    const bug = spawnBug(g, 'b', (i * 37) % 900);
    const { x, y } = bug;
    killBug(g, bug);
    const d = g.drops.at(-1);
    assert.ok(Math.hypot(d.x - x, d.y - y) <= DROP_RANGE + 8 * Math.SQRT2, `drop ${Math.round(Math.hypot(d.x - x, d.y - y))} px from the bug`);
  }
});

test('no free cell in range: the drop lands on the nearest free cell', () => {
  const g = waveGame(); g.random = () => 0.5;
  // Far off the board's top-left corner: nothing is within range, cell 0,0 or its neighbour is the closest.
  const { x, y } = landingSpot(g, -500, -500);
  const { col, row } = cellAt(x, y);
  assert.ok(isBuildable(col, row));
  assert.ok(col <= 1 && row <= 1, `cell ${col},${row}`);
});

test('collecting a drop pays double its amount and the pop shows the doubled number', () => {
  const g = waveGame();
  assert.equal(COLLECT_MULT, 2);
  const drop = { id: 1, x: 100, y: 100, drink: 'monster', amount: 4, ttl: 10 };
  g.drops.push(drop);
  assert.equal(collectDrop(g, drop), true);
  assert.equal(g.drinks.monster, 108);
  assert.ok(g.effects.some(e => e.kind === 'pop' && e.text === '+8'));
});
