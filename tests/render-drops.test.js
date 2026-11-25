import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame } from '../src/engine/game.js';
import { render } from '../src/engine/render.js';
import { DROP_TTL, BLINK_AT } from '../src/engine/drops.js';
import { registerTestDrinks } from './helpers/drinks.js';

const stubCtx = () => new Proxy({}, {
  get: (t, k) => {
    if (k in t) return t[k];
    if (k === 'measureText') return () => ({ width: 0 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
    return () => {};
  },
  set: (t, k, v) => { t[k] = v; return true; },
});

test('render draws fresh, popping and blinking drops without throwing', () => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  const game = createGame();
  game.phase = 'wave';
  const [a, b] = R.getDrinks();
  game.drops.push(
    { id: 1, x: 100, y: 100, drink: a.id, amount: 2, ttl: DROP_TTL },
    { id: 2, x: 150, y: 100, drink: a.id, amount: 2, ttl: DROP_TTL - 0.1 },
    { id: 3, x: 200, y: 100, drink: b.id, amount: 3, ttl: BLINK_AT - 0.5 },
    { id: 4, x: 250, y: 100, drink: b.id, amount: 3, ttl: BLINK_AT - 0.7 },
  );
  assert.doesNotThrow(() => render(stubCtx(), game, { selected: null, hover: null, hire: null, paused: false }));
});

test('drops are drawn under the running event, so PROD-is-down darkness hides them outside the flashlight', async () => {
  const { recordingCtx } = await import('./stub-ctx.js');
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerEvent({ id: 'dark', name: 'Dark', draw(ctx) { ctx.darkOverlay(); } });
  const game = createGame();
  game.phase = 'wave';
  game.activeEvent = 'dark';
  game.drops.push({ id: 1, x: 123, y: 77, drink: R.getDrinks()[0].id, amount: 2, ttl: DROP_TTL });
  const ctx = recordingCtx();
  render(ctx, game, { selected: null, hover: null, hire: null, paused: false });
  const dropAt = ctx.calls.findIndex(([k, ...a]) => k === 'translate' && a[0] === 123 && a[1] === 77);
  const darkAt = ctx.calls.findIndex(([k]) => k === 'darkOverlay');
  assert.ok(dropAt >= 0 && darkAt >= 0, 'both drawn');
  assert.ok(dropAt < darkAt, 'drop drawn before the event overlay');
});

test('a drop still in the air renders without throwing', () => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  const game = createGame();
  game.phase = 'wave';
  const [a] = R.getDrinks();
  game.drops.push({ id: 1, x: 300, y: 200, fromX: 100, fromY: 60, flight: 0.25, drink: a.id, amount: 2, ttl: DROP_TTL });
  assert.doesNotThrow(() => render(stubCtx(), game, { selected: null, hover: null, hire: null, paused: false }));
});

test('features drawn with drawUnder go under the event overlay (the vacuum stays dark when PROD is down)', async () => {
  const { recordingCtx } = await import('./stub-ctx.js');
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerEvent({ id: 'dark', name: 'Dark', draw(ctx) { ctx.darkOverlay(); } });
  const vac = (await import('../src/content/investments/robot-vacuum.js')).vacuumFeature;
  const gob = (await import('../src/content/events/goblin.js')).goblinFeature;
  R.registerFeature(vac); R.registerFeature(gob);
  const game = createGame();
  game.phase = 'wave'; game.activeEvent = 'dark'; game.unlocks.vacuum = 1;
  game.vacuum = { x: 321, y: 123, angle: 0, moving: false };
  game.goblin = { x: 432, y: 98, carried: 0, face: 1, moving: false, leaving: false };
  const ctx = recordingCtx();
  render(ctx, game, { selected: null, hover: null, hire: null, paused: false });
  const at = (x, y) => ctx.calls.findIndex(([k, ...a]) => k === 'translate' && a[0] === x && a[1] === y);
  const darkAt = ctx.calls.findIndex(([k]) => k === 'darkOverlay');
  assert.ok(at(321, 123) >= 0 && at(321, 123) < darkAt, 'vacuum under the overlay');
  assert.ok(at(432, 98) >= 0 && at(432, 98) < darkAt, 'goblin under the overlay');
});
