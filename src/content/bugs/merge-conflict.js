import { registerBug } from '../../engine/registry.js';
import { spawnBug, addEffect } from '../../engine/game.js';

// Merge conflict: squash it and it splits into two smaller, faster halves, "ours" and "theirs".
// Grey ring: no developer counters it, everybody has to resolve it together.
export const GREY = '#64748B';
export const HALF_GAP = 12;   // px between the two halves on the path

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
