import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';

beforeEach(() => R.resetRegistry());

test('getDevelopers returns registration order', () => {
  R.registerDeveloper({ id: 'b' });
  R.registerDeveloper({ id: 'a' });
  assert.deepEqual(R.getDevelopers().map(d => d.id), ['b', 'a']);
});

test('duplicate id replaces', () => {
  const orig = console.warn; console.warn = () => {};
  R.registerBug({ id: 'x', hp: 1 });
  R.registerBug({ id: 'x', hp: 2 });
  console.warn = orig;
  assert.equal(R.getBug('x').hp, 2);
  assert.equal(R.getBugs().length, 1);
});

test('resetRegistry empties all', () => {
  R.registerDeveloper({ id: 'd' }); R.registerBug({ id: 'b' });
  R.registerPowerup({ id: 'p' }); R.registerFeature({ id: 'f' });
  R.registerWaves([{ groups: [] }]);
  R.resetRegistry();
  assert.equal(R.getDevelopers().length + R.getBugs().length + R.getPowerups().length + R.getFeatures().length + R.getWaves().length, 0);
});
