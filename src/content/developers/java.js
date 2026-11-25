import { registerDeveloper } from '../../engine/registry.js';

// Java: balanced speed and damage. Counters null pointers.
registerDeveloper({
  id: 'java',
  name: 'Java',
  accent: '#EA580C',
  cost: 75,
  damage: 18,
  fireRate: 1.5,
  range: 2.2,
  counters: 'nullpointer',
  blurb: 'Balanced all-rounder',
  drawIcon(ctx, size) {
    const s = size / 36;
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    // cup
    ctx.beginPath();
    ctx.moveTo(-9, -1);
    ctx.lineTo(6, -1);
    ctx.lineTo(6, 5);
    ctx.arc(-1.5, 5, 7.5, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    // handle
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(7.5, 4, 3, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // saucer
    ctx.beginPath();
    ctx.moveTo(-11, 14.5);
    ctx.lineTo(8, 14.5);
    ctx.stroke();
    // steam
    ctx.lineWidth = 1.8;
    for (const x of [-4, 2]) {
      ctx.beginPath();
      ctx.moveTo(x, -12);
      ctx.quadraticCurveTo(x - 3, -9.5, x, -7);
      ctx.quadraticCurveTo(x + 3, -4.5, x, -3);
      ctx.stroke();
    }
    ctx.restore();
  },
});
