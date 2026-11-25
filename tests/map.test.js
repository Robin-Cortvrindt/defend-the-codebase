import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PATH_LENGTH, PATH_WIDTH, WAYPOINTS, PROD, COLS, ROWS, WIDTH, HEIGHT, pointAt, headingAt, isBuildable, cellAt, cellCenter } from '../src/engine/map.js';
import { BUILDING } from '../src/engine/building.js';

test('the board is 24 x 12 cells of 40 px', () => {
  assert.equal(COLS, 24);
  assert.equal(ROWS, 12);
  assert.equal(WIDTH, 960);
  assert.equal(HEIGHT, 480);
});

test('path length', () => assert.equal(PATH_LENGTH, 2216));

test('pointAt start, corner and clamped end', () => {
  assert.deepEqual(pointAt(0), { x: 0, y: 60 });
  assert.deepEqual(pointAt(310), { x: 300, y: 70 });
  assert.deepEqual(pointAt(1e9), { x: 896, y: 260 });
});

test('isBuildable', () => {
  assert.equal(isBuildable(0, 1), false);    // lane
  assert.equal(isBuildable(3, 3), true);
  assert.equal(isBuildable(22, 3), false);   // the column above PROD stays free for the building
  assert.equal(isBuildable(23, 11), true);
  assert.equal(isBuildable(-1, 0), false);
  assert.equal(isBuildable(24, 0), false);
});

test('cellAt / cellCenter round trip', () => {
  assert.deepEqual(cellAt(139, 141), { col: 3, row: 3 });
  assert.deepEqual(cellCenter(3, 3), { x: 140, y: 140 });
});

test('headingAt: the direction a bug walks, 0 = right, π/2 = down', () => {
  assert.equal(headingAt(10), 0);
  assert.equal(headingAt(330), Math.PI / 2);
  assert.equal(headingAt(PATH_LENGTH + 10), 0);
  assert.equal(headingAt(-5), 0);
});

test('headingAt: bugs turn smoothly through a corner instead of snapping', () => {
  assert.equal(headingAt(300 - 13), 0);
  assert.ok(Math.abs(headingAt(300) - Math.PI / 4) < 1e-9, 'halfway round at the corner');
  assert.ok(headingAt(300 - 6) > 0 && headingAt(300 - 6) < Math.PI / 4);
  assert.equal(headingAt(300 + 13), Math.PI / 2);
});

test('the building stands on PROD and its column never touches the lane', () => {
  assert.equal(BUILDING.x, PROD.x + 2);
  assert.equal(BUILDING.ground, PROD.y + 72);
  assert.equal(BUILDING.groundTop, PROD.y + 12);
  assert.ok(BUILDING.minTop >= 0);
  const rect = { x0: BUILDING.x, x1: BUILDING.x + BUILDING.w, y0: BUILDING.minTop, y1: PROD.y };
  const segs = WAYPOINTS.slice(1).map((b, i) => [WAYPOINTS[i], b]);
  for (const [a, b] of segs) {
    const sx0 = Math.min(a.x, b.x) - PATH_WIDTH / 2, sx1 = Math.max(a.x, b.x) + PATH_WIDTH / 2;
    const sy0 = Math.min(a.y, b.y) - PATH_WIDTH / 2, sy1 = Math.max(a.y, b.y) + PATH_WIDTH / 2;
    const overlap = sx0 < rect.x1 && sx1 > rect.x0 && sy0 < rect.y1 && sy1 > rect.y0;
    assert.ok(!overlap, `lane segment ${JSON.stringify([a, b])} runs through the building column`);
  }
});
