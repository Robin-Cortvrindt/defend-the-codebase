// Collects every effect acting on a developer, for the hover card. DOM-free.
// Content supplies describeEffect(game, dev, level?) hooks; this module only gathers and orders them.
import { getDeveloper, getInvestments, getPowerups, getEvent, getFeatures } from './registry.js';
import { powerupState } from './powerups.js';
import { CELL } from './map.js';

export const GROUPS = ['upgrade', 'team', 'investment', 'powerup', 'event'];

export function pctText(factor) {
  const n = Math.round((factor - 1) * 100);
  return `${n < 0 ? '−' : '+'}${Math.abs(n)}%`;
}

export function ordinal(n) {
  const mod100 = n % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix}`;
}

const STAT_LABELS = {
  damage: v => `damage ${v}`,
  fireRate: v => `attack speed ${v}/s`,
  range: v => `range ${v}`,
};

export function statsText(stats) {
  return Object.entries(stats).map(([k, v]) => (STAT_LABELS[k] ? STAT_LABELS[k](v) : `${k} ${v}`)).join(', ');
}

// Normalises a hook result into lines; skips empty ones.
function lines(result, group, name) {
  const out = [];
  for (const r of [].concat(result ?? [])) {
    const item = typeof r === 'string' ? { text: r } : r;
    if (!item || !item.text) continue;
    out.push({ group: item.group || group, name: item.name || name, text: item.text });
  }
  return out;
}

function collect(kind, id, group, name, fn) {
  try { return lines(fn(), group, name); } catch (e) { console.error(`[effects ${kind} ${id}]`, e); return []; }
}

// `overriddenBy` = the level-3 upgrade's stats: level-2 stats it replaces no longer apply.
function upgradeLine(game, dev, up, overriddenBy = null) {
  let text;
  if (up.describeEffect) text = up.describeEffect(game, dev);
  else if (up.stats) {
    const kept = Object.fromEntries(Object.entries(up.stats).filter(([k]) => !(overriddenBy && k in overriddenBy)));
    text = Object.keys(kept).length ? statsText(kept) : up.description;
  } else text = up.description;
  return lines(text, 'upgrade', up.name);
}

export function devEffects(game, dev) {
  const def = getDeveloper(dev.type);
  const out = [];
  const ups = def?.upgrades;
  if (dev.level >= 1 && ups?.level2) {
    out.push(...collect('upgrade', ups.level2.id, 'upgrade', ups.level2.name, () => upgradeLine(game, dev, ups.level2, dev.level === 2 ? dev.upgrade?.stats : null)));
  }
  if (dev.level === 2 && dev.upgrade) {
    out.push(...collect('upgrade', dev.upgrade.id, 'upgrade', dev.upgrade.name, () => upgradeLine(game, dev, dev.upgrade)));
  }
  if (def?.describeEffect) {
    out.push(...collect('developer', def.id, 'team', def.name, () => def.describeEffect(game, dev)));
  }
  const seen = new Set();
  for (const other of game.devs) {
    const up = other.upgrade;
    const aura = up?.aura;
    if (other === dev || !aura?.describe || seen.has(up.id)) continue;
    if (Math.hypot(other.x - dev.x, other.y - dev.y) > aura.radius * CELL) continue;
    seen.add(up.id);
    out.push(...collect('aura', up.id, 'team', `${up.name} (nearby)`, () => aura.describe(game, dev)));
  }
  for (const f of getFeatures()) {
    if (f.describeEffect) out.push(...collect('feature', f.id, 'team', f.name, () => f.describeEffect(game, dev)));
  }
  for (const inv of getInvestments()) {
    const level = game.investmentLevels?.[inv.id] || 0;
    if (!inv.describeEffect || level <= 0) continue;
    out.push(...collect('investment', inv.id, 'investment', `${inv.name} ${level}`, () => inv.describeEffect(game, dev, level)));
  }
  for (const p of getPowerups()) {
    if (!p.describeEffect || !powerupState(game, p.id).active) continue;
    out.push(...collect('powerup', p.id, 'powerup', p.name, () => p.describeEffect(game, dev)));
  }
  if (game.activeEvent) {
    out.push(...collect('event', game.activeEvent, 'event', game.activeEvent, () => {
      const ev = getEvent(game.activeEvent);
      return ev?.describeEffect ? lines(ev.describeEffect(game, dev), 'event', ev.name) : null;
    }));
  }
  return GROUPS.flatMap(g => out.filter(l => l.group === g));
}
