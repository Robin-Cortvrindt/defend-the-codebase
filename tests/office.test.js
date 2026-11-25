import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECORATIONS, drawOffice } from '../src/engine/office.js';
import { isBuildable, isPathCell, WIDTH, HEIGHT } from '../src/engine/map.js';
import { stubCtx, recordingCtx } from './stub-ctx.js';

test('office decorations sit on buildable cells, never on the lane', () => {
  assert.ok(DECORATIONS.length > 0);
  for (const d of DECORATIONS) {
    assert.ok(['plant', 'desk', 'coffee'].includes(d.kind), d.kind);
    assert.ok(isBuildable(d.col, d.row), `(${d.col},${d.row}) must be buildable`);
    assert.ok(!isPathCell(d.col, d.row), `(${d.col},${d.row}) is on the lane`);
  }
});

test('no two office decorations share a cell', () => {
  const keys = DECORATIONS.map(d => `${d.col},${d.row}`);
  assert.equal(new Set(keys).size, keys.length);
});

test('drawOffice covers the whole board without throwing', () => {
  assert.doesNotThrow(() => drawOffice(stubCtx()));
  const ctx = recordingCtx();
  drawOffice(ctx);
  const fills = ctx.calls.filter(c => c[0] === 'fillRect');
  assert.ok(fills.some(([, x, y]) => x === 0 && y === 0), 'top-left tile');
  assert.ok(fills.some(([, x, y, w, h]) => x + w === WIDTH && y + h === HEIGHT), 'bottom-right tile');
});
