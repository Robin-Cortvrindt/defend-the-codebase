import { registerBug } from '../../engine/registry.js';

// Tiny, fast and plentiful. The blue ring says: React counters it.
registerBug({ id: 'typo', name: 'Typo bug', ring: '#2563EB', radius: 5, hp: 10, speed: 70, livesLost: 1, reward: 1 });
