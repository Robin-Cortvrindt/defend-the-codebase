import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame, startWave, quitRun } from '../src/engine/game.js';
import { collectDrop } from '../src/engine/drops.js';
import { WIDTH } from '../src/engine/map.js';
import { registerTestDrinks } from './helpers/drinks.js';
import { stubCtx } from './stub-ctx.js';
import goblin, { goblinFeature, goblinOnLost, goblinSpeed, GOBLIN_SPEED } from '../src/content/events/goblin.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerWaves([{ groups: [] }]);
  R.registerEvent(goblin);
  R.registerFeature(goblinFeature);
  on('game:lost', goblinOnLost);   // clearAll() dropped the module's top-level listener
});

function setup(resistance = 0) {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = [];
  g.resistance.goblin = resistance;
  g.activeEvent = 'goblin';
  goblin.start(g);
  return g;
}
const drop = (id, x, y, extra = {}) => ({ id, x, y, drink: 'coffee', amount: 2, ttl: 10, ...extra });
const run = (g, seconds, dt = 0.05) => { for (let t = 0; t < seconds; t += dt) goblinFeature.update(g, dt); };

test('the event: name, text, colour', () => {
  assert.deepEqual([goblin.id, goblin.name, goblin.description, goblin.accent], ['goblin', 'A greedy goblin', 'It steals your dropped drinks', '#65A30D']);
});

test('starts just off the right edge', () => {
  const g = setup();
  assert.equal(g.goblin.x, WIDTH + 16);
  assert.equal(g.goblin.carried, 0);
});

test('runs to the nearest landed drop and steals it, without paying', () => {
  const g = setup();
  g.goblin.y = 100;
  const near = drop(1, 500, 100), far = drop(2, 100, 100);
  g.drops.push(far, near);
  run(g, 1.2);
  assert.deepEqual(g.drops, [far]);
  assert.equal(g.goblin.carried, 1);
  assert.equal(g.drinks.coffee, 100);
});

test('speed scales with the trap: 160 px/s untrapped, 64 px/s at level 3', () => {
  assert.equal(GOBLIN_SPEED, 160);
  for (const [res, px] of [[0, 16], [1, 6.4]]) {
    const g = setup(res);
    assert.ok(Math.abs(goblinSpeed(g) - px * 10) < 1e-9);
    g.goblin.x = 400; g.goblin.y = 100;
    g.drops.push(drop(1, 100, 100));
    goblinFeature.update(g, 0.1);
    assert.ok(Math.abs(g.goblin.x - (400 - px)) < 1e-9, `resistance ${res}`);
  }
});

test('Review Focus 2: re-targets when its drop is gone', () => {
  const g = setup();
  g.goblin.x = 300; g.goblin.y = 100;
  const a = drop(1, 200, 100), b = drop(2, 300, 250);
  g.drops.push(a, b);
  goblinFeature.update(g, 0.05);
  assert.ok(g.goblin.x < 300, 'heading for a');
  collectDrop(g, a);
  const y0 = g.goblin.y;
  goblinFeature.update(g, 0.05);
  assert.ok(g.goblin.y > y0, 'now heading for b');
});

test('ignores drops still in the air', () => {
  const g = setup();
  g.goblin.x = 110; g.goblin.y = 100;
  g.drops.push(drop(1, 100, 100, { flight: 0.5 }));
  run(g, 0.4);
  assert.equal(g.drops.length, 1);
});

test('end: it runs off the right edge without stealing, then is gone', () => {
  const g = setup();
  g.goblin.x = 300; g.goblin.y = 100;
  goblin.end(g); g.activeEvent = null;
  g.drops.push(drop(1, 320, 100));
  run(g, 3);
  assert.equal(g.goblin, null);
  assert.equal(g.drops.length, 1);
});

test('Review Focus 3: a new run starts without a goblin', () => {
  setup();
  const g = createGame(); startGame(g);
  assert.equal(g.goblin ?? null, null);
});

test('when the run is lost the goblin is gone at once (it would freeze during the collapse)', () => {
  const g = setup();
  g.goblin.x = 300;
  quitRun(g);
  assert.equal(g.goblin, null);
});

test('only moves during a sprint', () => {
  const g = setup();
  g.phase = 'review';
  const x = g.goblin.x;
  g.drops.push(drop(1, 100, 100));
  run(g, 1);
  assert.equal(g.goblin.x, x);
});

test('draws without throwing, empty or with a full sack', () => {
  const g = setup();
  for (const carried of [0, 8]) {
    g.goblin.carried = carried;
    assert.doesNotThrow(() => goblinFeature.drawUnder(stubCtx(), g));
  }
});

test('the building draws a goblin trap that grows per level, also next to every other upgrade', async () => {
  const { drawBuilding } = await import('../src/engine/building.js');
  const { recordingCtx } = await import('./stub-ctx.js');
  const calls = level => {
    const ctx = recordingCtx();
    drawBuilding(ctx, { floors: 1, lives: 5, maxLives: 10, time: 1, levels: { aircon: 3, heating: 3, coffee: 3, fridge: 3, generator: 3, water: 3, trap: level } });
    return ctx.calls.length;
  };
  const none = calls(0);
  assert.ok(calls(1) > none, 'level 1 adds the trap');
  assert.ok(calls(3) > calls(1), 'level 3 has more teeth and a cage');
});

test('the Goblin trap upgrade and its side-panel label', async () => {
  const trap = (await import('../src/content/upgrades/trap.js')).default;
  assert.deepEqual([trap.id, trap.name, trap.description, trap.counters], ['trap', 'Goblin trap', 'Counters: greedy goblin', 'goblin']);
});
