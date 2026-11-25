import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerTestDrinks, totalDrinks, collectAll } from './helpers/drinks.js';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, step, killBug } from '../src/engine/game.js';
import { usePowerup, canUse, powerupState, tickPowerups } from '../src/engine/powerups.js';
import '../src/content/powerups/training-manager.js';

async function fresh() {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  // re-register after reset (modules are cached, so import the defs directly)
  for (const m of ['training-manager', 'business-manager', 'ceo', 'claude']) {
    const mod = await import(`../src/content/powerups/${m}.js`);
    R.registerPowerup(mod.default);
  }
  R.registerBug({ id: 'b', hp: 10, speed: 0, livesLost: 1, reward: 4, radius: 5 });
  R.registerWaves([{ groups: [] }, { groups: [] }]);
}
beforeEach(fresh);

function waveGame() { const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; return g; }

test('Training manager doubles xpMultiplier for 15s then restores; reuse only after 45s cooldown', () => {
  const g = waveGame(); spawnBug(g, 'b', 10);
  assert.equal(usePowerup(g, 'training'), true);
  assert.equal(g.mods.xpMultiplier, 2);
  assert.equal(canUse(g, 'training'), false);
  tickPowerups(g, 15.01);
  assert.equal(g.mods.xpMultiplier, 1);
  assert.equal(canUse(g, 'training'), false);
  tickPowerups(g, 45);
  assert.equal(canUse(g, 'training'), true);
});

test('Business manager doubles drinks, CEO speeds attacks', () => {
  const g = waveGame();
  usePowerup(g, 'business'); usePowerup(g, 'ceo');
  assert.equal(g.mods.drinkMultiplier, 2);
  assert.equal(g.mods.fireRateMultiplier, 1.5);
});

test('cooldown keeps ticking in bell phase', () => {
  const g = waveGame();
  usePowerup(g, 'ceo');
  g.phase = 'bell';
  step(g, 0.05);
  tickPowerups(g, 60);
  assert.equal(powerupState(g, 'ceo').cooldownLeft, 0);
});

test('power-ups refused outside wave phase', () => {
  const g = createGame(); startGame(g);
  assert.equal(usePowerup(g, 'training'), false);
  assert.equal(g.mods.xpMultiplier, 1);
});

test('Claude success kills all bugs and pays rewards; power-ups cost nothing', () => {
  const g = waveGame(); g.random = () => 0.9;
  const drinksBefore = totalDrinks(g);
  spawnBug(g, 'b', 10); spawnBug(g, 'b', 20);
  assert.equal(usePowerup(g, 'claude'), true);
  assert.equal(g.bugs.length, 0);
  collectAll(g);
  assert.equal(totalDrinks(g), drinksBefore + 8);
});

test('power-ups work with every drink at 0', () => {
  const g = waveGame();
  for (const id of Object.keys(g.drinks)) g.drinks[id] = 0;
  assert.equal(usePowerup(g, 'ceo'), true);
});

test('Claude: cooldown 90 s, then usable again', () => {
  const g = waveGame(); g.random = () => 0.9;
  spawnBug(g, 'b', 10);
  assert.equal(usePowerup(g, 'claude'), true);
  spawnBug(g, 'b', 10);
  assert.equal(canUse(g, 'claude'), false);
  tickPowerups(g, 89);
  assert.equal(canUse(g, 'claude'), false);
  tickPowerups(g, 1);
  assert.equal(canUse(g, 'claude'), true);
});

test('Claude with 0 bugs is refused and starts no cooldown', () => {
  const g = waveGame();
  assert.equal(usePowerup(g, 'claude'), false);
  assert.equal(powerupState(g, 'claude').uses, 0);
});

test('usePowerup emits skippedCooldown only when a skipCooldown hook allowed it', () => {
  const g = waveGame(); g.random = () => 0.9;
  const seen = []; on('powerup:activated', d => seen.push(d.skippedCooldown));
  spawnBug(g, 'b', 10);
  usePowerup(g, 'claude');
  spawnBug(g, 'b', 10);
  R.getPowerup('claude').skipCooldown = () => true;
  try {
    assert.equal(usePowerup(g, 'claude'), true);
    assert.deepEqual(seen, [false, true]);
  } finally { delete R.getPowerup('claude').skipCooldown; }
});

test('Review Focus 5: backfire doubles bugs, clones keep distance and hp, wave waits for clones', () => {
  const g = waveGame(); g.random = () => 0.1;
  const a = spawnBug(g, 'b', 30); a.hp = 7;
  spawnBug(g, 'b', 50);
  let bf = 0; on('claude:backfire', () => bf++);
  assert.equal(usePowerup(g, 'claude'), true);
  assert.equal(bf, 1);
  assert.equal(g.bugs.length, 4);
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

test('I1: a power-up whose canActivate throws is just unusable, never throws', () => {
  R.registerPowerup({ id: 'broken', name: 'Broken', description: 'x', duration: 1, cooldown: 1, canActivate() { throw new Error('boom'); }, activate() {} });
  R.registerPowerup({ id: 'broken2', name: 'Broken2', description: 'x', duration: 1, cooldown: 1, canActivate() { throw new Error('boom'); }, activate() {} });
  const g = waveGame();
  const orig = console.error; console.error = () => {};
  assert.equal(canUse(g, 'broken'), false);
  assert.equal(canUse(g, 'broken2'), false);
  assert.equal(usePowerup(g, 'broken'), false);
  console.error = orig;
});

// ---------- power-up investments ----------
import { powerupMod, effectiveCooldown } from '../src/engine/powerups.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';

const PU_INVESTMENTS = ['training-budget', 'training-planning', 'sales-targets', 'sales-pipeline', 'leadership-coaching', 'ceo-calendar', 'prompt-engineering', 'enterprise-plan'];
async function withPowerupInvestments() {
  setStorage(null);
  for (const m of PU_INVESTMENTS) R.registerInvestment((await import(`../src/content/investments/${m}.js`)).default);
}

test('effect level makes training stronger; activate→deactivate restores exactly', () => {
  const g = waveGame(); powerupMod(g, 'training').effect = 2; spawnBug(g, 'b', 10);
  usePowerup(g, 'training'); assert.equal(g.mods.xpMultiplier, 2.5);
  tickPowerups(g, 15.01); assert.equal(g.mods.xpMultiplier, 1);
});

test('business and CEO effect levels', () => {
  const g = waveGame(); powerupMod(g, 'business').effect = 1; powerupMod(g, 'ceo').effect = 2;
  usePowerup(g, 'business'); usePowerup(g, 'ceo');
  assert.equal(g.mods.drinkMultiplier, 2.25);
  assert.ok(Math.abs(g.mods.fireRateMultiplier - 1.7) < 1e-9);
  tickPowerups(g, 15.01);
  assert.ok(Math.abs(g.mods.drinkMultiplier - 1) < 1e-9);
  assert.ok(Math.abs(g.mods.fireRateMultiplier - 1) < 1e-9);
});

test('cooldown level shortens the cooldown', () => {
  const g = waveGame(); powerupMod(g, 'ceo').cooldown = 0.7;
  assert.equal(effectiveCooldown(g, 'ceo'), 28);
  usePowerup(g, 'ceo'); tickPowerups(g, 10.01);
  assert.ok(Math.abs(powerupState(g, 'ceo').cooldownLeft - 28) < 0.05);
});

test('Review Focus 4: CEO boost + another fireRate change in between unwind cleanly', () => {
  const g = waveGame(); powerupMod(g, 'ceo').effect = 3;
  usePowerup(g, 'ceo'); g.mods.fireRateMultiplier *= 0.5;   // e.g. heating out starts
  tickPowerups(g, 10.01); g.mods.fireRateMultiplier /= 0.5; // CEO ends, then event ends
  assert.ok(Math.abs(g.mods.fireRateMultiplier - 1) < 1e-9);
});

test('Claude: prompt engineering lowers backfire; enterprise plan level 2 → cooldown 72', async () => {
  const g = waveGame(); powerupMod(g, 'claude').effect = 3;
  g.random = () => 0.12; spawnBug(g, 'b', 10);
  usePowerup(g, 'claude'); assert.equal(g.bugs.length, 0);   // 0.12 ≥ 0.10 → success
  await withPowerupInvestments();
  saveProgress({ capital: 0, levels: { 'enterprise-plan': 2 } });
  const g2 = createGame(); startGame(g2);
  assert.ok(Math.abs(effectiveCooldown(g2, 'claude') - 72) < 1e-9);
});


test('describe() shows the upgraded numbers', () => {
  const g = waveGame(); powerupMod(g, 'training').effect = 1; powerupMod(g, 'claude').effect = 2;
  assert.equal(R.getPowerup('training').describe(g), '×2.25 XP');
  assert.equal(R.getPowerup('claude').describe(g), 'Squash every bug · 15% backfire');
});

test('investment files apply to powerupMods via startGame', async () => {
  await withPowerupInvestments();
  saveProgress({ capital: 0, levels: { 'training-budget': 1, 'ceo-calendar': 2, 'enterprise-plan': 3 } });
  const g = createGame(); startGame(g);
  assert.equal(powerupMod(g, 'training').effect, 1);
  assert.ok(Math.abs(powerupMod(g, 'ceo').cooldown - 0.8) < 1e-9);
  assert.ok(Math.abs(powerupMod(g, 'claude').cooldown - 0.7) < 1e-9);
});

// ---------- cooldowns only run during a sprint ----------
// A sprint-like game: phase 'wave' with a bug on the map so the sprint does not end by itself.
function heldWave() { const g = waveGame(); spawnBug(g, 'b', 10); return g; }

test('a cooldown pauses between sprints and resumes in the next sprint', () => {
  const g = heldWave();
  usePowerup(g, 'training');
  tickPowerups(g, 15.01);                 // the effect ends during the sprint: cooldown starts
  const left = powerupState(g, 'training').cooldownLeft;
  assert.ok(left > 0);
  for (const phase of ['bell', 'building', 'review']) {
    g.phase = phase;
    step(g, 5);
    assert.equal(powerupState(g, 'training').cooldownLeft, left, phase);
  }
  g.phase = 'wave';
  step(g, 5);
  assert.ok(Math.abs(powerupState(g, 'training').cooldownLeft - (left - 5)) < 1e-9);
});

test('an active power-up keeps its remaining time until the next sprint', () => {
  const g = heldWave();
  usePowerup(g, 'training');
  step(g, 3);
  const remaining = powerupState(g, 'training').remaining;
  g.phase = 'bell';
  step(g, 30);
  assert.equal(powerupState(g, 'training').active, true);
  assert.equal(powerupState(g, 'training').remaining, remaining);
  assert.equal(g.mods.xpMultiplier, 2);
});
