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
import { isBuildable, COLS, ROWS } from '../src/engine/map.js';
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
  // Any free buildable cell well away from the square (the map changes, so don't hard-code one).
  let lone = null;
  for (let c = COLS - 1; c >= 0 && !lone; c--) for (let r = 0; r < ROWS && !lone; r++) {
    if (c > 3 && isBuildable(c, r)) lone = hire(g2, 'java', c, r);
  }
  assert.ok(lone, 'found a free cell for the lone Java developer');
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

// --- Task 3: events and developers ---
const up3 = (d, i = 0) => { d.level = 2; d.upgrade = R.getDeveloper(d.type).upgrades.level3[i]; return d; };

test('Heating out shows its factor and nothing when it is 1', () => {
  const g = game();
  const d = hire(g, 'java', 0);
  g.activeEvent = 'heating-out'; g.heatingOutFactor = 0.5;
  assert.deepEqual(line(g, d, 'event'), [{ group: 'event', name: 'The heating is out', text: 'attack speed −50%' }]);
  g.heatingOutFactor = 1;
  assert.equal(line(g, d, 'event').length, 0);
});

test('Out of coffee hits Java only; Out of Red Bull hits .NET only', () => {
  const g = game();
  const j = hire(g, 'java', 0), r = hire(g, 'react', 1), n = hire(g, 'dotnet', 2);
  g.activeEvent = 'no-coffee'; g.coffeeFactor = 0.5;
  assert.equal(line(g, j, 'event')[0].text, 'attack speed −50%');
  assert.equal(line(g, r, 'event').length, 0);
  g.coffeeFactor = 1;
  assert.equal(line(g, j, 'event').length, 0);
  g.activeEvent = 'no-redbull'; g.redbullFactor = 0.5;
  assert.equal(line(g, n, 'event')[0].text, 'attack speed −50%');
  assert.equal(line(g, j, 'event').length, 0);
  g.redbullFactor = 1;
  assert.equal(line(g, n, 'event').length, 0);
});

test('Wine tasting says tipsy', () => {
  const g = game();
  const d = hire(g, 'java', 0);
  g.activeEvent = 'wine-tasting';
  assert.equal(line(g, d, 'event')[0].text, 'tipsy: 100% of shots at random bugs');
  g.resistance = { 'wine-tasting': 1 / 3 };
  assert.equal(line(g, d, 'event')[0].text, 'tipsy: 67% of shots at random bugs');
  g.resistance = { 'wine-tasting': 1 };
  assert.equal(line(g, d, 'event').length, 0);
});

test('Azure shows off / out of White Monster / billing', () => {
  const g = game();
  const n = up3(hire(g, 'dotnet', 3), 1);
  const azure = () => line(g, n, 'upgrade').find(l => l.name === 'Azure Function').text;
  assert.equal(azure(), 'triple area damage, 1 White Monster / 0.5 s');
  g.drinks.monster = 0;
  assert.equal(azure(), 'out of White Monster: not shooting');
  n.state.azureOff = true;
  assert.equal(azure(), 'off: not shooting');
});

test('Level 3 hides the level-2 stats it overrides and uses readable labels', () => {
  const g = game();
  const n = up3(hire(g, 'dotnet', 3), 0);
  const ups = line(g, n, 'upgrade');
  assert.deepEqual(ups[0], { group: 'upgrade', name: '.NET Core', text: 'Faster attacks' });
  assert.deepEqual(ups[1], { group: 'upgrade', name: 'Visual Studio Enterprise', text: 'damage 160, attack speed 0.6/s' });
});

test('Garbage collection uses an ordinal', () => {
  const g = game({ 'garbage-collection': 1 });
  const sq = [[0, 4], [1, 4], [0, 5], [1, 5]].map(([c, r]) => hire(g, 'java', c, r));
  assert.ok(line(g, sq[0], 'team').some(l => l.text === 'every 10th kill slows bugs nearby'));
});

test('React team bonus counts others and caps', () => {
  const g = game();
  const d = hire(g, 'react', 0);
  assert.equal(line(g, d, 'team').length, 0);
  const spots = [];
  for (let r = 0; r < 12 && spots.length < 8; r++) for (let c = 0; c < 20 && spots.length < 8; c++) if (isBuildable(c, r) && !(c === 0 && r === 3)) spots.push([c, r]);
  for (const [c, r] of spots.slice(0, 3)) hire(g, 'react', c, r);
  assert.deepEqual(line(g, d, 'team'), [{ group: 'team', name: 'React team (3 others)', text: 'attack speed +30%' }]);
  for (const [c, r] of spots.slice(3, 7)) hire(g, 'react', c, r);
  assert.equal(g.devs.filter(x => x.type === 'react').length, 8);
  assert.deepEqual(line(g, d, 'team'), [{ group: 'team', name: 'React team (7 others)', text: 'attack speed +50%' }]);
});

test('Enterprise Architect: aura line for neighbours, own line for itself', () => {
  const g = game();
  const arch = up3(hire(g, 'java', 0));
  const near = hire(g, 'java', 1);
  assert.deepEqual(line(g, near, 'team'), [{ group: 'team', name: 'Enterprise Architect (nearby)', text: 'damage +15%' }]);
  assert.equal(line(g, arch, 'team').length, 0);
  assert.equal(line(g, arch, 'upgrade').find(l => l.name === 'Enterprise Architect').text, 'damage −10%, +15% damage to developers nearby');
});

test('Spring Boot and Azure upgrade lines', () => {
  const g = game();
  const j = hire(g, 'java', 0); j.level = 1;
  assert.deepEqual(line(g, j, 'upgrade')[0], { group: 'upgrade', name: 'Spring Boot Dev', text: 'damage 40, range 2.6' });
  const n = up3(hire(g, 'dotnet', 3), 1); n.level = 2;
  assert.equal(line(g, n, 'upgrade').find(l => l.name === 'Azure Function').text, 'triple area damage, 1 White Monster / 0.5 s');
});
