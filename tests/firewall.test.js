import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug } from '../src/engine/game.js';
import { placeDev, sellDev } from '../src/engine/devs.js';
import { isPathCell } from '../src/engine/map.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import securityTraining, { firewallFeature, findFirewalls, tickFirewalls, FIREWALL_DPS } from '../src/content/investments/security-training.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null);
  R.registerDeveloper({ id: 'dotnet', cost: 110, damage: 55, fireRate: 0.6, range: 2.6, counters: 'legacy' });
  R.registerDeveloper({ id: 'react', cost: 50, damage: 6, fireRate: 4, range: 2.2, counters: 'typo' });
  R.registerBug({ id: 'b', hp: 100, speed: 0, livesLost: 1, reward: 3, radius: 5 });
  R.registerBug({ id: 'boss', hp: 300, speed: 0, livesLost: 5, reward: 30, radius: 18, boss: true });
  R.registerWaves([{ groups: [] }]);
  R.registerInvestment(securityTraining);
  R.registerFeature(firewallFeature);
});

function dotnetGame() {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.warrants = 9999; g.unlocks.firewall = true; return g;
}
// Two .NET developers across the horizontal lane at row 1: firewall on cell (2,1). Distance 100 on the path → (100, 60).
function pairGame() {
  const g = dotnetGame();
  const a = placeDev(g, 'dotnet', 2, 0), b = placeDev(g, 'dotnet', 2, 2);
  a.cooldown = b.cooldown = 999;   // keep their own shots out of the way
  return { g, a, b };
}

test('isPathCell: lane cells yes, buildable and off-map cells no', () => {
  assert.equal(isPathCell(2, 1), true);
  assert.equal(isPathCell(4, 4), true);
  assert.equal(isPathCell(2, 0), false);
  assert.equal(isPathCell(-1, 1), false);
});

test('pair across a horizontal lane forms a firewall on the lane cell', () => {
  const { g } = pairGame();
  assert.deepEqual(findFirewalls(g).map(f => [f.col, f.row]), [[2, 1]]);
});

test('pair across a vertical lane forms a firewall', () => {
  const g = dotnetGame(); placeDev(g, 'dotnet', 3, 4); placeDev(g, 'dotnet', 5, 4);
  assert.deepEqual(findFirewalls(g).map(f => [f.col, f.row]), [[4, 4]]);
});

test('no firewall: one dev, non-lane gap, other developer types', () => {
  const g = dotnetGame(); placeDev(g, 'dotnet', 2, 0);
  assert.equal(findFirewalls(g).length, 0);
  placeDev(g, 'dotnet', 7, 0); placeDev(g, 'dotnet', 9, 0);   // gap (8,0) is not lane
  assert.equal(findFirewalls(g).length, 0);
  placeDev(g, 'react', 7, 2);                                  // react across from... nothing .NET
  placeDev(g, 'react', 0, 0); placeDev(g, 'react', 0, 2);      // react pair across the lane
  assert.equal(findFirewalls(g).length, 0);
});

test('damages a bug inside the cell at 10/s (bosses too), not one outside', () => {
  const { g } = pairGame();
  const inside = spawnBug(g, 'b', 100), boss = spawnBug(g, 'boss', 95), outside = spawnBug(g, 'b', 300);
  tickFirewalls(g, 1);
  assert.equal(FIREWALL_DPS, 10);
  assert.equal(inside.hp, 90);
  assert.equal(boss.hp, 290);
  assert.equal(outside.hp, 100);
});

test('kill pays Warrants and gives XP + a kill to both developers', () => {
  const { g, a, b } = pairGame();
  const bug = spawnBug(g, 'b', 100); bug.hp = 5;
  const before = g.warrants;
  tickFirewalls(g, 1);
  assert.equal(g.bugs.includes(bug), false);
  assert.equal(g.warrants, before + 3);
  assert.deepEqual([a.xp, b.xp, a.kills, b.kills], [1, 1, 1, 1]);
});

test('without the unlock the feature does nothing; outside a wave too', () => {
  const { g } = pairGame();
  const bug = spawnBug(g, 'b', 100);
  g.unlocks.firewall = false;
  firewallFeature.update(g, 1);
  assert.equal(bug.hp, 100);
  g.unlocks.firewall = true; g.phase = 'bell';
  firewallFeature.update(g, 1);
  assert.equal(bug.hp, 100);
  g.phase = 'wave';
  firewallFeature.update(g, 1);
  assert.equal(bug.hp, 90);
});

test('Review Focus 5: selling one developer removes the firewall immediately', () => {
  const { g, a } = pairGame();
  const bug = spawnBug(g, 'b', 100); bug.hp = 5;
  sellDev(g, a);
  tickFirewalls(g, 1);
  assert.equal(bug.hp, 5);
  assert.equal(a.xp, 0);
});

test('buying security training then startGame sets game.unlocks.firewall', () => {
  saveProgress({ capital: 0, levels: { 'security-training': 1 } });
  const g = createGame(); startGame(g);
  assert.equal(g.unlocks.firewall, true);
  const g2 = createGame(); setStorage(null); startGame(g2);
  assert.equal(g2.unlocks.firewall, undefined);
});
