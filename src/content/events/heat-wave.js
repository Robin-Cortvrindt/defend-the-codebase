// Event: heat wave. Bugs move 50% faster.
import { registerEvent } from '../../engine/registry.js';

registerEvent({
  id: 'heat-wave', name: 'Heat wave', description: 'Bugs move 50% faster', accent: '#EA580C',
  start(game) { game.mods.bugSpeedMultiplier *= 1.5; },
  end(game) { game.mods.bugSpeedMultiplier /= 1.5; },
});
