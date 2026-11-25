import { registerUpgrade } from '../../engine/registry.js';

// Air conditioning: each level takes a third off the heat wave (the heat wave event reads game.heatResistance).
const COSTS = [3, 5, 7];
const aircon = {
  id: 'aircon',
  name: 'Air conditioning',
  description: 'Protects against heat waves',
  maxLevel: COSTS.length,
  getCost(game, level) { return COSTS[level] ?? Infinity; },
  apply(game, level) { game.heatResistance = level / COSTS.length; },
};
registerUpgrade(aircon);
export default aircon;
