import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadModules } from '../src/engine/loader.js';

test('Review Focus 4: a failing module is skipped, others load', async () => {
  const fake = p => p === 'bad' ? Promise.reject(new Error('nope')) : Promise.resolve({});
  const orig = console.error; console.error = () => {};
  const r = await loadModules(['ok', 'bad', 'ok2'], fake);
  console.error = orig;
  assert.deepEqual(r.loaded, ['ok', 'ok2']);
  assert.equal(r.failed[0].path, 'bad');
});
