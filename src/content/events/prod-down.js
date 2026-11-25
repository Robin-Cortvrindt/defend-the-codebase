// Event: PROD is down. The lights go out; you only see what your cursor's flashlight hits.
import { registerEvent } from '../../engine/registry.js';
import { WIDTH, HEIGHT, CELL } from '../../engine/map.js';

const DARK = 'rgba(0, 8, 16, 0.96)';
const RADIUS = 2.5 * CELL;

registerEvent({
  id: 'prod-down', name: 'PROD is down', description: 'Find the bugs in the dark', accent: '#94A3B8',
  start() {},
  end() {},
  draw(ctx, game, view) {
    const c = view?.cursor;
    ctx.fillStyle = DARK;
    ctx.beginPath();
    ctx.rect(0, 0, WIDTH, HEIGHT);
    if (c) ctx.arc(c.x, c.y, RADIUS, 0, Math.PI * 2);
    ctx.fill('evenodd');
    if (!c) return;
    // soft edge: clear in the middle, fading to dark at the rim
    const g = ctx.createRadialGradient(c.x, c.y, RADIUS * 0.55, c.x, c.y, RADIUS);
    g.addColorStop(0, 'rgba(0, 8, 16, 0)');
    g.addColorStop(1, DARK);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, RADIUS, 0, Math.PI * 2);
    ctx.fill();
  },
});
