import { registerDeveloper } from '../../engine/registry.js';

// React (front-end): fast, light hits. Counters swarms of typo bugs.
registerDeveloper({
  id: 'react',
  name: 'React',
  accent: '#2563EB',
  cost: 50,
  damage: 6,
  fireRate: 4,
  range: 2.2,
  counters: 'typo',
  blurb: 'Fast, light hits',
  drawIcon(ctx, size) {
    const s = size / 36;
    ctx.save();
    ctx.scale(s, s);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.8;
    for (const a of [0, Math.PI / 3, -Math.PI / 3]) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 13, 5, a, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
});
