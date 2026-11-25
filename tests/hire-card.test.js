import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { hireCardInfo } from '../src/engine/hire-card.js';

beforeEach(() => {
  R.resetRegistry();
  R.registerBug({ id: 'typo', name: 'Typo bug', ring: '#2563EB' });
  R.registerBug({ id: 'nullpointer', name: 'Null pointer', ring: '#EA580C' });
});

test('names the countered bug with its ring colour and a 1-based hotkey', () => {
  assert.deepEqual(hireCardInfo({ counters: 'nullpointer' }, 1), { strong: { name: 'Null pointer', ring: '#EA580C' }, hotkey: 'Hotkey 2' });
  assert.equal(hireCardInfo({ counters: 'typo' }, 0).strong.name, 'Typo bug');
});

test('no counter: only the hotkey', () => {
  assert.deepEqual(hireCardInfo({}, 2), { strong: null, hotkey: 'Hotkey 3' });
});

test('unregistered counter: strong is null', () => {
  assert.equal(hireCardInfo({ counters: 'ghost' }, 0).strong, null);
});

test('real content: React, Java and .NET counters', async () => {
  R.resetRegistry();
  const { failed } = await loadModules(CONTENT_URLS);
  assert.equal(failed.length, 0);
  const names = R.getDevelopers().map((d, i) => hireCardInfo(d, i).strong.name);
  assert.deepEqual(names, ['Typo bug', 'Null pointer', 'Legacy bug']);
});
