// Event: Thomas organized a wine tasting. Tipsy developers shoot a random bug in range instead of
// the one furthest along, and their shots zigzag. The water cooler sobers up a third of the shots per level.
// No stats change: targeting reads game.activeEvent (pickTarget in engine/devs.js).
import { registerEvent } from '../../engine/registry.js';
import { resistanceTo } from '../../engine/upgrades.js';

const wineTasting = {
  id: 'wine-tasting', name: 'Thomas organized a wine tasting', description: 'Developers shoot at random bugs', accent: '#9F1239',
  describeEffect(game) {
    const r = resistanceTo(game, 'wine-tasting');
    return r >= 1 ? null : `tipsy: ${Math.round((1 - r) * 100)}% of shots at random bugs`;
  },
  start() {},
  end() {},
};
registerEvent(wineTasting);
export default wineTasting;
