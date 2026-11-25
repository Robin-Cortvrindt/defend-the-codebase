// While the bell waits between sprints, nothing about the team can change (Robin's rule).
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll } from '../src/engine/events.js';
import { createGame, startGame, startWave, isLocked, lockedView } from '../src/engine/game.js';
import { placeDev, sellDev, buyUpgrade } from '../src/engine/devs.js';
import { usePowerup } from '../src/engine/powerups.js';
import mailbox, { makeOffer, acceptOffer, tickOffer, claimMail, canClaim, offerHeld } from '../src/content/features/mailbox.js';
import { registerTestDrinks } from './helpers/drinks.js';

let g;
beforeEach(() => {
  R.resetRegistry(); clearAll(); registerTestDrinks();
  R.registerDeveloper({ id: 'u', drink: 'coffee', cost: 10, damage: 10, fireRate: 1, range: 2, counters: 'small',
    upgrades: { level2: { id: 'two', name: 'Two', cost: 5, description: 'd', stats: { damage: 20 } }, level3: [] } });
  R.registerPowerup({ id: 'ceo', name: 'CEO', description: 'd', duration: 5, cooldown: 10, activate() {} });
  R.registerBug({ id: 'small', hp: 100, speed: 0, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([{ groups: [] }, { groups: [] }, { groups: [] }]);
  g = createGame(); startGame(g); startWave(g); g.spawnQueue = [];
  mailbox.init(g);
  g.random = () => 0.5;
});

const doneMail = () => { makeOffer(g); const m = acceptOffer(g); m.progress = m.target; return m; };

test('isLocked is true only while the bell waits', () => {
  for (const phase of ['building', 'wave', 'review', 'menu', 'lost']) { g.phase = phase; assert.equal(isLocked(g), false, phase); }
  g.phase = 'bell';
  assert.equal(isLocked(g), true);
});

test('during the bell no developer can be hired', () => {
  g.phase = 'bell';
  assert.equal(placeDev(g, 'u', 3, 3), null);
  assert.equal(g.devs.length, 0);
  g.phase = 'wave';
  assert.ok(placeDev(g, 'u', 3, 3));
});

test('during the bell no developer can be sold', () => {
  const d = placeDev(g, 'u', 3, 3);
  g.phase = 'bell';
  assert.equal(sellDev(g, d), 0);
  assert.equal(g.devs.length, 1);
  g.phase = 'wave';
  assert.ok(sellDev(g, d) > 0);
});

test('during the bell no developer can be upgraded', () => {
  const d = placeDev(g, 'u', 3, 3); d.xp = 10;
  g.phase = 'bell';
  assert.equal(buyUpgrade(g, d, 'two'), false);
  assert.equal(d.level, 0);
  g.phase = 'wave';
  assert.equal(buyUpgrade(g, d, 'two'), true);
});

test('during the bell power-ups stay unusable', () => {
  g.phase = 'bell';
  assert.equal(usePowerup(g, 'ceo'), false);
});

test('during the bell finished mail cannot be claimed', () => {
  const m = doneMail();
  g.phase = 'bell';
  assert.equal(canClaim(g), false);
  assert.equal(claimMail(g, m.id), null);
  g.phase = 'wave';
  assert.equal(claimMail(g, m.id), 'reward');
});

test('an offer showing at the bell waits: no accept, its countdown pauses, then it resumes', () => {
  makeOffer(g);
  const left = g.mailbox.offer.remaining;
  g.phase = 'bell';
  assert.equal(acceptOffer(g), null);
  tickOffer(g, 5);
  assert.ok(g.mailbox.offer, 'still showing');
  assert.equal(g.mailbox.offer.remaining, left);
  g.phase = 'wave';
  assert.ok(acceptOffer(g));
});

test('offerHeld tells the card to show it waits for the bell', () => {
  assert.equal(offerHeld(g), false);
  makeOffer(g);
  assert.equal(offerHeld(g), false);
  g.phase = 'bell';
  assert.equal(offerHeld(g), true);
});

test('bell clears selection and hire mode', () => {
  const view = { selected: { id: 1 }, hire: 'u', speed: 2, paused: false };
  assert.deepEqual(lockedView(view), { selected: null, hire: null, speed: 2, paused: false });
});
