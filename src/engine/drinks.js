// Drink wallet: balances live in game.drinks, keyed by drink id. Pure helpers, no DOM.
import { getDrinks, getDrink, getDeveloper } from './registry.js';

export const START_DRINKS = 100;

const ids = () => getDrinks().map(d => d.id);

export function startingDrinks() {
  const wallet = {};
  for (const id of ids()) wallet[id] = START_DRINKS;
  return wallet;
}

export const drinkFor = typeId => getDeveloper(typeId)?.drink ?? getDrinks()[0]?.id;
export const drinkName = id => getDrink(id)?.name ?? id;

export function addDrink(game, id, amount) {
  game.drinks[id] = (game.drinks[id] ?? 0) + amount;
  game.stats.drinksCollected += amount;
}

export const canAfford = (game, id, amount) => (game.drinks[id] ?? 0) >= amount;

export function spendDrink(game, id, amount) {
  if (!canAfford(game, id, amount)) return false;
  game.drinks[id] -= amount;
  return true;
}

// The one place the ceil-split lives: what each drink gets (or loses) of a total.
export function eachShare(total) {
  const n = getDrinks().length;
  return n ? Math.ceil(total / n) : 0;
}

export function addEachDrink(game, total) {
  const all = ids();
  const each = eachShare(total);
  for (const id of all) addDrink(game, id, each);
  return each;
}

export function takeEachDrink(game, total) {
  const all = ids();
  const each = eachShare(total);
  for (const id of all) game.drinks[id] = Math.max(0, (game.drinks[id] ?? 0) - each);
  return each;
}

export function randomDrink(game) {
  const all = ids();
  return all.length ? all[Math.floor(game.random() * all.length)] : null;
}
