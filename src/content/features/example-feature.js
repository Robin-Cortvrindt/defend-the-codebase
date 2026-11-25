// EXAMPLE FEATURE: copy this file to start your own add-on.
// It is NOT in the manifest, so it doesn't run. To try it, add this line to src/content/manifest.js:
//   './features/example-feature.js',
//
// The rule: one new file plus one manifest line. Never edit src/engine/ to add content.

import { registerFeature } from '../../engine/registry.js';
import { on } from '../../engine/events.js';
import { addEffect } from '../../engine/game.js';
import { addEachDrink } from '../../engine/drinks.js';

// 1) React to events (full list in CONTRIBUTING.md).
//    Subscribe here at the top level, NOT inside init(): init runs again on every restart.
on('wave:cleared', ({ game, wave }) => {
  addEffect(game, { kind: 'banner', title: 'Example feature', text: `Wave ${wave} done — have a slice of pizza`, accent: '#16A34A', ttl: 2.5 });
});

// 2) Register a feature for per-frame logic, drawing and extra HUD buttons (all optional)
registerFeature({
  id: 'example-feature',
  init(game) { /* runs at game start and on every restart: reset your own state here, don't call on() */ },
  update(game, dt) { /* runs every simulation step */ },
  draw(ctx, game) {
    // draw on the 640 x 320 map, on top of everything else
    // ctx.fillStyle = '#fff'; ctx.fillText('hello', 10, 310);
  },
  hudButtons: [
    { label: 'Pizza', hint: '+9 of each drink', onClick(game) { addEachDrink(game, 25); } },
  ],
});

/* ---- Other things you can register (each in its own file) ----

import { registerPowerup, registerDeveloper, registerBug, registerEvent } from '../../engine/registry.js';

registerPowerup({
  id: 'freeze', name: 'Code freeze', description: 'Bugs move 50% slower',
  duration: 8, cooldown: 40,
  // skipCooldown(game) { return false; },   // optional: true lets it fire during its cooldown
  // canActivate(game) { return true; },     // optional extra condition
  activate(game) { game.mods.bugSpeedMultiplier *= 0.5; },
  deactivate(game) { game.mods.bugSpeedMultiplier /= 0.5; },
});

registerDeveloper({
  id: 'python', name: 'Python', accent: '#16A34A', blurb: 'Long range',
  cost: 90, damage: 14, fireRate: 1.2, range: 3.2, counters: 'typo', // cost = price in the developer's drink
  drawIcon(ctx, size) { ctx.fillStyle = '#fff'; ctx.font = `900 ${size * 0.4}px Lato`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Py', 0, 1); },
});

registerBug({
  id: 'flaky', name: 'Flaky test', ring: '#94A3B8', radius: 8, hp: 30, speed: 55, livesLost: 1, reward: 2, legs: true,
  onDeath(bug, game) { if (game.random() < 0.5) spawnBug(game, 'flaky', bug.distance); }, // import spawnBug from game.js
});
// A new bug only appears if a wave spawns it: add it to a group in src/content/waves.js.

registerEvent({ // random event, rolled at wave start (put it in src/content/events/)
  id: 'wifi-down', name: 'The wifi is down', description: 'Developers have 30% less range',
  start(game) { game.mods.rangeMultiplier *= 0.7; }, end(game) { game.mods.rangeMultiplier /= 0.7; },
});

registerInvestment({ // permanent upgrade bought between runs (put it in src/content/investments/; import registerInvestment)
  id: 'standing-desks', name: 'Standing desks', description: '+5 starting drinks of each kind per level',
  group: 'developers', maxLevel: 3,
  getCost(level) { return [10, 20, 30][level] ?? Infinity; },
  apply(game, level) { for (const id of Object.keys(game.drinks)) game.drinks[id] += 5 * level; },   // runs once at the start of every run
  effectText(level) { return `+${5 * level} starting drinks each`; },
});
*/
