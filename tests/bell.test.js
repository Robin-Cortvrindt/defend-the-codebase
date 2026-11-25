import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame } from '../src/engine/game.js';
import { getBellActions } from '../src/engine/bell.js';

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
