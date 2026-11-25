// Event: the heating in the Nexios building is out. Cold developers work at half speed
// (bugs are not affected). Server heat recovery reduces it; at level 3 it has no effect.
import { registerEvent } from '../../engine/registry.js';
import { resistanceTo } from '../../engine/upgrades.js';

const heatingOut = {
  id: 'heating-out', name: 'The heating is out', description: 'Developers work at half speed', accent: '#2563EB',
  start(game) {
    game.heatingOutFactor = 0.5 + 0.5 * resistanceTo(game, 'heating-out'); // remembered so end() undoes exactly this
    game.mods.fireRateMultiplier *= game.heatingOutFactor;
  },
  end(game) {
    game.mods.fireRateMultiplier /= game.heatingOutFactor ?? 1;
    game.heatingOutFactor = 1;
  },
};
registerEvent(heatingOut);
export default heatingOut;
