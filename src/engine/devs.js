// Developers: hiring, selling, targeting, combat and levelling.
import { getDeveloper, getBug } from './registry.js';
import { emit } from './events.js';
import { isBuildable, cellCenter, CELL } from './map.js';
import { killBug, addEffect, isLocked } from './game.js';
import { drinkFor, canAfford, spendDrink } from './drinks.js';
import { resistanceTo } from './upgrades.js';

export const XP_GATES = [0, 10, 30];

export const devAt = (game, col, row) => game.devs.find(d => d.col === col && d.row === row);

// What hiring a developer costs right now (the recruitment investment lowers it).
export function hireCost(game, typeId) {
  const def = getDeveloper(typeId);
  return def ? Math.round(def.cost * (game.mods.devCostMultiplier ?? 1)) : Infinity;
}

export function canPlace(game, typeId, col, row) {
  const def = getDeveloper(typeId);
  return !!def && !isLocked(game) && isBuildable(col, row) && !devAt(game, col, row) && canAfford(game, drinkFor(typeId), hireCost(game, typeId));
}

export function placeDev(game, typeId, col, row) {
  if (!canPlace(game, typeId, col, row)) return null;
  const def = getDeveloper(typeId);
  const { x, y } = cellCenter(col, row);
  const cost = hireCost(game, typeId);
  const dev = { id: game.nextId++, type: typeId, col, row, x, y, level: 0, upgrade: null, state: {}, xp: 0, cooldown: 0, spent: cost, kills: 0 };
  spendDrink(game, drinkFor(typeId), cost);
  game.devs.push(dev);
  emit('dev:placed', { game, dev });
  return dev;
}

export function sellDev(game, dev) {
  const i = game.devs.indexOf(dev);
  if (i < 0 || isLocked(game)) return 0;
  game.devs.splice(i, 1);
  const refund = Math.floor(dev.spent * 0.5);
  const drink = drinkFor(dev.type);
  // Refunds bypass addDrink on purpose, so they do not count as drinks collected.
  game.drinks[drink] = (game.drinks[drink] ?? 0) + refund;
  emit('dev:sold', { game, dev, refund, drink });
  return refund;
}

export function nextUpgrades(dev) {
  const ups = getDeveloper(dev.type)?.upgrades;
  if (!ups) return [];
  if (dev.level === 0) return ups.level2 ? [ups.level2] : [];
  if (dev.level === 1) return ups.level3 ?? [];
  return [];
}

export const upgradeUnlocked = dev => nextUpgrades(dev).length > 0 && dev.xp >= XP_GATES[dev.level + 1];

export function upgradeStatus(game, dev, upgrade) {
  if (dev.xp < XP_GATES[dev.level + 1]) return { ok: false, reason: 'xp' };
  if (!canAfford(game, drinkFor(dev.type), upgrade.cost)) return { ok: false, reason: 'drink' };
  return { ok: true, reason: null };
}

export function buyUpgrade(game, dev, upgradeId) {
  const upgrade = nextUpgrades(dev).find(u => u.id === upgradeId);
  if (!upgrade || isLocked(game) || !upgradeStatus(game, dev, upgrade).ok) return false;
  spendDrink(game, drinkFor(dev.type), upgrade.cost);
  dev.spent += upgrade.cost;
  dev.level++;
  dev.upgrade = upgrade;
  if (dev.level === 2) game.stats.seniors++;
  emit('dev:levelup', { game, dev, level: dev.level, upgrade });
  // XP may already be past the next gate (earned while waiting to buy this one)
  if (nextUpgrades(dev).length > 0 && dev.xp >= XP_GATES[dev.level + 1]) emit('dev:upgradeready', { game, dev, level: dev.level + 1 });
  return true;
}

export function levelName(dev) {
  const def = getDeveloper(dev.type);
  return dev.upgrade?.name ?? def?.levelName ?? def?.name;
}

export function devStats(game, dev) {
  const def = getDeveloper(dev.type);
  const ups = def.upgrades;
  const stats = { damage: def.damage, fireRate: def.fireRate, range: def.range };
  if (dev.level >= 1 && ups?.level2?.stats) Object.assign(stats, ups.level2.stats);
  if (dev.level === 2 && dev.upgrade?.stats) Object.assign(stats, dev.upgrade.stats);
  try { def.modifyStats?.(game, dev, stats); } catch (e) { console.error(`[dev ${dev.type}] modifyStats failed`, e); }
  try { dev.upgrade?.modifyStats?.(game, dev, stats); } catch (e) { console.error(`[dev ${dev.type}] upgrade modifyStats failed`, e); }
  // Aura step: each distinct upgrade id with an aura applies once if another dev with it is in radius.
  const applied = new Set();
  for (const other of game.devs) {
    const aura = other.upgrade?.aura;
    if (other === dev || !aura || applied.has(other.upgrade.id)) continue;
    if (Math.hypot(other.x - dev.x, other.y - dev.y) > aura.radius * CELL) continue;
    applied.add(other.upgrade.id);
    try { aura.apply(game, dev, stats); } catch (e) { console.error(`[dev ${dev.type}] aura failed`, e); }
  }
  return {
    ...stats,
    damage: stats.damage * game.mods.damageMultiplier,
    fireRate: stats.fireRate * game.mods.fireRateMultiplier * (game.mods.devFireRate?.[dev.type] ?? 1),
    range: stats.range * CELL * game.mods.rangeMultiplier,
  };
}

export function grantXp(game, dev, amount) {
  const before = dev.xp;
  dev.xp += amount * game.mods.xpMultiplier;
  const gate = XP_GATES[dev.level + 1];
  if (nextUpgrades(dev).length > 0 && before < gate && dev.xp >= gate) {
    emit('dev:upgradeready', { game, dev, level: dev.level + 1 });
  }
}

export function bugsInRange(game, dev, range) {
  return game.bugs
    .filter(b => !b.dead && Math.hypot(b.x - dev.x, b.y - dev.y) <= range)
    .sort((a, b) => b.distance - a.distance);
}

// Which bug a developer shoots: the one furthest along. During Thomas's wine tasting a shot is tipsy
// (chance 1 - water cooler resistance) and goes to a random bug in range instead.
export function pickTarget(game, dev, range) {
  const bugs = bugsInRange(game, dev, range);
  if (!bugs.length) return { target: null, tipsy: false };
  const tipsy = game.activeEvent === 'wine-tasting' && game.random() >= resistanceTo(game, 'wine-tasting');
  return { target: tipsy ? bugs[Math.floor(game.random() * bugs.length)] : bugs[0], tipsy };
}

// One shot's animation from the developer to `bug`: the developer's own attack look (drawAttack),
// or a straight beam in `color` (default its accent) for developers without one.
export function shotBeam(game, dev, bug, color, damage = getDeveloper(dev.type).damage) {
  dev.lastShotAt = game.time;
  addAttack(game, dev, { x: dev.x, y: dev.y }, bug, { color, damage });
}

export function hitBug(game, dev, bug, damage) {
  if (bug.dead) return false;
  const counter = bug.type === getDeveloper(dev.type).counters;
  bug.hp -= damage * (counter ? 2 : 1);
  if (counter) addEffect(game, { kind: 'pop', x: bug.x, y: bug.y - 12, text: '×2', ttl: 0.6 });
  try { getBug(bug.type)?.onHit?.(bug, game); } catch (e) { console.error(`[bug ${bug.type}] onHit failed`, e); }
  if (bug.hp > 0) return false;
  killBug(game, bug, dev);
  dev.kills++;
  grantXp(game, dev, 1);
  return true;
}

const shotSeed = (dev, target) => {
  const n = Math.sin((dev.shots ?? 0) * 12.9898 + (target.id ?? 0) * 78.233 + (dev.col ?? 0) * 37.719 + (dev.row ?? 0) * 4.581) * 43758.5453;
  return n - Math.floor(n);
};

// The animation of one hit. Damage is dealt by the caller, at once; this is only what you see.
// The effect follows `target` while it lives (see tickEffects) and the developer may draw it (drawAttack).
// `damage` sets the fallback beam's width; `color` overrides its colour.
export function addAttack(game, dev, from, target, { color, damage } = {}) {
  const def = getDeveloper(dev.type);
  addEffect(game, {
    kind: 'attack', dev: dev.type, from, to: { x: target.x, y: target.y }, target,
    // Visual-only randomness, worked out from the shot itself so the game's own random numbers
    // (events, mails, Claude's backfire) aren't used up by animations.
    seed: shotSeed(dev, target), shot: dev.shots ?? 0, counter: target.type === def?.counters, tipsy: !!dev.tipsy,
    ttl: def?.attackDuration ?? 0.12, hitAt: def?.attackHitAt ?? 0,
    color, width: Math.min(5, 1.5 + (damage ?? devStats(game, dev).damage) / 15),
  });
  dev.shots = (dev.shots ?? 0) + 1;
}

export function tickDevs(game, dt) {
  for (const dev of game.devs) {
    dev.cooldown -= dt;
    const stats = devStats(game, dev);
    let hold = false;
    try { hold = dev.upgrade?.update?.(game, dev, dt, stats) === false; } catch (e) { console.error(`[dev ${dev.type}] update failed`, e); }
    if (hold) { dev.cooldown = 0; continue; }
    if (dev.cooldown > 0) continue;
    const { target, tipsy } = pickTarget(game, dev, stats.range);
    if (!target) { dev.cooldown = 0; continue; }
    dev.tipsy = tipsy; // read by addAttack so this shot's animation zigzags
    try {
      if (dev.upgrade?.fire) dev.upgrade.fire(game, dev, target, stats);
      else { shotBeam(game, dev, target, undefined, stats.damage); hitBug(game, dev, target, stats.damage); }
    } catch (e) { console.error(`[dev ${dev.type}] fire failed`, e); }
    dev.tipsy = false; // follow-up hits (e.g. a bounce on dev:hit) fly straight
    // Once per shot, after the kill check, so a listener (e.g. a bounce) never kills the same bug twice.
    const counter = target.type === getDeveloper(dev.type)?.counters;
    emit('dev:hit', { game, dev, bug: target, damage: stats.damage * (counter ? 2 : 1), counter });
    dev.cooldown = 1 / stats.fireRate;
  }
}
