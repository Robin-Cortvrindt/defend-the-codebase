// Nexios building upgrades, bought with Nexios Coins in the quarter review.
import { getUpgrade } from './registry.js';
import { emit } from './events.js';

export const upgradeLevel = (game, id) => game.upgrades[id] || 0;

export function upgradeCost(game, id) {
  const def = getUpgrade(id);
  if (!def) return Infinity;
  try { return def.getCost(game, upgradeLevel(game, id)); } catch (e) { console.error(`[upgrade ${id}]`, e); return Infinity; }
}

export function canBuy(game, id) {
  const def = getUpgrade(id);
  if (!def || game.phase !== 'review') return false;
  if (upgradeLevel(game, id) >= (def.maxLevel ?? Infinity)) return false;
  return game.coins >= upgradeCost(game, id);
}

export function buyUpgrade(game, id) {
  if (!canBuy(game, id)) return false;
  const def = getUpgrade(id);
  game.coins -= upgradeCost(game, id);
  const level = upgradeLevel(game, id) + 1;
  game.upgrades[id] = level;
  try { def.apply(game, level); } catch (e) { console.error(`[upgrade ${id}]`, e); }
  emit('upgrade:bought', { game, id, level });
  return true;
}
