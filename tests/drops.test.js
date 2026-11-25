import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerTestDrinks } from './helpers/drinks.js';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, step, spawnBug, killBug, quitRun } from '../src/engine/game.js';
import { tickDrops, clickDrop, pickDrop, collectDrop, DROP_TTL, PICK_RADIUS } from '../src/engine/drops.js';

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
  assert.equal(g.drinks.coffee, 50);
});

test('a boss kill leaves one drop per drink, 10 each', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'boss'));
  assert.deepEqual(g.drops.map(d => [d.drink, d.amount]), [['coffee', 10], ['monster', 10], ['redbull', 10]]);
});

test('drops expire after 10 s without paying', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'b'));
  tickDrops(g, 9.9);
  assert.equal(g.drops.length, 1);
  tickDrops(g, 0.2);
  assert.equal(g.drops.length, 0);
  assert.deepEqual(g.drinks, { coffee: 50, monster: 50, redbull: 50 });
});

test('clicks are ignored while paused; otherwise collect', () => {
  const g = waveGame(); g.random = () => 0;
  killBug(g, spawnBug(g, 'b'));
  const { x, y } = g.drops[0];
  assert.equal(clickDrop(g, { paused: true }, x, y), null);
  assert.equal(g.drops.length, 1);
  assert.ok(clickDrop(g, { paused: false }, x, y));
  assert.equal(g.drops.length, 0);
  assert.equal(g.drinks.coffee, 53);
});

test('a click 25 px away picks nothing', () => {
  const g = waveGame();
  killBug(g, spawnBug(g, 'b'));
  const { x, y } = g.drops[0];
  assert.equal(pickDrop(g, x + 25, y), null);
  assert.ok(PICK_RADIUS < 25);
  assert.equal(g.drops.length, 1);
});

test('Review Focus 1: two close drops, one click collects only the nearer one', () => {
  const g = waveGame();
  g.drops.push({ id: 1, x: 100, y: 100, drink: 'coffee', amount: 1, ttl: 10 });
  g.drops.push({ id: 2, x: 104, y: 100, drink: 'monster', amount: 1, ttl: 10 });
  const got = pickDrop(g, 103, 100);
  assert.equal(got.id, 2);
  assert.deepEqual(g.drops.map(d => d.id), [1]);
  assert.equal(g.drinks.monster, 51);
  assert.equal(g.drinks.coffee, 50);
});

test('no pickups outside wave / bell', () => {
  const g = createGame(); startGame(g);
  g.drops.push({ id: 1, x: 5, y: 5, drink: 'coffee', amount: 1, ttl: 10 });
  assert.equal(pickDrop(g, 5, 5), null);
  assert.equal(collectDrop(g, { id: 9 }), false);
});

test('Review Focus 4: last sprint of a quarter holds for drops', () => {
  const g = waveGame(); g.sprint = 6;
  killBug(g, spawnBug(g, 'b'));
  step(g, 0.05);
  assert.equal(g.phase, 'wave');
  for (let i = 0; i < 200; i++) step(g, 0.05);
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
