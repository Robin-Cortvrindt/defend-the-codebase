// Mailbox: task mails trickle into an inbox. Finish a task and press Claim for Warrants or,
// rarely, a free Claude. About 1 in 6 mails is phishing: it looks exactly like a real one
// until you claim it. Spec: docs/superpowers/specs/2026-11-25-mailbox-design.md
//
// To add a task: add one line to TEMPLATES below.
import { registerFeature, getPowerup } from '../../engine/registry.js';
import { addWarrants, addEffect } from '../../engine/game.js';
import { on, emit } from '../../engine/events.js';

export const MAX_MAILS = 4;
export const FIRST_MAIL_DELAY = 5;     // seconds after the game starts
export const MAIL_INTERVAL = 30;       // seconds of (scaled) game time between mails
export const PHISH_CHANCE = 1 / 6;
export const CLAUDE_REWARD_CHANCE = 1 / 8;
const ACTIVE_PHASES = ['building', 'wave', 'bell'];

const hire = type => ({ 'dev:placed': (m, d) => (d.dev?.type === type ? 1 : 0) });
const squash = type => ({ 'bug:killed': (m, d) => (d.bug?.type === type ? 1 : 0) });
const promote = level => ({ 'dev:levelup': (m, d) => (d.level >= level ? 1 : 0) });

// One line per task. `handlers` map a bus event to a progress increment.
export const TEMPLATES = [
  { id: 'hire-dotnet', from: 'HR', subject: 'Hire 3 .NET developers', target: 3, reward: 60, handlers: hire('dotnet') },
  { id: 'hire-react', from: 'HR', subject: 'Hire 2 React developers', target: 2, reward: 40, handlers: hire('react') },
  { id: 'hire-java', from: 'HR', subject: 'Hire 2 Java developers', target: 2, reward: 40, handlers: hire('java') },
  { id: 'promote-consultant', from: 'Training manager', subject: 'Promote a developer to Consultant', target: 1, reward: 40, handlers: promote(1) },
  { id: 'promote-senior', from: 'Training manager', subject: 'Promote a developer to Senior Consultant', target: 1, reward: 80, handlers: promote(2) },
  { id: 'squash-typo', from: 'IT service desk', subject: 'Squash 25 typo bugs', target: 25, reward: 50, handlers: squash('typo') },
  { id: 'squash-nullpointer', from: 'IT service desk', subject: 'Squash 15 null pointers', target: 15, reward: 50, handlers: squash('nullpointer') },
  { id: 'squash-legacy', from: 'IT service desk', subject: 'Squash 8 legacy bugs', target: 8, reward: 60, handlers: squash('legacy') },
  { id: 'survive-sprints', from: 'CEO', subject: 'Survive 2 more sprints', target: 2, reward: 50, handlers: { 'sprint:cleared': () => 1 } },
  { id: 'no-leak', from: 'Business manager', subject: 'Clear a sprint without a single leak', target: 1, reward: 70, handlers: {
    'wave:start': m => { m.armed = true; m.leaked = false; return 0; },
    'bug:leaked': m => { m.leaked = true; return 0; },
    'sprint:cleared': m => (m.armed && !m.leaked ? 1 : 0),
  } },
];
const TRACKED = [...new Set(TEMPLATES.flatMap(t => Object.keys(t.handlers)))];
const templateOf = mail => TEMPLATES.find(t => t.id === mail.template);

export function createMailbox() {
  return { mails: [], timer: FIRST_MAIL_DELAY, nextId: 1, vouchers: 0, locks: [], pendingMalware: 0, open: false, flash: 0 };
}

export function deliverMail(game) {
  const box = game.mailbox;
  if (!box || box.mails.length >= MAX_MAILS) return null;
  const open = new Set(box.mails.map(m => m.template));
  const pool = TEMPLATES.filter(t => !open.has(t.id) && (t.available?.(game) ?? true));
  if (!pool.length) return null;
  const tpl = pool[Math.floor(game.random() * pool.length)];
  const phishing = game.random() < PHISH_CHANCE;
  const claude = getPowerup('claude') && game.random() < CLAUDE_REWARD_CHANCE;
  const mail = {
    id: box.nextId++, template: tpl.id, from: tpl.from, subject: '', target: tpl.target, progress: 0,
    reward: claude ? { kind: 'claude' } : { kind: 'warrants', amount: tpl.reward },
    phishing, unread: true,
  };
  tpl.setup?.(mail, game);
  mail.subject = typeof tpl.subject === 'function' ? tpl.subject(mail) : tpl.subject;
  box.mails.push(mail);
  emit('mail:received', { game, mail });
  return mail;
}

export function tickMailbox(game, dt) {
  const box = game.mailbox;
  if (!box || !ACTIVE_PHASES.includes(game.phase) || box.mails.length >= MAX_MAILS) return;
  box.timer -= dt;
  if (box.timer <= 0) {
    deliverMail(game);
    box.timer = MAIL_INTERVAL;
  }
}

export const isDone = mail => mail.progress >= mail.target;

export function trackMail(game, eventName, data) {
  for (const mail of game.mailbox?.mails ?? []) {
    const handler = templateOf(mail)?.handlers[eventName];
    if (!handler || isDone(mail)) continue;
    const inc = handler(mail, data, game) || 0;
    mail.progress = Math.min(mail.target, mail.progress + inc);
  }
}

function payReward(game, mail) {
  if (mail.reward.kind === 'claude') game.mailbox.vouchers++;
  else addWarrants(game, mail.reward.amount);
  const what = mail.reward.kind === 'claude' ? 'free Claude' : `+${mail.reward.amount} Warrants`;
  addEffect(game, { kind: 'banner', title: 'Reward claimed', text: `${mail.from}: ${what}`, accent: '#16A34A', ttl: 2.5 });
}

// Phishing penalties arrive in the next step; until then a phishing claim simply pays nothing.
function applyPenalty() { return 'stolen'; }

export function claimMail(game, mailId) {
  const box = game.mailbox;
  const i = box?.mails.findIndex(m => m.id === mailId) ?? -1;
  if (i < 0 || !isDone(box.mails[i])) return null;
  const [mail] = box.mails.splice(i, 1);
  if (mail.phishing) return applyPenalty(game, mail);
  payReward(game, mail);
  return 'reward';
}

// A free-Claude voucher makes Claude's next use cost 0. The wrap reads the voucher from the game.
export function wrapClaude() {
  const def = getPowerup('claude');
  if (!def || def.mailboxWrapped) return;
  const original = def.getCost;
  def.getCost = g => (g.mailbox?.vouchers > 0 ? 0 : original?.call(def, g) ?? 0);
  def.mailboxWrapped = true;
}

// Bus listeners. Called once at the top level (tests call it again after clearing the bus).
export function attachListeners() {
  for (const name of TRACKED) on(name, d => { if (d?.game?.mailbox) trackMail(d.game, name, d); });
  on('powerup:activated', ({ game, id }) => {
    if (id === 'claude' && game?.mailbox?.vouchers > 0) game.mailbox.vouchers--;
  });
}
attachListeners();

const feature = {
  id: 'mailbox',
  init(game) { game.mailbox = createMailbox(); wrapClaude(); },
  update(game, dt) { tickMailbox(game, dt); },
  hudButtons: [{ label: 'Inbox', hint: '0 new · 0/4', onClick(game) { if (game.mailbox) game.mailbox.open = !game.mailbox.open; } }],
};
registerFeature(feature);
export default feature;
