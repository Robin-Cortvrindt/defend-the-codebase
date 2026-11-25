import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATH_LENGTH, pointAt, isBuildable, cellAt, cellCenter } from '../src/engine/map.js';

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
