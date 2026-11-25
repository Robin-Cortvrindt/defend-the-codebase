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

// ---------- Task 2: progress, claiming and real rewards ----------
import { TEMPLATES, trackMail, isDone, claimMail } from '../src/content/features/mailbox.js';
import { emit } from '../src/engine/events.js';
import { powerupCost } from '../src/engine/powerups.js';

// Deliver a specific template (real unless phishing: true, Warrants reward unless claude: true).
function give(id, { phishing = false, claude = false } = {}) {
  const open = new Set(g.mailbox.mails.map(m => m.template));
  const pool = TEMPLATES.filter(t => !open.has(t.id) && (t.available?.(g) ?? true));
  const i = pool.findIndex(t => t.id === id);
  g.random = rolls((i + 0.5) / pool.length, phishing ? 0 : 0.5, claude ? 0 : 0.5);
  const m = deliverMail(g);
  assert.equal(m.template, id);
  return m;
}
const stubClaude = () => R.registerPowerup({ id: 'claude', name: 'Claude', description: 'x', duration: 0, cooldown: 0, getCost: () => 150, activate() {} });

test('hire-dotnet counts only dotnet placements', () => {
  const m = give('hire-dotnet');
  emit('dev:placed', { game: g, dev: { type: 'react' } });
  emit('dev:placed', { game: g, dev: { type: 'dotnet' } });
  assert.equal(m.progress, 1);
});

test('progress caps at target', () => {
  const m = give('hire-react');
  for (let i = 0; i < 5; i++) trackMail(g, 'dev:placed', { game: g, dev: { type: 'react' } });
  assert.equal(m.progress, 2);
  assert.equal(isDone(m), true);
});

test('promote-consultant counts level 1 and up', () => {
  const m = give('promote-consultant');
  trackMail(g, 'dev:levelup', { game: g, dev: {}, level: 1 });
  assert.equal(isDone(m), true);
});

test('promote-senior ignores level 1', () => {
  const m = give('promote-senior');
  trackMail(g, 'dev:levelup', { game: g, dev: {}, level: 1 });
  assert.equal(m.progress, 0);
  trackMail(g, 'dev:levelup', { game: g, dev: {}, level: 2 });
  assert.equal(isDone(m), true);
});

test('squash-typo counts typo kills', () => {
  const m = give('squash-typo');
  trackMail(g, 'bug:killed', { game: g, bug: { type: 'legacy' } });
  trackMail(g, 'bug:killed', { game: g, bug: { type: 'typo' } });
  assert.equal(m.progress, 1);
});

test('claim before done returns null', () => {
  const m = give('hire-dotnet');
  assert.equal(claimMail(g, m.id), null);
  assert.equal(g.mailbox.mails.length, 1);
});

test('claim pays Warrants and removes the mail', () => {
  const m = give('hire-dotnet');
  m.progress = m.target;
  const w = g.warrants, earned = g.stats.warrantsEarned;
  assert.equal(claimMail(g, m.id), 'reward');
  assert.equal(g.warrants, w + 60);
  assert.equal(g.stats.warrantsEarned, earned + 60);
  assert.equal(g.mailbox.mails.length, 0);
  assert.ok(g.effects.some(e => e.kind === 'banner' && e.title === 'Reward claimed'));
});

test('second claim of the same mail returns null', () => {
  const m = give('hire-dotnet');
  m.progress = m.target;
  claimMail(g, m.id);
  const w = g.warrants;
  assert.equal(claimMail(g, m.id), null);
  assert.equal(g.warrants, w);
});

test('survive-sprints completes after 2 sprint:cleared, including one that leads into a quarter review', () => {
  const m = give('survive-sprints');
  emit('sprint:cleared', { game: g });
  g.phase = 'review';
  emit('sprint:cleared', { game: g });
  assert.equal(isDone(m), true);
});

test('no-leak needs a whole sprint after arrival', () => {
  const m = give('no-leak');
  trackMail(g, 'sprint:cleared', { game: g });
  assert.equal(m.progress, 0);
  trackMail(g, 'wave:start', { game: g });
  trackMail(g, 'sprint:cleared', { game: g });
  assert.equal(isDone(m), true);
});

test('no-leak fails when a bug leaks during the sprint', () => {
  const m = give('no-leak');
  trackMail(g, 'wave:start', { game: g });
  trackMail(g, 'bug:leaked', { game: g, bug: {} });
  trackMail(g, 'sprint:cleared', { game: g });
  assert.equal(m.progress, 0);
});

test('claude voucher makes Claude cost 0 and is spent on activation', () => {
  stubClaude(); mailbox.init(g);
  g.mailbox.vouchers = 1;
  assert.equal(powerupCost(g, 'claude'), 0);
  emit('powerup:activated', { game: g, id: 'claude' });
  assert.equal(g.mailbox.vouchers, 0);
  assert.equal(powerupCost(g, 'claude'), 150);
});

test('claiming a claude mail gives a voucher', () => {
  stubClaude(); mailbox.init(g);
  const m = give('hire-dotnet', { claude: true });
  assert.equal(m.reward.kind, 'claude');
  m.progress = m.target;
  assert.equal(claimMail(g, m.id), 'reward');
  assert.equal(g.mailbox.vouchers, 1);
});

test('no claude reward without a claude power-up', () => {
  g.random = () => 0;
  assert.equal(deliverMail(g).reward.kind, 'warrants');
});

test('wrapClaude does not double-wrap across inits', () => {
  stubClaude(); mailbox.init(g); mailbox.init(g);
  g.mailbox.vouchers = 1;
  assert.equal(powerupCost(g, 'claude'), 0);
  g.mailbox.vouchers = 0;
  assert.equal(powerupCost(g, 'claude'), 150);
});
