import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// Business manager is back sooner: -10% cooldown per level
const investment = {
  id: 'sales-pipeline',
  name: 'Sales pipeline',
  description: 'Business manager is back sooner: -10% cooldown per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [10, 25, 45][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'business').cooldown *= 1 - 0.10 * level; },
  effectText(level) { return `Business manager cooldown -${level * 10}%`; },
};
registerInvestment(investment);
export default investment;
