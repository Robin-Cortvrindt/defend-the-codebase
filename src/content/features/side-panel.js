// Side panel: the Building and Developers sections of the permanent panel right of the board.
// The Tasks section belongs to mailbox.js. Spec: docs/superpowers/specs/2026-11-25-side-panel-design.md
import { registerFeature, getUpgrades, getDevelopers } from '../../engine/registry.js';
import { upgradeLevel } from '../../engine/upgrades.js';
import { drawDevTile } from '../../engine/render.js';

// ---------- plain helpers (tested in Node) ----------
export const buildingInfo = game => ({ floors: game.floors, lives: game.lives, maxLives: game.maxLives, warrants: game.warrants });

export const buildingRows = game => getUpgrades()
  .filter(def => def.id !== 'floor')
  .map(def => ({ id: def.id, name: def.name, description: def.description, level: upgradeLevel(game, def.id), maxLevel: def.maxLevel ?? 3 }));

export function upgradeSummary(game) {
  const rows = buildingRows(game);
  return { levels: rows.reduce((s, r) => s + r.level, 0), max: rows.reduce((s, r) => s + r.maxLevel, 0) };
}

export const devCounts = game => getDevelopers().map(def => ({
  id: def.id, name: def.name, accent: def.accent, count: game.devs.filter(d => d.type === def.id).length,
}));

// ---------- DOM (browser only) ----------
const HAS_DOM = typeof document !== 'undefined';
let keys = { building: '', devs: '' };

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
const title = text => el('div', 'sp-title', text);
// Short tile labels for the known upgrades; any other upgrade uses the first word of its name.
const SHORT = { aircon: 'Aircon', heating: 'Heating', coffee: 'Coffee', fridge: 'Fridge', generator: 'Power', water: 'Water', trap: 'Trap' };
const shortName = r => SHORT[r.id] ?? String(r.name).split(' ')[0];
const kv = (label, value, cls = '') => { const row = el('div', 'sp-kv'); row.append(el('span', '', label), el('b', cls, String(value))); return row; };

function renderBuilding(sec, game) {
  const info = buildingInfo(game);
  const rows = buildingRows(game);
  const sum = upgradeSummary(game);
  sec.textContent = '';
  sec.append(title('Nexios building'), kv('Floors', info.floors), kv('Production', `${info.lives} / ${info.maxLives}`));
  const share = info.maxLives > 0 ? info.lives / info.maxLives : 0;
  const bar = el('div', `sp-bar${share <= 0.4 ? ' low' : ''}`);
  const fill = el('i'); fill.style.width = `${Math.round(Math.max(0, Math.min(1, share)) * 100)}%`; bar.append(fill);
  sec.append(bar, kv('Warrants', info.warrants, 'sp-warrants'));
  // Compact: one row of small tiles (short label + pips); the full name and counter are in the tooltip.
  const tiles = el('div', 'sp-upgs');
  for (const r of rows) {
    const tile = el('span', 'sp-upg');
    tile.title = `${r.name} · ${r.description ?? ''} · level ${r.level} of ${r.maxLevel}`;
    const pips = el('span', 'sp-pips');
    for (let i = 0; i < r.maxLevel; i++) pips.append(el('i', i < r.level ? 'on' : ''));
    tile.append(el('span', 'sp-upg-name', shortName(r)), pips);
    tiles.append(tile);
  }
  sec.append(tiles);
  sec.append(el('div', 'sp-summary', `Upgrades: ${sum.levels} of ${sum.max} levels`));
}

function devIcon(def) {
  const cv = el('canvas', 'sp-ico');
  cv.width = 40; cv.height = 40;
  const c = cv.getContext('2d');
  if (c) { c.scale(2, 2); drawDevTile(c, def, 10, 10, 18); }
  return cv;
}

function renderDevs(sec, game) {
  const counts = devCounts(game);
  const defs = new Map(getDevelopers().map(d => [d.id, d]));
  const total = counts.reduce((s, d) => s + d.count, 0);
  sec.textContent = '';
  // Compact: the total sits in the header, the types are one row of chips.
  const head = title('Developers');
  head.append(el('span', 'sp-total', total === 0 ? 'None hired yet' : `${total} developer${total === 1 ? '' : 's'}`));
  const chips = el('div', 'sp-devs');
  for (const d of counts) {
    const chip = el('div', 'sp-dev');
    chip.append(devIcon(defs.get(d.id)), el('span', '', d.name), el('b', '', String(d.count)));
    chips.append(chip);
  }
  sec.append(head, chips);
}

function sync(game) {
  if (!HAS_DOM) return;
  const building = document.getElementById('panel-building');
  if (building) {
    const key = JSON.stringify([buildingInfo(game), buildingRows(game).map(r => r.level)]);
    if (key !== keys.building) { keys.building = key; renderBuilding(building, game); }
  }
  const devs = document.getElementById('panel-devs');
  if (devs) {
    const key = devCounts(game).map(d => d.count).join(',');
    if (key !== keys.devs) { keys.devs = key; renderDevs(devs, game); }
  }
}

const feature = {
  id: 'side-panel',
  init() { keys = { building: '', devs: '' }; },
  // draw runs every frame (also while paused); sync only rebuilds a section when its values changed.
  draw(ctx, game) { sync(game); },
};
registerFeature(feature);
export default feature;
