import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import { CELL } from '../src/engine/map.js';
import { placeDev } from '../src/engine/devs.js';
import { setStorage } from '../src/engine/investments.js';
import { devEffects } from '../src/engine/effects.js';
import { hoveredDev, totalsText, effectsCardKey } from '../src/engine/effects-card.js';
import { registerTestDrinks } from './helpers/drinks.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null); registerTestDrinks();
  R.registerDeveloper({ id: 'd', name: 'Dev', drink: 'coffee', cost: 10, damage: 44.4, fireRate: 1.94, range: 2.94 });
  R.registerWaves([{ groups: [] }]);
});

function setup() {
  const g = createGame(); startGame(g);
  g.drinks = { coffee: 9999, monster: 9999, redbull: 9999 };
  const dev = placeDev(g, 'd', 0, 3);
  return { g, dev };
}

test('hoveredDev: hides without a hover, on an empty cell, or on the selected dev', () => {
  const { g, dev } = setup();
  g.phase = 'wave';
  assert.equal(hoveredDev(g, { hover: null, selected: null }, false), null);
  assert.equal(hoveredDev(g, { hover: { col: 5, row: 5 }, selected: null }, false), null);
  assert.equal(hoveredDev(g, { hover: { col: 0, row: 3 }, selected: dev }, false), null);
});

test('hoveredDev: phase rules', () => {
  const { g, dev } = setup();
  const view = { hover: { col: 0, row: 3 }, selected: null };
  for (const p of ['menu', 'lost']) { g.phase = p; assert.equal(hoveredDev(g, view, false), null, p); }
  g.phase = 'review';
  assert.equal(hoveredDev(g, view, false), null);
  assert.equal(hoveredDev(g, view, true), dev);
  for (const p of ['building', 'wave', 'bell']) { g.phase = p; assert.equal(hoveredDev(g, view, false), dev, p); }
  g.phase = 'wave';
  assert.equal(hoveredDev(g, { ...view, paused: true }, false), dev);
});

test('hoveredDev: hidden while the quit modal is open', () => {
  const { g, dev } = setup();
  g.phase = 'wave';
  const view = { hover: { col: 0, row: 3 }, selected: null };
  assert.equal(hoveredDev(g, view, false, false), dev);
  assert.equal(hoveredDev(g, view, false, true), null);
});

test('totalsText formats damage, rate and range in cells', () => {
  const { g, dev } = setup();
  g.mods.damageMultiplier = 1; g.mods.fireRateMultiplier = 1; g.mods.rangeMultiplier = 1;
  g.mods.devFireRate = {};
  R.getDeveloper('d').damage = 44.4; R.getDeveloper('d').fireRate = 1.94; R.getDeveloper('d').range = 2.94;
  assert.equal(totalsText(g, dev), 'Damage 44 · 1.9/s · range 2.9');
  assert.ok(CELL > 0);
});

test('effectsCardKey ignores countdown digits but sees added/removed lines', () => {
  const { g, dev } = setup();
  const set = lines => { R.getDeveloper('d').describeEffect = () => lines; };
  set([{ group: 'powerup', name: 'CEO', text: '+30% (8 s left)' }]);
  const key = () => effectsCardKey(dev, devEffects(g, dev));
  const a = key();
  set([{ group: 'powerup', name: 'CEO', text: '+30% (7 s left)' }]);
  assert.equal(key(), a);
  set([{ group: 'powerup', name: 'CEO', text: '+30% (7 s left)' }, { group: 'event', name: 'Rain', text: '−10%' }]);
  assert.notEqual(key(), a);
  set([]);
  assert.notEqual(key(), a);
});
