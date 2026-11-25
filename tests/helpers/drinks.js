import { registerDrink } from '../../src/engine/registry.js';
import { collectDrop } from '../../src/engine/drops.js';

export function registerTestDrinks() {
  registerDrink({ id: 'coffee', name: 'Coffee', color: '#92400E', icon: '☕' });
  registerDrink({ id: 'monster', name: 'White Monster', color: '#64748B', icon: 'M' });
  registerDrink({ id: 'redbull', name: 'Red Bull', color: '#2563EB', icon: 'R' });
}

export const totalDrinks = game => Object.values(game.drinks).reduce((a, b) => a + b, 0);

// Kills now leave drops on the board; collect them all so the balance reflects the payout.
export function collectAll(game) {
  for (const d of [...game.drops]) collectDrop(game, d);
}
