import { registerBug } from '../../engine/registry.js';
import { drawBugLegs, COLORS } from '../../engine/render.js';

// Big, slow and tanky. The fuchsia ring says: .NET counters it.
// A beetle whose shell is a floppy disk, kicking up dust as it trudges along.
const FUCHSIA = '#C026D3';
const DISK = '#4A044E';

registerBug({
  id: 'legacy', name: 'Legacy bug', ring: FUCHSIA, radius: 14, hp: 200, speed: 25, livesLost: 3, reward: 8, legs: true,
  draw(ctx, r, bug, time) {
    const s = r / 14;
    ctx.save(); ctx.scale(s, s);
    // dust behind it
    for (let i = 0; i < 4; i++) {
      const k = (time * 1.5 + i / 4) % 1;
      ctx.globalAlpha = 0.3 * (1 - k); ctx.fillStyle = COLORS.s400;
      ctx.beginPath(); ctx.arc(-18 - k * 18, (i % 2 ? 6 : -6) + Math.sin(i) * 3, 2 + k * 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawBugLegs(ctx, 14, (bug?.distance ?? time * 25) * 0.6, COLORS.s400, 0.95);
    ctx.fillStyle = COLORS.navy3; ctx.beginPath(); ctx.arc(15, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = FUCHSIA; ctx.lineWidth = 2; ctx.stroke();
    // the floppy disk, seen from above, label at the back
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = DISK;
    ctx.beginPath(); ctx.moveTo(-13, -13); ctx.lineTo(9, -13); ctx.lineTo(13, -9); ctx.lineTo(13, 13); ctx.lineTo(-13, 13); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = FUCHSIA; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#CBD5E1'; ctx.fillRect(-6, -13, 12, 8);
    ctx.fillStyle = DISK; ctx.fillRect(1, -11.5, 3, 5);
    ctx.fillStyle = '#F5F5F4'; ctx.fillRect(-9, 1, 18, 10);
    ctx.strokeStyle = '#A8A29E'; ctx.lineWidth = 0.8;
    for (const y of [4, 6.5, 9]) { ctx.beginPath(); ctx.moveTo(-7, y); ctx.lineTo(7, y); ctx.stroke(); }
    ctx.restore();
  },
});
