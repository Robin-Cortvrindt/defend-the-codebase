import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import { CELL } from '../src/engine/map.js';
import { placeDev } from '../src/engine/devs.js';
import { powerupState } from '../src/engine/powerups.js';
import { setStorage, saveProgress } from '../src/engine/investments.js';
import { devEffects, pctText, statsText, GROUPS } from '../src/engine/effects.js';
import { registerTestDrinks } from './helpers/drinks.js';

beforeEach(() => {
  R.resetRegistry(); clearAll(); setStorage(null); registerTestDrinks();
  R.registerDeveloper({ id: 'd', name: 'Dev', drink: 'coffee', cost: 10, damage: 10, fireRate: 1, range: 2,
    upgrades: {
      level2: { id: 'u2', name: 'Up Two', stats: { damage: 40, range: 2.6 } },
      level3: [{ id: 'u3', name: 'Up Three', description: 'does a thing' }],
    } });
  R.registerWaves([{ groups: [] }]);
});

function setup(level = 0) {
  const g = createGame(); startGame(g);
  g.drinks = { coffee: 9999, monster: 9999, redbull: 9999 };
  const dev = placeDev(g, 'd', 0, 3);
  dev.level = level;
  if (level === 2) dev.upgrade = R.getDeveloper('d').upgrades.level3[0];
  return { g, dev };
}

test('pctText and statsText', () => {
  assert.equal(pctText(1.3), '+30%');
  assert.equal(pctText(0.5), '−50%');
  assert.equal(pctText(1.15), '+15%');
  assert.equal(statsText({ damage: 40, range: 2.6 }), 'damage 40, range 2.6');
  assert.deepEqual(GROUPS, ['upgrade', 'team', 'investment', 'powerup', 'event']);
});

test('upgrade lines', () => {
  assert.deepEqual(devEffects(...Object.values(setup(0))), []);
  const a = setup(1);
  assert.deepEqual(devEffects(a.g, a.dev), [{ group: 'upgrade', name: 'Up Two', text: 'damage 40, range 2.6' }]);
  const b = setup(2);
  assert.deepEqual(devEffects(b.g, b.dev), [
    { group: 'upgrade', name: 'Up Two', text: 'damage 40, range 2.6' },
    { group: 'upgrade', name: 'Up Three', text: 'does a thing' }]);
});

test('investment lines use levels and skip 0/missing', () => {
  R.registerInvestment({ id: 'inv', name: 'Inv', describeEffect: (g, d, lvl) => `damage +${lvl * 10}%` });
  const { g, dev } = setup();
  g.investmentLevels = { inv: 3 };
  assert.deepEqual(devEffects(g, dev), [{ group: 'investment', name: 'Inv 3', text: 'damage +30%' }]);
  g.investmentLevels = { inv: 0 };
  assert.deepEqual(devEffects(g, dev), []);
  g.investmentLevels = {};
  assert.deepEqual(devEffects(g, dev), []);
});

test('Review Focus 3: levels are captured at startGame, not read from storage later', () => {
  R.registerInvestment({ id: 'inv', name: 'Inv', apply() {}, describeEffect: (g, d, lvl) => `lvl ${lvl}` });
  saveProgress({ capital: 0, levels: { inv: 2 } });
  const g = createGame(); startGame(g);
  assert.equal(g.investmentLevels.inv, 2);
  g.drinks = { coffee: 9999 };
  const dev = placeDev(g, 'd', 0, 3);
  saveProgress({ capital: 0, levels: { inv: 5 } });
  assert.equal(devEffects(g, dev)[0].name, 'Inv 2');
});

test('powerup lines only while active', () => {
  R.registerPowerup({ id: 'pu', name: 'Pu', describeEffect: () => 'boosted' });
  const { g, dev } = setup();
  assert.deepEqual(devEffects(g, dev), []);
  powerupState(g, 'pu').active = true;
  assert.deepEqual(devEffects(g, dev), [{ group: 'powerup', name: 'Pu', text: 'boosted' }]);
});

test('event hook only when active event', () => {
  R.registerEvent({ id: 'ev', name: 'Ev', describeEffect: () => 'slower' });
  const { g, dev } = setup();
  assert.deepEqual(devEffects(g, dev), []);
  g.activeEvent = 'ev';
  assert.deepEqual(devEffects(g, dev), [{ group: 'event', name: 'Ev', text: 'slower' }]);
});

test('group override moves a line before investments', () => {
  R.registerInvestment({ id: 'inv', name: 'Inv', describeEffect: () => ({ text: 't', group: 'team' }) });
  R.registerInvestment({ id: 'inv2', name: 'Inv2', describeEffect: () => 'x' });
  const { g, dev } = setup();
  g.investmentLevels = { inv: 1, inv2: 1 };
  assert.deepEqual(devEffects(g, dev).map(l => l.group), ['team', 'investment']);
});

test('Review Focus 4: throwing hook is skipped', () => {
  R.registerInvestment({ id: 'bad', name: 'Bad', describeEffect: () => { throw new Error('x'); } });
  R.registerInvestment({ id: 'ok', name: 'Ok', describeEffect: () => 'fine' });
  const { g, dev } = setup();
  g.investmentLevels = { bad: 1, ok: 1 };
  const orig = console.error; console.error = () => {};
  try { assert.deepEqual(devEffects(g, dev), [{ group: 'investment', name: 'Ok 1', text: 'fine' }]); }
  finally { console.error = orig; }
});

test('Review Focus 5: aura lines once per upgrade id, in radius only', () => {
  const aura = { id: 'au', name: 'Aura Up', aura: { radius: 2, describe: () => 'faster', apply() {} } };
  R.registerDeveloper({ id: 'a', name: 'A', drink: 'coffee', cost: 1, damage: 1, fireRate: 1, range: 1 });
  const { g, dev } = setup();
  const o1 = placeDev(g, 'a', 1, 3); o1.upgrade = aura;
  const o2 = placeDev(g, 'a', 0, 4); o2.upgrade = aura;
  assert.deepEqual(devEffects(g, dev).map(l => [l.group, l.name, l.text]), [['team', 'Aura Up (nearby)', 'faster']]);
  const { g: far, dev: d2 } = setup();
  const f = placeDev(far, 'a', 1, 3); f.x = d2.x + 5 * CELL; f.upgrade = aura;
  assert.deepEqual(devEffects(far, d2), []);
});

test('mixed order follows GROUPS', () => {
  R.registerInvestment({ id: 'inv', name: 'Inv', describeEffect: () => 'i' });
  R.registerPowerup({ id: 'pu', name: 'Pu', describeEffect: () => 'p' });
  R.registerEvent({ id: 'ev', name: 'Ev', describeEffect: () => 'e' });
  const { g, dev } = setup(1);
  g.investmentLevels = { inv: 1 }; powerupState(g, 'pu').active = true; g.activeEvent = 'ev';
  assert.deepEqual(devEffects(g, dev).map(l => l.group), ['upgrade', 'investment', 'powerup', 'event']);
});

test('hook result normalisation', () => {
  const run = result => {
    R.resetRegistry(); R.registerDeveloper({ id: 'd', name: 'Dev', drink: 'coffee', cost: 10, damage: 1, fireRate: 1, range: 1 });
    R.registerInvestment({ id: 'inv', name: 'Inv', describeEffect: () => result });
    const g = createGame(); startGame(g); g.drinks = { coffee: 99 };
    const dev = placeDev(g, 'd', 0, 3);
    g.investmentLevels = { inv: 1 };
    return devEffects(g, dev);
  };
  assert.deepEqual(run(['a', 'b']).map(l => l.text), ['a', 'b']);
  assert.deepEqual(run([{ name: 'X', text: 'a' }, { text: 'b' }]).map(l => [l.name, l.text]), [['X', 'a'], ['Inv 1', 'b']]);
  assert.deepEqual(run(null), []);
  assert.deepEqual(run([]), []);
  assert.deepEqual(run({ text: '' }), []);
});

test('developer and feature hooks land in team, developer before aura', () => {
  const aura = { id: 'au', name: 'Aura Up', aura: { radius: 2, describe: () => 'faster', apply() {} } };
  R.registerDeveloper({ id: 'a', name: 'A', drink: 'coffee', cost: 1, damage: 1, fireRate: 1, range: 1 });
  R.registerDeveloper({ id: 'n', name: 'N', drink: 'coffee', cost: 1, damage: 1, fireRate: 1, range: 1,
    describeEffect: () => [{ text: 'own' }, { name: 'Custom', text: 'own2' }] });
  R.registerFeature({ id: 'feat', name: 'Feat', describeEffect: () => 'fx' });
  const { g } = setup();
  const n = placeDev(g, 'n', 1, 3);
  const o = placeDev(g, 'a', 0, 4); o.upgrade = aura;
  assert.deepEqual(devEffects(g, n).map(l => [l.group, l.name, l.text]), [
    ['team', 'N', 'own'], ['team', 'Custom', 'own2'], ['team', 'Aura Up (nearby)', 'faster'], ['team', 'Feat', 'fx']]);
});
