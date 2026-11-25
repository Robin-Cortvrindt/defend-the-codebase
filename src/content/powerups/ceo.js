import { registerPowerup } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// +50% attack speed, +10 points per Leadership coaching investment level.
const factor = game => 1.5 + 0.10 * powerupMod(game, 'ceo').effect;

// The CEO walks in. Every developer suddenly works 50% faster.
const ceo = {
  id: 'ceo',
  name: 'CEO',
  description: 'Attack speed +50%',
  duration: 10,
  cooldown: 40,
  describe(game) { return `Attack speed +${Math.round((factor(game) - 1) * 100)}%`; },
  activate(game, st) { st.factor = factor(game); game.mods.fireRateMultiplier *= st.factor; },
  deactivate(game, st) { game.mods.fireRateMultiplier /= st.factor ?? 1.5; },
};
registerPowerup(ceo);
export default ceo;
