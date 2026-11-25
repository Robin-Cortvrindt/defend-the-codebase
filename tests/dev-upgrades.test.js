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
  g.drinks = { coffee: 10000, monster: 10000, redbull: 10000 };
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
  assert.equal(devStats(g, d).damage, 40);
  assert.equal(devStats(g, d).range, 2.6 * 40);
  assert.equal(d.spent, 75 + 25);
});

test('java: Enterprise Architect deals x0.9 itself and gives +15% to neighbours, once, not to itself', () => {
  const g = waveGame();
  const ea = devAt(g, 'java', 3, 3, 'springboot', 'architect');
  const ea2 = devAt(g, 'java', 3, 4, 'springboot', 'architect');
  const r = devAt(g, 'react', 2, 3);
  near(devStats(g, ea).damage, 40 * 0.9 * 1.15); // gets ea2's aura, not its own
  near(devStats(g, r).damage, 6 * 1.15);         // two architects, applied once
  sellDev(g, ea); sellDev(g, ea2);
  assert.equal(devStats(g, r).damage, 6);        // aura ends on sell
});

test('java: Garbage Collector holds fire 1 s every 8 s, then pulses 2x to all in range', () => {
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
  assert.equal(pulse.dFar, 80); // bug at 260 is the less advanced one, not the regular shot's target
  assert.ok(pulse.dNear >= 80); // furthest-along (300) may also take the regular shot
  assert.ok(g.effects.some(e => e.kind === 'pop' && e.text === 'Stop-the-World'));
});

test('java: "Initializing 847 beans…" pop for 1 s on placement, java only', () => {
  const g = waveGame();
  g.drinks.coffee = g.drinks.monster = g.drinks.redbull = 1000;
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
  assert.equal(1000 - b.hp, 99); // 1 hit + 10 re-renders at damage 9
  b.hp = 1000; g.devs[0].cooldown = 0;
  g.random = () => 0.5;
  tickDevs(g, 0.05);
  assert.equal(1000 - b.hp, 9);

  const g2 = waveGame();
  devAt(g2, 'react', 3, 3, 'vite', 'effecthell');
  const a = spawnBug(g2, 'nullpointer', 280, 6); a.slow = 0;
  const c = spawnBug(g2, 'nullpointer', 220, 1000); c.slow = 0;
  g2.random = () => 0.1;
  tickDevs(g2, 0.05);
  assert.ok(a.hp <= 0 || a.dead);
  assert.ok(c.hp < 1000);
});

test('dotnet: names and stats', () => {
  const g = waveGame();
  const d = devAt(g, 'dotnet', 3, 3);
  assert.equal(levelName(d), '.NET Framework 4.8');
  buyUpgrade(g, d, 'core');
  assert.equal(levelName(d), '.NET Core');
  assert.equal(devStats(g, d).fireRate, 0.9);
  const v = devAt(g, 'dotnet', 3, 4, 'core', 'vs');
  assert.equal(levelName(v), 'Visual Studio Enterprise');
  assert.equal(devStats(g, v).damage, 160);
  assert.equal(devStats(g, v).fireRate, 0.6);
});

test('dotnet: Azure splashes 3× damage on everything within 1 cell of the target', () => {
  const g = waveGame();
  devAt(g, 'dotnet', 3, 3, 'core', 'azure');
  const [t, n, f] = [300, 270, 220].map(dist => { const b = spawnBug(g, 'typo', dist, 1000); b.slow = 0; return b; });
  tickDevs(g, 0.05);
  assert.equal(1000 - t.hp, 165);
  assert.equal(1000 - n.hp, 165);
  assert.equal(1000 - f.hp, 0);
});

test('Review Focus 3: Azure bills 1 White Monster per 0.5 s with a bug in range, never below 0, stops at 0', () => {
  const g = waveGame();
  devAt(g, 'dotnet', 3, 3, 'core', 'azure');
  const b = spawnBug(g, 'typo', 270, 100000); b.slow = 0;
  g.drinks.monster = 3;
  for (let i = 0; i < 40; i++) {
    tickDevs(g, 0.05);
    assert.ok(g.drinks.monster >= 0 && Number.isInteger(g.drinks.monster));
  }
  assert.equal(g.drinks.monster, 0);
  const hp = b.hp;
  assert.ok(hp < 100000);
  for (let i = 0; i < 40; i++) tickDevs(g, 0.05);
  assert.equal(b.hp, hp);
  g.drinks.monster = 5;
  for (let i = 0; i < 40; i++) tickDevs(g, 0.05);
  assert.ok(b.hp < hp);

  const g2 = waveGame();
  devAt(g2, 'dotnet', 3, 3, 'core', 'azure');
  g2.drinks.monster = 5;
  for (let i = 0; i < 40; i++) tickDevs(g2, 0.05);
  assert.equal(g2.drinks.monster, 5);
});

test('dotnet: Azure toggle', () => {
  const g = waveGame();
  const d = devAt(g, 'dotnet', 3, 3, 'core', 'azure');
  const b = spawnBug(g, 'typo', 270, 100000); b.slow = 0;
  assert.equal(d.upgrade.panelButtons(g, d)[0].label, 'Azure on');
  const btn = () => d.upgrade.panelButtons(g, d)[0];
  btn().onClick(g, d);
  assert.equal(btn().label, 'Azure off');
  g.drinks.monster = 5;
  for (let i = 0; i < 40; i++) tickDevs(g, 0.05);
  assert.equal(b.hp, 100000);
  assert.equal(g.drinks.monster, 5);
});

test('Review Focus 2: Azure with 1 monster bills once, resets the bill, stops at 0', () => {
  const g = waveGame();
  const d = devAt(g, 'dotnet', 3, 3, 'core', 'azure');
  const b = spawnBug(g, 'typo', 270, 100000); b.slow = 0;
  g.drinks.monster = 1; g.drinks.coffee = 7;
  tickDevs(g, 0.6);
  assert.equal(g.drinks.monster, 0);
  assert.equal(d.state.bill, 0);
  assert.equal(d.upgrade.update(g, d, 0.6, { range: 2.6 * 40 }), false);
  assert.equal(g.drinks.monster, 0);
  assert.equal(g.drinks.coffee, 7);
});
