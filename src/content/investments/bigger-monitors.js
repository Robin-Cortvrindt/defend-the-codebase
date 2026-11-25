import { registerInvestment } from '../../engine/registry.js';

// All developers see further: +5% range per level
const investment = {
  id: 'bigger-monitors',
  name: 'Bigger monitors',
  description: 'All developers see further: +5% range per level',
  group: 'developers',
  maxLevel: 3,
  getCost(level) { return [15, 30, 50][level] ?? Infinity; },
  apply(game, level) { game.mods.rangeMultiplier *= 1 + 0.05 * level; },
  effectText(level) { return `+${level * 5}% range`; },
};
registerInvestment(investment);
export default investment;
