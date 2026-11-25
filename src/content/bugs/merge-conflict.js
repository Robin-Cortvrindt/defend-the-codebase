import { registerBug } from '../../engine/registry.js';
import { spawnBug, addEffect } from '../../engine/game.js';
import { drawBugLegs } from '../../engine/render.js';

// Merge conflict: squash it and it splits into two smaller, faster halves, "ours" and "theirs".
// Grey ring: no developer counters it, everybody has to resolve it together.
export const GREY = '#64748B';
export const HALF_GAP = 12;   // px between the two halves on the path
// Diff colours, kept pale so the grey outline stays the "nobody counters this" signal (and the
// red half never reads as the boss's dark red).
const DIFF = { plus: { fill: '#BBF7D0', ink: '#15803D' }, minus: { fill: '#FECACA', ink: '#B91C1C' } };

// A + or − of the diff at (x, y).
function sign(ctx, x, y, plus) {
  ctx.strokeStyle = (plus ? DIFF.plus : DIFF.minus).ink; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 3, y); ctx.lineTo(x + 3, y);
  if (plus) { ctx.moveTo(x, y - 2.5); ctx.lineTo(x, y + 2.5); }
  ctx.stroke();
}

registerBug({
  id: 'merge-conflict',
  name: 'Merge conflict',
  ring: GREY,
  radius: 10,
  hp: 30,
  speed: 35,
  livesLost: 2,
  reward: 3,
  legs: true,
  onDeath(bug, game) {
    for (const [side, offset] of [['ours', 0], ['theirs', -HALF_GAP]]) {
      const half = spawnBug(game, 'merge-conflict-half', Math.max(0, bug.distance + offset));
      if (half) half.side = side;
    }
    addEffect(game, { kind: 'pop', x: bug.x, y: bug.y - 16, text: 'CONFLICT', color: GREY, size: 11, ttl: 0.8 });
  },
  // A diff: a pale-green + half and a pale-red − half along a zigzag seam, with a thick grey outline.
  draw(ctx, r, bug, time) {
    const s = r / 10;
    ctx.save(); ctx.scale(s, s);
    drawBugLegs(ctx, 10, bug?.distance ?? time * 35);
    const shell = () => { ctx.beginPath(); ctx.ellipse(0, 0, 11, 8.5, 0, 0, Math.PI * 2); };
    ctx.save(); shell(); ctx.clip();
    ctx.fillStyle = DIFF.plus.fill; ctx.fillRect(-12, -10, 24, 10);
    ctx.fillStyle = DIFF.minus.fill; ctx.fillRect(-12, 0, 24, 10);
    ctx.restore();
    ctx.strokeStyle = GREY; ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) { const x = -11 + i * 2.75; if (i) ctx.lineTo(x, i % 2 ? -1.5 : 1.5); else ctx.moveTo(x, 0); }
    ctx.stroke();
    shell(); ctx.strokeStyle = GREY; ctx.lineWidth = 3; ctx.stroke();
    sign(ctx, 0, -4.5, true);
    sign(ctx, 0, 4.5, false);
    ctx.restore();
  },
  // Conflict markers: <<< over >>>.
  drawIcon(ctx, r) {
    ctx.save();
    ctx.strokeStyle = GREY; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const s = r / 10;
    ctx.beginPath();
    ctx.moveTo(-2 * s, -6 * s); ctx.lineTo(-6 * s, -3 * s); ctx.lineTo(-2 * s, 0);
    ctx.moveTo(2 * s, 0); ctx.lineTo(6 * s, 3 * s); ctx.lineTo(2 * s, 6 * s);
    ctx.moveTo(-7 * s, 0); ctx.lineTo(7 * s, 0);
    ctx.stroke();
    ctx.restore();
  },
});

// One half of a squashed merge conflict. Not spawned by waves, only by onDeath above.
registerBug({
  id: 'merge-conflict-half',
  name: 'Conflict half',
  ring: GREY,
  radius: 6,
  hp: 8,
  speed: 42,
  livesLost: 1,
  reward: 1,
  legs: true,
  // "ours" is the pale-green + half, "theirs" the pale-red − half.
  draw(ctx, r, bug, time) {
    const plus = bug?.side !== 'theirs', s = r / 6;
    ctx.save(); ctx.scale(s, s);
    drawBugLegs(ctx, 6, bug?.distance ?? time * 42);
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 5.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = (plus ? DIFF.plus : DIFF.minus).fill; ctx.fill();
    ctx.strokeStyle = GREY; ctx.lineWidth = 2; ctx.stroke();
    sign(ctx, 0, 0, plus);
    ctx.restore();
  },
  // A single chevron: "<" for ours, ">" for theirs.
  drawIcon(ctx, r, bug) {
    const d = bug?.side === 'theirs' ? 1 : -1;
    ctx.save();
    ctx.strokeStyle = GREY; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-d * r * 0.3, -r * 0.5); ctx.lineTo(d * r * 0.4, 0); ctx.lineTo(-d * r * 0.3, r * 0.5);
    ctx.stroke();
    ctx.restore();
  },
});
