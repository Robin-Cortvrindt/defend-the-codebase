import { registerBug } from '../../engine/registry.js';

// Medium bug. The orange ring says: Java counters it.
registerBug({ id: 'nullpointer', name: 'Null pointer', ring: '#EA580C', radius: 9, hp: 45, speed: 45, livesLost: 1, reward: 3, legs: true });
