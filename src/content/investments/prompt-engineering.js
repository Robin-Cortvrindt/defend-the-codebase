import { registerInvestment } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// Claude hallucinates less: -5 points backfire chance per level
const investment = {
  id: 'prompt-engineering',
  name: 'Prompt engineering',
  description: 'Claude hallucinates less: -5 points backfire chance per level',
  group: 'powerups',
  maxLevel: 3,
  getCost(level) { return [15, 30, 50][level] ?? Infinity; },
  apply(game, level) { powerupMod(game, 'claude').effect += level; },
  effectText(level) { return `Claude backfires ${25 - 5 * level}% of the time`; },
};
registerInvestment(investment);
export default investment;
