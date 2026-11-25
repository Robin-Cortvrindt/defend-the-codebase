import { registerUpgrade } from '../../engine/registry.js';
import { counterUpgrade } from '../../engine/upgrades.js';

// A stocked fridge keeps the .NET developers going.
const fridge = counterUpgrade({ id: 'fridge', name: 'Energy drink fridge', description: 'Counters: out of Red Bull', counters: 'no-redbull' });
registerUpgrade(fridge);
export default fridge;
