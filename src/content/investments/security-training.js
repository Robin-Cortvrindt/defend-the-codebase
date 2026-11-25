// Unlock: Security training for .NET developers.
// Two .NET developers facing each other across the lane (same row or column, one lane cell
// between them) build a firewall on that cell. Bugs inside it take a little damage every second,
// and a firewall kill counts for both developers.
// This file is also the template for future unlocks: one investment + one feature, gated on game.unlocks.
import { registerInvestment, registerFeature } from '../../engine/registry.js';
import { killBug } from '../../engine/game.js';
import { grantXp } from '../../engine/devs.js';
import { cellAt, cellCenter, isPathCell, CELL } from '../../engine/map.js';

export const FIREWALL_DPS = 10;
const ACCENT = '#C026D3';

const investment = {
  id: 'security-training',
  name: 'Security training (.NET)',
  description: 'Two .NET developers facing each other across the lane build a firewall',
  group: 'unlocks',
  maxLevel: 1,
  getCost() { return 40; },
  apply(game) { game.unlocks.firewall = true; },
  effectText() { return 'Opposite .NET pairs build a firewall'; },
};

// Every firewall on the map right now: { col, row, vertical, devs }. Recomputed each call,
// so hiring or selling a developer takes effect on the next tick.
export function findFirewalls(game) {
  const dotnets = game.devs.filter(d => d.type === 'dotnet');
  const at = (col, row) => dotnets.find(d => d.col === col && d.row === row);
  const walls = new Map();
  for (const d of dotnets) {
    for (const [dc, dr] of [[0, 2], [2, 0]]) {
      const other = at(d.col + dc, d.row + dr);
      const col = d.col + dc / 2, row = d.row + dr / 2;
      if (!other || !isPathCell(col, row)) continue;
      const key = `${col},${row}`;
      const wall = walls.get(key) ?? { col, row, vertical: dr === 0, devs: [] };
      for (const dev of [d, other]) if (!wall.devs.includes(dev)) wall.devs.push(dev);
      walls.set(key, wall);
    }
  }
  return [...walls.values()];
}

export function tickFirewalls(game, dt) {
  const walls = findFirewalls(game);
  if (!walls.length) return;
  for (const bug of [...game.bugs]) {
    if (bug.dead) continue;
    const { col, row } = cellAt(bug.x, bug.y);
    const wall = walls.find(w => w.col === col && w.row === row);
    if (!wall) continue;
    bug.hp -= FIREWALL_DPS * dt;
    if (bug.hp > 0) continue;
    killBug(game, bug, null);
    for (const dev of wall.devs) { grantXp(game, dev, 1); dev.kills++; }
  }
}

export const firewallFeature = {
  id: 'firewall',
  update(game, dt) {
    if (!game.unlocks?.firewall || game.phase !== 'wave') return;
    tickFirewalls(game, dt);
  },
  // The whole lane cell burns with fuchsia fire. Features draw on top of the bugs, so bugs inside
  // seem to walk through the flames, and they catch fire while they're in it.
  draw(ctx, game) {
    if (!game.unlocks?.firewall) return;
    const walls = findFirewalls(game);
    if (!walls.length) return;
    const time = game.time || 0;
    ctx.save();
    for (const w of walls) {
      const { x, y } = cellCenter(w.col, w.row);
      const glow = ctx.createRadialGradient(x, y, 2, x, y, CELL * 1.15);
      glow.addColorStop(0, `rgba(192,38,211,${0.35 + 0.08 * Math.sin(time * 13)})`);
      glow.addColorStop(1, 'rgba(192,38,211,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - CELL * 1.25, y - CELL * 1.25, CELL * 2.5, CELL * 2.5);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (const w of walls) {
      const { x, y } = cellCenter(w.col, w.row);
      drawFire(ctx, fireParticles(time, x, y, CELL, FIRE_PARTICLES), 1);
      for (const bug of game.bugs) {
        const c = cellAt(bug.x, bug.y);
        if (c.col === w.col && c.row === w.row) drawFire(ctx, fireParticles(time + bug.id * 0.37, bug.x, bug.y, 18, 16), 0.75);
      }
    }
    ctx.restore();
  },
};

// ---- the fire ----
export const FIRE_PARTICLES = 80;
const fract = n => n - Math.floor(n);
const hash = n => fract(Math.sin(n * 12.9898 + 78.233) * 43758.5453);

// The flames of a burning square of `size` px centred on (x, y) at `time`, worked out from the time
// alone (nothing to store or update). Particle i lives for a fixed time, starts somewhere in the
// square each time round, rises and sways. Every 25th is an ember: tiny, longer lived, rises further.
export function fireParticles(time, x, y, size, count) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const ember = i % 25 === 0;
    const life = ember ? 0.6 + 0.6 * hash(i + 0.5) : 0.27 + 0.27 * hash(i + 0.5);
    const u = time + hash(i + 0.25) * life, cycle = Math.floor(u / life), t = u - cycle * life;
    const seed = i * 7.13 + cycle * 1.37;
    const x0 = x - size / 2 + 3 + hash(seed) * (size - 6), y0 = y - size / 2 + 4 + hash(seed + 0.3) * (size - 4);
    const rise = (ember ? 50 : 26) * (0.6 + 0.6 * hash(seed + 0.6));
    parts.push({
      x: x0 + (hash(seed + 0.9) - 0.5) * 12 * t + Math.sin(time * 7 + y0 * 0.2) * 2,
      y: y0 - rise * t - 10 * t * t,
      r: ember ? 1 : 4.5 * (0.7 + 0.6 * hash(seed + 1.2)),
      age: t / life,
      ember,
    });
  }
  return parts;
}

// Born pale and hot, cooling to fuchsia, then dark purple as they rise and fade.
function fireColor(age) {
  if (age < 0.18) return '#FCE7F3';
  if (age < 0.4) return '#F0ABFC';
  if (age < 0.7) return ACCENT;
  return '#701A75';
}

function drawFire(ctx, parts, scale) {
  for (const p of parts) {
    if (p.ember) {
      ctx.globalAlpha = (1 - p.age) * 0.9; ctx.fillStyle = '#F5D0FE';
      ctx.fillRect(p.x, p.y, 1.6, 1.6);
      continue;
    }
    ctx.globalAlpha = (1 - p.age) * 0.38;
    ctx.fillStyle = fireColor(p.age);
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, p.r * scale * (1 - p.age * 0.65)), 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

registerInvestment(investment);
registerFeature(firewallFeature);
export default investment;
