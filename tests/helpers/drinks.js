import { registerDrink } from '../../src/engine/registry.js';

export function registerTestDrinks() {
  registerDrink({ id: 'coffee', name: 'Coffee', color: '#92400E', icon: '☕' });
  registerDrink({ id: 'monster', name: 'White Monster', color: '#64748B', icon: 'M' });
  registerDrink({ id: 'redbull', name: 'Red Bull', color: '#2563EB', icon: 'R' });
}

export const totalDrinks = game => Object.values(game.drinks).reduce((a, b) => a + b, 0);
