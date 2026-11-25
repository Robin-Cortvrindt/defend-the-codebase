import { registerDeveloper } from '../../engine/registry.js';
import { bugsInRange, hitBug, shotBeam } from '../../engine/devs.js';

// React (front-end): fast, light hits. Counters swarms of typo bugs.
registerDeveloper({
  id: 'react',
  drink: 'redbull',
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
