import { registerUpgrade } from '../../engine/registry.js';
import { counterUpgrade } from '../../engine/upgrades.js';

// The server room heats the office, so a broken heating system matters less.
const heating = counterUpgrade({ id: 'heating', name: 'Server heat recovery', description: 'Counters: the heating is out', counters: 'heating-out' });
registerUpgrade(heating);
export default heating;
