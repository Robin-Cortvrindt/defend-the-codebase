import { registerInvestment } from '../../engine/registry.js';
import { pctText } from '../../engine/effects.js';

export const FIRE_RATE_PER_LEVEL = 0.08;

// All developers work faster: +8% attack speed per level
const investment = {
  id: 'agile-coaching',
  name: 'Agile coaching',
  description: 'All developers work faster: +8% attack speed per level',
  group: 'developers',
  maxLevel: 5,
  getCost(level) { return [10, 20, 35, 55, 80][level] ?? Infinity; },
  apply(game, level) { game.mods.fireRateMultiplier *= 1 + FIRE_RATE_PER_LEVEL * level; },
  describeEffect(game, dev, level) { return `attack speed ${pctText(1 + FIRE_RATE_PER_LEVEL * level)}`; },
  effectText(level) { return `+${level * 8}% attack speed`; },
};
registerInvestment(investment);
export default investment;
