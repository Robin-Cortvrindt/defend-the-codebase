import { registerDeveloper } from '../../engine/registry.js';
import { addEffect } from '../../engine/game.js';
import { bugsInRange, hitBug, shotBeam } from '../../engine/devs.js';

// .NET: slow, heavy hits and a longer range. Counters legacy bugs.
registerDeveloper({
  id: 'dotnet',
  name: '.NET',
  accent: '#C026D3',
  cost: 110,
  damage: 55,
  fireRate: 0.6,
  range: 2.6,
  counters: 'legacy',
  blurb: 'Slow, heavy hits',
  levelName: '.NET Framework 4.8',
  upgrades: {
    level2: { id: 'core', name: '.NET Core', cost: 50, description: 'Faster attacks', stats: { fireRate: 0.9 } },
    level3: [
      {
        id: 'vs', name: 'Visual Studio Enterprise', kind: 'steady', cost: 70,
        description: 'Huge single hit',
        stats: { damage: 160, fireRate: 0.6 },
      },
      {
        id: 'azure', name: 'Azure Function', kind: 'gamble', cost: 100,
        description: 'Area damage, pay-as-you-go',
        update(game, dev, dt, stats) {
          if (dev.state.azureOff) return false;
          if (bugsInRange(game, dev, stats.range).length === 0) return true;
          dev.state.bill = (dev.state.bill ?? 0) + dt;
          while (dev.state.bill >= 0.5 && game.warrants > 0) {
            game.warrants -= 1;
            dev.state.bill -= 0.5;
          }
          if (game.warrants <= 0) dev.state.bill = 0; // no debt while broke
          return game.warrants > 0;
        },
        fire(game, dev, target, stats) {
          const { x, y } = target;
          shotBeam(game, dev, target);
          addEffect(game, { kind: 'ring', x, y, color: dev.accent ?? '#C026D3', ttl: 0.4 });
          for (const bug of bugsInRange(game, dev, stats.range + 40)) {
            if (Math.hypot(bug.x - x, bug.y - y) <= 40) hitBug(game, dev, bug, stats.damage);
          }
        },
        panelButtons(game, dev) {
          return [{
            label: dev.state.azureOff ? 'Azure off' : 'Azure on',
            onClick: (g, d) => { d.state.azureOff = !d.state.azureOff; },
          }];
        },
      },
    ],
  },
  drawIcon(ctx, size) {
    const s = size / 36;
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = '#fff';
    ctx.font = '900 13px Lato, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('.NET', 0, 1);
    ctx.restore();
  },
});
