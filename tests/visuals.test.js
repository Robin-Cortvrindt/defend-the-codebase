import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, spawnBug, step } from '../src/engine/game.js';
import { placeDev, tickDevs } from '../src/engine/devs.js';
import { render, hitFlash, MAP_TILE } from '../src/engine/render.js';
import { stubCtx } from './stub-ctx.js';

let calls;
beforeEach(() => {
  R.resetRegistry(); clearAll();
  calls = [];
  R.registerDeveloper({ id: 'java', accent: '#EA580C', cost: 75, damage: 18, fireRate: 1.5, range: 2.2, attackDuration: 0.4, attackHitAt: 0.66,
    drawAttack(ctx, a) { calls.push(a); } });
  R.registerDeveloper({ id: 'plain', accent: '#2563EB', cost: 50, damage: 6, fireRate: 4, range: 2.2 });
  R.registerDeveloper({ id: 'broken', accent: '#C026D3', cost: 50, damage: 6, fireRate: 4, range: 2.2, drawAttack() { throw new Error('boom'); } });
  R.registerBug({ id: 'b', ring: '#64748B', hp: 1000, speed: 0, livesLost: 1, reward: 1, radius: 9 });
  R.registerWaves([{ groups: [] }]);
});

// A game in a wave with one bug on the first lane segment (y = 60) and a developer right below it at cell (2, 2).
function setup(type = 'java') {
  const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.warrants = 9999;
  const bug = spawnBug(g, 'b', 100);
  const dev = placeDev(g, type, 2, 2);
  return { g, bug, dev };
}
const attacks = g => g.effects.filter(e => e.kind === 'attack');
const quietConsole = fn => { const err = console.error; const logged = []; console.error = (...a) => logged.push(a); try { fn(); } finally { console.error = err; } return logged; };

test('attack effect: firing pushes kind attack with dev type, target and its duration', () => {
  const { g, bug, dev } = setup();
  tickDevs(g, 0.01);
  const [a] = attacks(g);
  assert.ok(a);
  assert.equal(a.dev, 'java');
  assert.equal(a.target, bug);
  assert.equal(a.maxTtl, 0.4);
  assert.equal(a.hitAt, 0.66);
  assert.equal(dev.lastShotAt, g.time);
});

test('attack effect: developer without attackDuration uses 0.12 and lands at once', () => {
  const { g } = setup('plain');
  tickDevs(g, 0.01);
  const [a] = attacks(g);
  assert.equal(a.maxTtl, 0.12);
  assert.equal(a.hitAt, 0);
});

test('attack effect: follows the target, then freezes where it died', () => {
  const { g, bug } = setup();
  tickDevs(g, 0.01);
  bug.distance = 120;   // the game moves bugs by their distance along the lane
  step(g, 0.01);
  const a = attacks(g)[0];
  assert.deepEqual([a.to.x, a.to.y], [120, 60]);
  bug.dead = true; bug.x = 300;
  step(g, 0.01);
  assert.deepEqual([a.to.x, a.to.y], [120, 60]);
});

test('render: drawAttack gets progress in 0..1 and the shot details', () => {
  const { g } = setup();
  tickDevs(g, 0.01);
  step(g, 0.1);
  render(stubCtx(), g, {});
  assert.equal(calls.length, 1);
  assert.ok(calls[0].progress > 0 && calls[0].progress <= 1);
  assert.deepEqual(Object.keys(calls[0]).sort(), ['accent', 'from', 'progress', 'seed', 'shot', 'time', 'to']);
});

test('render: a throwing drawAttack is logged and the frame finishes', () => {
  const { g } = setup('broken');
  tickDevs(g, 0.01);
  const logged = quietConsole(() => render(stubCtx(), g, {}));
  assert.equal(logged.length, 1);
});

test('render: developer without drawAttack still draws its beam', () => {
  const { g } = setup('plain');
  tickDevs(g, 0.01);
  const logged = quietConsole(() => render(stubCtx(), g, {}));
  assert.equal(logged.length, 0);
});

test('hitFlash: 0 before the attack lands, 1 when it lands, gone 0.3 later', () => {
  const { g, bug } = setup();
  tickDevs(g, 0.01);
  const a = attacks(g)[0];
  const at = progress => { a.ttl = a.maxTtl * (1 - progress); return hitFlash(g, bug); };
  assert.equal(at(0.5), 0);
  assert.ok(Math.abs(at(0.66) - 1) < 1e-9);
  assert.equal(at(0.97), 0);
  assert.equal(hitFlash(g, { }), 0);
});

test('render: a bug draw hook gets its radius, the bug and the game time', () => {
  const seen = [];
  R.registerBug({ id: 'drawn', ring: '#2563EB', hp: 10, speed: 0, livesLost: 1, reward: 1, radius: 7, draw(ctx, r, bug, time) { seen.push([r, bug, time]); } });
  const { g } = setup();
  const bug = spawnBug(g, 'drawn', 50);
  g.time = 3.5;
  render(stubCtx(), g, {});
  assert.deepEqual(seen, [[7, bug, 3.5]]);
});

test('render: a throwing bug draw hook is logged; a bug without one still draws', () => {
  R.registerBug({ id: 'bad', ring: '#2563EB', hp: 10, speed: 0, livesLost: 1, reward: 1, radius: 7, draw() { throw new Error('boom'); } });
  const { g } = setup();
  spawnBug(g, 'bad', 50);
  const logged = quietConsole(() => render(stubCtx(), g, {}));
  assert.equal(logged.length, 1);
});

test('render: a placed developer\'s icon gets the developer and the game time', () => {
  const seen = [];
  R.registerDeveloper({ id: 'iconic', accent: '#2563EB', cost: 50, damage: 6, fireRate: 4, range: 2.2, drawIcon(ctx, size, dev, time) { seen.push([size, dev, time]); } });
  const { g } = setup();
  const dev = placeDev(g, 'iconic', 3, 2);
  g.time = 2;
  render(stubCtx(), g, {});
  assert.deepEqual(seen, [[MAP_TILE, dev, 2]]);
});

test('every shipped developer look draws without throwing', async () => {
  for (const id of ['java', 'dotnet', 'react']) await import(`../src/content/developers/${id}.js?t=${Math.random()}`);
  for (const id of ['java', 'dotnet', 'react']) {
    const def = R.getDeveloper(id);
    assert.equal(typeof def.drawAttack, 'function', `${id} has drawAttack`);
    assert.ok(def.attackDuration > 0, `${id} has attackDuration`);
    def.drawIcon(stubCtx(), 36);
    def.drawIcon(stubCtx(), 36, { lastShotAt: 1 }, 1.1);
    for (const progress of [0, 0.3, 0.5, 0.7, 1]) {
      for (const shot of [0, 1]) {
        def.drawAttack(stubCtx(), { from: { x: 100, y: 100 }, to: { x: 180, y: 40 }, progress, time: 2.3, seed: 0.4, shot, accent: def.accent });
        def.drawAttack(stubCtx(), { from: { x: 100, y: 100 }, to: { x: 100, y: 100 }, progress, time: 2.3, seed: 0.4, shot, accent: def.accent });
      }
    }
  }
});

test('every shipped bug look draws without throwing', async () => {
  const files = ['typo', 'nullpointer', 'legacy', 'merge-conflict', 'memory-leak', 'security-risk'];
  for (const f of files) await import(`../src/content/bugs/${f}.js?t=${Math.random()}`);
  const ids = ['typo', 'nullpointer', 'legacy', 'merge-conflict', 'merge-conflict-half', 'memory-leak', 'security-risk'];
  for (const id of ids) {
    const def = R.getBug(id);
    assert.equal(typeof def.draw, 'function', `${id} has draw`);
    for (const side of ['ours', 'theirs']) def.draw(stubCtx(), def.radius, { radius: def.radius, side, distance: 40 }, 1.3);
    def.draw(stubCtx(), def.radius, undefined, 0);
  }
});
