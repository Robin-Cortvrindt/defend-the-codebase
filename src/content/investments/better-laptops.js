import { registerInvestment } from '../../engine/registry.js';
import { pctText } from '../../engine/effects.js';

export const DAMAGE_PER_LEVEL = 0.10;

// All developers hit harder: +10% damage per level
const investment = {
  id: 'better-laptops',
  name: 'Better laptops',
  description: 'All developers hit harder: +10% damage per level',
  group: 'developers',
  maxLevel: 5,
  getCost(level) { return [10, 20, 35, 55, 80][level] ?? Infinity; },
  apply(game, level) { game.mods.damageMultiplier *= 1 + DAMAGE_PER_LEVEL * level; },
  describeEffect(game, dev, level) { return `damage ${pctText(1 + DAMAGE_PER_LEVEL * level)}`; },
  effectText(level) { return `+${level * 10}% damage`; },
};
registerInvestment(investment);
export default investment;
