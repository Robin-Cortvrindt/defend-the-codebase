import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devLayout, MAP_TILE } from '../src/engine/render.js';
import { CELL } from '../src/engine/map.js';

const inCell = r => r.x >= -CELL / 2 && r.y >= -CELL / 2 && r.x + r.w <= CELL / 2 && r.y + r.h <= CELL / 2;

test('every tower marker stays inside its own cell', () => {
  const L = devLayout();
  for (const [name, r] of Object.entries(L)) assert.ok(inCell(r), `${name} ${JSON.stringify(r)} leaves the cell`);
});

test('tile is 32 px; badge is 14 px in the top-right corner', () => {
  const { tile, badge } = devLayout();
  assert.equal(MAP_TILE, 32);
  assert.deepEqual(tile, { x: -16, y: -16, w: 32, h: 32 });
  assert.deepEqual(badge, { x: 5, y: -19, w: 14, h: 14 });
});

test('badge does not cover the icon centre; XP bar does not touch the badge', () => {
  const { badge, xp } = devLayout();
  assert.ok(badge.x > 0 && badge.y + badge.h < 0, 'badge clear of the centre');
  assert.ok(xp.y >= badge.y + badge.h, 'xp bar below the badge');
});
