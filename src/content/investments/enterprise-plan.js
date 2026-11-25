import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// Claude is cheaper: -10% price per level
const investment = {
  id: 'enterprise-plan',
  name: 'Enterprise plan',
  description: 'Claude is cheaper: -10% price per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [15, 30, 50][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'claude').cost *= 1 - 0.10 * level; },
  effectText(level) { return `Claude -${level * 10}% price`; },
};
registerInvestment(investment);
export default investment;
