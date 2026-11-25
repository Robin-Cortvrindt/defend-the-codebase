import { registerPowerup } from '../../engine/registry.js';
import { powerupMod, powerupState } from '../../engine/powerups.js';
import { pctText } from '../../engine/effects.js';

// +50% attack speed, +10 points per Leadership coaching investment level.
export const ceoFactor = game => 1.5 + 0.10 * powerupMod(game, 'ceo').effect;

// The CEO walks in. Every developer suddenly works 50% faster.
const ceo = {
  id: 'ceo',
  name: 'CEO',
  description: 'Attack speed +50%',
  duration: 10,
  cooldown: 40,
  describe(game) { return `Attack speed +${Math.round((ceoFactor(game) - 1) * 100)}%`; },
  describeEffect(game) { const st = powerupState(game, 'ceo'); return `attack speed ${pctText(st.factor)} (${Math.ceil(st.remaining)} s left)`; },
  activate(game, st) { st.factor = ceoFactor(game); game.mods.fireRateMultiplier *= st.factor; },
  deactivate(game, st) { game.mods.fireRateMultiplier /= st.factor ?? 1.5; },
};
registerPowerup(ceo);
export default ceo;
