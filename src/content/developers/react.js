import { registerDeveloper } from '../../engine/registry.js';
import { bugsInRange, hitBug, shotBeam } from '../../engine/devs.js';

// React (front-end): fast, light hits. Counters swarms of typo bugs.
// Its attack: small hooks thrown spinning on a curve, alternating left and right, that stick in the bug.
const BLUE = '#2563EB';
const FLY = 0.6;   // share of the attack spent in the air; the rest it sticks in the bug and fades

// A fishing hook at the origin pointing along +x, its eye at the back.
function hook(ctx, scale) {
  ctx.save(); ctx.scale(scale, scale);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(3, 0);
    ctx.arc(3, 4, 4, -Math.PI / 2, Math.PI / 2); ctx.lineTo(-1, 8); ctx.lineTo(-1, 5.5);
  };
  ctx.strokeStyle = BLUE; ctx.lineWidth = 4.2; path(); ctx.stroke();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; path(); ctx.stroke();
  ctx.restore();
}

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
  levelName: 'Create React App',
  modifyStats(game, dev, stats) {
    const others = game.devs.filter(d => d.type === 'react' && d !== dev).length;
    stats.fireRate *= 1 + 0.1 * Math.min(5, others);
  },
  upgrades: {
    level2: { id: 'vite', name: 'Vite', cost: 30, description: 'Much faster rate of fire', tooltip: 'CRA is deprecated, sorry.', stats: { fireRate: 6 } },
    level3: [
      {
        id: 'nextjs', name: 'Next.js', kind: 'steady', cost: 50,
        description: 'Hits pierce 2 more bugs',
        tooltip: 'Renders before they arrive.',
        fire(game, dev, target, stats) {
          const list = bugsInRange(game, dev, stats.range);
          const i = list.indexOf(target);
          const hits = i < 0 ? [target] : list.slice(i, i + 3);
          for (const bug of hits) {
            shotBeam(game, dev, bug);
            hitBug(game, dev, bug, stats.damage);
          }
        },
      },
      {
        id: 'effecthell', name: 'useEffect Hell', kind: 'gamble', cost: 35,
        description: 'Harder hits, 20% chance each hit re-renders',
        stats: { damage: 9 },
        fire(game, dev, target, stats) {
          shotBeam(game, dev, target);
          hitBug(game, dev, target, stats.damage);
          let cur = target;
          for (let n = 0; n < 10 && game.random() < 0.2; n++) {
            if (cur.dead) cur = bugsInRange(game, dev, stats.range)[0];
            if (!cur) break;
            shotBeam(game, dev, cur);
            hitBug(game, dev, cur, stats.damage);
          }
        },
      },
    ],
  },
  attackDuration: 0.22,
  attackHitAt: FLY,
  drawAttack(ctx, { from, to, progress, shot }) {
    const side = shot % 2 ? 1 : -1;
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len, ang = Math.atan2(dy, dx);
    ctx.save();
    if (progress < FLY) {
      const f = progress / FLY, bow = Math.sin(Math.PI * f) * 30 * side;
      ctx.translate(from.x + dx * f + nx * bow, from.y + dy * f + ny * bow);
      ctx.rotate(f * Math.PI * 4 * side);
    } else {
      const k = (progress - FLY) / (1 - FLY);
      ctx.globalAlpha = 1 - k;
      ctx.translate(to.x - Math.cos(ang) * 8 + nx * side * 5, to.y - Math.sin(ang) * 8 + ny * side * 5);
      ctx.rotate(ang);
    }
    hook(ctx, 0.75);
    ctx.restore();
  },
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
