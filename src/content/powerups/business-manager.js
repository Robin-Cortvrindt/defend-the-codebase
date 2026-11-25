import { registerPowerup } from '../../engine/registry.js';

// Business manager: renegotiated the rates. Squashed bugs pay double Warrants for a while.
const businessManager = {
  id: 'business',
  name: 'Business manager',
  description: 'Double Warrants',
  duration: 15,
  cooldown: 45,
  activate(game) { game.mods.warrantMultiplier *= 2; },
  deactivate(game) { game.mods.warrantMultiplier /= 2; },
};
registerPowerup(businessManager);
export default businessManager;
