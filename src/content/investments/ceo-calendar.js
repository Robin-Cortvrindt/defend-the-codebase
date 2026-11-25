import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// The CEO drops by more often: -10% cooldown per level
const investment = {
  id: 'ceo-calendar',
  name: "CEO's calendar",
  description: 'The CEO drops by more often: -10% cooldown per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [10, 25, 45][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'ceo').cooldown *= 1 - 0.10 * level; },
  effectText(level) { return `CEO cooldown -${level * 10}%`; },
};
registerInvestment(investment);
export default investment;
