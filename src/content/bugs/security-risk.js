import { registerBug } from '../../engine/registry.js';
import { addEffect } from '../../engine/game.js';
import { drawBugLegs } from '../../engine/render.js';

const RED = '#DC2626', DARK = '#7F1D1D', DARKER = '#450A0A', LOCK = '#FECACA';

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
  // A big dark-red armoured beetle with an unlocked padlock on its back and a pulsing alarm ring.
  draw(ctx, r, bug, time) {
    const s = r / 18;
    ctx.save(); ctx.scale(s, s);
    const p = (time * 1.3) % 1;
    ctx.globalAlpha = 0.5 * (1 - p); ctx.strokeStyle = RED; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 22 + p * 14, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    drawBugLegs(ctx, 18, (bug?.distance ?? time * 22) * 0.5, DARK, 0.9);
    // head and mandibles
    ctx.fillStyle = DARKER; ctx.beginPath(); ctx.arc(19, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = RED; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = DARK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(24, -3); ctx.quadraticCurveTo(30, -6, 30, -11); ctx.moveTo(24, 3); ctx.quadraticCurveTo(30, 6, 30, 11); ctx.stroke();
    // armour plates
    ctx.beginPath(); ctx.ellipse(-1, 0, 19, 15, 0, 0, Math.PI * 2); ctx.fillStyle = DARK; ctx.fill();
    ctx.strokeStyle = RED; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = DARKER; ctx.lineWidth = 1.5;
    for (const x of [-11, 9]) { ctx.beginPath(); ctx.ellipse(-1, 0, Math.abs(x + 1), 15, 0, -Math.PI / 2, Math.PI / 2, x < 0); ctx.stroke(); }
    // open padlock
    ctx.translate(-1, 1); ctx.scale(0.95, 0.95);
    ctx.strokeStyle = LOCK; ctx.fillStyle = LOCK; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, -6, 5, Math.PI, -0.1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(-5, -3); ctx.stroke();
    ctx.fillRect(-7, -3, 14, 10);
    ctx.fillStyle = DARKER; ctx.fillRect(-1, 0, 2, 4);
    ctx.restore();
  },
  // Padlock on the body (the look before bugs drew themselves).
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
