import { registerUpgrade } from '../../engine/registry.js';
import { counterUpgrade } from '../../engine/upgrades.js';

// A goblin trap in front of the building: each level slows the greedy goblin, to 40% of its speed at level 3.
const trap = counterUpgrade({ id: 'trap', name: 'Goblin trap', description: 'Counters: greedy goblin', counters: 'goblin' });
registerUpgrade(trap);
export default trap;
