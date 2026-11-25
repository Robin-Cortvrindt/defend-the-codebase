// Sprint retrospective: when a run ends (lost or quit), a card with some fun stats about it.
// Spec: docs/superpowers/specs/2026-11-25-sprint-retrospective-design.md
import { registerFeature, getDeveloper, getBug, getDrinks } from '../../engine/registry.js';
import { on } from '../../engine/events.js';
import { sprintInfo, deathAnimDone } from '../../engine/game.js';
import { levelName } from '../../engine/devs.js';

// ---------- tally (from bus events) ----------
export function createRetro() {
  return { leaks: {}, phished: 0, drinks: {}, claudeUses: 0, claudeBackfires: 0, info: null, shown: false };
}

let leakOrder = 0;   // ties on "Works on my machine" go to the bug that leaked first

export function attachListeners() {
  const tally = (name, fn) => on(name, data => { if (data?.game?.retro) fn(data.game.retro, data); });
  tally('bug:leaked', (r, { bug }) => {
    const entry = r.leaks[bug.type] ??= { count: 0, first: leakOrder++ };
    entry.count++;
  });
  tally('mail:phished', r => { r.phished++; });
  tally('drop:collected', (r, { drop }) => { r.drinks[drop.drink] = (r.drinks[drop.drink] ?? 0) + (drop.amount ?? 0); });
  tally('powerup:activated', (r, { id }) => { if (id === 'claude') r.claudeUses++; });
  tally('claude:backfire', r => { r.claudeBackfires++; });
  tally('game:lost', (r, { info }) => { if (info) r.info = info; });
}
attachListeners();

// ---------- awards ----------
const times = n => `${n} time${n === 1 ? '' : 's'}`;
const bugs = n => `${n} bug${n === 1 ? "" : "s"} squashed`;

function mvp(game) {
  let best = null;
  for (const dev of game.devs) {
    if (!(dev.kills > 0)) continue;
    if (!best || dev.kills > best.kills || (dev.kills === best.kills && dev.id < best.id)) best = dev;
  }
  if (!best) return null;
  const type = getDeveloper(best.type)?.name ?? best.type;
  return `${type} developer (${levelName(best) ?? type}) · ${bugs(best.kills)}`;
}

function mostLeaked(r) {
  let best = null;
  for (const [type, e] of Object.entries(r.leaks)) {
    if (!best || e.count > best.count || (e.count === best.count && e.first < best.first)) best = { type, ...e };
  }
  if (!best) return null;
  return `${getBug(best.type)?.name ?? best.type} got through ${times(best.count)}`;
}

function caffeine(r) {
  const known = getDrinks().map(d => d.id);
  const ids = [...known, ...Object.keys(r.drinks).filter(id => !known.includes(id))];
  const parts = ids.filter(id => r.drinks[id] > 0).map(id => `${r.drinks[id]} ${getDrinks().find(d => d.id === id)?.name ?? id}`);
  return parts.length ? parts.join(' · ') : null;
}

export function retroAwards(game) {
  const r = game.retro ?? createRetro();
  const info = r.info ?? sprintInfo(game.sprint);
  const list = [
    ['MVP developer', mvp(game)],
    ['Works on my machine', mostLeaked(r)],
    ['Fell for it', r.phished > 0 ? `${r.phished} phishing mail${r.phished === 1 ? '' : 's'}. IT has been notified.` : null],
    ['Caffeine intake', caffeine(r)],
    ['Asked Claude', r.claudeUses > 0 ? `${times(r.claudeUses)}${r.claudeBackfires > 0 ? ` · backfired ${times(r.claudeBackfires)}` : ''}` : null],
    ['Survived', `Year ${info.year} · Q${info.quarter} · Sprint ${info.sprint} · ${bugs(game.stats?.squashed ?? 0)}`],
  ];
  return list.filter(([, text]) => text).map(([title, text]) => ({ title, text }));
}

// ---------- the card (browser only) ----------
const HAS_DOM = typeof document !== 'undefined';
let closeCard = null;  // closes the open card and removes its key listener
let previous = null;   // the game before the last init: a quit run goes straight to the menu, so its card shows then

const CSS = `
.rt-card { position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 12px;
  background: rgba(0, 30, 50, .9); line-height: 1.4; font-family: Lato, system-ui, sans-serif; }
.rt-panel { width: min(560px, 100%); max-height: 100%; overflow-y: auto; background: var(--navy); border: 1px solid var(--navy3);
  border-left: 3px solid var(--green); border-radius: 12px; padding: 18px 22px; }
.rt-panel h2 { margin: 4px 0 14px; font-size: clamp(18px, 2.4vw, 24px); font-weight: 900; }
.rt-list { display: grid; grid-template-columns: auto 1fr; gap: 8px 18px; margin: 0 0 18px; }
.rt-award { display: contents; }
.rt-award b { font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--s400); padding-top: 2px; white-space: nowrap; }
.rt-award span { font-size: 14px; color: #fff; }
.rt-actions { display: flex; justify-content: flex-end; }
@media (max-width: 720px) { .rt-list { grid-template-columns: 1fr; gap: 2px; } .rt-award span { margin-bottom: 8px; } }
`;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function showCard(game) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  if (!document.getElementById('rt-style')) {
    const style = el('style'); style.id = 'rt-style'; style.textContent = CSS;
    document.head.append(style);
  }
  closeCard?.();   // never two cards (or two key listeners) at once
  const info = game.retro?.info ?? sprintInfo(game.sprint);
  const card = el('div', 'rt-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Sprint retrospective');
  const panel = el('div', 'rt-panel');
  const list = el('div', 'rt-list');
  for (const a of retroAwards(game)) {
    const row = el('div', 'rt-award');
    row.append(el('b', '', a.title), el('span', '', a.text));
    list.append(row);
  }
  card.setAttribute('aria-modal', 'true');
  const go = el('button', 'btn primary big rt-continue', 'Continue →');
  go.type = 'button';
  // While the card is open it owns the keyboard, wherever focus is (a click on the dimmed backdrop
  // moves focus to the page): Space, Enter and Escape close it, every other key is swallowed so the
  // game underneath never starts a run or a sprint. Held-down repeats are ignored.
  const onKey = ev => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (!ev.repeat && (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'Escape')) close();
  };
  const close = () => { window.removeEventListener('keydown', onKey, true); card.remove(); if (closeCard === close) closeCard = null; };
  closeCard = close;
  window.addEventListener('keydown', onKey, true);
  go.addEventListener('click', close);
  const actions = el('div', 'rt-actions'); actions.append(go);
  panel.append(el('div', 'eyebrow', 'Sprint retrospective'), el('h2', '', `Year ${info.year} · Q${info.quarter} · Sprint ${info.sprint}`), list, actions);
  card.append(panel);
  stage.append(card);
  go.focus();
}

// ---------- feature ----------
const feature = {
  id: 'retrospective',
  init(game) {
    // A quit run goes straight back to the menu (a fresh game, so init runs): show its card over the menu.
    if (HAS_DOM && previous && previous !== game && previous.phase === 'lost' && previous.quit && previous.retro && !previous.retro.shown) {
      previous.retro.shown = true;
      showCard(previous);
    }
    previous = game;
    game.retro = createRetro();
  },
  // A lost run: show the card once the building has collapsed, the moment the game-over screen appears underneath.
  draw(ctx, game) {
    if (!HAS_DOM || !game.retro || game.retro.shown) return;
    if (game.phase === 'lost' && !game.quit && deathAnimDone(game)) {
      game.retro.shown = true;
      showCard(game);
    }
  },
};
registerFeature(feature);
export default feature;
