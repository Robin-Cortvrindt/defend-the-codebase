import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../src/engine/registry.js';
import { clearAll, emit, on } from '../src/engine/events.js';
import { createGame, startGame } from '../src/engine/game.js';
import retro, { createRetro, retroAwards, attachListeners } from '../src/content/features/retrospective.js';
import mailbox, { attachListeners as attachMailbox, makeOffer, acceptOffer, claimMail } from '../src/content/features/mailbox.js';

let g;
beforeEach(() => {
  R.resetRegistry(); clearAll(); attachListeners();
  R.registerDeveloper({ id: 'react', name: 'React', accent: '#2563EB', cost: 50, damage: 5, fireRate: 2, range: 2, counters: 'typo' });
  R.registerDeveloper({ id: 'java', name: 'Java', accent: '#EA580C', cost: 75, damage: 10, fireRate: 1, range: 2, counters: 'typo' });
  R.registerBug({ id: 'typo', name: 'Typo bug', hp: 10, speed: 10, livesLost: 1, reward: 1, radius: 5 });
  R.registerBug({ id: 'leak', name: 'Memory leak', hp: 10, speed: 10, livesLost: 1, reward: 1, radius: 5 });
  R.registerDrink({ id: 'coffee', name: 'Coffee', color: '#92400E' });
  R.registerDrink({ id: 'redbull', name: 'Red Bull', color: '#2563EB' });
  R.registerWaves([{ groups: [] }]);
  g = createGame(); startGame(g);
  retro.init(g);
});

const award = title => retroAwards(g).find(a => a.title === title);
const leak = type => emit('bug:leaked', { game: g, bug: { type } });

test('tallies leaks, phishing, drinks and Claude from events', () => {
  leak('typo'); leak('leak'); leak('leak');
  emit('mail:phished', { game: g, mail: {}, kind: 'stolen' });
  emit('drop:collected', { game: g, drop: { drink: 'coffee', amount: 4 } });
  emit('drop:collected', { game: g, drop: { drink: 'coffee', amount: 2 } });
  emit('powerup:activated', { game: g, id: 'claude' });
  emit('powerup:activated', { game: g, id: 'ceo' });
  emit('claude:backfire', { game: g });
  emit('game:lost', { game: g, info: { year: 2, quarter: 3, sprint: 4 } });
  const r = g.retro;
  assert.equal(r.leaks.typo.count, 1);
  assert.equal(r.leaks.leak.count, 2);
  assert.equal(r.phished, 1);
  assert.equal(r.drinks.coffee, 6);
  assert.equal(r.claudeUses, 1);
  assert.equal(r.claudeBackfires, 1);
  assert.deepEqual(r.info, { year: 2, quarter: 3, sprint: 4 });
});

test('events for a game without a tally are ignored', () => {
  assert.doesNotThrow(() => emit('bug:leaked', { game: {}, bug: { type: 'typo' } }));
});

test('MVP is the developer on the board with most kills', () => {
  g.devs = [{ id: 1, type: 'react', kills: 5 }, { id: 2, type: 'java', kills: 9 }];
  assert.equal(award('MVP developer').text, 'Java developer (Java) · 9 bugs squashed');
});

test('MVP uses the level-3 upgrade name when there is one', () => {
  g.devs = [{ id: 1, type: 'react', kills: 5, upgrade: { name: 'Next.js' } }];
  assert.equal(award('MVP developer').text, 'React developer (Next.js) · 5 bugs squashed');
});

test('MVP ignores sold developers', () => {
  g.devs = [{ id: 1, type: 'react', kills: 5 }];
  emit('dev:sold', { game: g, dev: { id: 2, type: 'java', kills: 50 }, refund: 0 });
  assert.match(award('MVP developer').text, /^React developer .* · 5 bugs squashed$/);
});

test('MVP tie goes to the lowest id', () => {
  g.devs = [{ id: 7, type: 'java', kills: 4 }, { id: 3, type: 'react', kills: 4 }];
  assert.match(award('MVP developer').text, /^React developer/);
});

test('MVP is skipped with no developers or no kills', () => {
  g.devs = [];
  assert.equal(award('MVP developer'), undefined);
  g.devs = [{ id: 1, type: 'react', kills: 0 }];
  assert.equal(award('MVP developer'), undefined);
});

test('Works on my machine picks the most leaked bug, tie to the first leaked', () => {
  leak('typo'); leak('leak'); leak('leak'); leak('leak');
  assert.equal(award('Works on my machine').text, 'Memory leak got through 3 times');
  retro.init(g);
  leak('leak'); leak('typo'); leak('typo'); leak('leak');
  assert.equal(award('Works on my machine').text, 'Memory leak got through 2 times');
});

test('Fell for it pluralises', () => {
  emit('mail:phished', { game: g, mail: {}, kind: 'malware' });
  assert.equal(award('Fell for it').text, '1 phishing mail. IT has been notified.');
  emit('mail:phished', { game: g, mail: {}, kind: 'stolen' });
  assert.equal(award('Fell for it').text, '2 phishing mails. IT has been notified.');
});

test('Caffeine intake lists drinks above 0 in registry order', () => {
  emit('drop:collected', { game: g, drop: { drink: 'redbull', amount: 3 } });
  emit('drop:collected', { game: g, drop: { drink: 'coffee', amount: 12 } });
  assert.equal(award('Caffeine intake').text, '12 Coffee · 3 Red Bull');
});

test('Asked Claude with and without backfires', () => {
  for (let i = 0; i < 3; i++) emit('powerup:activated', { game: g, id: 'claude' });
  assert.equal(award('Asked Claude').text, '3 times');
  emit('claude:backfire', { game: g });
  assert.equal(award('Asked Claude').text, '3 times · backfired 1 time');
});

test('Survived always shows, and empty awards are skipped', () => {
  const list = retroAwards(g);
  assert.deepEqual(list.map(a => a.title), ['Survived']);
  assert.equal(list[0].text, 'Year 1 · Q1 · Sprint 1 · 0 bugs squashed');
});

test('awards come in the agreed order', () => {
  g.devs = [{ id: 1, type: 'react', kills: 1 }];
  leak('typo');
  emit('mail:phished', { game: g, mail: {}, kind: 'stolen' });
  emit('drop:collected', { game: g, drop: { drink: 'coffee', amount: 1 } });
  emit('powerup:activated', { game: g, id: 'claude' });
  assert.deepEqual(retroAwards(g).map(a => a.title),
    ['MVP developer', 'Works on my machine', 'Fell for it', 'Caffeine intake', 'Asked Claude', 'Survived']);
});

test('unknown developer and bug types fall back to their id', () => {
  g.devs = [{ id: 1, type: 'cobol', kills: 2 }];
  leak('heisenbug');
  assert.match(award('MVP developer').text, /^cobol developer \(cobol\) · 2 bugs squashed$/);
  assert.equal(award('Works on my machine').text, 'heisenbug got through 1 time');
});

test('init resets the tally', () => {
  leak('typo');
  g.retro.shown = true;
  retro.init(g);
  assert.deepEqual(g.retro, createRetro());
});

test('mailbox emits mail:phished on a phishing claim', () => {
  attachMailbox();
  mailbox.init(g);
  g.phase = 'wave';
  const got = [];
  on('mail:phished', d => got.push(d));
  makeOffer(g);
  const m = acceptOffer(g);
  m.phishing = true; m.progress = m.target;
  g.warrants = 100;
  const kind = claimMail(g, m.id);
  assert.equal(got.length, 1);
  assert.equal(got[0].kind, kind);
  assert.equal(got[0].mail, m);
  assert.equal(g.retro.phished, 1);
});

test('one bug squashed is singular', () => {
  g.devs = [{ id: 1, type: 'react', kills: 1 }];
  g.stats.squashed = 1;
  assert.match(award('MVP developer').text, / · 1 bug squashed$/);
  assert.match(award('Survived').text, / · 1 bug squashed$/);
});
