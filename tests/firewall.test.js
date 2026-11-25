import { registerTestDrinks, totalDrinks, collectAll } from './helpers/drinks.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug } from '../src/engine/game.js';
import { placeDev, sellDev } from '../src/engine/devs.js';
import { isPathCell } from '../src/engine/map.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import securityTraining, { firewallFeature, findFirewalls, tickFirewalls, FIREWALL_DPS, fireParticles } from '../src/content/investments/security-training.js';
import { stubCtx } from './stub-ctx.js';
import { COLLECT_MULT } from '../src/engine/drops.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null); registerTestDrinks();
  R.registerDeveloper({ id: 'dotnet', cost: 110, damage: 55, fireRate: 0.6, range: 2.6, counters: 'legacy' });
  R.registerDeveloper({ id: 'react', cost: 50, damage: 6, fireRate: 4, range: 2.2, counters: 'typo' });
  R.registerBug({ id: 'b', hp: 100, speed: 0, livesLost: 1, reward: 3, radius: 5 });
  R.registerBug({ id: 'boss', hp: 300, speed: 0, livesLost: 5, reward: 30, radius: 18, boss: true });
  R.registerWaves([{ groups: [] }]);
  R.registerInvestment(securityTraining);
  R.registerFeature(firewallFeature);
});

function dotnetGame() {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.drinks = { coffee: 9999, monster: 9999, redbull: 9999 }; g.unlocks.firewall = true; return g;
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
  assert.equal(isPathCell(7, 3), true);
  assert.equal(isPathCell(2, 0), false);
  assert.equal(isPathCell(-1, 1), false);
});

test('pair across a horizontal lane forms a firewall on the lane cell', () => {
  const { g } = pairGame();
  assert.deepEqual(findFirewalls(g).map(f => [f.col, f.row]), [[2, 1]]);
});

test('pair across a vertical lane forms a firewall', () => {
  const g = dotnetGame(); placeDev(g, 'dotnet', 6, 3); placeDev(g, 'dotnet', 8, 3);
  assert.deepEqual(findFirewalls(g).map(f => [f.col, f.row]), [[7, 3]]);
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

test('kill pays drinks and gives XP + a kill to both developers', () => {
  const { g, a, b } = pairGame();
  const bug = spawnBug(g, 'b', 100); bug.hp = 5;
  const before = totalDrinks(g);
  tickFirewalls(g, 1);
  assert.equal(g.bugs.includes(bug), false);
  collectAll(g);
  assert.equal(totalDrinks(g), before + 3 * COLLECT_MULT);
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

test('fireParticles: the same moment always gives the same fire', () => {
  assert.deepEqual(fireParticles(3.7, 100, 60, 40, 50), fireParticles(3.7, 100, 60, 40, 50));
  assert.notDeepEqual(fireParticles(3.7, 100, 60, 40, 50), fireParticles(3.8, 100, 60, 40, 50));
});

test('fireParticles: flames burn across the cell and rise from it', () => {
  for (const time of [0, 1.23, 9.9]) {
    const parts = fireParticles(time, 100, 60, 40, 110);
    assert.equal(parts.length, 110);
    for (const p of parts) {
      assert.ok(p.age >= 0 && p.age < 1, 'age is 0..1');
      if (p.ember) continue;
      assert.ok(p.x >= 100 - 20 - 6 && p.x <= 100 + 20 + 6, `x ${p.x} inside the cell (± sway)`);
      assert.ok(p.y <= 60 + 20 && p.y >= 60 - 20 - 40, `y ${p.y} in or just above the cell`);
    }
  }
});

test('firewall draw does not throw, with a bug burning inside', () => {
  const { g } = pairGame();
  spawnBug(g, 'b', 100);
  firewallFeature.draw(stubCtx(), g);
});
