import { registerUpgrade } from '../../engine/registry.js';
import { counterUpgrade } from '../../engine/upgrades.js';

// A backup generator keeps more lights on when PROD goes down.
const generator = counterUpgrade({ id: 'generator', name: 'Backup generator', description: 'Counters: PROD is down', counters: 'prod-down' });
registerUpgrade(generator);
export default generator;
