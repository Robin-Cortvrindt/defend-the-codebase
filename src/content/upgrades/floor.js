import { registerUpgrade } from '../../engine/registry.js';

// Add a floor to the Nexios building: more production capacity, and it heals a bit.
const floor = {
  id: 'floor',
  name: 'Add a floor',
  description: '+5 production, heals 5',
  maxLevel: Infinity,
  getCost(game, level) { return 3 + level; },
  apply(game) {
    game.floors += 1;
    game.maxLives += 5;
    game.lives = Math.min(game.maxLives, game.lives + 5);
  },
};
registerUpgrade(floor);
export default floor;
