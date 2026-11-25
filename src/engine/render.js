// Canvas rendering. Reads game state, never changes it.
import { getDeveloper, getBug, getFeatures, getEvent } from './registry.js';
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
  drawActiveEvent(ctx, game, view);
  drawEffects(ctx, game);
  for (const f of getFeatures()) {
    if (!f.draw) continue;
    ctx.save();
    try { f.draw(ctx, game); } catch (e) { console.error(`[feature ${f.id}]`, e); }
    ctx.restore();
  }
  ctx.restore();
}

// The running random event can draw over the map (e.g. PROD down), below banners and effects.
function drawActiveEvent(ctx, game, view) {
  const def = game.activeEvent && getEvent(game.activeEvent);
  if (!def?.draw) return;
  ctx.save();
  try { def.draw(ctx, game, view); } catch (e) { console.error(`[event ${def.id}]`, e); }
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

  drawBuilding(ctx, game);
}

// The Nexios building (your base) at the end of the path: one storey per floor bought,
// an air-conditioning unit on the roof, and a production bar underneath.
function drawBuilding(ctx, game) {
  const x = PROD.x + 2, w = PROD.w - 4;
  const ground = 178;              // bottom of the building
  const groundTop = 120;           // ground floor: 120..178 (the path enters at y 140)
  const ac = Math.round((game.heatResistance || 0) * 3);
  const acH = ac ? 6 + ac * 2 : 0;
  const uppers = Math.max(0, (game.floors || 1) - 1);
  const floorH = uppers ? Math.min(12, (groundTop - 6 - acH) / uppers) : 12;
  const top = groundTop - uppers * floorH;

  // body
  ctx.fillStyle = COLORS.navy2;
  ctx.fillRect(x, top, w, ground - top);
  ctx.strokeStyle = COLORS.s200; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, top + 0.5, w - 1, ground - top - 1);

  // upper floors: a separator and a row of windows each
  for (let i = 0; i < uppers; i++) {
    const fy = groundTop - (i + 1) * floorH;
    ctx.fillStyle = COLORS.navy3;
    ctx.fillRect(x + 1, fy + floorH - 1, w - 2, 1);
    const wh = Math.max(2, floorH - 5);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = (i + k + Math.floor(game.time / 3)) % 5 === 0 ? COLORS.s400 : COLORS.s200;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + 6 + k * 11, fy + 2, 7, wh);
      ctx.globalAlpha = 1;
    }
  }

  // ground floor: sign, door facing the path, windows
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 1, groundTop + 1, w - 2, 11);
  ctx.fillStyle = COLORS.navy;
  ctx.font = `900 8px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('NEXIOS', x + w / 2, groundTop + 7);
  ctx.fillStyle = COLORS.navy3;
  ctx.fillRect(x, 130, 9, 22);
  ctx.fillStyle = COLORS.green;
  ctx.fillRect(x, 130, 9, 2);
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = COLORS.s200; ctx.globalAlpha = 0.85;
    ctx.fillRect(x + 16 + k * 11, 134, 7, 8);
    ctx.fillRect(x + 16 + k * 11, 150, 7, 8);
    ctx.globalAlpha = 1;
  }

  // air conditioning on the roof, bigger per level, fan spinning
  if (ac) {
    const uw = 12 + ac * 4, ux = x + w - uw - 4, uy = top - acH;
    ctx.fillStyle = COLORS.s400;
    ctx.fillRect(ux, uy, uw, acH);
    ctx.fillStyle = COLORS.navy;
    const r = acH / 2 - 1.5, cx = ux + uw / 2, cy = uy + acH / 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.s200; ctx.lineWidth = 1;
    const a0 = game.time * 8;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a1 = a0 + (k * Math.PI * 2) / 3;
      ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
    }
    ctx.stroke();
    ctx.fillStyle = COLORS.blue;
    ctx.font = `900 6px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`AC ${ac}`, x + 3, uy + acH / 2);
  }

  // production bar
  const frac = Math.max(0, game.lives / game.maxLives);
  ctx.fillStyle = COLORS.navy3;
  ctx.fillRect(x, ground + 4, w, 4);
  ctx.fillStyle = frac <= 0.4 ? COLORS.orange : COLORS.green;
  ctx.fillRect(x, ground + 4, w * frac, 4);
  ctx.fillStyle = COLORS.s400;
  ctx.font = `700 7px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${Math.ceil(game.lives)} / ${game.maxLives}`, x + w / 2, ground + 16);
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
