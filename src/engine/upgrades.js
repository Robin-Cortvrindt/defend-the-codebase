// Nexios building upgrades, bought with Nexios Coins in the quarter review.
import { getUpgrade } from './registry.js';
import { emit } from './events.js';

export const upgradeLevel = (game, id) => game.upgrades[id] || 0;

// How well the building is protected against a random event: 0 = not at all, 1 = fully.
export function resistanceTo(game, eventId) {
  const r = game.resistance?.[eventId] ?? (eventId === 'heat-wave' ? game.heatResistance : 0) ?? 0;
  return Math.min(1, Math.max(0, r || 0));
}

// A counter-upgrade: 3 levels for 3/5/7 coins, each level takes a third off one event.
export const COUNTER_COSTS = [3, 5, 7];
export function counterUpgrade({ id, name, description, counters, onApply }) {
  return {
    id, name, description, counters,
    maxLevel: COUNTER_COSTS.length,
    getCost(game, level) { return COUNTER_COSTS[level] ?? Infinity; },
    apply(game, level) {
      game.resistance = game.resistance || {};
      game.resistance[counters] = level / COUNTER_COSTS.length;
      onApply?.(game, level);
    },
  };
}

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
