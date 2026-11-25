import { registerInvestment } from '../../engine/registry.js';

// All developers hit harder: +10% damage per level
const investment = {
  id: 'better-laptops',
  name: 'Better laptops',
  description: 'All developers hit harder: +10% damage per level',
  group: 'developers',
  maxLevel: 5,
  getCost(level) { return [10, 20, 35, 55, 80][level] ?? Infinity; },
  apply(game, level) { game.mods.damageMultiplier *= 1 + 0.10 * level; },
  effectText(level) { return `+${level * 10}% damage`; },
};
registerInvestment(investment);
export default investment;
