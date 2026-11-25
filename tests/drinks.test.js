import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resetRegistry, registerDeveloper } from '../src/engine/registry.js';
import { registerTestDrinks } from './helpers/drinks.js';
import { startingDrinks, drinkFor, drinkName, addDrink, canAfford, spendDrink, addEachDrink, takeEachDrink, randomDrink } from '../src/engine/drinks.js';

let g;
beforeEach(() => {
  resetRegistry(); registerTestDrinks();
  registerDeveloper({ id: 'j', drink: 'coffee' });
  registerDeveloper({ id: 'nodrink' });
  g = { drinks: startingDrinks(), stats: { drinksCollected: 0 }, random: Math.random };
});

test('startingDrinks gives every drink 50', () => {
  assert.deepEqual(startingDrinks(), { coffee: 50, monster: 50, redbull: 50 });
});

test('drinkFor uses the developer drink, falling back to the first drink', () => {
  assert.equal(drinkFor('j'), 'coffee');
  assert.equal(drinkFor('nodrink'), 'coffee');
});

test('drinkName falls back to the id', () => {
  assert.equal(drinkName('monster'), 'White Monster');
  assert.equal(drinkName('x'), 'x');
});

test('addDrink counts into stats', () => {
  addDrink(g, 'monster', 5);
  assert.equal(g.drinks.monster, 55);
  assert.equal(g.stats.drinksCollected, 5);
});

test('spendDrink refuses when short and spends when enough', () => {
  assert.equal(canAfford(g, 'coffee', 60), false);
  assert.equal(spendDrink(g, 'coffee', 60), false);
  assert.equal(g.drinks.coffee, 50);
  assert.equal(spendDrink(g, 'coffee', 30), true);
  assert.equal(g.drinks.coffee, 20);
});

test('addEachDrink splits the total over every drink', () => {
  assert.equal(addEachDrink(g, 35), 12);
  assert.deepEqual(g.drinks, { coffee: 62, monster: 62, redbull: 62 });
  assert.equal(g.stats.drinksCollected, 36);
});

test('takeEachDrink floors at 0', () => {
  g.drinks = { coffee: 10, monster: 50, redbull: 50 };
  assert.equal(takeEachDrink(g, 100), 34);
  assert.deepEqual(g.drinks, { coffee: 0, monster: 16, redbull: 16 });
});

test('randomDrink picks by game.random', () => {
  g.random = () => 0.99;
  assert.equal(randomDrink(g), 'redbull');
  g.random = () => 0;
  assert.equal(randomDrink(g), 'coffee');
});
