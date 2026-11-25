import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// The CEO motivates harder: +10% attack speed per level
const investment = {
  id: 'leadership-coaching',
  name: 'Leadership coaching',
  description: 'The CEO motivates harder: +10% attack speed per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [10, 25, 45][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'ceo').effect += level; },
  effectText(level) { return `CEO attack speed +${50 + 10 * level}%`; },
};
registerInvestment(investment);
export default investment;
