// Event: heat wave. Bugs move 50% faster, less with air conditioning
// (resistance 0 = none, 1 = air conditioning level 3 cancels the heat wave completely).
import { registerEvent } from '../../engine/registry.js';
import { resistanceTo } from '../../engine/upgrades.js';

const heatWave = {
  id: 'heat-wave', name: 'Heat wave', description: 'Bugs move 50% faster', accent: '#EA580C',
  start(game) {
    game.heatWaveFactor = 1 + 0.5 * (1 - resistanceTo(game, 'heat-wave')); // remembered so end() undoes exactly what start() did
    game.mods.bugSpeedMultiplier *= game.heatWaveFactor;
  },
  end(game) {
    game.mods.bugSpeedMultiplier /= game.heatWaveFactor ?? 1;
    game.heatWaveFactor = 1;
  },
};
registerEvent(heatWave);
export default heatWave;
