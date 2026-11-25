// Mailbox: new mail pops up as an offer for a few seconds; click it to accept the task into the
// Tasks section of the side panel. Finish a task and press Claim for drinks or, rarely, a free
// Claude. About 1 in 6 mails is phishing: it looks exactly like a real one until you claim it.
// Specs: docs/superpowers/specs/2026-11-25-mailbox-design.md and 2026-11-25-side-panel-design.md
//
// To add a task: add one line to TEMPLATES below.
import { registerFeature, getPowerup, getBugs, getDeveloper } from '../../engine/registry.js';
import { addEffect, spawnBug } from '../../engine/game.js';
import { addEachDrink, takeEachDrink, eachShare } from '../../engine/drinks.js';
import { on, emit } from '../../engine/events.js';
import { WIDTH, HEIGHT } from '../../engine/map.js';
import { registerSound, playSound } from '../../engine/sound.js';

export const MAX_MAILS = 4;
export const FIRST_MAIL_DELAY = 5;     // seconds after the game starts
export const MAIL_INTERVAL = 30;       // seconds of (scaled) game time between mails
export const PHISH_CHANCE = 1 / 6;
export const CLAUDE_REWARD_CHANCE = 1 / 8;
export const CLAUDE_STEAL = 100;       // total drinks a phished "free Claude" mail takes
export const LOCK_SECONDS = 10;        // how long a compromised developer is locked out
const FLASH_SECONDS = 0.4;
const RED = '#DC2626';
export const OFFER_SECONDS = 6;        // real seconds a new-mail offer stays up before it is missed
const ACTIVE_PHASES = ['building', 'wave', 'bell'];
const CLAIM_PHASES = ['building', 'wave', 'bell', 'review'];

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
  return { mails: [], offer: null, timer: FIRST_MAIL_DELAY, nextId: 1, vouchers: 0, locks: [], pendingMalware: 0, flash: 0 };
}

// ---------- offers: new mail pops up for OFFER_SECONDS and only becomes a task when clicked ----------
export function makeOffer(game) {
  const box = game.mailbox;
  if (!box || box.offer || box.mails.length >= MAX_MAILS) return null;
  const taken = new Set(box.mails.map(m => m.template));
  const pool = TEMPLATES.filter(t => !taken.has(t.id) && (t.available?.(game) ?? true));
  if (!pool.length) return null;
  const tpl = pool[Math.floor(game.random() * pool.length)];
  const phishing = game.random() < PHISH_CHANCE;
  const claude = getPowerup('claude') && game.random() < CLAUDE_REWARD_CHANCE;
  const mail = {
    id: box.nextId++, template: tpl.id, from: tpl.from, subject: '', target: tpl.target, progress: 0,
    reward: claude ? { kind: 'claude' } : { kind: 'drinks', amount: tpl.reward },
    phishing,
  };
  tpl.setup?.(mail, game);
  mail.subject = typeof tpl.subject === 'function' ? tpl.subject(mail) : tpl.subject;
  box.offer = { mail, remaining: OFFER_SECONDS };
  emit('mail:offered', { game, mail });
  return mail;
}

export function acceptOffer(game) {
  const box = game.mailbox;
  if (!box?.offer) return null;
  const { mail } = box.offer;
  box.offer = null;
  box.mails.unshift(mail);
  emit('mail:accepted', { game, mail });
  return mail;
}

export function missOffer(game) {
  const box = game.mailbox;
  if (!box?.offer) return;
  const { mail } = box.offer;
  box.offer = null;
  emit('mail:missed', { game, mail });
}

// Real seconds (not game time), so 10x speed never makes an offer uncatchable.
export function tickOffer(game, realDt) {
  const box = game.mailbox;
  if (!box?.offer) return;
  if (!ACTIVE_PHASES.includes(game.phase)) { missOffer(game); return; }
  box.offer.remaining -= realDt;
  if (box.offer.remaining <= 0) missOffer(game);
}

export function tickMailbox(game, dt) {
  const box = game.mailbox;
  if (!box) return;
  if (box.offer && !ACTIVE_PHASES.includes(game.phase)) missOffer(game);
  if (box.offer || !ACTIVE_PHASES.includes(game.phase) || box.mails.length >= MAX_MAILS) return;
  box.timer -= dt;
  if (box.timer <= 0) {
    makeOffer(game);
    box.timer = MAIL_INTERVAL;
  }
}

export const canClaim = game => CLAIM_PHASES.includes(game.phase);

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
  else addEachDrink(game, mail.reward.amount);
  const what = mail.reward.kind === 'claude' ? 'free Claude' : `+${eachShare(mail.reward.amount)} of each drink`;
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
  const each = takeEachDrink(game, stealAmount(mail));
  phished(game, `That wasn't ${mail.from}. ${each} of each drink gone.`);
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
  if (!canClaim(game)) return null;
  const i = box?.mails.findIndex(m => m.id === mailId) ?? -1;
  if (i < 0 || !isDone(box.mails[i])) return null;
  const [mail] = box.mails.splice(i, 1);
  if (mail.phishing) return applyPenalty(game, mail);
  payReward(game, mail);
  return 'reward';
}

// A free-Claude voucher lets Claude fire during its cooldown. The hook reads the voucher from the game.
export function wrapClaude() {
  const def = getPowerup('claude');
  if (!def || def.mailboxWrapped) return;
  def.skipCooldown = g => g.mailbox?.vouchers > 0;
  def.mailboxWrapped = true;
}

// Bus listeners. Called once at the top level (tests call it again after clearing the bus).
export function attachListeners() {
  for (const name of TRACKED) on(name, d => { if (d?.game?.mailbox) trackMail(d.game, name, d); });
  on('powerup:activated', ({ game, id, skippedCooldown }) => {
    if (id === 'claude' && skippedCooldown && game?.mailbox?.vouchers > 0) game.mailbox.vouchers--;
  });
  on('wave:start', ({ game }) => {
    const box = game?.mailbox;
    if (!box?.pendingMalware) return;
    const n = box.pendingMalware;
    box.pendingMalware = 0;
    spawnMalware(game, n);
  });
}
attachListeners();

// ---------- sounds and the feature ----------
registerSound('mail', (ctx, tone) => {
  tone({ freq: 880, type: 'triangle', dur: 0.12, vol: 0.08 });
  tone({ freq: 1320, type: 'triangle', start: 0.1, dur: 0.2, vol: 0.08 });
});
registerSound('phished', (ctx, tone) => tone({ freq: 520, type: 'sawtooth', dur: 0.5, vol: 0.06, to: 110 }));

// ---------- DOM: the Tasks section of the side panel (browser only) ----------
const HAS_DOM = typeof document !== 'undefined';
const HIGHLIGHT_MS = 1200;
let ui = null;            // { root, count, slot, list, card, bar, offerId, key, highlight }
let lastDraw = 0;         // performance.now() of the previous draw
let updatedSinceDraw = false;   // false between two draws means the game is paused

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const rewardText = mail => (mail.reward.kind === 'claude' ? 'Free Claude' : `+${eachShare(mail.reward.amount)} each`);
const blurFocus = () => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); };

function setupTasks(game) {
  ui = null;
  const root = document.getElementById('panel-tasks');
  if (!root) return;
  root.textContent = '';
  const head = el('div', 'sp-title', 'Tasks');
  const count = el('span', '', `0/${MAX_MAILS}`);
  head.append(count);
  const slot = el('div', 'mb-offer-slot');
  const list = el('div', 'mb-list');
  root.append(head, slot, list);
  list.addEventListener('click', ev => {
    const btn = ev.target.closest?.('.mb-claim');
    if (!btn || btn.disabled) return;
    const result = claimMail(game, Number(btn.dataset.id));
    if (result) playSound(result === 'reward' ? 'mail' : 'phished');
    blurFocus();
  });
  ui = { root, count, slot, list, card: null, bar: null, offerId: 0, key: null, rows: new Map(), highlight: { id: 0, until: 0 }, game };
}

function showOffer(mail) {
  ui.slot.textContent = '';
  // A real <button>: Enter and Space accept it, and input.js leaves focused buttons alone.
  const card = el('button', 'mb-offer');
  card.type = 'button';
  const row = el('span', 'mb-offer-row');
  row.append(el('small', '', rewardText(mail)), el('span', 'mb-accept', 'Click to accept'));
  const bar = el('i', 'mb-time');
  card.append(el('span', 'mb-from', `New mail · ${mail.from}`), el('b', '', mail.subject), row, bar);
  card.addEventListener('click', () => {
    const accepted = acceptOffer(ui.game);
    if (accepted) {
      playSound('mail');
      ui.highlight = { id: accepted.id, until: performance.now() + HIGHLIGHT_MS };
      hideOffer(true);   // accepted: the new task replaces the card at once (only a miss slides out)
    }
    blurFocus();
  });
  ui.slot.append(card);
  ui.card = card; ui.bar = bar; ui.offerId = mail.id;
  playSound('mail');
}

function hideOffer(immediate = false) {
  const card = ui.card;
  ui.card = null; ui.bar = null; ui.offerId = 0;
  if (!card) return;
  if (immediate) { card.remove(); return; }
  card.classList.add('leaving');
  setTimeout(() => card.remove(), 250);
}

// Rows are rebuilt only when the set of tasks or a task's done-state changes. Progress ticks update
// the bar and the "x/y" text in place, so a Claim button is never swapped out under the pointer.
function renderTasks(box) {
  ui.list.textContent = '';
  ui.rows = new Map();
  if (!box.mails.length) { ui.list.append(el('div', 'mb-empty', 'No tasks yet. Click new mail when it pops up to accept it.')); return; }
  for (const m of box.mails) {
    const row = el('div', 'mb-task');
    const bar = el('i'); const fill = el('b'); bar.append(fill);
    const text = el('small', '');
    const prog = el('div', 'mb-prog'); prog.append(bar, text);
    row.append(el('span', 'mb-from', m.from), el('span', 'mb-subj', m.subject), el('span', 'mb-rew', rewardText(m)), prog);
    let claim = null;
    if (isDone(m)) {
      claim = el('button', 'mb-claim', 'Claim');
      claim.type = 'button';
      claim.dataset.id = String(m.id);
      row.append(claim);
    }
    ui.list.append(row);
    ui.rows.set(m.id, { row, fill, text, claim });
  }
}

function updateTasks(box, claimable, now) {
  for (const m of box.mails) {
    const r = ui.rows.get(m.id);
    if (!r) continue;
    const width = `${Math.round((m.progress / m.target) * 100)}%`;
    if (r.fill.style.width !== width) r.fill.style.width = width;
    const text = `${m.progress}/${m.target}`;
    if (r.text.textContent !== text) r.text.textContent = text;
    if (r.claim && r.claim.disabled === claimable) r.claim.disabled = !claimable;
    const fresh = m.id === ui.highlight.id && now < ui.highlight.until;
    if (r.row.classList.contains('fresh') !== fresh) r.row.classList.toggle('fresh', fresh);
  }
}

function syncTasks(game, paused, now) {
  if (!ui || ui.game !== game || !game.mailbox) return;
  const box = game.mailbox;
  const count = `${box.mails.length}/${MAX_MAILS}`;
  if (ui.count.textContent !== count) ui.count.textContent = count;
  if (box.offer && box.offer.mail.id !== ui.offerId) showOffer(box.offer.mail);
  else if (!box.offer && ui.card) hideOffer();
  if (box.offer && ui.bar) ui.bar.style.width = `${Math.max(0, (box.offer.remaining / OFFER_SECONDS) * 100).toFixed(1)}%`;
  const key = box.mails.map(m => `${m.id}:${isDone(m) ? 1 : 0}`).join(',');
  if (key !== ui.key) { ui.key = key; renderTasks(box); }
  updateTasks(box, canClaim(game) && !paused, now);
}

const feature = {
  id: 'mailbox',
  init(game) {
    game.mailbox = createMailbox();
    wrapClaude();
    lastDraw = 0;
    updatedSinceDraw = false;
    if (HAS_DOM) setupTasks(game);
  },
  update(game, dt) {
    tickMailbox(game, dt);
    tickPenalties(game, dt);
    updatedSinceDraw = true;
  },
  // draw runs every frame, also while paused. The offer countdown uses real time here, and only
  // counts when the game advanced since the last draw, so pausing freezes it.
  draw(ctx, game) {
    drawPenalties(ctx, game);
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const paused = !updatedSinceDraw;
    const realDt = lastDraw && !paused ? Math.min(0.25, (now - lastDraw) / 1000) : 0;
    tickOffer(game, realDt);   // with 0 it still drops an offer outside active play
    lastDraw = now;
    updatedSinceDraw = false;
    if (HAS_DOM) syncTasks(game, paused, now);
  },
};
registerFeature(feature);
export default feature;
