import { registerInvestment } from '../../engine/registry.js';

// Hiring is cheaper: -5% hiring cost per level
const investment = {
  id: 'recruitment-network',
  name: 'Recruitment network',
  description: 'Hiring is cheaper: -5% hiring cost per level',
  group: 'developers',
  maxLevel: 3,
  getCost(level) { return [15, 30, 50][level] ?? Infinity; },
  apply(game, level) { game.mods.devCostMultiplier *= 1 - 0.05 * level; },
  effectText(level) { return `-${level * 5}% hiring cost`; },
};
registerInvestment(investment);
export default investment;
