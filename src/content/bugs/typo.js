import { registerBug } from '../../engine/registry.js';

// Tiny, fast and plentiful. The blue ring says: React counters it.
// Looks like the wavy spelling-mistake underline, crawling like a worm.
const BLUE = '#2563EB';

registerBug({
  id: 'typo', name: 'Typo bug', ring: BLUE, radius: 5, hp: 10, speed: 70, livesLost: 1, reward: 1,
  draw(ctx, r, bug, time) {
    const s = r / 5, step = bug?.distance ?? time * 70;
    ctx.save(); ctx.scale(s, s);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const pts = [];
    for (let i = 0; i <= 14; i++) pts.push([-12 + i * 1.1, Math.sin(i * 0.9 - step * 0.3) * 2.6]);
    for (const [c, w] of [['rgba(37,99,235,.35)', 6], [BLUE, 3]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    const [hx, hy] = pts[pts.length - 1];
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + 1.5, hy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = BLUE; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
  },
});
