import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame } from '../src/engine/game.js';

test('manifest registers 3 developers, 4 bugs, 10 consistent waves with a boss', async () => {
  R.resetRegistry();
  const { failed } = await loadModules(CONTENT_URLS);
  assert.equal(failed.length, 0);
  assert.deepEqual(R.getDevelopers().map(d => d.id), ['react', 'java', 'dotnet']);
  assert.deepEqual(R.getBugs().map(b => b.id), ['typo', 'nullpointer', 'legacy', 'security-risk']);
  for (const d of R.getDevelopers()) assert.ok(R.getBug(d.counters), `${d.id} counters a registered bug`);
  const waves = R.getWaves();
  assert.equal(waves.length, 10);
  for (const w of waves) for (const g of w.groups) assert.ok(R.getBug(g.bug), `wave bug ${g.bug} registered`);
  for (const w of waves) assert.equal(w.boss, 'security-risk', 'every sprint ends with the security-risk boss');
  assert.ok(!R.getDevelopers().some(d => d.counters === 'security-risk'), 'no developer counters the boss');
  assert.deepEqual([...new Set(waves[0].groups.map(g => g.bug))], ['typo']);
  assert.deepEqual(R.getEvents().map(e => e.id), ['prod-down', 'heating-out', 'no-coffee', 'no-redbull', 'heat-wave']);

  // each event's end exactly undoes its start
  for (const e of R.getEvents()) {
    const g = createGame();
    e.start(g); e.end(g);
    assert.equal(g.mods.timeScale, 1, e.id);
    assert.equal(g.mods.bugSpeedMultiplier, 1, e.id);
    assert.equal(g.mods.devFireRate.java ?? 1, 1, e.id);
    assert.equal(g.mods.devFireRate.dotnet ?? 1, 1, e.id);
  }

  // heat wave is scaled down by air conditioning (game.heatResistance 0..1)
  const hw = R.getEvent('heat-wave');
  for (const [res, expected] of [[undefined, 1.5], [0, 1.5], [0.5, 1.25], [1, 1]]) {
    const g = createGame(); g.heatResistance = res;
    hw.start(g);
    assert.equal(g.mods.bugSpeedMultiplier, expected, `heatResistance ${res}`);
    hw.end(g);
    assert.equal(g.mods.bugSpeedMultiplier, 1);
  }

  // prod-down draws with or without a cursor
  const noop = () => {};
  const ctx = new Proxy({ createRadialGradient: () => ({ addColorStop: noop }) }, {
    get: (t, k) => (k in t ? t[k] : noop), set: () => true,
  });
  const prod = R.getEvent('prod-down');
  prod.draw(ctx, createGame(), { cursor: null });
  prod.draw(ctx, createGame(), { cursor: { x: 100, y: 100 } });
});
