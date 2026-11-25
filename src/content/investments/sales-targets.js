import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// Business manager earns more: +0.25× drinks per level
const investment = {
  id: 'sales-targets',
  name: 'Sales targets',
  description: 'Business manager earns more: +0.25× drinks per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [10, 25, 45][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'business').effect += level; },
  effectText(level) { return `Business manager ×${2 + 0.25 * level} drinks`; },
};
registerInvestment(investment);
export default investment;
