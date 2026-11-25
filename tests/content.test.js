import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';

test('manifest registers 3 developers, 3 bugs, 10 consistent waves', async () => {
  R.resetRegistry();
  const { failed } = await loadModules(CONTENT_URLS);
  assert.equal(failed.length, 0);
  assert.deepEqual(R.getDevelopers().map(d => d.id), ['react', 'java', 'dotnet']);
  assert.equal(R.getBugs().length, 3);
  for (const d of R.getDevelopers()) assert.ok(R.getBug(d.counters), `${d.id} counters a registered bug`);
  const waves = R.getWaves();
  assert.equal(waves.length, 10);
  for (const w of waves) for (const g of w.groups) assert.ok(R.getBug(g.bug), `wave bug ${g.bug} registered`);
  assert.deepEqual([...new Set(waves[0].groups.map(g => g.bug))], ['typo']);
});
