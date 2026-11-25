import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame } from '../src/engine/game.js';
import { getBellActions, bellActionView } from '../src/engine/bell.js';

const ACTION = { id: 'act', label: () => 'Do it', enabled: () => true, onClick() {} };

beforeEach(() => {
  R.resetRegistry(); clearAll();
  R.registerFeature({ id: 'feat', bellActions: [ACTION] });
});

const at = (phase, pendingYearReview = false) => {
  const g = createGame(); g.phase = phase; g.pendingYearReview = pendingYearReview; return g;
};

test('bell actions show at the bell and in the quarter review', () => {
  const bell = getBellActions(at('bell'));
  assert.equal(bell.length, 1);
  assert.equal(bell[0].feature, 'feat');
  assert.equal(bell[0].action, ACTION);
  assert.equal(getBellActions(at('review')).length, 1);
});

test('bell actions hide during a sprint, in the menu and during the yearly review', () => {
  for (const phase of ['wave', 'building', 'menu', 'lost']) assert.deepEqual(getBellActions(at(phase)), [], phase);
  assert.deepEqual(getBellActions(at('review', true)), []);
});

test('features without bellActions are skipped', () => {
  R.registerFeature({ id: 'odd', bellActions: 'x' });
  R.registerFeature({ id: 'none' });
  assert.equal(getBellActions(at('bell')).length, 1);
});

test('an action view follows the game state every time it is read', () => {
  const g = at('bell'); g.drinks = { coffee: 10 };
  const action = {
    id: 'buy', label: game => `Buy (${game.drinks.coffee})`, hint: () => 'hint',
    cost: () => ({ coffee: 20 }), enabled: game => game.drinks.coffee >= 20, onClick() {},
  };
  assert.deepEqual(bellActionView(g, action), { label: 'Buy (10)', hint: 'hint', cost: { coffee: 20 }, enabled: false });
  g.drinks.coffee = 25;   // e.g. the player picked up the boss drops at the bell
  assert.deepEqual(bellActionView(g, action), { label: 'Buy (25)', hint: 'hint', cost: { coffee: 20 }, enabled: true });
});

test('an action view survives a throwing or missing callback', () => {
  const g = at('bell');
  const view = bellActionView(g, { id: 'x', label: () => { throw new Error('boom'); }, enabled: () => { throw new Error('boom'); } });
  assert.deepEqual(view, { label: 'x', hint: '', cost: null, enabled: false });
});
