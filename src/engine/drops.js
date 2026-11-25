// What a squashed bug pays. For now it goes straight into the wallet.
import { getDrinks } from './registry.js';
import { addDrink, randomDrink } from './drinks.js';

// Normal bug: one random drink. Boss: every drink, the reward split over them.
export function payKill(game, def) {
  const n = getDrinks().length;
  if (!n) return;
  const worth = (def?.reward ?? 0) * game.mods.drinkMultiplier;
  if (def?.boss) {
    const each = Math.max(1, Math.round(worth / n));
    for (const d of getDrinks()) addDrink(game, d.id, each);
  } else {
    const id = randomDrink(game);
    if (id) addDrink(game, id, Math.max(1, Math.round(worth)));
  }
}
