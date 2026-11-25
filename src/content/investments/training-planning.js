import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// Training manager is back sooner: -10% cooldown per level
const investment = {
  id: 'training-planning',
  name: 'Training planning',
  description: 'Training manager is back sooner: -10% cooldown per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [10, 25, 45][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'training').cooldown *= 1 - 0.10 * level; },
  effectText(level) { return `Training manager cooldown -${level * 10}%`; },
};
registerInvestment(investment);
export default investment;
