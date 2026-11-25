import { registerBug } from '../../engine/registry.js';
import { drawBugLegs, COLORS } from '../../engine/render.js';

// Medium bug. The orange ring says: Java counters it.
// A beetle with an orange shell and the ∅ null sign on its back.
const ORANGE = '#EA580C';

registerBug({
  id: 'nullpointer', name: 'Null pointer', ring: ORANGE, radius: 9, hp: 45, speed: 45, livesLost: 1, reward: 3, legs: true,
  draw(ctx, r, bug, time) {
    const s = r / 9;
    ctx.save(); ctx.scale(s, s);
    drawBugLegs(ctx, 9, bug?.distance ?? time * 45);
    // head and antennae
    ctx.fillStyle = COLORS.navy3; ctx.beginPath(); ctx.arc(10, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = COLORS.s400; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(13, -2); ctx.lineTo(17, -5); ctx.moveTo(13, 2); ctx.lineTo(17, 5); ctx.stroke();
    // shell, split down the middle
    ctx.beginPath(); ctx.ellipse(-1, 0, 10, 8, 0, 0, Math.PI * 2); ctx.fillStyle = ORANGE; ctx.fill();
    ctx.strokeStyle = '#9A3412'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-11, 0); ctx.stroke();
    // ∅
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(-1, 0, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4.5, 4); ctx.lineTo(2.5, -4); ctx.stroke();
    ctx.restore();
  },
});
