import { registerDeveloper } from '../../engine/registry.js';

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
