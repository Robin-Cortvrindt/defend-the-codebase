import { registerPowerup } from '../../engine/registry.js';

// The CEO walks in. Every developer suddenly works 50% faster.
const ceo = {
  id: 'ceo',
  name: 'CEO',
  description: 'Attack speed +50%',
  duration: 10,
  cooldown: 40,
  activate(game) { game.mods.fireRateMultiplier *= 1.5; },
  deactivate(game) { game.mods.fireRateMultiplier /= 1.5; },
};
registerPowerup(ceo);
export default ceo;
