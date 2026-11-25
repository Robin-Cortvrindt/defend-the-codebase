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
  // Features draw on top of the bugs, so the wall stays see-through.
  draw(ctx, game) {
    if (!game.unlocks?.firewall) return;
    const pulse = 0.35 + 0.25 * (0.5 + 0.5 * Math.sin((game.time || 0) * 4));
    for (const w of findFirewalls(game)) {
      const { x, y } = cellCenter(w.col, w.row);
      // The bar crosses the lane: a horizontal lane gets a vertical bar and vice versa.
      const [bw, bh] = w.vertical ? [CELL, 8] : [8, CELL];
      ctx.globalAlpha = pulse;
      ctx.fillStyle = ACCENT;
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 12;
      ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
      ctx.globalAlpha = Math.min(1, pulse + 0.3);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#F5D0FE';
      if (w.vertical) ctx.fillRect(x - bw / 2, y - 1, bw, 2);
      else ctx.fillRect(x - 1, y - bh / 2, 2, bh);
    }
    ctx.globalAlpha = 1;
  },
};

registerInvestment(investment);
registerFeature(firewallFeature);
export default investment;
