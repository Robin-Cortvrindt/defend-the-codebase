import { registerTestDrinks, totalDrinks, collectAll } from './helpers/drinks.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug } from '../src/engine/game.js';
import { placeDev, sellDev, tickDevs, devStats } from '../src/engine/devs.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import { CELL } from '../src/engine/map.js';

let squad;
beforeEach(async () => {
  R.resetRegistry(); clearAll(); setStorage(null); registerTestDrinks();
  // Re-import fresh each time: the module subscribes to dev:hit at top level, and clearAll() drops listeners.
  squad = await import(`../src/content/investments/full-stack-squad.js?t=${Math.random()}`);
  R.registerDeveloper({ id: 'react', cost: 10, damage: 6, fireRate: 4, range: 2.2, counters: 'typo', accent: '#2563EB' });
  R.registerDeveloper({ id: 'java', cost: 10, damage: 1, fireRate: 0.001, range: 0.1, counters: 'np' });
  R.registerDeveloper({ id: 'dotnet', cost: 10, damage: 1, fireRate: 0.001, range: 0.1, counters: 'legacy' });
  R.registerBug({ id: 'b', hp: 100, speed: 0, livesLost: 1, reward: 3, radius: 5 });
  R.registerBug({ id: 'typo', hp: 100, speed: 0, livesLost: 1, reward: 3, radius: 5 });
  R.registerWaves([{ groups: [] }]);
});

function game(unlocked = true) {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.drinks = { coffee: 9999, monster: 9999, redbull: 9999 };
  g.unlocks.fullStackSquad = unlocked;
  return g;
}
// React at (3,3) with a Java left (2,3) and a .NET below (3,4): a squad. All buildable cells.
function squadGame(unlocked = true) {
  const g = game(unlocked);
  const react = placeDev(g, 'react', 3, 3), java = placeDev(g, 'java', 2, 3), dotnet = placeDev(g, 'dotnet', 3, 4);
  return { g, react, java, dotnet };
}
// Put a bug at an exact spot (bugs don't move: speed 0, and tickDevs doesn't move them).
function bugAt(g, type, x, y, hp = 100) { const b = spawnBug(g, type, 0); b.x = x; b.y = y; b.hp = hp; return b; }

test('the investment is a 40-capital one-time unlock', () => {
  const inv = squad.default;
  assert.deepEqual([inv.id, inv.group, inv.maxLevel, inv.getCost(0)], ['full-stack-squad', 'unlocks', 1, 40]);
  saveProgress({ capital: 0, levels: { 'full-stack-squad': 1 } });
  R.registerInvestment(inv);
  const g = createGame(); startGame(g);
  assert.equal(g.unlocks.fullStackSquad, true);
});

test('squad needs a Java and a .NET among the 4 straight neighbours', () => {
  const { g, react } = squadGame();
  assert.equal(squad.isSquadReact(g, react), true);
});

test('diagonal neighbours do not count', () => {
  const g = game();
  const react = placeDev(g, 'react', 3, 3);
  assert.ok(placeDev(g, 'java', 2, 2)); assert.ok(placeDev(g, 'dotnet', 2, 4));
  assert.equal(squad.isSquadReact(g, react), false);
});

test('only a Java or only a .NET is not enough; a non-React dev never qualifies', () => {
  const g = game();
  const react = placeDev(g, 'react', 3, 3);
  placeDev(g, 'java', 2, 3); placeDev(g, 'java', 4, 3);
  assert.equal(squad.isSquadReact(g, react), false);
  const g2 = game();
  const r2 = placeDev(g2, 'react', 3, 3);
  placeDev(g2, 'dotnet', 2, 3);
  assert.equal(squad.isSquadReact(g2, r2), false);
  const { g: g3, java } = squadGame();
  assert.equal(squad.isSquadReact(g3, java), false);
});

test('bounce: 50% of devStats damage to the nearest other bug within range, not one outside', () => {
  const { g, react } = squadGame();
  const target = bugAt(g, 'b', react.x + 30, react.y);
  const near = bugAt(g, 'b', target.x + CELL, target.y);            // 1 cell away
  const far = bugAt(g, 'b', target.x - 2 * CELL, target.y);         // 2 cells away
  const dmg = devStats(g, react).damage;
  tickDevs(g, 0.01);
  assert.equal(squad.BOUNCE_FACTOR, 0.5);
  assert.equal(squad.BOUNCE_RANGE, 1.5 * CELL);
  assert.equal(target.hp, 100 - dmg);
  assert.equal(near.hp, 100 - dmg * 0.5);
  assert.equal(far.hp, 100);
});

test('bounce shows the React developer\'s own attack, from the hit bug to the next one', () => {
  const { g, react } = squadGame();
  const target = bugAt(g, 'b', react.x + 30, react.y);
  const near = bugAt(g, 'b', target.x + CELL, target.y);
  tickDevs(g, 0.01);
  const bounce = g.effects.find(e => e.kind === 'attack' && e.target === near);
  assert.ok(bounce);
  assert.equal(bounce.dev, 'react');
  assert.deepEqual(bounce.from, { x: target.x, y: target.y });
});

test('bounce on a typo bug (React counter) does double', () => {
  const { g, react } = squadGame();
  const target = bugAt(g, 'b', react.x + 30, react.y);
  const typo = bugAt(g, 'typo', target.x + CELL, target.y);
  tickDevs(g, 0.01);
  assert.equal(typo.hp, 100 - devStats(g, react).damage);
});

test('bounce kill credits the React developer: XP, kill, drinks', () => {
  const { g, react } = squadGame();
  bugAt(g, 'b', react.x + 30, react.y);
  const weak = bugAt(g, 'b', react.x + 30 + CELL, react.y, 1);
  const before = totalDrinks(g);
  tickDevs(g, 0.01);
  assert.equal(g.bugs.includes(weak), false);
  assert.equal(react.kills, 1);
  assert.equal(react.xp, 1);
  collectAll(g);
  assert.equal(totalDrinks(g), before + 3);
});

test('without the unlock there is no bounce', () => {
  const { g, react } = squadGame(false);
  bugAt(g, 'b', react.x + 30, react.y);
  const near = bugAt(g, 'b', react.x + 30 + CELL, react.y);
  tickDevs(g, 0.01);
  assert.equal(near.hp, 100);
});

test('selling a neighbour switches the squad off', () => {
  const { g, react, java } = squadGame();
  sellDev(g, java);
  assert.equal(squad.isSquadReact(g, react), false);
  bugAt(g, 'b', react.x + 30, react.y);
  const near = bugAt(g, 'b', react.x + 30 + CELL, react.y);
  tickDevs(g, 0.01);
  assert.equal(near.hp, 100);
});

test('dev:hit fires once per developer hit (the bounce does not emit it)', () => {
  const { g, react } = squadGame();
  let hits = 0; on('dev:hit', () => hits++);
  bugAt(g, 'b', react.x + 30, react.y);
  bugAt(g, 'b', react.x + 30 + CELL, react.y);
  tickDevs(g, 0.01);
  assert.equal(hits, 1);
});
