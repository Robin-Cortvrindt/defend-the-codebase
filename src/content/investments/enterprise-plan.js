import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// Claude comes back sooner: -10% cooldown per level
const investment = {
  id: 'enterprise-plan',
  name: 'Enterprise plan',
  description: 'Claude comes back sooner: -10% cooldown per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [15, 30, 50][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'claude').cooldown *= 1 - 0.10 * level; },
  effectText(level) { return `Claude -${level * 10}% cooldown`; },
};
registerInvestment(investment);
export default investment;
