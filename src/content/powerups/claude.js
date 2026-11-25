import { registerPowerup } from '../../engine/registry.js';
import { spawnBug, killBug, addEffect } from '../../engine/game.js';
import { emit } from '../../engine/events.js';
import { powerupState } from '../../engine/powerups.js';

// Claude: squashes every bug on the map at once. Gets pricier each use,
// and 1 in 4 times it hallucinates and doubles the bugs instead.
export const BASE_COST = 150;
export const COST_GROWTH = 1.5;
export const BACKFIRE_CHANCE = 0.25;

const claude = {
  id: 'claude',
  name: 'Claude',
  description: 'Squash every bug',
  duration: 0,
  cooldown: 0,
  getCost(game) { return Math.round(BASE_COST * COST_GROWTH ** powerupState(game, 'claude').uses); },
  canActivate(game) { return game.bugs.length > 0; },
  activate(game) {
    if (game.random() < BACKFIRE_CHANCE) {
      for (const bug of [...game.bugs]) {
        const clone = spawnBug(game, bug.type, bug.distance, bug.hp);
        if (clone) clone.jitter = (game.random() - 0.5) * 14;
      }
      game.stats.backfires++;
      addEffect(game, { kind: 'banner', title: 'Claude · backfire', text: 'Hallucinated a fix — bug count doubled', accent: '#EA580C', ttl: 2.5 });
      emit('claude:backfire', { game });
    } else {
      for (const bug of [...game.bugs]) killBug(game, bug, null);
      addEffect(game, { kind: 'flash', ttl: 0.35 });
      addEffect(game, { kind: 'banner', title: 'Claude · success', text: 'Every bug squashed', accent: '#16A34A', ttl: 2.5 });
    }
  },
};
registerPowerup(claude);
export default claude;
