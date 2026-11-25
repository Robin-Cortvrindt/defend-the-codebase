import { registerBug } from '../../engine/registry.js';

// Memory leak: starts small and keeps growing the longer it lives, up to twice its health and twice
// its size. Squash it early. Grey ring: no developer counters it.
export const GREY = '#64748B';
export const LEAK_COLOR = '#001E32';   // navy droplet
export const GROWTH_PER_SECOND = 0.08; // +8% of its starting health every second
export const MAX_GROWTH = 2;           // stops growing at 2x (after 12.5 s)
export const BASE_RADIUS = 7;
export const MAX_RADIUS = 14;

// Grow the bug to `factor` times its starting health. Damage already taken stays taken.
export function growLeak(bug, factor) {
  bug.baseHp ??= bug.maxHp;
  const maxHp = Math.round(bug.baseHp * factor);
  bug.hp += maxHp - bug.maxHp;
  bug.maxHp = maxHp;
  bug.radius = BASE_RADIUS + (MAX_RADIUS - BASE_RADIUS) * (factor - 1) / (MAX_GROWTH - 1);
}

registerBug({
  id: 'memory-leak',
  name: 'Memory leak',
  ring: GREY,
  radius: BASE_RADIUS,
  hp: 20,
  speed: 30,
  livesLost: 2,
  reward: 4,
  legs: true,
  update(bug, game, dt) {
    bug.age = (bug.age ?? 0) + dt;
    growLeak(bug, Math.min(MAX_GROWTH, 1 + GROWTH_PER_SECOND * bug.age));
  },
  // A droplet that fills up as the leak grows.
  drawIcon(ctx, r, bug) {
    const fill = Math.min(1, ((bug?.radius ?? r) - BASE_RADIUS) / (MAX_RADIUS - BASE_RADIUS));
    const h = r * 0.75;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.bezierCurveTo(h * 0.7, -h * 0.1, h * 0.7, h * 0.8, 0, h * 0.8);
    ctx.bezierCurveTo(-h * 0.7, h * 0.8, -h * 0.7, -h * 0.1, 0, -h);
    ctx.fillStyle = LEAK_COLOR;
    ctx.globalAlpha = 0.35 + 0.65 * fill;
    ctx.fill();
    ctx.restore();
  },
});
