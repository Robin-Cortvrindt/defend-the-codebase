import { registerWaves } from '../engine/registry.js';

// 10 waves. Each group spawns `count` bugs, one every `interval` seconds, starting after `delay`.
// `hp` multiplies every bug's health in that wave, so later waves are tougher.
const g = (bug, count, interval, delay = 0) => ({ bug, count, interval, delay });

// Merge conflicts join from sprint 5, memory leaks from sprint 7.
// Every sprint ends with a security-risk boss (also in the generated sprints after these).
const BOSS = 'security-risk';
// The 24 x 12 route is ~2.5x longer than the old one, so developers get more time on every bug.
// This shared health factor, tuned with scripts/sim.mjs, keeps the difficulty where it was.
const ROUTE_HP = 1.4;

registerWaves([
  { boss: BOSS, hp: 1 * ROUTE_HP, groups: [g('typo', 12, 0.8)] },
  { boss: BOSS, hp: 1.2 * ROUTE_HP, groups: [g('typo', 16, 0.6), g('nullpointer', 3, 2, 4)] },
  { boss: BOSS, hp: 1.5 * ROUTE_HP, groups: [g('typo', 20, 0.5), g('nullpointer', 6, 1.5, 2)] },
  { boss: BOSS, hp: 1.9 * ROUTE_HP, groups: [g('typo', 20, 0.45), g('nullpointer', 6, 1.4, 1), g('legacy', 1, 1, 8)] },
  { boss: BOSS, hp: 2.4 * ROUTE_HP, groups: [g('typo', 28, 0.4), g('nullpointer', 10, 1.2, 3), g('legacy', 2, 6, 6), g('merge-conflict', 1, 1, 8)] },
  { boss: BOSS, hp: 3 * ROUTE_HP, groups: [g('typo', 34, 0.35), g('nullpointer', 12, 1.0, 2), g('legacy', 3, 5, 5), g('merge-conflict', 2, 6, 6)] },
  { boss: BOSS, hp: 3.7 * ROUTE_HP, groups: [g('typo', 40, 0.3), g('nullpointer', 15, 0.9, 2), g('legacy', 4, 4, 4), g('merge-conflict', 2, 6, 5), g('memory-leak', 1, 1, 10)] },
  { boss: BOSS, hp: 4.5 * ROUTE_HP, groups: [g('typo', 46, 0.3), g('nullpointer', 18, 0.8, 1), g('legacy', 5, 4, 3), g('merge-conflict', 2, 6, 4), g('memory-leak', 1, 1, 6)] },
  { boss: BOSS, hp: 5.4 * ROUTE_HP, groups: [g('typo', 52, 0.27), g('nullpointer', 22, 0.7, 1), g('legacy', 6, 3.5, 2), g('merge-conflict', 3, 5, 3), g('memory-leak', 1, 1, 5)] },
  { boss: BOSS, hp: 6.5 * ROUTE_HP, groups: [g('typo', 60, 0.25), g('nullpointer', 25, 0.6, 1), g('legacy', 8, 3, 2), g('merge-conflict', 3, 5, 3), g('memory-leak', 2, 8, 4)] },
]);
