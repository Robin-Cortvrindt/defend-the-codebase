import { registerDeveloper } from '../../engine/registry.js';
import { addEffect } from '../../engine/game.js';
import { on } from '../../engine/events.js';
import { bugsInRange, hitBug } from '../../engine/devs.js';
import { zigzagPoint } from '../../engine/zigzag.js';
import { pctText } from '../../engine/effects.js';

export const ARCHITECT_OWN = 0.9;     // the Architect's own damage factor
export const ARCHITECT_AURA = 1.15;   // damage factor for developers nearby

on('dev:placed', ({ game, dev }) => {
  if (dev.type !== 'java') return;
  addEffect(game, { kind: 'pop', x: dev.x, y: dev.y - 26, text: 'Initializing 847 beans…', ttl: 1 });
});

// Java: balanced speed and damage. Counters null pointers.
// Its attack is the steam off its coffee: the two wisps lift off the cup and curl into the bug.
const ORANGE = '#EA580C';
const STEAM_X = [-4, 2];      // the icon's two steam lines (icon units, 36 = one tile)
const STEAM_REGROW = 0.35;    // seconds for new steam to rise out of the cup after a shot
const BODY = 0.5;             // length of a wisp, as a share of the distance to the bug

// A point on a wisp from `from` to `to` at s (0..1): lazy S-curves, pinned at both ends.
// A tipsy wisp (wine tasting) weaves around a zigzag centre line instead of a straight one.
function wispPoint(s, from, to, time, phase, side, zig) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const waves = Math.max(1.2, len / 70), env = Math.sin(Math.PI * s);
  const off = (zig == null ? 10 : 8) * env * Math.sin(2 * Math.PI * waves * s - time * 9 + phase) + side * 3 * env;
  const c = zig == null ? { x: from.x + dx * s, y: from.y + dy * s } : zigzagPoint(from, to, s, zig, 16);
  return { x: c.x + nx * off, y: c.y + ny * off };
}

function strokeWisp(ctx, tail, head, from, to, time, phase, side, zig) {
  if (head <= tail) return;
  const N = 28, pts = [];
  for (let i = 0; i <= N; i++) pts.push(wispPoint(tail + (head - tail) * (i / N), from, to, time, phase, side, zig));
  ctx.lineCap = 'round';
  // White haze under an orange-hot core; thinner and fainter towards the tail, as if evaporating.
  for (const pass of [{ c: '#fff', w: 7, a: 0.12 }, { c: ORANGE, w: 3, a: 0.95 }]) {
    ctx.strokeStyle = pass.c;
    for (let i = 1; i <= N; i++) {
      const k = i / N;
      ctx.globalAlpha = pass.a * (0.15 + 0.85 * k);
      ctx.lineWidth = pass.w * (0.45 + 0.55 * k);
      ctx.beginPath(); ctx.moveTo(pts[i - 1].x, pts[i - 1].y); ctx.lineTo(pts[i].x, pts[i].y); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

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
        modifyStats(game, dev, stats) { stats.damage *= ARCHITECT_OWN; },
        describeEffect: () => `damage ${pctText(ARCHITECT_OWN)}, ${pctText(ARCHITECT_AURA)} damage to developers nearby`,
        aura: {
          radius: 5,
          apply(game, dev, stats) { stats.damage *= ARCHITECT_AURA; },
          describe: () => `damage ${pctText(ARCHITECT_AURA)}`,
        },
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
  attackDuration: 0.42,
  attackHitAt: 0.66,   // the head of the steam reaches the bug
  drawAttack(ctx, { from, to, progress, time, seed, tipsy }) {
    const travel = progress * (1 + BODY);
    const head = Math.min(1, travel), tail = Math.max(0, travel - BODY);
    const phase = seed * 6.28;
    STEAM_X.forEach((sx, i) => {
      const origin = { x: from.x + sx, y: from.y - 10 };
      strokeWisp(ctx, tail, head, origin, to, time, phase + i * Math.PI, i ? 1 : -1, tipsy ? seed : null);
    });
    // A few small puffs where the steam sinks into the bug.
    if (head >= 1 && tail < 1) {
      const k = 1 - tail;
      ctx.globalAlpha = 0.35 * k; ctx.fillStyle = ORANGE;
      for (let j = 0; j < 3; j++) {
        const a = phase + j * 2.1, r = 12 + (1 - k) * 10;
        ctx.beginPath(); ctx.arc(to.x + Math.cos(a) * r, to.y + Math.sin(a) * r * 0.7, 3 + (1 - k) * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  },
  // `dev` and `time` are only given on the board: the steam is gone right after a shot and rises back.
  drawIcon(ctx, size, dev, time) {
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
    // steam, rising out of the cup (clipped from the cup up) after a shot
    const since = dev?.lastShotAt != null && time != null ? time - dev.lastShotAt : Infinity;
    const grow = Math.max(0, Math.min(1, since / STEAM_REGROW));
    if (grow > 0) {
      ctx.save();
      ctx.beginPath(); ctx.rect(-20, -3 - 10 * grow, 40, 10 * grow); ctx.clip();
      ctx.globalAlpha = grow;
      ctx.lineWidth = 1.8;
      for (const x of STEAM_X) {
        ctx.beginPath();
        ctx.moveTo(x, -12);
        ctx.quadraticCurveTo(x - 3, -9.5, x, -7);
        ctx.quadraticCurveTo(x + 3, -4.5, x, -3);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  },
});
