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

// ---------- Task 3: phishing penalties ----------
import { applyPenalty, stealAmount, malwareCount, LOCK_SECONDS, CLAUDE_STEAL } from '../src/content/features/mailbox.js';

const PENALTY = { stolen: 0.1, malware: 0.5, compromised: 0.9 };
// A finished phishing mail, ready to claim; the next random roll picks the penalty.
function phish(kind, opts = {}) {
  const m = give('hire-dotnet', { phishing: true, ...opts });
  m.progress = m.target;
  g.random = rolls(PENALTY[kind], 0.5);
  return m;
}
function addDev(id, type = 'dotnet') {
  const dev = { id, type, col: 0, row: 0, x: 20, y: 20, level: 0, xp: 0, cooldown: 0, kills: 0 };
  g.devs.push(dev);
  return dev;
}
const banners = () => g.effects.filter(e => e.kind === 'banner');
const noopCtx = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });

test('constants for penalties match the spec', () => {
  assert.equal(LOCK_SECONDS, 10);
  assert.equal(CLAUDE_STEAL, 100);
});

test('stolen subtracts the reward and floors at 0', () => {
  let m = phish('stolen');
  g.warrants = 100;
  assert.equal(claimMail(g, m.id), 'stolen');
  assert.equal(g.warrants, 40);
  m = phish('stolen');
  g.warrants = 10;
  claimMail(g, m.id);
  assert.equal(g.warrants, 0);
});

test('stolen claude mail costs 100', () => {
  stubClaude(); mailbox.init(g);
  const m = phish('stolen', { claude: true });
  assert.equal(stealAmount(m), 100);
  g.warrants = 250;
  claimMail(g, m.id);
  assert.equal(g.warrants, 150);
});

test('malware spawns min(8, 3 + floor(sprint/3)) non-boss bugs during a sprint', () => {
  R.registerBug({ id: 'boss', boss: true, hp: 300, speed: 10, livesLost: 5, reward: 30, radius: 18 });
  g.phase = 'wave';
  g.sprint = 6;
  assert.equal(malwareCount(g), 5);
  const m = phish('malware');
  assert.equal(claimMail(g, m.id), 'malware');
  assert.equal(g.bugs.length, 5);
  assert.ok(g.bugs.every(b => b.type !== 'boss'));
  g.sprint = 30;
  assert.equal(malwareCount(g), 8);
});

test('malware outside a sprint is queued and spawns on wave:start', () => {
  g.phase = 'bell';
  const m = phish('malware');
  claimMail(g, m.id);
  assert.equal(g.bugs.length, 0);
  assert.equal(g.mailbox.pendingMalware, 3);
  assert.ok(banners().some(b => b.text.includes('next sprint')));
  emit('wave:start', { game: g, wave: 1 });
  assert.equal(g.bugs.length, 3);
  assert.equal(g.mailbox.pendingMalware, 0);
});

test('compromised locks one developer for 10 s', () => {
  R.registerDeveloper({ id: 'dotnet', name: '.NET', accent: '#C026D3', cost: 100, damage: 10, fireRate: 1, range: 2, counters: 'typo' });
  const dev = addDev(7);
  g.time = 3;
  const m = phish('compromised');
  assert.equal(claimMail(g, m.id), 'compromised');
  assert.equal(dev.cooldown, 10);
  assert.deepEqual(g.mailbox.locks, [{ devId: 7, until: 13 }]);
  assert.ok(banners().some(b => b.title === 'Phished' && b.text.includes('.NET')));
});

test('compromised falls back to stolen with no developers', () => {
  const m = phish('compromised');
  g.warrants = 100;
  assert.equal(claimMail(g, m.id), 'stolen');
  assert.equal(g.warrants, 40);
});

test('phishing claim shows a Phished banner, a red flash and no reward', () => {
  const m = phish('stolen');
  const earned = g.stats.warrantsEarned;
  claimMail(g, m.id);
  assert.ok(banners().some(b => b.title === 'Phished'));
  assert.ok(!banners().some(b => b.title === 'Reward claimed'));
  assert.equal(g.stats.warrantsEarned, earned);
  assert.ok(g.mailbox.flash > 0);
});

test('applyPenalty is exported and returns the kind', () => {
  const m = give('hire-dotnet', { phishing: true });
  g.random = rolls(PENALTY.stolen);
  assert.equal(applyPenalty(g, m), 'stolen');
});

test('lock expires after 10 s of game time', () => {
  addDev(7);
  const m = phish('compromised');
  claimMail(g, m.id);
  g.time += 10.1;
  mailbox.update(g, 0.016);
  assert.equal(g.mailbox.locks.length, 0);
});

test('lock is dropped when its developer is sold', () => {
  addDev(7);
  const m = phish('compromised');
  claimMail(g, m.id);
  g.devs = [];
  mailbox.update(g, 0.016);
  assert.equal(g.mailbox.locks.length, 0);
  assert.doesNotThrow(() => mailbox.draw(noopCtx(), g));
});

test('draw does not throw with a lock and a flash', () => {
  addDev(7);
  const m = phish('compromised');
  claimMail(g, m.id);
  assert.doesNotThrow(() => mailbox.draw(noopCtx(), g));
});
