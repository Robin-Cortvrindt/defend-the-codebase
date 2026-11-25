import { registerPowerup } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// x2 drinks, +0.25 per Sales targets investment level.
const factor = game => 2 + 0.25 * powerupMod(game, 'business').effect;

// Business manager: renegotiated the rates. Squashed bugs pay double drinks for a while.
const businessManager = {
  id: 'business',
  name: 'Business manager',
  description: 'Double drinks',
  duration: 15,
  cooldown: 45,
  describe(game) { return `×${factor(game)} drinks`; },
  activate(game, st) { st.factor = factor(game); game.mods.drinkMultiplier *= st.factor; },
  deactivate(game, st) { game.mods.drinkMultiplier /= st.factor ?? 2; },
};
registerPowerup(businessManager);
export default businessManager;
