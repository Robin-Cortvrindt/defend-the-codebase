import { registerUpgrade } from '../../engine/registry.js';
import { counterUpgrade } from '../../engine/upgrades.js';

// A coffee bar keeps the Java developers going.
const coffee = counterUpgrade({ id: 'coffee', name: 'Coffee bar', description: 'Counters: out of coffee', counters: 'no-coffee' });
registerUpgrade(coffee);
export default coffee;
