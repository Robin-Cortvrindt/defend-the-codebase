// Event: Thomas organized a wine tasting. Tipsy developers shoot a random bug in range instead of
// the one furthest along, and their shots zigzag. The water cooler sobers up a third of the shots per level.
// No stats change: targeting reads game.activeEvent (pickTarget in engine/devs.js).
import { registerEvent } from '../../engine/registry.js';

const wineTasting = {
  id: 'wine-tasting', name: 'Thomas organized a wine tasting', description: 'Developers shoot at random bugs', accent: '#9F1239',
  start() {},
  end() {},
};
registerEvent(wineTasting);
export default wineTasting;
