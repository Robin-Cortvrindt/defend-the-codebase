import { registerDeveloper } from '../../engine/registry.js';
import { addEffect } from '../../engine/game.js';
import { on } from '../../engine/events.js';
import { bugsInRange, hitBug } from '../../engine/devs.js';

on('dev:placed', ({ game, dev }) => {
  if (dev.type !== 'java') return;
  addEffect(game, { kind: 'pop', x: dev.x, y: dev.y - 26, text: 'Initializing 847 beans…', ttl: 1 });
});

// Java: balanced speed and damage. Counters null pointers.
registerDeveloper({
  id: 'java',
  drink: 'coffee',
  name: 'Java',
  accent: '#EA580C',
  cost: 75,
  damage: 18,
  fireRate: 1.5,
  range: 2.2,
  counters: 'nullpointer',
  blurb: 'Balanced all-rounder',
  levelName: 'Junior Java Dev',
  upgrades: {
    level2: { id: 'springboot', name: 'Spring Boot Dev', cost: 25, description: '+damage, +range', stats: { damage: 40, range: 2.6 } },
    level3: [
      {
        id: 'architect', name: 'Enterprise Architect', kind: 'steady', cost: 40,
        description: 'Less damage itself, +15% damage to developers nearby',
        tooltip: "I don't code anymore, I enable.",
        modifyStats(game, dev, stats) { stats.damage *= 0.9; },
        aura: { radius: 5, apply(game, dev, stats) { stats.damage *= 1.15; } },
      },
      {
        id: 'gc', name: 'Garbage Collector', kind: 'gamble', cost: 120,
        description: 'Stop-the-World, then a pulse',
        update(game, dev, dt, stats) {
          const st = dev.state;
          st.gcT = (st.gcT ?? 0) + dt;
          if (st.gcT >= 9) {
            for (const bug of bugsInRange(game, dev, stats.range)) hitBug(game, dev, bug, 2 * stats.damage);
            addEffect(game, { kind: 'ring', x: dev.x, y: dev.y, color: '#EA580C', radius: stats.range, ttl: 0.5 });
            st.gcT = 0; st.stopped = false;
            return true;
          }
          if (st.gcT >= 8) {
            if (!st.stopped) {
              st.stopped = true;
              addEffect(game, { kind: 'pop', x: dev.x, y: dev.y - 26, text: 'Stop-the-World', ttl: 1 });
            }
            return false;
          }
          return true;
        },
      },
    ],
  },
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
