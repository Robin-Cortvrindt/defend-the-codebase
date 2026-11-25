import { registerPowerup, getBug } from '../../engine/registry.js';
import { spawnBug, killBug, addEffect } from '../../engine/game.js';
import { emit } from '../../engine/events.js';
import { powerupMod } from '../../engine/powerups.js';

// Claude: squashes every bug on the map at once. Free, on a 90 s cooldown,
// and 1 in 4 times it hallucinates and doubles the bugs instead.
export const BACKFIRE_CHANCE = 0.25;
export const MIN_BACKFIRE_CHANCE = 0.10;

// Prompt engineering (investment) takes 5 points off the backfire chance per level.
export const backfireChance = game => Math.max(MIN_BACKFIRE_CHANCE, BACKFIRE_CHANCE - 0.05 * powerupMod(game, 'claude').effect);

// Bugs flagged `claudeImmune` (the Trojan horse) are neither squashed nor copied by Claude.
const hittable = bug => !getBug(bug.type)?.claudeImmune;

const claude = {
  id: 'claude',
  name: 'Claude',
  description: 'Squash every bug',
  duration: 0,
  cooldown: 90,
  describe(game) { return `Squash every bug · ${Math.round(backfireChance(game) * 100)}% backfire`; },
  canActivate(game) { return game.bugs.some(hittable); },
  activate(game) {
    if (game.random() < backfireChance(game)) {
      for (const bug of game.bugs.filter(hittable)) {
        const clone = spawnBug(game, bug.type, bug.distance, bug.hp);
        if (clone) clone.jitter = (game.random() - 0.5) * 14;
      }
      game.stats.backfires++;
      addEffect(game, { kind: 'banner', title: 'Claude · backfire', text: 'Hallucinated a fix — bug count doubled', accent: '#EA580C', ttl: 2.5 });
      emit('claude:backfire', { game });
    } else {
      for (const bug of game.bugs.filter(hittable)) killBug(game, bug, null);
      addEffect(game, { kind: 'flash', ttl: 0.35 });
      addEffect(game, { kind: 'banner', title: 'Claude · success', text: 'Every bug squashed', accent: '#16A34A', ttl: 2.5 });
    }
  },
};
registerPowerup(claude);
export default claude;
