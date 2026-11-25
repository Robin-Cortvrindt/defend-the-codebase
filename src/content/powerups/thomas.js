import { registerPowerup } from '../../engine/registry.js';

// Thomas: coaching session. Developers gain double experience for a while.
const thomas = {
  id: 'thomas',
  name: 'Thomas',
  description: 'Double XP',
  duration: 15,
  cooldown: 45,
  activate(game) { game.mods.xpMultiplier *= 2; },
  deactivate(game) { game.mods.xpMultiplier /= 2; },
};
registerPowerup(thomas);
export default thomas;
