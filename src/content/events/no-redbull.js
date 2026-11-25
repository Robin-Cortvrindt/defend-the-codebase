// Event: out of Red Bull. .NET developers work at half speed.
import { registerEvent } from '../../engine/registry.js';

registerEvent({
  id: 'no-redbull', name: 'Out of Red Bull', description: '.NET developers work at half speed', accent: '#C026D3',
  start(game) { game.mods.devFireRate.dotnet = (game.mods.devFireRate.dotnet ?? 1) * 0.5; },
  end(game) { game.mods.devFireRate.dotnet = (game.mods.devFireRate.dotnet ?? 1) / 0.5; },
});
