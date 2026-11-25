import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// Training manager gives more XP: +0.25× per level
const investment = {
  id: 'training-budget',
  name: 'Training budget',
  description: 'Training manager gives more XP: +0.25× per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [10, 25, 45][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'training').effect += level; },
  effectText(level) { return `Training manager ×${2 + 0.25 * level} XP`; },
};
registerInvestment(investment);
export default investment;
