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

import { loadManifest } from '../src/engine/loader.js';

test('I3: a broken manifest falls back to the core content list', async () => {
  const orig = console.error; console.error = () => {};
  const urls = await loadManifest('manifest', ['core-a', 'core-b'], () => Promise.reject(new SyntaxError('bad')));
  const urls2 = await loadManifest('manifest', ['core-a'], () => Promise.resolve({ CONTENT_URLS: 'nope' }));
  console.error = orig;
  assert.deepEqual(urls, ['core-a', 'core-b']);
  assert.deepEqual(urls2, ['core-a']);
  assert.deepEqual(await loadManifest('m', [], () => Promise.resolve({ CONTENT_URLS: ['x'] })), ['x']);
});
