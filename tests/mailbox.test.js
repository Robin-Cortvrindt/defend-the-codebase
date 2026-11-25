import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import mailbox, {
  createMailbox, deliverMail, tickMailbox, attachListeners,
  MAX_MAILS, FIRST_MAIL_DELAY, MAIL_INTERVAL, PHISH_CHANCE,
} from '../src/content/features/mailbox.js';

let g;

beforeEach(() => {
  R.resetRegistry(); clearAll(); attachListeners();
  R.registerBug({ id: 'typo', hp: 10, speed: 100, livesLost: 1, reward: 1, radius: 5 });
  R.registerWaves([
    { groups: [{ bug: 'typo', count: 1, interval: 1, delay: 0 }] },
    { groups: [{ bug: 'typo', count: 1, interval: 1, delay: 0 }] },
    { groups: [{ bug: 'typo', count: 1, interval: 1, delay: 0 }] },
  ]);
  g = createGame(); startGame(g);
  mailbox.init(g);
  g.random = () => 0.5;
});

// Scripted random: returns the given rolls in order, then repeats the last one.
function rolls(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('constants match the spec', () => {
  assert.equal(MAX_MAILS, 4);
  assert.equal(FIRST_MAIL_DELAY, 5);
  assert.equal(MAIL_INTERVAL, 30);
  assert.equal(PHISH_CHANCE, 1 / 6);
});

test('first mail arrives after 5 s', () => {
  tickMailbox(g, 4.9);
  assert.equal(g.mailbox.mails.length, 0);
  tickMailbox(g, 0.2);
  assert.equal(g.mailbox.mails.length, 1);
});

test('then one every 30 s', () => {
  tickMailbox(g, 5);
  assert.equal(g.mailbox.mails.length, 1);
  tickMailbox(g, 29.9);
  assert.equal(g.mailbox.mails.length, 1);
  tickMailbox(g, 0.2);
  assert.equal(g.mailbox.mails.length, 2);
});

test('inbox caps at 4 and the timer pauses while full', () => {
  for (let i = 0; i < 4; i++) deliverMail(g);
  const timer = g.mailbox.timer;
  tickMailbox(g, 100);
  assert.equal(g.mailbox.mails.length, 4);
  assert.equal(g.mailbox.timer, timer);
  assert.equal(deliverMail(g), null);
});

test('timer does not run in menu, review or lost', () => {
  for (const phase of ['menu', 'review', 'lost']) {
    g.phase = phase;
    tickMailbox(g, 100);
    assert.equal(g.mailbox.mails.length, 0, phase);
    assert.equal(g.mailbox.timer, FIRST_MAIL_DELAY, phase);
  }
});

test('timer runs in building, wave and bell', () => {
  for (const phase of ['building', 'wave', 'bell']) {
    mailbox.init(g);
    g.phase = phase;
    tickMailbox(g, 5);
    assert.equal(g.mailbox.mails.length, 1, phase);
  }
});

test('no template open twice', () => {
  g.random = () => 0;
  for (let i = 0; i < 4; i++) deliverMail(g);
  const ids = g.mailbox.mails.map(m => m.template);
  assert.equal(new Set(ids).size, 4);
});

test('phishing roll uses PHISH_CHANCE', () => {
  g.random = rolls(0, 0.1);
  assert.equal(deliverMail(g).phishing, true);
  g.random = rolls(0, 0.5);
  assert.equal(deliverMail(g).phishing, false);
});

test('a new mail is unread, starts at 0 and has a Warrants reward', () => {
  const m = deliverMail(g);
  assert.equal(m.unread, true);
  assert.equal(m.progress, 0);
  assert.ok(m.target > 0);
  assert.equal(m.reward.kind, 'warrants');
  assert.ok(m.reward.amount > 0);
  assert.ok(m.from && m.subject);
});

test('deliverMail emits mail:received', () => {
  let got = null;
  on('mail:received', d => { got = d; });
  const m = deliverMail(g);
  assert.equal(got.game, g);
  assert.equal(got.mail, m);
});

test('init resets state', () => {
  deliverMail(g); deliverMail(g);
  g.mailbox.vouchers = 2;
  g.mailbox.pendingMalware = 3;
  g.mailbox.locks.push({ devId: 1, until: 10 });
  g.mailbox.open = true;
  mailbox.init(g);
  assert.deepEqual(g.mailbox, createMailbox());
});
