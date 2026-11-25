import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, killBug, step } from '../src/engine/game.js';
import { DROP_TTL, SWEEP_RADIUS, underBellCard } from '../src/engine/drops.js';
import { PATH_LENGTH, WIDTH, HEIGHT, cellAt } from '../src/engine/map.js';
import { getDrinks } from '../src/engine/registry.js';
import { registerTestDrinks } from './helpers/drinks.js';
import { mulberry32 } from '../scripts/pickup.mjs';
import '../src/content/bugs/security-risk.js';
import { trojanPrice, trojanLoot, scatterLoot, EXTRA_TTL } from '../src/content/bugs/trojan-horse.js';
import CLAUDE from '../src/content/powerups/claude.js';

// The content files register on import; keep their definitions and re-register them per test.
const HORSE = R.getBug('trojan-horse');
const RISK = R.getBug('security-risk');

beforeEach(() => {
  R.resetRegistry(); clearAll();
  R.registerBug(HORSE); R.registerBug(RISK); R.registerPowerup(CLAUDE);
  registerTestDrinks();
  R.registerWaves([{ hp: 2, boss: 'security-risk', groups: [] }]);
});

function game() { const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; return g; }
const perDrink = g => Object.fromEntries(getDrinks().map(d => [d.id, g.drops.filter(x => x.drink === d.id).reduce((a, x) => a + x.amount, 0)]));

test('price grows 10% of the base per sprint', () => {
  assert.equal(trojanPrice(0), 100);
  assert.equal(trojanPrice(6), 160);
  assert.equal(trojanPrice(27), 370);
});

test('horse has 3x the health of the security risk in the same sprint', () => {
  const g = game();
  assert.equal(spawnBug(g, 'trojan-horse').maxHp, 3 * spawnBug(g, 'security-risk').maxHp);
});

test('a leaked horse ends the run', () => {
  const g = game();
  g.lives = 20;
  spawnBug(g, 'trojan-horse', PATH_LENGTH - 0.1);
  step(g, 0.05);
  assert.equal(g.lives, 0);
  assert.equal(g.phase, 'lost');
});

test('squashed horse drops exactly 2x the price per drink', () => {
  const g = game(); g.sprint = 6;
  const horse = spawnBug(g, 'trojan-horse', 300);
  killBug(g, horse);
  assert.equal(trojanLoot(6, 1), 320);
  for (const [id, sum] of Object.entries(perDrink(g))) {
    assert.equal(sum, 320, id);
    assert.ok(g.drops.filter(x => x.drink === id).length > 3, `${id} is spread over many drops`);
  }
  for (const d of g.drops) assert.ok(Number.isInteger(d.amount) && d.amount >= 1, `drop amount ${d.amount}`);
});

test('loot respects the drink multiplier exactly', () => {
  for (const m of [1.1, 2.2]) {
    const g = game(); g.sprint = 6; g.mods.drinkMultiplier = m;
    killBug(g, spawnBug(g, 'trojan-horse', 300));
    for (const [id, sum] of Object.entries(perDrink(g))) assert.equal(sum, Math.round(2 * 160 * m), `${id} at ×${m}`);
    for (const d of g.drops) assert.ok(Number.isInteger(d.amount) && d.amount >= 1);
  }
});

test('loot lands on the map and far drops live longer', () => {
  const g = game(); g.random = mulberry32(7);
  // At distance 0 the horse sits at the path start, partly off the map: the thrown jackpot must still land on it.
  const horse = spawnBug(g, 'trojan-horse', 0);
  const thrown = scatterLoot(g, horse);
  assert.ok(thrown.length > 3);
  for (const d of thrown) {
    assert.ok(d.x >= 0 && d.x <= WIDTH && d.y >= 0 && d.y <= HEIGHT, `drop at ${d.x},${d.y}`);
    assert.ok(d.ttl >= DROP_TTL && d.ttl <= DROP_TTL + EXTRA_TTL, `ttl ${d.ttl}`);
    const { col, row } = cellAt(d.x, d.y);
    assert.ok(!underBellCard(col, row), `drop at ${col},${row} is under the bell card`);
    assert.equal(d.fromX, horse.x, 'loot flies out of the horse');
  }
  assert.ok(g.drops.some(d => Math.hypot(d.x - horse.x, d.y - horse.y) > SWEEP_RADIUS), 'some loot is out of one sweep');
  assert.ok(g.drops.some(d => d.ttl > DROP_TTL), 'thrown loot lives longer');
});

test('Claude success leaves the horse alive', () => {
  const g = game(); g.random = () => 0.99;
  const horse = spawnBug(g, 'trojan-horse', 100);
  spawnBug(g, 'security-risk', 50);
  CLAUDE.activate(g);
  assert.ok(g.bugs.includes(horse));
  assert.equal(horse.hp, horse.maxHp);
  assert.equal(g.bugs.filter(b => b.type === 'security-risk').length, 0);
});

test('Claude backfire does not copy the horse', () => {
  const g = game(); g.random = () => 0;
  spawnBug(g, 'trojan-horse', 100);
  spawnBug(g, 'security-risk', 50);
  CLAUDE.activate(g);
  assert.equal(g.bugs.filter(b => b.type === 'trojan-horse').length, 1);
  assert.equal(g.bugs.filter(b => b.type === 'security-risk').length, 2);
});

test("Claude can't fire at a lone horse", () => {
  const g = game();
  spawnBug(g, 'trojan-horse', 100);
  assert.equal(CLAUDE.canActivate(g), false);
});
