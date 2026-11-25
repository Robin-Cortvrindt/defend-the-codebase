import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popoverPosition } from '../src/engine/popover.js';

const base = { scale: 1, stageW: 640, stageH: 320, popW: 240, popH: 160 };

test('opens to the right of a tower with room, centred vertically', () => {
  const p = popoverPosition({ ...base, x: 140, y: 140 });
  assert.deepEqual(p, { left: 172, top: 60, side: 'right', arrowY: 80, maxW: 468, maxH: 320 });
});

test('opens to the left near the right edge and stays inside', () => {
  const p = popoverPosition({ ...base, x: 580, y: 140 });
  assert.equal(p.side, 'left');
  assert.equal(p.left, 580 - 32 - 240);
  assert.ok(p.left >= 0 && p.left + base.popW <= base.stageW);
});

test('clamps vertically at top and bottom rows; arrow still points at the tower', () => {
  const top = popoverPosition({ ...base, x: 140, y: 20 });
  assert.equal(top.top, 0); assert.equal(top.arrowY, 20);
  const bottom = popoverPosition({ ...base, x: 140, y: 300 });
  assert.equal(bottom.top, 160); assert.equal(bottom.arrowY, 140);
});

test('a popover taller than the stage clamps top to 0 and caps its height', () => {
  const p = popoverPosition({ ...base, x: 140, y: 140, popH: 400 });
  assert.equal(p.top, 0);
  assert.equal(p.arrowY, 140);
  assert.equal(p.maxH, 320);
  assert.ok(p.top + Math.min(400, p.maxH) <= base.stageH);
});

test('scale multiplies map coordinates and the tower half-size', () => {
  const p = popoverPosition({ ...base, scale: 0.5, stageW: 320, stageH: 160, popW: 100, popH: 60, x: 140, y: 140 });
  assert.deepEqual(p, { left: 91, top: 40, side: 'right', arrowY: 30, maxW: 229, maxH: 160 });
});

test('narrow stage: picks the side with more room and caps width so the tower stays visible', () => {
  const left = popoverPosition({ ...base, stageW: 360, x: 200, y: 140 });
  assert.equal(left.side, 'left');
  assert.equal(left.maxW, 168);
  assert.equal(left.left, 0);
  assert.ok(left.left + Math.min(240, left.maxW) <= 200 - 32);

  const right = popoverPosition({ ...base, stageW: 360, x: 160, y: 140 });
  assert.equal(right.side, 'right');
  assert.equal(right.left, 192);
  assert.equal(right.maxW, 168);
});

test('exact fit on the right stays on the right', () => {
  // cx + off + popW === stageW, with cx = 368, off = 32, popW = 240
  const p = popoverPosition({ ...base, x: 368, y: 140 });
  assert.equal(p.side, 'right');
  assert.equal(p.left, 400);
  assert.equal(p.left + base.popW, base.stageW);
});
