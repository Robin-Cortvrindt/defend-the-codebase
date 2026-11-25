import { registerPowerup } from '../../engine/registry.js';
import { powerupMod, powerupState } from '../../engine/powerups.js';

// x2 XP, +0.25 per Training budget investment level.
export const trainingFactor = game => 2 + 0.25 * powerupMod(game, 'training').effect;

// Training manager: coaching session. Developers gain double experience for a while.
const trainingManager = {
  id: 'training',
  name: 'Training manager',
  description: 'Double XP',
  duration: 15,
  cooldown: 45,
  describe(game) { return `×${trainingFactor(game)} XP`; },
  describeEffect(game) { const st = powerupState(game, 'training'); return `XP ×${st.factor} (${Math.ceil(st.remaining)} s left)`; },
  activate(game, st) { st.factor = trainingFactor(game); game.mods.xpMultiplier *= st.factor; },
  deactivate(game, st) { game.mods.xpMultiplier /= st.factor ?? 2; },
};
registerPowerup(trainingManager);
export default trainingManager;
