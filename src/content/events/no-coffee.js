// Event: out of coffee. Java developers work at half speed, less with a coffee bar.
import { registerEvent } from '../../engine/registry.js';
import { resistanceTo } from '../../engine/upgrades.js';

const event = {
  id: 'no-coffee', name: 'Out of coffee', description: 'Java developers work at half speed', accent: '#EA580C',
  start(game) {
    const f = 0.5 + 0.5 * resistanceTo(game, 'no-coffee');
    game.coffeeFactor = f;
    if (f !== 1) game.mods.devFireRate.java = (game.mods.devFireRate.java ?? 1) * f;
  },
  end(game) {
    const f = game.coffeeFactor ?? 1;
    if (f !== 1) {
      const v = (game.mods.devFireRate.java ?? 1) / f;
      if (Math.abs(v - 1) < 1e-9) delete game.mods.devFireRate.java; else game.mods.devFireRate.java = v;
    }
    game.coffeeFactor = 1;
  },
};
registerEvent(event);
export default event;
