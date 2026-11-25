import { registerPowerup } from '../../engine/registry.js';

// Jeroen: renegotiated the rates. Squashed bugs pay double Warrants for a while.
const jeroen = {
  id: 'jeroen',
  name: 'Jeroen',
  description: 'Double Warrants',
  duration: 15,
  cooldown: 45,
  activate(game) { game.mods.warrantMultiplier *= 2; },
  deactivate(game) { game.mods.warrantMultiplier /= 2; },
};
registerPowerup(jeroen);
export default jeroen;
