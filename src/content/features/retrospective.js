// Sprint retrospective: when a run ends (lost or quit), a card with some fun stats about it.
// Spec: docs/superpowers/specs/2026-11-25-sprint-retrospective-design.md
import { registerFeature, getDeveloper, getBug, getDrinks } from '../../engine/registry.js';
import { on } from '../../engine/events.js';
import { sprintInfo } from '../../engine/game.js';
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

function mvp(game) {
  let best = null;
  for (const dev of game.devs) {
    if (!(dev.kills > 0)) continue;
    if (!best || dev.kills > best.kills || (dev.kills === best.kills && dev.id < best.id)) best = dev;
  }
  if (!best) return null;
  const type = getDeveloper(best.type)?.name ?? best.type;
  return `${type} developer (${levelName(best) ?? type}) · ${best.kills} bugs squashed`;
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
    ['Survived', `Year ${info.year} · Q${info.quarter} · Sprint ${info.sprint} · ${game.stats?.squashed ?? 0} bugs squashed`],
  ];
  return list.filter(([, text]) => text).map(([title, text]) => ({ title, text }));
}

// ---------- feature ----------
const feature = {
  id: 'retrospective',
  init(game) {
    game.retro = createRetro();
  },
};
registerFeature(feature);
export default feature;
