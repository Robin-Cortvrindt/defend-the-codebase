// Event: heat wave. Bugs move 50% faster, less with air conditioning
// (game.heatResistance: 0 = none, 1 = AC cancels the heat wave completely).
import { registerEvent } from '../../engine/registry.js';

registerEvent({
  id: 'heat-wave', name: 'Heat wave', description: 'Bugs move 50% faster', accent: '#EA580C',
  start(game) {
    const resistance = Math.min(1, Math.max(0, game.heatResistance ?? 0));
    game.heatWaveFactor = 1 + 0.5 * (1 - resistance); // remembered so end() undoes exactly what start() did
    game.mods.bugSpeedMultiplier *= game.heatWaveFactor;
  },
  end(game) {
    game.mods.bugSpeedMultiplier /= game.heatWaveFactor ?? 1;
    game.heatWaveFactor = 1;
  },
});
