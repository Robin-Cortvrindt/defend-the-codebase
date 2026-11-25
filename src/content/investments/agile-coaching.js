import { registerInvestment } from '../../engine/registry.js';

// All developers work faster: +8% attack speed per level
const investment = {
  id: 'agile-coaching',
  name: 'Agile coaching',
  description: 'All developers work faster: +8% attack speed per level',
  group: 'developers',
  maxLevel: 5,
  getCost(level) { return [10, 20, 35, 55, 80][level] ?? Infinity; },
  apply(game, level) { game.mods.fireRateMultiplier *= 1 + 0.08 * level; },
  effectText(level) { return `+${level * 8}% attack speed`; },
};
registerInvestment(investment);
export default investment;
