import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { drawDrinkIcon } from '../src/engine/drink-icons.js';
import { recordingCtx } from './stub-ctx.js';

test('the real drinks draw their own icon, not a letter', async () => {
  R.resetRegistry();
  await import('../src/content/drinks/coffee.js');
  await import('../src/content/drinks/monster.js');
  await import('../src/content/drinks/redbull.js');
  for (const def of R.getDrinks()) {
    assert.equal(typeof def.drawIcon, 'function', def.id);
    const ctx = recordingCtx();
    drawDrinkIcon(ctx, def, 22);
    assert.ok(ctx.calls.some(([k]) => k === 'arc'), `${def.id} draws shapes`);
    assert.ok(!ctx.calls.some(([k]) => k === 'fillText'), `${def.id} draws no text`);
  }
});

test('a drink without drawIcon falls back to a disc with its text icon', () => {
  const ctx = recordingCtx();
  drawDrinkIcon(ctx, { id: 'tea', color: '#16A34A', icon: 'T' }, 22);
  assert.ok(ctx.calls.some(([k, text]) => k === 'fillText' && text === 'T'));
});

test('a broken drawIcon is logged, not thrown', () => {
  const ctx = recordingCtx();
  const err = console.error; console.error = () => {};
  try { assert.doesNotThrow(() => drawDrinkIcon(ctx, { id: 'bad', drawIcon() { throw new Error('x'); } }, 22)); }
  finally { console.error = err; }
});
