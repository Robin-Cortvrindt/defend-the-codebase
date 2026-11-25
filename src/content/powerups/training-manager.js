import { registerPowerup } from '../../engine/registry.js';

// Training manager: coaching session. Developers gain double experience for a while.
const trainingManager = {
  id: 'training',
  name: 'Training manager',
  description: 'Double XP',
  duration: 15,
  cooldown: 45,
  activate(game) { game.mods.xpMultiplier *= 2; },
  deactivate(game) { game.mods.xpMultiplier /= 2; },
};
registerPowerup(trainingManager);
export default trainingManager;
