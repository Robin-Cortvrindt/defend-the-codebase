import { registerUpgrade } from '../../engine/registry.js';
import { counterUpgrade } from '../../engine/upgrades.js';

// A water cooler sobers the team up after Thomas's wine tasting.
const water = counterUpgrade({ id: 'water', name: 'Water cooler', description: 'Counters: wine tasting', counters: 'wine-tasting' });
registerUpgrade(water);
export default water;
