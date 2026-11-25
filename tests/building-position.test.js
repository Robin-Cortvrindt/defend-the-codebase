// The building stands on PROD; everything drawn on it must move with it (no old-board y values).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import { drawBuilding, BUILDING } from '../src/engine/building.js';
import { render } from '../src/engine/render.js';
import { registerTestDrinks } from './helpers/drinks.js';
import { recordingCtx } from './stub-ctx.js';

beforeEach(() => { R.resetRegistry(); clearAll(); registerTestDrinks(); R.registerWaves([{ groups: [] }]); });

const levels = { aircon: 0, heating: 0, coffee: 0, fridge: 0, generator: 0 };

test('the door is on the ground floor, facing the lane', () => {
  const ctx = recordingCtx();
  drawBuilding(ctx, { floors: 1, lives: 10, maxLives: 10, time: 0, levels });
  const door = ctx.calls.find(c => c[0] === 'fillRect' && c[1] === BUILDING.x && c[3] === 10 && c[4] === 24);
  assert.ok(door, 'door drawn');
  assert.equal(door[2], BUILDING.groundTop + 10);
});

test('on a loss the fire burns in the building, not above it', () => {
  const g = createGame(); startGame(g);
  g.floors = 6; g.lives = 0; g.phase = 'lost'; g.deathTime = 1.2; g.time = 3;
  const ctx = recordingCtx();
  render(ctx, g, {});
  const flames = ctx.calls.filter(c => c[0] === 'fillRect' && c[3] === 7 && (c[4] === 7 || c[4] === 8));
  const lobby = flames.filter(c => c[4] === 8);
  const windows = flames.filter(c => c[4] === 7);
  assert.ok(lobby.length > 0, 'lobby flames');
  for (const c of lobby) assert.ok(c[2] >= BUILDING.groundTop && c[2] + 8 <= BUILDING.ground, `lobby flame at y ${c[2]}`);
  assert.ok(windows.length > 0, 'upper windows catch fire');
  for (const c of windows) assert.ok(c[2] < BUILDING.groundTop, `window fire at y ${c[2]}`);
});
