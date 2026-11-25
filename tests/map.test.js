import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATH_LENGTH, pointAt, headingAt, isBuildable, cellAt, cellCenter } from '../src/engine/map.js';

test('path length', () => assert.equal(PATH_LENGTH, 180 + 200 + 240 + 120 + 156));
test('pointAt start, corner and clamped end', () => {
  assert.deepEqual(pointAt(0), { x: 0, y: 60 });
  assert.deepEqual(pointAt(190), { x: 180, y: 70 });
  assert.deepEqual(pointAt(1e9), { x: 576, y: 140 });
});
test('isBuildable', () => {
  assert.equal(isBuildable(0, 1), false);
  assert.equal(isBuildable(3, 3), true);
  assert.equal(isBuildable(15, 3), false);
  assert.equal(isBuildable(-1, 0), false);
  assert.equal(isBuildable(16, 0), false);
});
test('cellAt / cellCenter round trip', () => {
  assert.deepEqual(cellAt(139, 141), { col: 3, row: 3 });
  assert.deepEqual(cellCenter(3, 3), { x: 140, y: 140 });
});

test('headingAt: the direction a bug walks, 0 = right, π/2 = down', () => {
  assert.equal(headingAt(10), 0);
  assert.equal(headingAt(200), Math.PI / 2);
  assert.equal(headingAt(180 + 200 + 240 + 50), -Math.PI / 2);
  assert.equal(headingAt(PATH_LENGTH + 10), 0);
  assert.equal(headingAt(-5), 0);
});

test('headingAt: bugs turn smoothly through a corner instead of snapping', () => {
  assert.equal(headingAt(180 - 13), 0);
  assert.ok(Math.abs(headingAt(180) - Math.PI / 4) < 1e-9, 'halfway round at the corner');
  assert.ok(headingAt(180 - 6) > 0 && headingAt(180 - 6) < Math.PI / 4);
  assert.equal(headingAt(180 + 13), Math.PI / 2);
  // turning left (down → right) goes the short way round
  assert.ok(Math.abs(headingAt(380) - Math.PI / 4) < 1e-9);
  // right → up at (420, 260): halfway is -π/4
  assert.ok(Math.abs(headingAt(620) + Math.PI / 4) < 1e-9);
});
