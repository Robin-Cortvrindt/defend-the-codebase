// Developers: hiring, selling, targeting, combat and levelling.
import { getDeveloper, getBug } from './registry.js';
import { emit } from './events.js';
import { isBuildable, cellCenter, CELL } from './map.js';
import { killBug, addEffect } from './game.js';

export const LEVELS = [
  { name: 'Junior Consultant', badge: 'J', xp: 0 },
  { name: 'Consultant', badge: 'C', xp: 10 },
  { name: 'Senior Consultant', badge: 'S', xp: 30 },
];
export const XP_GATES = [0, 10, 30];

export const devAt = (game, col, row) => game.devs.find(d => d.col === col && d.row === row);

export function canPlace(game, typeId, col, row) {
  const def = getDeveloper(typeId);
  return !!def && isBuildable(col, row) && !devAt(game, col, row) && game.warrants >= def.cost;
}

export function placeDev(game, typeId, col, row) {
  if (!canPlace(game, typeId, col, row)) return null;
  const def = getDeveloper(typeId);
  const { x, y } = cellCenter(col, row);
  const dev = { id: game.nextId++, type: typeId, col, row, x, y, level: 0, upgrade: null, state: {}, xp: 0, cooldown: 0, spent: def.cost, kills: 0 };
  game.warrants -= def.cost;
  game.devs.push(dev);
  emit('dev:placed', { game, dev });
  return dev;
}

export function sellDev(game, dev) {
  const i = game.devs.indexOf(dev);
  if (i < 0) return 0;
  game.devs.splice(i, 1);
  const refund = Math.floor(dev.spent * 0.5);
  game.warrants += refund;
  emit('dev:sold', { game, dev, refund });
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
  if (game.warrants < upgrade.cost) return { ok: false, reason: 'warrants' };
  return { ok: true, reason: null };
}

export function buyUpgrade(game, dev, upgradeId) {
  const upgrade = nextUpgrades(dev).find(u => u.id === upgradeId);
  if (!upgrade || !upgradeStatus(game, dev, upgrade).ok) return false;
  game.warrants -= upgrade.cost;
  dev.spent += upgrade.cost;
  dev.level++;
  dev.upgrade = upgrade;
  if (dev.level === 2) game.stats.seniors++;
  emit('dev:levelup', { game, dev, level: dev.level, upgrade });
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
  try { def.modifyStats?.(game, dev, stats); } catch (e) { console.error(e); }
  try { dev.upgrade?.modifyStats?.(game, dev, stats); } catch (e) { console.error(e); }
  // Aura step: Task 4 applies nearby developers' auras to `stats` here.
  return {
    ...stats,
    damage: stats.damage * game.mods.damageMultiplier,
    fireRate: stats.fireRate * game.mods.fireRateMultiplier,
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

export function tickDevs(game, dt) {
  for (const dev of game.devs) {
    dev.cooldown -= dt;
    if (dev.cooldown > 0) continue;
    const { damage, fireRate, range } = devStats(game, dev);
    let target = null;
    for (const bug of game.bugs) {
      if (Math.hypot(bug.x - dev.x, bug.y - dev.y) > range) continue;
      if (!target || bug.distance > target.distance) target = bug;
    }
    if (!target) { dev.cooldown = 0; continue; }
    const def = getDeveloper(dev.type);
    const counter = target.type === def.counters;
    target.hp -= damage * (counter ? 2 : 1);
    addEffect(game, { kind: 'beam', from: { x: dev.x, y: dev.y }, to: { x: target.x, y: target.y }, color: def.accent, width: Math.min(5, 1.5 + damage / 15), ttl: 0.12 });
    if (counter) addEffect(game, { kind: 'pop', x: target.x, y: target.y - 12, text: '×2', ttl: 0.6 });
    try { getBug(target.type)?.onHit?.(target, game); } catch (e) { console.error(e); }
    if (target.hp <= 0) {
      killBug(game, target, dev);
      dev.kills++;
      grantXp(game, dev, 1);
    }
    dev.cooldown = 1 / fireRate;
  }
}
