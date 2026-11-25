import { registerUpgrade } from '../../engine/registry.js';
import { counterUpgrade } from '../../engine/upgrades.js';

// Air conditioning: counters the heat wave. Also keeps the old game.heatResistance field in sync.
const aircon = counterUpgrade({
  id: 'aircon', name: 'Air conditioning', description: 'Counters: heat wave', counters: 'heat-wave',
  onApply(game, level) { game.heatResistance = level / 3; },
});
registerUpgrade(aircon);
export default aircon;
