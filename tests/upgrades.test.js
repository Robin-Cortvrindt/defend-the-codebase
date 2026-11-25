import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave, spawnBug } from '../src/engine/game.js';
import { getDeveloper } from '../src/engine/registry.js';
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

test('react: Vite fire rate, names, tooltip', () => {
  const g = waveGame();
  const d = devAt(g, 'react', 3, 3);
  assert.equal(levelName(d), 'Create React App');
  buyUpgrade(g, d, 'vite');
  assert.equal(levelName(d), 'Vite');
  assert.equal(devStats(g, d).fireRate, 6);
  assert.equal(getDeveloper('react').upgrades.level2.tooltip, 'CRA is deprecated, sorry.');
});

test('react: ecosystem +10% fire rate per other React dev, capped at +50%', () => {
  const g = waveGame();
  const d = devAt(g, 'react', 3, 3);
  assert.equal(devStats(g, d).fireRate, 4);
  devAt(g, 'java', 3, 4);
  assert.equal(devStats(g, d).fireRate, 4);
  const cells = [[0,0],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7]];
  devAt(g, 'react', ...cells[0]); devAt(g, 'react', ...cells[1]);
  near(devStats(g, d).fireRate, 4 * 1.2);
  for (const c of cells.slice(2)) devAt(g, 'react', ...c);
  near(devStats(g, d).fireRate, 4 * 1.5);
});

test('react: Next.js hits the target and the next 2 bugs behind it', () => {
  const g = waveGame();
  devAt(g, 'react', 3, 3, 'vite', 'nextjs');
  const bugs = [220, 240, 260, 280].map(dist => { const b = spawnBug(g, 'nullpointer', dist, 1000); b.slow = 0; return b; });
  tickDevs(g, 0.05);
  assert.deepEqual(bugs.map(b => 1000 - b.hp), [0, 6, 6, 6]);
});

test('react: useEffect Hell chains at 20%, capped at 10', () => {
  const g = waveGame();
  devAt(g, 'react', 3, 3, 'vite', 'effecthell');
  const b = spawnBug(g, 'nullpointer', 260, 1000); b.slow = 0;
  g.random = () => 0.1;
  tickDevs(g, 0.05);
  assert.equal(1000 - b.hp, 66);
  b.hp = 1000; g.devs[0].cooldown = 0;
  g.random = () => 0.5;
  tickDevs(g, 0.05);
  assert.equal(1000 - b.hp, 6);

  const g2 = waveGame();
  devAt(g2, 'react', 3, 3, 'vite', 'effecthell');
  const a = spawnBug(g2, 'nullpointer', 280, 6); a.slow = 0;
  const c = spawnBug(g2, 'nullpointer', 220, 1000); c.slow = 0;
  g2.random = () => 0.1;
  tickDevs(g2, 0.05);
  assert.ok(a.hp <= 0 || a.dead);
  assert.ok(c.hp < 1000);
});
