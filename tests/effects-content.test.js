import { test, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave } from '../src/engine/game.js';
import { placeDev, devStats } from '../src/engine/devs.js';
import { usePowerup, tickPowerups } from '../src/engine/powerups.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import { devEffects } from '../src/engine/effects.js';

// Content modules register themselves once (imports are cached), so load them once for the file.
before(async () => {
  R.resetRegistry(); clearAll(); setStorage(null);
  const { failed } = await loadModules(CONTENT_URLS);
  assert.equal(failed.length, 0);
});
afterEach(() => setStorage(null));

function game(levels = {}) {
  saveProgress({ capital: 0, levels });
  const g = createGame(); startGame(g);
  g.drinks = { coffee: 9999, monster: 9999, redbull: 9999 };
  return g;
}
const hire = (g, type, col, row = 3) => placeDev(g, type, col, row);
const line = (g, dev, group) => devEffects(g, dev).filter(l => l.group === group);

test('Better laptops, Agile coaching and Bigger monitors describe their level', () => {
  const g = game();
  const d = hire(g, 'java', 0);
  g.investmentLevels['better-laptops'] = 3;
  g.investmentLevels['agile-coaching'] = 2;
  g.investmentLevels['bigger-monitors'] = 3;
  const inv = line(g, d, 'investment');
  assert.deepEqual(inv.find(l => l.name === 'Better laptops 3'), { group: 'investment', name: 'Better laptops 3', text: 'damage +30%' });
  assert.equal(inv.find(l => l.name === 'Agile coaching 2').text, 'attack speed +16%');
  assert.equal(inv.find(l => l.name === 'Bigger monitors 3').text, 'range +15%');
});

test('CEO shows while active and disappears after it expires', () => {
  const g = game();
  const d = hire(g, 'java', 0);
  startWave(g); g.spawnQueue = [];
  assert.equal(usePowerup(g, 'ceo'), true);
  const l = line(g, d, 'powerup');
  assert.equal(l.length, 1);
  assert.ok(l[0].text.startsWith('attack speed +50%'), l[0].text);
  assert.ok(l[0].text.includes('s left'));
  tickPowerups(g, 10.5);
  assert.equal(line(g, d, 'powerup').length, 0);
});

test('Training manager shows XP factor while active', () => {
  const g = game();
  const d = hire(g, 'java', 0);
  startWave(g); g.spawnQueue = [];
  usePowerup(g, 'training');
  assert.match(line(g, d, 'powerup')[0].text, /^XP ×2 \(\d+ s left\)$/);
});

test('Cross-functional adds a team line to every developer only while balanced', () => {
  const g = game({ 'cross-functional': 1 });
  const a = hire(g, 'react', 0), b = hire(g, 'java', 1), c = hire(g, 'dotnet', 2);
  for (const d of [a, b, c]) {
    assert.ok(line(g, d, 'team').some(l => l.text === 'attack speed +25%'), d.type);
  }
  hire(g, 'react', 3); hire(g, 'java', 4, 4);
  assert.equal(line(g, a, 'team').filter(l => l.text === 'attack speed +25%').length, 0);
});

test('Full-stack squad, Garbage collection and Security training describe team links', () => {
  const g = game({ 'full-stack-squad': 1, 'garbage-collection': 1, 'security-training': 1 });
  const r = hire(g, 'react', 1, 4), j = hire(g, 'java', 0, 4), n = hire(g, 'dotnet', 2, 4);
  assert.ok(line(g, r, 'team').some(l => l.text === 'hits bounce to a second bug for 50%'));
  assert.ok(!line(g, j, 'team').some(l => l.text.startsWith('hits bounce')));
  const g2 = game({ 'garbage-collection': 1 });
  const sq = [[0, 4], [1, 4], [0, 5], [1, 5]].map(([c, r]) => hire(g2, 'java', c, r));
  assert.ok(line(g2, sq[0], 'team').some(l => l.text === 'every 10th kill slows bugs nearby'));
  const lone = hire(g2, 'java', 5, 5);
  assert.ok(!line(g2, lone, 'team').some(l => l.text.includes('10th')));
});

test('Security training line shows only for a developer in a firewall pair', () => {
  const g = game({ 'security-training': 1 });
  // (2,0) and (2,2) face each other across the lane cell (2,1); (0,7) is far from any lane gap.
  const a = hire(g, 'dotnet', 2, 0), b = hire(g, 'dotnet', 2, 2), stray = hire(g, 'dotnet', 0, 7);
  for (const d of [a, b]) assert.ok(line(g, d, 'team').some(l => l.text === 'part of a firewall'));
  assert.ok(!line(g, stray, 'team').some(l => l.text === 'part of a firewall'));
});

test('math unchanged: Better laptops 3 still multiplies damage by 1.3', () => {
  const g = game({ 'better-laptops': 3 });
  const d = hire(g, 'java', 0);
  assert.ok(Math.abs(devStats(g, d).damage - R.getDeveloper('java').damage * 1.3) < 1e-9);
});
