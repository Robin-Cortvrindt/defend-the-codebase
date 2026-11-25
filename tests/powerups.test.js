import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, step, killBug } from '../src/engine/game.js';
import { usePowerup, canUse, powerupState, tickPowerups } from '../src/engine/powerups.js';
import '../src/content/powerups/thomas.js';

async function fresh() {
  R.resetRegistry(); clearAll();
  // re-register after reset (modules are cached, so import the defs directly)
  for (const m of ['thomas', 'jeroen', 'bart', 'claude']) {
    const mod = await import(`../src/content/powerups/${m}.js`);
    R.registerPowerup(mod.default);
  }
  R.registerBug({ id: 'b', hp: 10, speed: 0, livesLost: 1, reward: 4, radius: 5 });
  R.registerWaves([{ groups: [] }, { groups: [] }]);
}
beforeEach(fresh);

function waveGame() { const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; return g; }

test('Thomas doubles xpMultiplier for 15s then restores; reuse only after 45s cooldown', () => {
  const g = waveGame(); spawnBug(g, 'b', 10);
  assert.equal(usePowerup(g, 'thomas'), true);
  assert.equal(g.mods.xpMultiplier, 2);
  assert.equal(canUse(g, 'thomas'), false);
  tickPowerups(g, 15.01);
  assert.equal(g.mods.xpMultiplier, 1);
  assert.equal(canUse(g, 'thomas'), false);
  tickPowerups(g, 45);
  assert.equal(canUse(g, 'thomas'), true);
});

test('Jeroen doubles warrants, Bart speeds attacks', () => {
  const g = waveGame();
  usePowerup(g, 'jeroen'); usePowerup(g, 'bart');
  assert.equal(g.mods.warrantMultiplier, 2);
  assert.equal(g.mods.fireRateMultiplier, 1.5);
});

test('cooldown keeps ticking in bell phase', () => {
  const g = waveGame();
  usePowerup(g, 'bart');
  g.phase = 'bell';
  step(g, 0.05);
  tickPowerups(g, 60);
  assert.equal(powerupState(g, 'bart').cooldownLeft, 0);
});

test('power-ups refused outside wave phase', () => {
  const g = createGame(); startGame(g);
  assert.equal(usePowerup(g, 'thomas'), false);
  assert.equal(g.mods.xpMultiplier, 1);
});

test('Claude success kills all bugs, pays rewards, price 150 → 225 → 338', () => {
  const g = waveGame(); g.random = () => 0.9; g.warrants = 1000;
  spawnBug(g, 'b', 10); spawnBug(g, 'b', 20);
  assert.equal(R.getPowerup('claude').getCost(g), 150);
  assert.equal(usePowerup(g, 'claude'), true);
  assert.equal(g.bugs.length, 0);
  assert.equal(g.warrants, 1000 - 150 + 8);
  assert.equal(R.getPowerup('claude').getCost(g), 225);
  spawnBug(g, 'b', 10);
  usePowerup(g, 'claude');
  assert.equal(R.getPowerup('claude').getCost(g), 338);
});

test('Review Focus 1: Claude with 0 bugs or insufficient warrants → refused, no charge', () => {
  const g = waveGame(); g.warrants = 1000;
  assert.equal(usePowerup(g, 'claude'), false);
  assert.equal(g.warrants, 1000);
  spawnBug(g, 'b', 10); g.warrants = 149;
  assert.equal(usePowerup(g, 'claude'), false);
  assert.equal(g.warrants, 149);
  assert.equal(powerupState(g, 'claude').uses, 0);
});

test('Review Focus 5: backfire doubles bugs, clones keep distance and hp, still charged; wave waits for clones', () => {
  const g = waveGame(); g.random = () => 0.1; g.warrants = 500;
  const a = spawnBug(g, 'b', 30); a.hp = 7;
  spawnBug(g, 'b', 50);
  let bf = 0; on('claude:backfire', () => bf++);
  assert.equal(usePowerup(g, 'claude'), true);
  assert.equal(bf, 1);
  assert.equal(g.bugs.length, 4);
  assert.equal(g.warrants, 350);
  assert.equal(g.stats.backfires, 1);
  const clone = g.bugs.find(b => b !== a && b.distance === 30);
  assert.equal(clone.hp, 7);
  killBug(g, g.bugs[0]); killBug(g, g.bugs[0]); killBug(g, g.bugs[0]);
  step(g, 0.01);
  assert.equal(g.phase, 'wave');
  killBug(g, g.bugs[0]);
  step(g, 0.01);
  assert.equal(g.phase, 'bell');
});

test('I1: a power-up whose getCost or canActivate throws is just unusable, never throws', () => {
  R.registerPowerup({ id: 'broken', name: 'Broken', description: 'x', duration: 1, cooldown: 1, getCost() { throw new Error('boom'); }, activate() {} });
  R.registerPowerup({ id: 'broken2', name: 'Broken2', description: 'x', duration: 1, cooldown: 1, canActivate() { throw new Error('boom'); }, activate() {} });
  const g = waveGame();
  const orig = console.error; console.error = () => {};
  assert.equal(canUse(g, 'broken'), false);
  assert.equal(canUse(g, 'broken2'), false);
  assert.equal(usePowerup(g, 'broken'), false);
  console.error = orig;
});
