import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, step } from '../src/engine/game.js';
import { GROWTH_PER_SECOND, MAX_GROWTH, BASE_RADIUS, MAX_RADIUS } from '../src/content/bugs/memory-leak.js';

// The content file registers on import; keep its definition and re-register it per test.
const DEF = R.getBug('memory-leak');

beforeEach(() => {
  R.resetRegistry(); clearAll();
  R.registerBug(DEF);
  R.registerWaves([{ hp: 2, groups: [] }]);
});

function game() { const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; return g; }
const noop = () => {};
const ctx = new Proxy({}, { get: () => noop, set: () => true });

test('memory leak grows its health and size over time, then caps', () => {
  const g = game();
  const leak = spawnBug(g, 'memory-leak', 0);
  const base = leak.maxHp;
  assert.equal(base, DEF.hp * 2, 'starts at the wave-scaled health');
  step(g, 1);
  assert.equal(leak.maxHp, Math.round(base * (1 + GROWTH_PER_SECOND)));
  assert.ok(leak.radius > BASE_RADIUS);
  for (let i = 0; i < 40; i++) step(g, 0.5);   // 21 s: past the cap, still on the path
  assert.ok(g.bugs.includes(leak));
  assert.equal(leak.maxHp, base * MAX_GROWTH);
  assert.equal(leak.radius, MAX_RADIUS);
});

test('growth keeps the damage it already took', () => {
  const g = game();
  const leak = spawnBug(g, 'memory-leak', 0);
  leak.hp -= 20;
  const missing = leak.maxHp - leak.hp;
  step(g, 2);
  assert.equal(leak.maxHp - leak.hp, missing);
});

test('growth follows simulation time, so game speed does not change it', () => {
  const g = game();
  g.mods.timeScale = 5;
  const leak = spawnBug(g, 'memory-leak', 0);
  const base = leak.maxHp;
  step(g, 1);   // 5 s of game time
  assert.equal(leak.maxHp, Math.round(base * (1 + 5 * GROWTH_PER_SECOND)));
});

test('it stops at the cap even after a long life', () => {
  const g = game();
  const leak = spawnBug(g, 'memory-leak', 0);
  const base = leak.maxHp;
  DEF.update(leak, g, 1000);
  assert.equal(leak.maxHp, base * MAX_GROWTH);
  assert.equal(leak.radius, MAX_RADIUS);
});

test('the icon draws with and without a bug', () => {
  DEF.drawIcon(ctx, DEF.radius);
  DEF.drawIcon(ctx, MAX_RADIUS, { radius: MAX_RADIUS });
});
