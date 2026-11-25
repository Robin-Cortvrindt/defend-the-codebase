// Event: a greedy goblin. It runs in from the right edge and steals dropped drinks, always the nearest
// one that has landed. The Goblin trap (building upgrade) slows it down, to 40% at level 3.
// Events have no update hook, so the same file registers a feature that moves and draws the goblin.
// It draws from the feature too, so it can still run off the board after the event has ended.
import { registerEvent, registerFeature } from '../../engine/registry.js';
import { WIDTH, HEIGHT } from '../../engine/map.js';
import { resistanceTo } from '../../engine/upgrades.js';
import { nearestDrop, stealDrop } from '../../engine/drops.js';

export const GOBLIN_SPEED = 160;   // px/s, faster than any bug
const STEAL_RADIUS = 12;
const IDLE_SPEED = 30;             // drifting to the middle while there is nothing to steal
const ACCENT = '#65A30D';

export const goblinSpeed = game => GOBLIN_SPEED * (1 - 0.6 * resistanceTo(game, 'goblin'));

const goblin = {
  id: 'goblin', name: 'A greedy goblin', description: 'It steals your dropped drinks', accent: ACCENT,
  start(game) {
    game.goblin = { x: WIDTH + 16, y: 40 + game.random() * (HEIGHT - 80), carried: 0, face: -1, moving: false, leaving: false };
  },
  end(game) {
    if (game.goblin) game.goblin.leaving = true;
  },
};

// Move `g` towards (tx, ty) at `speed`; returns the distance still left.
function moveTo(g, tx, ty, speed, dt) {
  const dx = tx - g.x, dy = ty - g.y, len = Math.hypot(dx, dy);
  if (len < 0.5) return 0;
  const s = Math.min(len, speed * dt);
  g.x += (dx / len) * s;
  g.y += (dy / len) * s;
  if (Math.abs(dx) > 0.5) g.face = dx < 0 ? -1 : 1;
  return len - s;
}

export const goblinFeature = {
  id: 'goblin',
  init(game) { game.goblin = null; },
  update(game, dt) {
    const g = game.goblin;
    if (!g) return;
    if (g.leaving) {
      g.moving = true;
      moveTo(g, WIDTH + 40, g.y, goblinSpeed(game), dt);
      if (g.x > WIDTH + 20) game.goblin = null;
      return;
    }
    if (game.activeEvent !== 'goblin' || (game.phase !== 'wave' && game.phase !== 'bell')) return;
    const target = nearestDrop(game, g.x, g.y);
    if (!target) { g.moving = moveTo(g, WIDTH / 2, HEIGHT / 2, IDLE_SPEED, dt) > 1; return; }
    moveTo(g, target.x, target.y, goblinSpeed(game), dt);
    g.moving = true;
    if (Math.hypot(target.x - g.x, target.y - g.y) <= STEAL_RADIUS && stealDrop(game, target)) g.carried++;
  },
  drawUnder(ctx, game) {   // on the floor: under effects, banners and the PROD-is-down darkness
    const g = game.goblin;
    if (g) drawGoblin(ctx, g, game.time || 0);
  },
};

// A small green goblin with pointy ears and a sack over its shoulder that fills up with every theft.
export function drawGoblin(ctx, g, time) {
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.scale(g.face < 0 ? -1 : 1, 1);
  const bob = g.moving ? Math.abs(Math.sin(time * 16)) * 2 : Math.abs(Math.sin(time * 3));
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath(); ctx.ellipse(0, 11, 9, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.translate(0, -bob);
  // legs
  const step = g.moving ? Math.sin(time * 16) * 3 : 0;
  ctx.strokeStyle = '#3F6212'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-2, 4); ctx.lineTo(-2 - step, 10); ctx.moveTo(2, 4); ctx.lineTo(2 + step, 10); ctx.stroke();
  // sack behind the shoulder
  const sr = 4 + Math.min(8, g.carried) * 0.75;
  ctx.fillStyle = '#92400E';
  ctx.beginPath(); ctx.ellipse(-6 - sr * 0.4, -3 - sr * 0.3, sr, sr * 0.9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#B45309';
  ctx.beginPath(); ctx.ellipse(-6 - sr * 0.55, -4 - sr * 0.5, sr * 0.4, sr * 0.3, -0.5, 0, Math.PI * 2); ctx.fill();
  if (g.carried) { ctx.fillStyle = '#FACC15'; ctx.beginPath(); ctx.arc(-6 - sr * 0.4, -3 - sr * 1.1, 1.6, 0, Math.PI * 2); ctx.fill(); }
  // body
  ctx.fillStyle = '#4D7C0F';
  ctx.beginPath(); ctx.ellipse(0, 1, 5.5, 5, 0, 0, Math.PI * 2); ctx.fill();
  // ears and head
  ctx.fillStyle = ACCENT;
  ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(-7, -12); ctx.lineTo(-1, -5); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, -7); ctx.lineTo(11, -13); ctx.lineTo(7, -5); ctx.fill();
  ctx.beginPath(); ctx.arc(3, -6, 5.2, 0, Math.PI * 2); ctx.fill();
  // nose, eye, grin
  ctx.beginPath(); ctx.moveTo(7, -6); ctx.lineTo(11, -4.5); ctx.lineTo(7, -3.8); ctx.fill();
  ctx.fillStyle = '#FDE047'; ctx.beginPath(); ctx.arc(5, -7.5, 1.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(5.5, -7.5, 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1A2E05'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(5, -4, 2, 0.2, 1.4); ctx.stroke();
  ctx.restore();
}

registerEvent(goblin);
registerFeature(goblinFeature);
export default goblin;
