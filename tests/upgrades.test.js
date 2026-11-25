import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave, spawnBug } from '../src/engine/game.js';
import { placeDev, sellDev, tickDevs, devStats, buyUpgrade, levelName } from '../src/engine/devs.js';

const { failed } = await loadModules(CONTENT_URLS);
assert.equal(failed.length, 0);

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

function waveGame() {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; return g;
}

function devAt(g, type, col, row, ...upgradeIds) {
  g.warrants = 10000;
  const d = placeDev(g, type, col, row); d.xp = 30;
  for (const id of upgradeIds) assert.ok(buyUpgrade(g, d, id), id);
  return d;
}

test('java: Spring Boot stats; names', () => {
  const g = waveGame();
  const d = devAt(g, 'java', 3, 3);
  assert.equal(levelName(d), 'Junior Java Dev');
  buyUpgrade(g, d, 'springboot');
  assert.equal(levelName(d), 'Spring Boot Dev');
  assert.equal(devStats(g, d).damage, 26);
  assert.equal(devStats(g, d).range, 2.6 * 40);
  assert.equal(d.spent, 75 + 60);
});

test('java: Enterprise Architect deals x0.6 itself and gives +15% to neighbours, once, not to itself', () => {
  const g = waveGame();
  const ea = devAt(g, 'java', 3, 3, 'springboot', 'architect');
  const ea2 = devAt(g, 'java', 3, 4, 'springboot', 'architect');
  const r = devAt(g, 'react', 2, 3);
  near(devStats(g, ea).damage, 26 * 0.6 * 1.15); // gets ea2's aura, not its own
  near(devStats(g, r).damage, 6 * 1.15);         // two architects, applied once
  sellDev(g, ea); sellDev(g, ea2);
  assert.equal(devStats(g, r).damage, 6);        // aura ends on sell
});

test('java: Garbage Collector holds fire 1 s every 8 s, then pulses 3x to all in range', () => {
  const g = waveGame();
  devAt(g, 'java', 3, 3, 'springboot', 'gc');
  const far = spawnBug(g, 'typo', 260, 10000); far.slow = 0;
  const near2 = spawnBug(g, 'typo', 300, 10000); near2.slow = 0;
  const log = [];
  for (let i = 1; i <= 190; i++) {
    const before = [far.hp, near2.hp];
    tickDevs(g, 0.05);
    log.push({ t: i * 0.05, dFar: before[0] - far.hp, dNear: before[1] - near2.hp });
  }
  for (const e of log.filter(e => e.t > 8.0 + 1e-6 && e.t < 9.0 - 1e-6)) {
    assert.equal(e.dFar + e.dNear, 0, `no damage at t=${e.t}`);
  }
  const pulse = log.find(e => e.t > 8.5 && e.dNear > 0); // first tick at or past 9 s (float drift may land it on the 9.05 tick)
  assert.ok(pulse.t >= 9.0 - 1e-6 && pulse.t <= 9.05 + 1e-6);
  assert.equal(pulse.dFar, 78); // bug at 260 is the less advanced one, not the regular shot's target
  assert.ok(pulse.dNear >= 78); // furthest-along (300) may also take the regular shot
  assert.ok(g.effects.some(e => e.kind === 'pop' && e.text === 'Stop-the-World'));
});

test('java: "Initializing 847 beans…" pop for 1 s on placement, java only', () => {
  const g = waveGame();
  g.warrants = 1000;
  placeDev(g, 'react', 2, 3);
  assert.ok(!g.effects.some(e => e.text === 'Initializing 847 beans…'));
  placeDev(g, 'java', 3, 3);
  const e = g.effects.find(e => e.text === 'Initializing 847 beans…');
  assert.ok(e);
  assert.equal(e.kind, 'pop');
  assert.equal(e.ttl, 1);
});
