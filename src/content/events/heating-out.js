// Event: the heating in the Nexios building is out. Everything moves at half speed,
// less with server heat recovery (resistance 1 cancels it).
import { registerEvent } from '../../engine/registry.js';
import { resistanceTo } from '../../engine/upgrades.js';

const heatingOut = {
  id: 'heating-out', name: 'The heating is out', description: 'Everyone moves at half speed', accent: '#2563EB',
  start(game) {
    game.heatingOutFactor = 0.5 + 0.5 * resistanceTo(game, 'heating-out');
    game.mods.timeScale *= game.heatingOutFactor;
  },
  end(game) {
    game.mods.timeScale /= game.heatingOutFactor ?? 1;
    game.heatingOutFactor = 1;
  },
};
registerEvent(heatingOut);
export default heatingOut;
