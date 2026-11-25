// Canvas rendering. Reads game state, never changes it.
import { getDeveloper, getBug, getFeatures } from './registry.js';
import { WIDTH, HEIGHT, CELL, COLS, ROWS, WAYPOINTS, PATH_WIDTH, PROD, cellCenter } from './map.js';
import { LEVELS, devStats, canPlace } from './devs.js';

export const COLORS = {
  navy: '#001E32', navy2: '#0A2A40', navy3: '#123650', pathLine: '#1E4A6A',
  blue: '#2563EB', orange: '#EA580C', fuchsia: '#C026D3', green: '#16A34A',
  s600: '#475569', s500: '#64748B', s400: '#94A3B8', s200: '#E2E8F0', tint: '#EEF1F5',
};
const FONT = 'Lato, system-ui, sans-serif';

export function render(ctx, game, view) {
  ctx.save();
  drawMap(ctx, game);
  drawRanges(ctx, game, view);
  for (const dev of game.devs) drawDev(ctx, dev, view.selected === dev);
  drawHover(ctx, game, view);
  for (const bug of game.bugs) drawBug(ctx, bug);
  drawEffects(ctx, game);
  for (const f of getFeatures()) {
    if (!f.draw) continue;
    ctx.save();
    try { f.draw(ctx, game); } catch (e) { console.error(`[feature ${f.id}]`, e); }
    ctx.restore();
  }
  ctx.restore();
}

function drawMap(ctx, game) {
  ctx.fillStyle = COLORS.navy;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = COLORS.navy2;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) { ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, HEIGHT); }
  for (let r = 1; r < ROWS; r++) { ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(WIDTH, r * CELL + 0.5); }
  ctx.stroke();

  const tracePath = () => {
    ctx.beginPath();
    WAYPOINTS.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  ctx.lineJoin = 'round';
  ctx.strokeStyle = COLORS.navy3;
  ctx.lineWidth = PATH_WIDTH;
  tracePath(); ctx.stroke();
  ctx.strokeStyle = COLORS.pathLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.lineDashOffset = -game.time * 20;
  tracePath(); ctx.stroke();
  ctx.setLineDash([]);

  // PROD box with production health bars
  roundRect(ctx, PROD.x, PROD.y, PROD.w, PROD.h, 10);
  ctx.fillStyle = COLORS.navy2; ctx.fill();
  ctx.strokeStyle = COLORS.s200; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = COLORS.s400;
  ctx.font = `700 10px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PROD', PROD.x + PROD.w / 2, PROD.y + 22);
  const frac = game.lives / game.maxLives;
  const bars = 5;
  const lit = Math.ceil(frac * bars);
  for (let i = 0; i < bars; i++) {
    const y = PROD.y + PROD.h - 12 - i * 7;
    ctx.fillStyle = i < lit ? (frac <= 0.4 ? COLORS.orange : COLORS.green) : COLORS.navy3;
    ctx.fillRect(PROD.x + 14, y, PROD.w - 28, 4);
  }
}

function drawRanges(ctx, game, view) {
  const dev = view.selected;
  if (dev && game.devs.includes(dev)) {
    const def = getDeveloper(dev.type);
    circleRange(ctx, dev.x, dev.y, devStats(game, dev).range, def.accent);
  }
}

function circleRange(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = hexA(color, 0.08); ctx.fill();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  ctx.setLineDash([]);
}

export function drawDevTile(ctx, def, x, y, size = 36) {
  ctx.save();
  ctx.translate(x, y);
  roundRect(ctx, -size / 2, -size / 2, size, size, size / 4);
  ctx.fillStyle = def.accent; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  try { def.drawIcon?.(ctx, size); } catch (e) { console.error(e); }
  ctx.restore();
}

function drawDev(ctx, dev, selected) {
  const def = getDeveloper(dev.type);
  if (!def) return;
  drawDevTile(ctx, def, dev.x, dev.y);
  // level badge at top-right corner
  const lvl = LEVELS[dev.level];
  const bx = dev.x + 19, by = dev.y - 19;
  roundRect(ctx, bx - 8, by - 7, 16, 14, 3);
  ctx.fillStyle = dev.level === LEVELS.length - 1 ? COLORS.green : '#fff';
  ctx.fill();
  ctx.fillStyle = dev.level === LEVELS.length - 1 ? '#fff' : COLORS.navy;
  ctx.font = `900 10px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(lvl.badge, bx, by + 0.5);
  if (dev.level === 1) { ctx.fillStyle = COLORS.green; ctx.fillRect(bx - 8, by + 5, 16, 2); }
  if (selected) {
    const next = LEVELS[dev.level + 1];
    const prev = lvl.xp;
    const pct = next ? Math.min(1, (dev.xp - prev) / (next.xp - prev)) : 1;
    ctx.fillStyle = COLORS.navy3; ctx.fillRect(dev.x - 20, dev.y + 22, 40, 4);
    ctx.fillStyle = COLORS.green; ctx.fillRect(dev.x - 20, dev.y + 22, 40 * pct, 4);
  }
}

function drawHover(ctx, game, view) {
  if (!view.hire || !view.hover) return;
  const { col, row } = view.hover;
  const def = getDeveloper(view.hire);
  if (!def) return;
  const { x, y } = cellCenter(col, row);
  if (canPlace(game, view.hire, col, row)) {
    circleRange(ctx, x, y, def.range * CELL * game.mods.rangeMultiplier, def.accent);
    ctx.globalAlpha = 0.6;
    drawDevTile(ctx, def, x, y);
    ctx.globalAlpha = 1;
  } else if (col >= 0 && row >= 0 && col < COLS && row < ROWS) {
    ctx.strokeStyle = COLORS.s500; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 8); ctx.lineTo(x + 8, y + 8);
    ctx.moveTo(x + 8, y - 8); ctx.lineTo(x - 8, y + 8);
    ctx.stroke();
  }
}

function drawBug(ctx, bug) {
  const def = getBug(bug.type);
  if (!def) return;
  const x = bug.x + (bug.jitter || 0) * 0.7, y = bug.y + (bug.jitter || 0);
  const r = def.radius;
  ctx.save();
  ctx.translate(x, y);
  if (def.legs) {
    const wiggle = Math.sin((bug.distance || 0) / 3) * 1.5;
    ctx.strokeStyle = COLORS.s400; ctx.lineWidth = r > 10 ? 2 : 1.5;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(-r * 0.5, s * r * 0.6); ctx.lineTo(-r * 0.9 - wiggle, s * (r + 4));
      ctx.moveTo(r * 0.1, s * r * 0.7); ctx.lineTo(r * 0.1 + wiggle, s * (r + 5));
      ctx.moveTo(r * 0.6, s * r * 0.6); ctx.lineTo(r * 0.9 - wiggle, s * (r + 4));
    }
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.1, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.s200; ctx.fill();
  ctx.strokeStyle = def.ring; ctx.lineWidth = r > 10 ? 3 : 2; ctx.stroke();
  ctx.restore();
  if (bug.hp < bug.maxHp) {
    const w = Math.max(12, r * 2.2);
    ctx.fillStyle = COLORS.navy3; ctx.fillRect(x - w / 2, y - r - 8, w, 3);
    ctx.fillStyle = def.ring; ctx.fillRect(x - w / 2, y - r - 8, w * Math.max(0, bug.hp / bug.maxHp), 3);
  }
}

function drawEffects(ctx, game) {
  for (const e of game.effects) {
    const t = Math.max(0, e.ttl / (e.maxTtl || 1)); // 1 → 0
    if (e.kind === 'beam') {
      ctx.globalAlpha = t;
      ctx.strokeStyle = e.color; ctx.lineWidth = e.width || 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(e.from.x, e.from.y); ctx.lineTo(e.to.x, e.to.y); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.kind === 'pop') {
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.fillStyle = e.color || '#fff';
      ctx.font = `900 ${e.size || 13}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(e.text, e.x, e.y - (1 - t) * 14);
      ctx.globalAlpha = 1;
    } else if (e.kind === 'flash') {
      ctx.globalAlpha = t * 0.85;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.globalAlpha = 1;
    } else if (e.kind === 'ring') {
      ctx.globalAlpha = t;
      ctx.strokeStyle = e.color || COLORS.green; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, e.y, 18 + (1 - t) * 16, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (e.kind === 'banner') {
      drawBanner(ctx, e, t);
    }
  }
}

function drawBanner(ctx, e, t) {
  const w = 320, h = 42, x = (WIDTH - w) / 2, y = 12;
  ctx.globalAlpha = Math.min(1, t * 4);
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = '#fff'; ctx.fill();
  ctx.fillStyle = e.accent || COLORS.blue; ctx.fillRect(x, y, 4, h);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = COLORS.s500; ctx.font = `700 10px ${FONT}`;
  ctx.fillText(spaced(e.title.toUpperCase()), x + 18, y + 17);
  ctx.fillStyle = COLORS.navy; ctx.font = `900 14px ${FONT}`;
  ctx.fillText(e.text, x + 18, y + 34);
  ctx.globalAlpha = 1;
}

const spaced = s => s.split('').join(' ');

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexA(hex, a) {
  if (typeof hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(hex)) return `rgba(255,255,255,${a})`;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
