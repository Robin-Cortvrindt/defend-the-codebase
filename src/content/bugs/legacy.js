import { registerBug } from '../../engine/registry.js';

// Big, slow and tanky. The fuchsia ring says: .NET counters it.
registerBug({ id: 'legacy', name: 'Legacy bug', ring: '#C026D3', radius: 14, hp: 200, speed: 25, livesLost: 3, reward: 8, legs: true });
