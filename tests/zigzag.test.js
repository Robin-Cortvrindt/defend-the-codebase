import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { zigzagPoint } from '../src/engine/zigzag.js';
import { stubCtx, recordingCtx } from './stub-ctx.js';
import '../src/content/developers/react.js';
import '../src/content/developers/java.js';
import '../src/content/developers/dotnet.js';

const from = { x: 0, y: 0 }, to = { x: 200, y: 0 };

test('zigzagPoint starts at the developer and ends on the bug', () => {
  for (const seed of [0, 0.3, 0.77]) {
    const start = zigzagPoint(from, to, 0, seed);
    assert.ok(Math.abs(start.x) < 1e-9 && Math.abs(start.y) < 1e-9);
    const end = zigzagPoint(from, to, 1, seed);
    assert.ok(Math.abs(end.x - 200) < 1e-9 && Math.abs(end.y) < 1e-9);
  }
});

test('zigzagPoint swings to both sides, never further than its amplitude', () => {
  const ys = Array.from({ length: 101 }, (_, i) => zigzagPoint(from, to, i / 100, 0.1, 16).y);
  assert.ok(ys.every(y => Math.abs(y) <= 16 + 1e-9));
  assert.ok(ys.some(y => y > 8) && ys.some(y => y < -8), 'zigs both ways');
  const xs = Array.from({ length: 11 }, (_, i) => zigzagPoint(from, to, i / 10, 0.1).x);
  assert.deepEqual(xs.map(Math.round), [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200], 'progress stays straight-line');
});

const path = ctx => ctx.calls.filter(c => c[0] === 'lineTo' || c[0] === 'translate').map(c => c.slice(1).map(Math.round).join(','));

test('every developer draws a tipsy shot without errors, and differently from a sober one', () => {
  for (const id of ['react', 'java', 'dotnet']) {
    const def = R.getDeveloper(id);
    for (const progress of [0, 0.3, 0.7, 1]) {
      const a = { from: { x: 100, y: 200 }, to: { x: 300, y: 60 }, progress, time: 1.23, seed: 0.42, shot: 3, counter: false, accent: def.accent };
      def.drawAttack(stubCtx(), { ...a, tipsy: true });
      if (progress !== 0.3) continue;
      const sober = recordingCtx(), tipsy = recordingCtx();
      def.drawAttack(sober, { ...a, tipsy: false });
      def.drawAttack(tipsy, { ...a, tipsy: true });
      assert.notDeepEqual(path(tipsy), path(sober), `${id} zigzags`);
    }
  }
});
