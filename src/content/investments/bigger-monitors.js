import { registerInvestment } from '../../engine/registry.js';
import { pctText } from '../../engine/effects.js';

export const RANGE_PER_LEVEL = 0.05;

// All developers see further: +5% range per level
const investment = {
  id: 'bigger-monitors',
  name: 'Bigger monitors',
  description: 'All developers see further: +5% range per level',
  group: 'developers',
  maxLevel: 3,
  getCost(level) { return [15, 30, 50][level] ?? Infinity; },
  apply(game, level) { game.mods.rangeMultiplier *= 1 + RANGE_PER_LEVEL * level; },
  describeEffect(game, dev, level) { return `range ${pctText(1 + RANGE_PER_LEVEL * level)}`; },
  effectText(level) { return `+${level * 5}% range`; },
};
registerInvestment(investment);
export default investment;
