// Event: out of Red Bull. .NET developers work at half speed, less with an energy drink fridge.
import { registerEvent } from '../../engine/registry.js';
import { resistanceTo } from '../../engine/upgrades.js';

const event = {
  id: 'no-redbull', name: 'Out of Red Bull', description: '.NET developers work at half speed', accent: '#C026D3',
  start(game) {
    const f = 0.5 + 0.5 * resistanceTo(game, 'no-redbull');
    game.redbullFactor = f;
    if (f !== 1) game.mods.devFireRate.dotnet = (game.mods.devFireRate.dotnet ?? 1) * f;
  },
  end(game) {
    const f = game.redbullFactor ?? 1;
    if (f !== 1) {
      const v = (game.mods.devFireRate.dotnet ?? 1) / f;
      if (Math.abs(v - 1) < 1e-9) delete game.mods.devFireRate.dotnet; else game.mods.devFireRate.dotnet = v;
    }
    game.redbullFactor = 1;
  },
};
registerEvent(event);
export default event;
