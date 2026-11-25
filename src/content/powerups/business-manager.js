import { registerPowerup } from '../../engine/registry.js';
import { powerupMod } from '../../engine/powerups.js';

// x2 Warrants, +0.25 per Sales targets investment level.
const factor = game => 2 + 0.25 * powerupMod(game, 'business').effect;

// Business manager: renegotiated the rates. Squashed bugs pay double Warrants for a while.
const businessManager = {
  id: 'business',
  name: 'Business manager',
  description: 'Double Warrants',
  duration: 15,
  cooldown: 45,
  describe(game) { return `×${factor(game)} Warrants`; },
  activate(game, st) { st.factor = factor(game); game.mods.warrantMultiplier *= st.factor; },
  deactivate(game, st) { game.mods.warrantMultiplier /= st.factor ?? 2; },
};
registerPowerup(businessManager);
export default businessManager;
