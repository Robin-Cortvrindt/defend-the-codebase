import { registerBug } from '../../engine/registry.js';
import { addEffect } from '../../engine/game.js';

// Boss: walks in at the end of every sprint. Huge, slow, and no developer counters it,
// so everybody has to chip in. The red ring and padlock mark it. Letting it through hurts.
registerBug({
  id: 'security-risk',
  name: 'Security risk',
  boss: true,
  ring: '#DC2626',
  radius: 18,
  hp: 300,
  speed: 22,
  livesLost: 5,
  reward: 30,
  legs: true,
  update(bug, game) {
    if (bug.announced) return;
    bug.announced = true;
    addEffect(game, { kind: 'pop', x: bug.x, y: bug.y - 28, text: 'SECURITY RISK!', color: '#DC2626', size: 15, ttl: 1.5 });
  },
  // Padlock on the body.
  drawIcon(ctx, r) {
    const s = r / 18;
    ctx.save();
    ctx.scale(s, s);
    ctx.strokeStyle = '#DC2626'; ctx.fillStyle = '#DC2626'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -3, 5, Math.PI, 0); ctx.stroke();
    ctx.fillRect(-7, -3, 14, 10);
    ctx.fillStyle = '#fff'; ctx.fillRect(-1, 0, 2, 4);
    ctx.restore();
  },
});
