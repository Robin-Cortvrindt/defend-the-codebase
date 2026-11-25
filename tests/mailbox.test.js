import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, on } from '../src/engine/events.js';
import { registerTestDrinks } from './helpers/drinks.js';
import { createGame, startGame } from '../src/engine/game.js';
import mailbox, {
  createMailbox, makeOffer, acceptOffer, tickOffer, missOffer, canClaim, tickMailbox, attachListeners,
  MAX_MAILS, FIRST_MAIL_DELAY, MAIL_INTERVAL, PHISH_CHANCE, OFFER_SECONDS,
} from '../src/content/features/mailbox.js';

let g;

beforeEach(() => {
  R.resetRegistry(); clearAll(); registerTestDrinks(); attachListeners();
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
// Make an offer and accept it straight away.
const takeOffer = () => { makeOffer(g); return acceptOffer(g); };
const events = name => { const got = []; on(name, d => got.push(d)); return got; };

test('constants match the spec', () => {
  assert.equal(MAX_MAILS, 4);
  assert.equal(FIRST_MAIL_DELAY, 5);
  assert.equal(MAIL_INTERVAL, 30);
  assert.equal(PHISH_CHANCE, 1 / 6);
  assert.equal(OFFER_SECONDS, 6);
});

test('the timer makes an offer, not a task', () => {
  tickMailbox(g, 4.9);
  assert.equal(g.mailbox.offer, null);
  tickMailbox(g, 0.2);
  assert.ok(g.mailbox.offer);
  assert.equal(g.mailbox.offer.remaining, OFFER_SECONDS);
  assert.equal(g.mailbox.mails.length, 0);
});

test('makeOffer emits mail:offered', () => {
  const got = events('mail:offered');
  const m = makeOffer(g);
  assert.equal(got.length, 1);
  assert.equal(got[0].mail, m);
  assert.equal(got[0].game, g);
});

test('accepting an offer adds the task at the front with progress 0', () => {
  takeOffer();
  const got = events('mail:accepted');
  const m = makeOffer(g);
  assert.equal(acceptOffer(g), m);
  assert.equal(g.mailbox.offer, null);
  assert.equal(g.mailbox.mails[0], m);
  assert.equal(m.progress, 0);
  assert.equal(got.length, 1);
  assert.equal(got[0].mail, m);
});

test('acceptOffer without an offer returns null', () => {
  assert.equal(acceptOffer(g), null);
});

test('an offer expires after 6 real seconds and adds nothing', () => {
  const got = events('mail:missed');
  const m = makeOffer(g);
  tickOffer(g, 5.9);
  assert.ok(g.mailbox.offer);
  tickOffer(g, 0.2);
  assert.equal(g.mailbox.offer, null);
  assert.equal(g.mailbox.mails.length, 0);
  assert.equal(got.length, 1);
  assert.equal(got[0].mail, m);
});

test('missOffer drops the offer', () => {
  makeOffer(g);
  missOffer(g);
  assert.equal(g.mailbox.offer, null);
  assert.equal(g.mailbox.mails.length, 0);
});

test('game time does not expire an offer', () => {
  makeOffer(g);
  tickMailbox(g, 1000);
  assert.ok(g.mailbox.offer);
  assert.equal(g.mailbox.offer.remaining, OFFER_SECONDS);
});

test('no new offer while one is pending', () => {
  const m = makeOffer(g);
  assert.equal(makeOffer(g), null);
  tickMailbox(g, 100);
  assert.equal(g.mailbox.offer.mail.id, m.id);
});

test('the next offer comes 30 s after the previous one was made', () => {
  tickMailbox(g, 5);
  missOffer(g);
  tickMailbox(g, 29.9);
  assert.equal(g.mailbox.offer, null);
  tickMailbox(g, 0.2);
  assert.ok(g.mailbox.offer);
});

test('no offers while 4 tasks are accepted', () => {
  for (let i = 0; i < 4; i++) takeOffer();
  assert.equal(g.mailbox.mails.length, 4);
  assert.equal(makeOffer(g), null);
  const timer = g.mailbox.timer;
  tickMailbox(g, 100);
  assert.equal(g.mailbox.offer, null);
  assert.equal(g.mailbox.timer, timer);
});

test('timer does not run in menu, review or lost', () => {
  for (const phase of ['menu', 'review', 'lost']) {
    g.phase = phase;
    tickMailbox(g, 100);
    assert.equal(g.mailbox.offer, null, phase);
    assert.equal(g.mailbox.timer, FIRST_MAIL_DELAY, phase);
  }
});

test('timer runs in building, wave and bell', () => {
  for (const phase of ['building', 'wave', 'bell']) {
    mailbox.init(g);
    g.phase = phase;
    tickMailbox(g, 5);
    assert.ok(g.mailbox.offer, phase);
  }
});

test('no template offered twice: accepted tasks and the pending offer are excluded', () => {
  g.random = () => 0;
  for (let i = 0; i < 3; i++) takeOffer();
  makeOffer(g);
  const ids = [...g.mailbox.mails.map(m => m.template), g.mailbox.offer.mail.template];
  assert.equal(new Set(ids).size, 4);
});

test('phishing roll uses PHISH_CHANCE', () => {
  g.random = rolls(0, 0.1);
  assert.equal(makeOffer(g).phishing, true);
  missOffer(g);
  g.random = rolls(0, 0.5);
  assert.equal(makeOffer(g).phishing, false);
});

test('an accepted task starts at 0 and has a drinks reward', () => {
  const m = takeOffer();
  assert.equal(m.progress, 0);
  assert.ok(m.target > 0);
  assert.equal(m.reward.kind, 'drinks');
  assert.ok(m.reward.amount > 0);
  assert.ok(m.from && m.subject);
  assert.equal('unread' in m, false);
});

test('an offer pending when the review opens is missed', () => {
  const got = events('mail:missed');
  makeOffer(g);
  g.phase = 'review';
  tickMailbox(g, 0.016);
  assert.equal(g.mailbox.offer, null);
  assert.equal(got.length, 1);
  makeOffer(g);                         // makeOffer itself does not check the phase
  g.phase = 'menu';
  tickOffer(g, 0.016);
  assert.equal(g.mailbox.offer, null);
  assert.equal(got.length, 2);
});

test('canClaim is true only while playing', () => {
  for (const phase of ['building', 'wave', 'bell', 'review']) { g.phase = phase; assert.equal(canClaim(g), true, phase); }
  for (const phase of ['menu', 'lost']) { g.phase = phase; assert.equal(canClaim(g), false, phase); }
});

test('init resets state', () => {
  takeOffer(); takeOffer();
  makeOffer(g);
  g.mailbox.vouchers = 2;
  g.mailbox.pendingMalware = 3;
  g.mailbox.locks.push({ devId: 1 });
  mailbox.init(g);
  assert.deepEqual(g.mailbox, createMailbox());
  assert.equal(g.mailbox.offer, null);
});

test('the mailbox no longer adds a HUD button', () => {
  assert.equal(mailbox.hudButtons, undefined);
});

// ---------- Task 2: progress, claiming and real rewards ----------
import { TEMPLATES, trackMail, isDone, claimMail } from '../src/content/features/mailbox.js';
import { emit } from '../src/engine/events.js';
import { usePowerup, powerupState } from '../src/engine/powerups.js';

// Offer and accept a specific template (real unless phishing: true, Warrants reward unless claude: true).
function give(id, { phishing = false, claude = false } = {}) {
  const open = new Set(g.mailbox.mails.map(m => m.template));
  const pool = TEMPLATES.filter(t => !open.has(t.id) && (t.available?.(g) ?? true));
  const i = pool.findIndex(t => t.id === id);
  g.random = rolls((i + 0.5) / pool.length, phishing ? 0 : 0.5, claude ? 0 : 0.5);
  makeOffer(g);
  const m = acceptOffer(g);
  assert.equal(m.template, id);
  return m;
}
const stubClaude = () => R.registerPowerup({ id: 'claude', name: 'Claude', description: 'x', duration: 0, cooldown: 90, activate() {} });

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

test('claim pays each drink and removes the mail', () => {
  const m = give('hire-dotnet');
  m.progress = m.target;
  assert.equal(claimMail(g, m.id), 'reward');
  assert.deepEqual(g.drinks, { coffee: 70, monster: 70, redbull: 70 });
  assert.ok(g.effects.some(e => e.kind === 'banner' && e.text.includes('+20 of each drink')));
  assert.equal(g.mailbox.mails.length, 0);
  assert.ok(g.effects.some(e => e.kind === 'banner' && e.title === 'Reward claimed'));
});

test('second claim of the same mail returns null', () => {
  const m = give('hire-dotnet');
  m.progress = m.target;
  claimMail(g, m.id);
  const before = { ...g.drinks };
  assert.equal(claimMail(g, m.id), null);
  assert.deepEqual(g.drinks, before);
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

test('claude voucher lets Claude fire during its cooldown and is spent only then', () => {
  stubClaude(); mailbox.init(g);
  g.phase = 'wave';
  powerupState(g, 'claude').cooldownLeft = 50;
  g.mailbox.vouchers = 1;
  assert.equal(usePowerup(g, 'claude'), true);
  assert.equal(g.mailbox.vouchers, 0);
  assert.equal(usePowerup(g, 'claude'), false);
});

test('using Claude off cooldown keeps the voucher', () => {
  stubClaude(); mailbox.init(g);
  g.phase = 'wave';
  g.mailbox.vouchers = 1;
  assert.equal(usePowerup(g, 'claude'), true);
  assert.equal(g.mailbox.vouchers, 1);
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
  assert.equal(makeOffer(g).reward.kind, 'drinks');
});

test('wrapClaude does not double-wrap across inits', () => {
  stubClaude(); mailbox.init(g); mailbox.init(g);
  const hook = R.getPowerup('claude').skipCooldown;
  mailbox.init(g);
  assert.equal(R.getPowerup('claude').skipCooldown, hook);
  g.mailbox.vouchers = 1;
  assert.equal(hook(g), true);
  g.mailbox.vouchers = 0;
  assert.equal(hook(g), false);
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

test('stolen takes the reward split across drinks and floors each at 0', () => {
  const m = phish('stolen');
  g.drinks = { coffee: 50, monster: 50, redbull: 5 };
  assert.equal(claimMail(g, m.id), 'stolen');
  assert.deepEqual(g.drinks, { coffee: 30, monster: 30, redbull: 0 });
  assert.ok(banners().some(b => b.text.includes('20 of each drink gone')));
});

test('stolen claude mail takes 34 of each drink', () => {
  stubClaude(); mailbox.init(g);
  const m = phish('stolen', { claude: true });
  assert.equal(stealAmount(m), 100);
  claimMail(g, m.id);
  assert.deepEqual(g.drinks, { coffee: 16, monster: 16, redbull: 16 });
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
  assert.deepEqual(g.mailbox.locks, [{ devId: 7 }]);
  assert.ok(banners().some(b => b.title === 'Phished' && b.text.includes('.NET')));
});

test('compromised falls back to stolen with no developers', () => {
  const m = phish('compromised');
  assert.equal(claimMail(g, m.id), 'stolen');
  assert.deepEqual(g.drinks, { coffee: 30, monster: 30, redbull: 30 });
});

test('phishing claim shows a Phished banner, a red flash and no reward', () => {
  const m = phish('stolen');
  claimMail(g, m.id);
  assert.ok(banners().some(b => b.title === 'Phished'));
  assert.ok(!banners().some(b => b.title === 'Reward claimed'));
  assert.ok(g.mailbox.flash > 0);
});

test('applyPenalty is exported and returns the kind', () => {
  const m = give('hire-dotnet', { phishing: true });
  g.random = rolls(PENALTY.stolen);
  assert.equal(applyPenalty(g, m), 'stolen');
});

test('lock ends when the developer can fire again', () => {
  const dev = addDev(7);
  const m = phish('compromised');
  claimMail(g, m.id);
  dev.cooldown = 0;   // tickDevs counted the 10 s down during the sprint
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

// ---------- Final review fixes ----------
test('a lock made between sprints lasts until the developer can fire again', () => {
  const dev = addDev(7);
  g.phase = 'bell';
  const m = phish('compromised');
  claimMail(g, m.id);
  g.time += 30;                       // game time passes in the bell, but dev cooldown does not tick
  mailbox.update(g, 0.016);
  assert.equal(g.mailbox.locks.length, 1);
  dev.cooldown = 0;                   // the developer has served the lock during the next sprint
  mailbox.update(g, 0.016);
  assert.equal(g.mailbox.locks.length, 0);
});

test('malware only spawns one-life bugs', () => {
  R.registerBug({ id: 'legacy', hp: 200, speed: 25, livesLost: 3, reward: 8, radius: 14 });
  g.phase = 'wave';
  g.random = rolls(0.99);
  const m = give('hire-dotnet', { phishing: true });
  m.progress = m.target;
  g.random = rolls(PENALTY.malware, 0.99);
  claimMail(g, m.id);
  assert.ok(g.bugs.length > 0);
  assert.ok(g.bugs.every(b => b.type === 'typo'));
});

test('malware can never cost the last life on its own', () => {
  g.phase = 'wave';
  g.lives = 3;
  const m = phish('malware');
  claimMail(g, m.id);
  assert.equal(g.bugs.length, 2);
});

test('malware with one life left steals instead', () => {
  g.phase = 'wave';
  g.lives = 1;
  const m = phish('malware');
  assert.equal(claimMail(g, m.id), 'stolen');
  assert.equal(g.bugs.length, 0);
});

test('queued malware is capped by lives when it spawns', () => {
  g.phase = 'bell';
  const m = phish('malware');
  claimMail(g, m.id);
  g.lives = 2;
  emit('wave:start', { game: g, wave: 1 });
  assert.equal(g.bugs.length, 1);
});

// ---------- Side panel: offers, phishing and when Claim works ----------
test('a phishing offer can be accepted and penalises only on Claim', () => {
  const m = give('hire-dotnet', { phishing: true });
  assert.equal(m.phishing, true);
  assert.deepEqual(g.drinks, { coffee: 50, monster: 50, redbull: 50 });
  m.progress = m.target;
  g.random = rolls(0.1);
  assert.equal(claimMail(g, m.id), 'stolen');
  assert.deepEqual(g.drinks, { coffee: 30, monster: 30, redbull: 30 });
});

test('claim is refused on the start and game-over screens', () => {
  for (const phase of ['menu', 'lost']) {
    mailbox.init(g);
    g.phase = 'wave';
    const m = give('hire-dotnet');
    m.progress = m.target;
    g.phase = phase;
      assert.equal(claimMail(g, m.id), null, phase);
    assert.equal(g.mailbox.mails.length, 1, phase);
  }
});

test('claim works during the quarter review', () => {
  const m = give('hire-dotnet');
  m.progress = m.target;
  g.phase = 'review';
  assert.equal(claimMail(g, m.id), 'reward');
});
