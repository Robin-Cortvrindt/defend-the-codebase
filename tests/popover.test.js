import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popoverPosition } from '../src/engine/popover.js';

const base = { scale: 1, stageW: 640, stageH: 320, popW: 240, popH: 160 };

test('opens to the right of a tower with room, centred vertically', () => {
  const p = popoverPosition({ ...base, x: 140, y: 140 });
  assert.deepEqual(p, { left: 140 + 22 + 10, top: 60, side: 'right', arrowY: 80 });
});

test('Review Focus 1: opens to the left near the right edge and stays inside', () => {
  const p = popoverPosition({ ...base, x: 580, y: 140 });
  assert.equal(p.side, 'left');
  assert.equal(p.left, 580 - 32 - 240);
  assert.ok(p.left >= 0 && p.left + base.popW <= base.stageW);
});

test('Review Focus 2: clamps vertically at top and bottom rows; arrow still points at the tower', () => {
  const top = popoverPosition({ ...base, x: 140, y: 20 });
  assert.equal(top.top, 0); assert.equal(top.arrowY, 20);
  const bottom = popoverPosition({ ...base, x: 140, y: 300 });
  assert.equal(bottom.top, 160); assert.equal(bottom.arrowY, 140);
});

test('Review Focus 3: a popover taller than the stage clamps top to 0', () => {
  assert.equal(popoverPosition({ ...base, x: 140, y: 140, popH: 400 }).top, 0);
});

test('scale multiplies map coordinates and the tower half-size', () => {
  const p = popoverPosition({ ...base, scale: 0.5, stageW: 320, stageH: 160, popW: 100, popH: 60, x: 140, y: 140 });
  assert.deepEqual(p, { left: 70 + 11 + 10, top: 40, side: 'right', arrowY: 30 });
});
