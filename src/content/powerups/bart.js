import { registerPowerup } from '../../engine/registry.js';

// Bart walks in. Every developer suddenly works 50% faster.
const bart = {
  id: 'bart',
  name: 'Bart',
  description: 'Attack speed +50%',
  duration: 10,
  cooldown: 40,
  activate(game) { game.mods.fireRateMultiplier *= 1.5; },
  deactivate(game) { game.mods.fireRateMultiplier /= 1.5; },
};
registerPowerup(bart);
export default bart;
