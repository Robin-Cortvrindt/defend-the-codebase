// Mailbox: task mails trickle into an inbox. Finish a task and press Claim for Warrants or,
// rarely, a free Claude. About 1 in 6 mails is phishing: it looks exactly like a real one
// until you claim it. Spec: docs/superpowers/specs/2026-11-25-mailbox-design.md
//
// To add a task: add one line to TEMPLATES below.
import { registerFeature, getPowerup, getBugs, getDeveloper } from '../../engine/registry.js';
import { addWarrants, addEffect, spawnBug } from '../../engine/game.js';
import { on, emit } from '../../engine/events.js';
import { WIDTH, HEIGHT } from '../../engine/map.js';
import { registerSound, playSound } from '../../engine/sound.js';

export const MAX_MAILS = 4;
export const FIRST_MAIL_DELAY = 5;     // seconds after the game starts
export const MAIL_INTERVAL = 30;       // seconds of (scaled) game time between mails
export const PHISH_CHANCE = 1 / 6;
export const CLAUDE_REWARD_CHANCE = 1 / 8;
export const CLAUDE_STEAL = 100;       // Warrants a phished "free Claude" mail takes
export const LOCK_SECONDS = 10;        // how long a compromised developer is locked out
const FLASH_SECONDS = 0.4;
const RED = '#DC2626';
const ACTIVE_PHASES = ['building', 'wave', 'bell'];

const hire = type => ({ 'dev:placed': (m, d) => (d.dev?.type === type ? 1 : 0) });
const squash = type => ({ 'bug:killed': (m, d) => (d.bug?.type === type ? 1 : 0) });
const promote = level => ({ 'dev:levelup': (m, d) => (d.level >= level ? 1 : 0) });

// One line per task. `handlers` map a bus event to a progress increment.
export const TEMPLATES = [
  { id: 'hire-dotnet', from: 'HR', subject: 'Hire 3 .NET developers', target: 3, reward: 60, handlers: hire('dotnet') },
  { id: 'hire-react', from: 'HR', subject: 'Hire 2 React developers', target: 2, reward: 40, handlers: hire('react') },
  { id: 'hire-java', from: 'HR', subject: 'Hire 2 Java developers', target: 2, reward: 40, handlers: hire('java') },
  { id: 'promote-consultant', from: 'Training manager', subject: 'Upgrade a developer to level 2', target: 1, reward: 40, handlers: promote(1) },
  { id: 'promote-senior', from: 'Training manager', subject: 'Upgrade a developer to level 3', target: 1, reward: 80, handlers: promote(2) },
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

// ---------- phishing penalties ----------
export const stealAmount = mail => (mail.reward.kind === 'claude' ? CLAUDE_STEAL : mail.reward.amount);
export const malwareCount = game => Math.min(8, 3 + Math.floor(game.sprint / 3));

function phished(game, text) {
  game.mailbox.flash = FLASH_SECONDS;
  addEffect(game, { kind: 'banner', title: 'Phished', text, accent: RED, ttl: 3 });
}

// Malware must never end a run on its own: only one-life bugs, and always one life to spare.
const malwareTypes = () => getBugs().filter(b => !b.boss && (b.livesLost ?? 1) <= 1);
const safeMalware = (game, n) => Math.max(0, Math.min(n, game.lives - 1));

function spawnMalware(game, count) {
  const types = malwareTypes();
  if (!types.length) return 0;
  const n = safeMalware(game, count);
  for (let i = 0; i < n; i++) {
    const def = types[Math.floor(game.random() * types.length)];
    spawnBug(game, def.id, game.random() * 30);
  }
  return n;
}

function steal(game, mail) {
  const n = stealAmount(mail);
  game.warrants = Math.max(0, game.warrants - n);
  phished(game, `That wasn't ${mail.from}. ${n} Warrants gone.`);
  return 'stolen';
}

function malware(game, mail) {
  const n = safeMalware(game, malwareCount(game));
  if (n === 0 || !malwareTypes().length) return steal(game, mail);
  if (game.phase === 'wave') {
    spawnMalware(game, n);
    phished(game, `The attachment was malware. ${n} bugs incoming.`);
  } else {
    game.mailbox.pendingMalware += n;
    phished(game, `The attachment was malware. ${n} bugs next sprint.`);
  }
  return 'malware';
}

function compromise(game, mail) {
  if (!game.devs.length) return steal(game, mail);
  const dev = game.devs[Math.floor(game.random() * game.devs.length)];
  dev.cooldown = LOCK_SECONDS;
  game.mailbox.locks.push({ devId: dev.id });
  const name = getDeveloper(dev.type)?.name ?? 'developer';
  phished(game, `A ${name} developer gave away their password.`);
  return 'compromised';
}

export function applyPenalty(game, mail) {
  const kinds = [steal, malware, compromise];
  return kinds[Math.min(kinds.length - 1, Math.floor(game.random() * kinds.length))](game, mail);
}

function tickPenalties(game, dt) {
  const box = game.mailbox;
  if (!box) return;
  box.flash = Math.max(0, box.flash - dt);
  // A lock lasts as long as the developer is really idle. Dev cooldown only ticks during sprints,
  // so a lock made between sprints carries its padlock into the next sprint.
  box.locks = box.locks.filter(l => (game.devs.find(d => d.id === l.devId)?.cooldown ?? 0) > 0);
}

function drawPadlock(ctx, x, y) {
  ctx.fillStyle = 'rgba(0, 30, 50, 0.6)';
  ctx.fillRect(x - 16, y - 16, 32, 32);
  ctx.strokeStyle = '#E2E8F0'; ctx.fillStyle = '#E2E8F0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y - 3, 5, Math.PI, 0); ctx.stroke();
  ctx.fillRect(x - 7, y - 3, 14, 10);
  ctx.fillStyle = '#001E32'; ctx.fillRect(x - 1, y, 2, 4);
}

function drawPenalties(ctx, game) {
  const box = game.mailbox;
  if (!box) return;
  for (const lock of box.locks) {
    const dev = game.devs.find(d => d.id === lock.devId);
    if (dev) drawPadlock(ctx, dev.x, dev.y);
  }
  if (box.flash > 0) {
    ctx.fillStyle = `rgba(220, 38, 38, ${(0.25 * box.flash / FLASH_SECONDS).toFixed(3)})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

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
  // The bell (or the quarter review) shows up in the bottom-right corner where the inbox opens: close it.
  on('sprint:cleared', ({ game }) => { if (game?.mailbox) game.mailbox.open = false; });
  on('wave:start', ({ game }) => {
    const box = game?.mailbox;
    if (!box?.pendingMalware) return;
    const n = box.pendingMalware;
    box.pendingMalware = 0;
    spawnMalware(game, n);
  });
}
attachListeners();

// ---------- DOM: inbox card, panel, new-mail popup (browser only) ----------
const HAS_DOM = typeof document !== 'undefined';
const VISIBLE_PHASES = ACTIVE_PHASES;
const TOAST_MS = 4000;
let dom = null;   // { panel, list, foot, toast, toastTimer, key }

const CSS = `
.mb-inbox { position: absolute; bottom: 4px; right: 10px; max-height: calc(100% - 12px); width: min(290px, 60%); display: flex; flex-direction: column; overflow: hidden;
  background: rgba(0, 30, 50, .97); border: 1px solid #123650; border-radius: 10px; line-height: 1.3; z-index: 5; font-family: Lato, system-ui, sans-serif; }
.mb-inbox[hidden], .mb-toast[hidden] { display: none; }
.mb-inbox header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #123650; }
.mb-inbox header b { font-size: 13px; }
.mb-inbox header small { font-size: 11px; color: #94A3B8; margin-left: 6px; }
.mb-close { background: none; border: 0; color: #94A3B8; font-size: 12px; padding: 2px 4px; }
.mb-close:hover { color: #fff; }
.mb-list { overflow: auto; flex: 1; }
.mb-empty { padding: 14px 12px; font-size: 12px; color: #94A3B8; }
.mb-mail { padding: 8px 12px; border-bottom: 1px solid #123650; display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; }
.mb-from { font-size: 10px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #94A3B8; }
.mb-subj { font-size: 12px; font-weight: 700; grid-column: 1; }
.mb-mail.unread .mb-subj::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #EA580C; margin-right: 6px; vertical-align: 1px; }
.mb-rew { font-size: 11px; font-weight: 900; color: #4ADE80; grid-row: 1 / 3; grid-column: 2; align-self: center; text-align: right; white-space: nowrap; }
.mb-prog { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.mb-prog i { flex: 1; height: 5px; border-radius: 3px; background: #123650; overflow: hidden; }
.mb-prog i b { display: block; height: 100%; background: #2563EB; }
.mb-prog small { font-size: 10px; color: #94A3B8; min-width: 32px; text-align: right; }
.mb-claim { grid-column: 1 / -1; margin-top: 5px; background: #16A34A; border: 0; border-radius: 6px; color: #fff; font-size: 11px; font-weight: 700; padding: 5px 0; }
.mb-claim:hover { background: #15803D; }
.mb-foot { padding: 6px 12px; font-size: 10px; color: #94A3B8; border-top: 1px solid #123650; }
.mb-toast { position: absolute; bottom: 4px; right: 10px; width: min(260px, 55%); display: flex; flex-direction: column; gap: 1px; cursor: pointer; z-index: 6;
  background: rgba(0, 30, 50, .97); border: 1px solid #123650; border-left: 3px solid #16A34A; border-radius: 8px; padding: 8px 12px; line-height: 1.3;
  box-shadow: 0 6px 18px rgba(0, 0, 0, .35); font-family: Lato, system-ui, sans-serif; animation: mb-in .25s ease-out; }
.mb-toast b { font-size: 13px; }
.mb-toast small { font-size: 11px; color: #4ADE80; }
.mb-toast::after { content: ""; position: absolute; bottom: -7px; right: var(--mb-arrow, 40px); width: 12px; height: 12px; background: rgb(0, 30, 50);
  border-right: 1px solid #123650; border-bottom: 1px solid #123650; transform: rotate(45deg); }
@keyframes mb-in { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
#powerups .pu.feature.mb-card { overflow: visible; }
.mb-badge { position: absolute; top: -7px; right: -7px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: #EA580C; color: #fff;
  font-size: 10px; font-weight: 900; display: flex; align-items: center; justify-content: center; }
.mb-badge[hidden] { display: none; }
`;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const rewardText = mail => (mail.reward.kind === 'claude' ? 'Free Claude' : `+${mail.reward.amount} W`);
const blurFocus = () => { if (HAS_DOM && document.activeElement instanceof HTMLElement) document.activeElement.blur(); };

function openInbox(game, open) {
  const box = game.mailbox;
  if (!box) return;
  box.open = open;
  if (open) for (const m of box.mails) m.unread = false;
  hideToast();
}

function setupDom(game) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  if (!document.getElementById('mailbox-style')) {
    const style = el('style'); style.id = 'mailbox-style'; style.textContent = CSS;
    document.head.append(style);
  }
  if (!dom) {
    const panel = el('div', 'mb-inbox');
    const head = el('header');
    const title = el('div'); title.append(el('b', '', 'Inbox'), el('small', 'mb-count', ''));
    const close = el('button', 'mb-close', 'Close');
    close.addEventListener('click', () => { if (dom.game) openInbox(dom.game, false); blurFocus(); });
    head.append(title, close);
    const list = el('div', 'mb-list');
    const foot = el('div', 'mb-foot');
    panel.append(head, list, foot);
    list.addEventListener('click', ev => {
      const btn = ev.target.closest?.('.mb-claim');
      if (!btn || !dom.game) return;
      const result = claimMail(dom.game, Number(btn.dataset.id));
      if (result) playSound(result === 'reward' ? 'mail' : 'phished');
      blurFocus();
    });
    const toast = el('div', 'mb-toast');
    toast.hidden = true;
    toast.addEventListener('click', () => { if (dom.game) openInbox(dom.game, true); });
    stage.append(panel, toast);
    dom = { panel, list, foot, count: title.querySelector('.mb-count'), toast, toastTimer: 0, key: '', game };
  }
  dom.game = game;
  dom.key = '';
  dom.list.textContent = '';
  hideToast();
}

const inboxCard = () => [...document.querySelectorAll('#powerups .pu.feature')].find(c => c.querySelector('b')?.textContent === 'Inbox');

// Pin an element to the bottom of the board with its right edge in line with the Inbox card.
// Returns the card's rect so callers can place extras such as the popup's arrow.
function placeAboveCard(elem) {
  const card = inboxCard();
  const stage = elem.parentElement;
  if (!card || !stage) return null;
  const s = stage.getBoundingClientRect(), c = card.getBoundingClientRect();
  const right = `${Math.max(0, Math.round(s.right - c.right))}px`;
  if (elem.style.right !== right) elem.style.right = right;
  return c;
}

// The popup also gets an arrow pointing down at the middle of the card.
function placeToast() {
  const c = placeAboveCard(dom.toast);
  if (!c) return;
  const arrow = `${Math.round(Math.min(c.width / 2, 120)) - 6}px`;
  if (dom.toast.style.getPropertyValue('--mb-arrow') !== arrow) dom.toast.style.setProperty('--mb-arrow', arrow);
}

function hideToast() {
  if (!dom) return;
  clearTimeout(dom.toastTimer);
  dom.toast.hidden = true;
}

function showToast(game, mail) {
  if (!dom || dom.game !== game || game.mailbox.open || !VISIBLE_PHASES.includes(game.phase)) return;
  dom.toast.textContent = '';
  dom.toast.append(el('span', 'mb-from', `New mail · ${mail.from}`), el('b', '', mail.subject), el('small', '', `${rewardText(mail)} · click to open the inbox`));
  dom.toast.hidden = false;
  placeToast();
  clearTimeout(dom.toastTimer);
  dom.toastTimer = setTimeout(hideToast, TOAST_MS);
  playSound('mail');
}

function renderList(box) {
  dom.list.textContent = '';
  if (!box.mails.length) { dom.list.append(el('div', 'mb-empty', 'No mail yet')); return; }
  for (const m of box.mails) {
    const row = el('div', `mb-mail${m.unread ? ' unread' : ''}`);
    const bar = el('i'); const fill = el('b'); fill.style.width = `${Math.round((m.progress / m.target) * 100)}%`; bar.append(fill);
    const prog = el('div', 'mb-prog'); prog.append(bar, el('small', '', `${m.progress}/${m.target}`));
    row.append(el('span', 'mb-from', m.from), el('span', 'mb-subj', m.subject), el('span', 'mb-rew', rewardText(m)), prog);
    if (isDone(m)) { const claim = el('button', 'mb-claim', 'Claim'); claim.dataset.id = String(m.id); row.append(claim); }
    dom.list.append(row);
  }
}

function syncCard(box) {
  const card = inboxCard();
  if (!card) return;
  const unread = box.mails.filter(m => m.unread).length;
  card.classList.add('mb-card');
  const hint = card.querySelector('small');
  const text = `${unread} new · ${box.mails.length}/${MAX_MAILS}`;
  if (hint && hint.textContent !== text) hint.textContent = text;
  let badge = card.querySelector('.mb-badge');
  if (!badge) { badge = el('span', 'mb-badge'); card.append(badge); }
  if (badge.textContent !== String(unread)) badge.textContent = String(unread);
  badge.hidden = unread === 0;
}

function syncDom(game) {
  if (!HAS_DOM || !dom || dom.game !== game || !game.mailbox) return;
  const box = game.mailbox;
  syncCard(box);
  const visible = box.open && VISIBLE_PHASES.includes(game.phase);
  if (dom.panel.hidden === visible) dom.panel.hidden = !visible;
  if (!VISIBLE_PHASES.includes(game.phase)) hideToast();
  else if (!dom.toast.hidden) placeToast();   // keeps it in place if the window is resized
  if (!visible) return;
  placeAboveCard(dom.panel);
  if (box.open) for (const m of box.mails) m.unread = false;
  const key = box.mails.map(m => `${m.id}:${m.progress}:${m.unread ? 1 : 0}`).join(',');
  if (key !== dom.key) { dom.key = key; renderList(box); }
  dom.count.textContent = `${box.mails.length} of ${MAX_MAILS}`;
  const foot = box.mails.length >= MAX_MAILS ? 'Inbox full · new mail paused' : `Next mail in ${Math.max(0, Math.ceil(box.timer))} s`;
  if (dom.foot.textContent !== foot) dom.foot.textContent = foot;
}

registerSound('mail', (ctx, tone) => {
  tone({ freq: 880, type: 'triangle', dur: 0.12, vol: 0.08 });
  tone({ freq: 1320, type: 'triangle', start: 0.1, dur: 0.2, vol: 0.08 });
});
registerSound('phished', (ctx, tone) => tone({ freq: 520, type: 'sawtooth', dur: 0.5, vol: 0.06, to: 110 }));
if (HAS_DOM) on('mail:received', ({ game, mail }) => showToast(game, mail));

const feature = {
  id: 'mailbox',
  init(game) {
    game.mailbox = createMailbox();
    wrapClaude();
    if (HAS_DOM) setupDom(game);
  },
  update(game, dt) { tickMailbox(game, dt); tickPenalties(game, dt); },
  // draw runs every frame, also while paused, so it keeps the DOM in step too.
  draw(ctx, game) { drawPenalties(ctx, game); syncDom(game); },
  hudButtons: [{
    label: 'Inbox', hint: `0 new · 0/${MAX_MAILS}`,
    onClick(game) { if (game.mailbox) openInbox(game, !game.mailbox.open); blurFocus(); },
  }],
};
registerFeature(feature);
export default feature;
