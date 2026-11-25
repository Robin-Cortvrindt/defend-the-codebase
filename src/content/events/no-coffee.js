// Event: out of coffee. Java developers work at half speed.
import { registerEvent } from '../../engine/registry.js';

registerEvent({
  id: 'no-coffee', name: 'Out of coffee', description: 'Java developers work at half speed', accent: '#EA580C',
  start(game) { game.mods.devFireRate.java = (game.mods.devFireRate.java ?? 1) * 0.5; },
  end(game) { game.mods.devFireRate.java = (game.mods.devFireRate.java ?? 1) / 0.5; },
});
