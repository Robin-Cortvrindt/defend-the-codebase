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

export function statsText(stats) {
  return Object.entries(stats).map(([k, v]) => `${k} ${v}`).join(', ');
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

function upgradeLine(game, dev, up) {
  const text = up.describeEffect ? up.describeEffect(game, dev)
    : up.stats ? statsText(up.stats) : up.description;
  return lines(text, 'upgrade', up.name);
}

export function devEffects(game, dev) {
  const def = getDeveloper(dev.type);
  const out = [];
  const ups = def?.upgrades;
  if (dev.level >= 1 && ups?.level2) {
    out.push(...collect('upgrade', ups.level2.id, 'upgrade', ups.level2.name, () => upgradeLine(game, dev, ups.level2)));
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
  const ev = game.activeEvent ? getEvent(game.activeEvent) : null;
  if (ev?.describeEffect) out.push(...collect('event', ev.id, 'event', ev.name, () => ev.describeEffect(game, dev)));
  return GROUPS.flatMap(g => out.filter(l => l.group === g));
}
