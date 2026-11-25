import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { registerTestDrinks, totalDrinks, collectAll } from './helpers/drinks.js';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, ringBell, step, spawnBug, sprintInfo, chooseYearReview, killBug, getSprintDef, deathAnimDone, DEATH_ANIM, quitRun } from '../src/engine/game.js';
import { PATH_LENGTH } from '../src/engine/map.js';
import { COLLECT_MULT } from '../src/engine/drops.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerBug({ id: 'b', hp: 10, speed: 100, livesLost: 2, reward: 3, radius: 5 });
  R.registerWaves([
    { groups: [{ bug: 'b', count: 3, interval: 1, delay: 0 }] },
    { groups: [{ bug: 'b', count: 1, interval: 1, delay: 0 }] },
  ]);
});

const run = (g, secs) => { for (let i = 0; i < secs * 20; i++) step(g, 0.05); };

test('startWave spawns the configured count over time', () => {
  const g = createGame(); startGame(g); startWave(g);
  let spawned = 0; on('bug:spawned', () => spawned++);
  run(g, 2.6);
  assert.equal(spawned, 3);
  assert.equal(g.phase, 'wave');
});

test('bug that reaches the end leaks and costs livesLost', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = [];
  spawnBug(g, 'b', PATH_LENGTH - 1);
  let leaked = 0; on('bug:leaked', () => leaked++);
  step(g, 0.05);
  assert.equal(leaked, 1);
  assert.equal(g.lives, 18);
});

test('clearing a wave pays 20+5*n, moves to bell, increments wave', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = [];
  const before = { ...g.drinks };
  step(g, 0.05);
  assert.equal(g.phase, 'bell');
  assert.equal(g.wave, 1);
  for (const id of Object.keys(before)) assert.equal(g.drinks[id], before[id] + 9);
});

test('ringBell starts next wave', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = []; step(g, 0.05);
  let rung = 0; on('bell:rung', () => rung++);
  ringBell(g);
  assert.equal(rung, 1);
  assert.equal(g.phase, 'wave');
});

test('after the last hand-made wave, sprints continue (generated) and never reach won', () => {
  const g = createGame(); startGame(g); g.wave = 1; startWave(g);
  g.spawnQueue = []; g.bugs = [];
  let won = 0; on('game:won', () => won++);
  step(g, 0.05);
  assert.equal(won, 0);
  assert.equal(g.phase, 'bell');
  assert.equal(g.sprint, 2);
  assert.equal(ringBell(g), true);
  assert.ok(g.spawnQueue.length > 0);
});

test('Review Focus 3: last life lost on the last bug of a quarter → lost, no review, no bell', () => {
  const g = createGame(); startGame(g); g.wave = 6; startWave(g);
  g.spawnQueue = []; g.bugs = []; g.lives = 2;
  spawnBug(g, 'b', PATH_LENGTH - 1);
  let won = 0, cleared = 0; on('game:won', () => won++); on('wave:cleared', () => cleared++);
  step(g, 0.05);
  assert.equal(g.phase, 'lost'); assert.equal(won, 0); assert.equal(cleared, 0);
});

test('bugSpeedMultiplier 0.5 halves distance travelled', () => {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.bugs = [];
  g.mods.bugSpeedMultiplier = 0.5;
  const bug = spawnBug(g, 'b', 0);
  step(g, 0.05);
  assert.equal(bug.distance, 2.5);
});

test('wave hp multiplier scales bug health', () => {
  R.registerWaves([{ hp: 2, groups: [] }]);
  const g = createGame(); startGame(g); startWave(g);
  const b = spawnBug(g, 'b', 0);
  assert.equal(b.hp, 20); assert.equal(b.maxHp, 20);
});

test('timeScale 0.5 halves how far bugs move', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = [];
  const bug = spawnBug(g, 'b', 0);
  g.mods.timeScale = 0.5;
  step(g, 0.1);
  assert.equal(bug.distance, 5);
});

test('sprintInfo maps global sprint index to year, quarter and sprint', () => {
  assert.equal(sprintInfo(0).label, 'Year 1 · Q1 · Sprint 1 / 7');
  assert.equal(sprintInfo(6).sprint, 7);
  assert.equal(sprintInfo(7).quarter, 2);
  assert.equal(sprintInfo(7).sprint, 1);
  assert.deepEqual([sprintInfo(28).year, sprintInfo(28).quarter], [2, 1]);
});

const clear = g => { g.spawnQueue = []; g.bugs = []; step(g, 0.01); };

test('clearing a sprint gives 1 warrant; sprint 7 gives 4 and enters the quarter review', () => {
  const g = createGame(); startGame(g); startWave(g);
  let reviews = 0; on('quarter:review', () => reviews++);
  clear(g);
  assert.equal(g.warrants, 1);
  g.sprint = 6; g.phase = 'bell'; ringBell(g); clear(g);
  assert.equal(g.warrants, 5);
  assert.equal(g.phase, 'review');
  assert.equal(reviews, 1);
  assert.equal(g.pendingYearReview, false);
});

test('clearing sprint 28 (Q4 sprint 7) sets pendingYearReview', () => {
  const g = createGame(); startGame(g); g.sprint = 27; startWave(g); clear(g);
  assert.equal(g.phase, 'review');
  assert.equal(g.pendingYearReview, true);
});

test('sprint aliases: wave:cleared and sprint:cleared both fire', () => {
  const g = createGame(); startGame(g); startWave(g);
  const got = []; on('wave:cleared', () => got.push('w')); on('sprint:cleared', () => got.push('s'));
  clear(g);
  assert.deepEqual(got.sort(), ['s', 'w']);
});

test('Review Focus 5: generated sprint 150 has finite positive counts and interval >= 0.12', () => {
  const d = getSprintDef(150);
  assert.ok(Number.isFinite(d.hp) && d.hp > 1);
  for (const gr of d.groups) {
    assert.ok(Number.isFinite(gr.count) && gr.count > 0);
    assert.ok(gr.interval >= 0.12);
  }
});

test('game over: the collapse timer runs after production goes down, then the end screen may show', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = []; g.lives = 1;
  spawnBug(g, 'b', PATH_LENGTH - 1);
  step(g, 0.05);
  assert.equal(g.phase, 'lost');
  assert.equal(g.deathTime, 0);
  assert.equal(deathAnimDone(g), false);
  for (let t = 0; t < DEATH_ANIM; t += 0.05) step(g, 0.05);
  step(g, 0.05);
  assert.equal(deathAnimDone(g), true);
});

test('quitRun ends the run as a loss', () => {
  const g = createGame(); startGame(g); startWave(g);
  let lost = 0; on('game:lost', () => lost++);
  assert.equal(quitRun(g), true);
  assert.equal(g.phase, 'lost');
  assert.equal(g.quit, true);
  assert.equal(g.lives, 0);
  assert.equal(lost, 1);
  run(g, DEATH_ANIM + 0.1);
  assert.equal(deathAnimDone(g), true);
  assert.equal(lost, 1);
});

test('quitRun works between sprints', () => {
  const g = createGame(); startGame(g);
  assert.equal(quitRun(g), true);
  assert.equal(g.phase, 'lost');
});

test('quitRun is ignored in the menu and after a loss', () => {
  const g = createGame();
  let lost = 0; on('game:lost', () => lost++);
  assert.equal(quitRun(g), false);
  assert.equal(g.phase, 'menu');
  startGame(g); quitRun(g);
  assert.equal(quitRun(g), false);
  assert.equal(lost, 1);
});

test('a normal kill pays a random drink: reward x drinkMultiplier', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.random = () => 0;
  killBug(g, spawnBug(g, 'b')); collectAll(g);
  assert.equal(g.drinks.coffee, 100 + 3 * COLLECT_MULT);
  g.mods.drinkMultiplier = 2;
  killBug(g, spawnBug(g, 'b')); collectAll(g);
  assert.equal(g.drinks.coffee, 100 + (3 + 6) * COLLECT_MULT);
});

test('a kill pays at least 1 drink', () => {
  R.registerBug({ id: 'tiny', hp: 1, speed: 1, reward: 1, radius: 5 });
  const g = createGame(); startGame(g); startWave(g);
  g.random = () => 0; g.mods.drinkMultiplier = 0.4;
  killBug(g, spawnBug(g, 'tiny')); collectAll(g);
  assert.equal(g.drinks.coffee, 100 + 1 * COLLECT_MULT);
});

test('a boss kill pays every drink reward / n', () => {
  R.registerBug({ id: 'boss', hp: 1, speed: 1, reward: 30, boss: true, radius: 5 });
  const g = createGame(); startGame(g); startWave(g);
  killBug(g, spawnBug(g, 'boss')); collectAll(g);
  assert.deepEqual(g.drinks, { coffee: 100 + 10 * COLLECT_MULT, monster: 100 + 10 * COLLECT_MULT, redbull: 100 + 10 * COLLECT_MULT });
});

test('yearly review accept raises drinkMultiplier', () => {
  const g = createGame(); startGame(g);
  g.pendingYearReview = true;
  chooseYearReview(g, 'accept');
  assert.ok(Math.abs(g.mods.drinkMultiplier - 1.1) < 1e-9);
});
