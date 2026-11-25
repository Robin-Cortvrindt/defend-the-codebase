import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, ringBell, BOSS_DELAY } from '../src/engine/game.js';
import { registerTestDrinks } from './helpers/drinks.js';
import '../src/content/bugs/security-risk.js';
import '../src/content/bugs/trojan-horse.js';
import feature, { canSummon, summonTrojan, attachListeners } from '../src/content/features/trojan-horse.js';

const HORSE = R.getBug('trojan-horse');
const RISK = R.getBug('security-risk');
const ACTION = feature.bellActions[0];

let g;
beforeEach(() => {
  R.resetRegistry(); clearAll(); attachListeners();
  R.registerBug(HORSE); R.registerBug(RISK); R.registerFeature(feature);
  registerTestDrinks();
  R.registerWaves([{ boss: 'security-risk', groups: [{ bug: 'security-risk', count: 2, interval: 1 }] }]);
  g = createGame(); startGame(g);
  g.phase = 'bell'; g.sprint = 3;
});

const fill = n => { for (const id of Object.keys(g.drinks)) g.drinks[id] = n; };
const horses = () => g.spawnQueue.filter(s => s.bug === 'trojan-horse');

test('summoning pays the price in every drink', () => {
  fill(500);
  assert.equal(summonTrojan(g), true);
  for (const [id, n] of Object.entries(g.drinks)) assert.equal(n, 370, id);
  assert.deepEqual(g.trojan, { sprint: 3, price: 130 });
});

test('exactly enough drinks is enough', () => {
  fill(130);
  assert.equal(summonTrojan(g), true);
  for (const n of Object.values(g.drinks)) assert.equal(n, 0);
});

test('one drink short refuses and charges nothing', () => {
  fill(500); g.drinks.coffee = 129;
  assert.equal(summonTrojan(g), false);
  assert.equal(g.drinks.coffee, 129);
  assert.equal(g.drinks.monster, 500);
  assert.equal(g.trojan, undefined);
});

test('only one horse per sprint', () => {
  fill(500);
  assert.equal(summonTrojan(g), true);
  assert.equal(summonTrojan(g), false);
  assert.equal(g.drinks.coffee, 370);
});

test('no summon outside the bell', () => {
  fill(500);
  g.phase = 'wave';
  assert.equal(canSummon(g), false);
  assert.equal(summonTrojan(g), false);
  g.phase = 'review'; g.pendingYearReview = true;
  assert.equal(summonTrojan(g), false);
  assert.equal(g.drinks.coffee, 500);
});

test('the horse is queued 3 s after the boss and only once', () => {
  fill(500); summonTrojan(g);
  assert.equal(ringBell(g), true);
  assert.equal(horses().length, 1);
  const boss = g.spawnQueue.filter(s => s.bug === 'security-risk').at(-1);
  assert.equal(horses()[0].t, boss.t + BOSS_DELAY);
  for (let i = 1; i < g.spawnQueue.length; i++) assert.ok(g.spawnQueue[i - 1].t <= g.spawnQueue[i].t, 'queue sorted');
  assert.equal(g.trojan, undefined);
  // the following sprint has no horse
  g.spawnQueue = []; g.bugs = []; g.phase = 'bell'; g.sprint++;
  ringBell(g);
  assert.equal(horses().length, 0);
});

test('a summon made in the quarter review spawns next sprint', () => {
  fill(500); g.phase = 'review';
  assert.equal(summonTrojan(g), true);
  assert.equal(ringBell(g), true);
  assert.equal(horses().length, 1);
});

test('bell action reflects state', () => {
  fill(500);
  assert.equal(ACTION.label(g), 'Let the Trojan horse in');
  assert.deepEqual(ACTION.cost(g), { coffee: 130, monster: 130, redbull: 130 });
  assert.equal(ACTION.enabled(g), true);
  g.drinks.redbull = 10;
  assert.equal(ACTION.enabled(g), false);
  g.drinks.redbull = 500;
  ACTION.onClick(g);
  assert.equal(ACTION.label(g), 'Trojan horse incoming');
  assert.equal(ACTION.enabled(g), false);
});

test('a new run starts without a summon', () => {
  assert.equal(createGame().trojan, undefined);
});
