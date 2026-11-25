// Event: the heating in the Nexios building is out. Everything moves at half speed.
import { registerEvent } from '../../engine/registry.js';

registerEvent({
  id: 'heating-out', name: 'The heating is out', description: 'Everyone moves at half speed', accent: '#2563EB',
  start(game) { game.mods.timeScale *= 0.5; },
  end(game) { game.mods.timeScale /= 0.5; },
});
