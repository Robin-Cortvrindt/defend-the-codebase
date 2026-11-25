// Unlock: Robot vacuum.
// A robot vacuum drives to the nearest dropped drink that has landed and collects it for you, then parks
// at its dock in the bottom-left corner when the floor is clean. Each level makes it faster, but it is always
// slower than an untrapped goblin. Clicking drinks yourself still works as before: it's a helper.
// Built like security-training.js: one investment + one feature, gated on game.unlocks.
import { registerInvestment, registerFeature } from '../../engine/registry.js';
import { HEIGHT } from '../../engine/map.js';
import { nearestDrop, collectDrop } from '../../engine/drops.js';

export const VACUUM_SPEEDS = [70, 100, 130];   // px/s for levels 1-3
export const DOCK = { x: 22, y: HEIGHT - 18 };
const COLLECT_RADIUS = 14;

const investment = {
  id: 'robot-vacuum',
  name: 'Robot vacuum',
  description: 'A robot vacuum collects dropped drinks for you. Each level makes it faster.',
  group: 'unlocks',
  maxLevel: 3,
  getCost(level) { return [40, 30, 50][level] ?? Infinity; },
  apply(game, level) { game.unlocks.vacuum = level; },
  effectText(level) { return `Robot vacuum: ${VACUUM_SPEEDS[level - 1]} px/s`; },
};

const parked = () => ({ x: DOCK.x, y: DOCK.y, angle: 0, moving: false });
// The engine doesn't call init (a new run is a new game object), so the state is also made on first use.
const state = game => (game.vacuum ??= parked());

export const vacuumFeature = {
  id: 'robot-vacuum',
  init(game) { game.vacuum = parked(); },
  update(game, dt) {
    const level = game.unlocks?.vacuum;
    if (!level || (game.phase !== 'wave' && game.phase !== 'bell')) return;
    const v = state(game);
    const target = nearestDrop(game, v.x, v.y);
    const tx = target ? target.x : DOCK.x, ty = target ? target.y : DOCK.y;
    const dx = tx - v.x, dy = ty - v.y, len = Math.hypot(dx, dy);
    v.moving = len > 0.5;
    if (v.moving) {
      const s = Math.min(len, VACUUM_SPEEDS[Math.min(level, VACUUM_SPEEDS.length) - 1] * dt);
      v.x += (dx / len) * s;
      v.y += (dy / len) * s;
      const turn = Math.atan2(Math.sin(Math.atan2(dy, dx) - v.angle), Math.cos(Math.atan2(dy, dx) - v.angle));
      v.angle += turn * Math.min(1, dt * 8);
      if (len - s <= 0.5) { v.x = tx; v.y = ty; }
    }
    if (target && Math.hypot(target.x - v.x, target.y - v.y) <= COLLECT_RADIUS) collectDrop(game, target);
  },
  draw(ctx, game) {
    if (!game.unlocks?.vacuum) return;
    const v = state(game);
    const time = game.time || 0;
    // dock: a grey plate with a green charging light
    ctx.fillStyle = '#64748B'; ctx.fillRect(DOCK.x - 12, HEIGHT - 6, 24, 5);
    ctx.fillStyle = '#4ADE80'; ctx.fillRect(DOCK.x - 2, HEIGHT - 5, 4, 2);
    drawVacuum(ctx, v, time);
  },
};

// A round grey robot with a dark front bumper and a blinking light; side brushes spin while it drives.
function drawVacuum(ctx, v, time) {
  ctx.save();
  ctx.translate(v.x, v.y);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath(); ctx.ellipse(0, 3, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(v.angle);
  if (v.moving) {
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)'; ctx.lineWidth = 1;
    for (const sy of [-9, 9]) {
      for (let k = 0; k < 3; k++) {
        const an = time * 20 + k * 2.1 + sy;
        ctx.beginPath(); ctx.moveTo(9, sy); ctx.lineTo(9 + Math.cos(an) * 6, sy + Math.sin(an) * 6); ctx.stroke();
      }
    }
  }
  ctx.fillStyle = '#CBD5E1'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#475569'; ctx.beginPath(); ctx.arc(0, 0, 13, -1.1, 1.1); ctx.lineTo(0, 0); ctx.fill();   // bumper
  ctx.fillStyle = '#CBD5E1'; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#E2E8F0'; ctx.beginPath(); ctx.arc(-1, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#94A3B8'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(-1, 0, 7, 0, Math.PI * 2); ctx.stroke();
  const on = v.moving ? Math.sin(time * 8) > 0 : Math.sin(time * 2) > 0.3;
  ctx.fillStyle = on ? '#4ADE80' : '#166534'; ctx.beginPath(); ctx.arc(5, 0, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

registerInvestment(investment);
registerFeature(vacuumFeature);
export default investment;
