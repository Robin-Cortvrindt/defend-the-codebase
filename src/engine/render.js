// Canvas rendering. Reads game state, never changes it.
import { getDeveloper, getBug, getFeatures, getEvent } from './registry.js';
import { WIDTH, HEIGHT, CELL, COLS, ROWS, WAYPOINTS, PATH_WIDTH, PROD, cellCenter } from './map.js';
import { LEVELS, devStats, canPlace } from './devs.js';
import { drawBuilding as drawBuildingArt, buildingTop as buildingArtTop } from './building.js';

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

const BUILDING_GROUND = 178;      // bottom of the Nexios building (same as BUILDING.ground in building.js)

// The Nexios building (your base) at the end of the path. On game over it burns and caves in.
function drawBuilding(ctx, game) {
  if (game.phase === 'lost') drawCollapse(ctx, game);
  else drawBuildingBody(ctx, game);
  drawProductionBar(ctx, game);
}

// What building.js needs to draw this game's building: floors and every upgrade level.
function buildingSpec(game) {
  const u = game.upgrades || {};
  return {
    floors: game.floors, lives: game.lives, maxLives: game.maxLives, time: game.time,
    levels: { aircon: u.aircon || 0, heating: u.heating || 0, coffee: u.coffee || 0, fridge: u.fridge || 0, generator: u.generator || 0 },
  };
}

// The building itself (see building.js); the production bar is drawn separately so it stays during the collapse.
function drawBuildingBody(ctx, game) {
  drawBuildingArt(ctx, { ...buildingSpec(game), bar: false });
}

// Highest point of the building, including whatever stands on the roof.
function buildingTop(game) {
  return buildingArtTop(buildingSpec(game));
}

function drawProductionBar(ctx, game) {
  const x = PROD.x + 2, w = PROD.w - 4, ground = BUILDING_GROUND;
  const frac = Math.max(0, game.lives / game.maxLives);
  ctx.fillStyle = COLORS.navy3;
  ctx.fillRect(x, ground + 5, w, 4);
  ctx.fillStyle = frac <= 0.4 ? COLORS.orange : COLORS.green;
  ctx.fillRect(x, ground + 5, w * frac, 4);
  ctx.fillStyle = COLORS.s400;
  ctx.font = `700 7px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(`${Math.ceil(game.lives)} / ${game.maxLives}`, x + w / 2, ground + 17);
}

// ----- game over: the building burns, then sinks into itself -----
// Timeline in seconds since production went down (game.deathTime, see DEATH_ANIM in game.js):
//   0 - 1.1    fire spreads through the windows, the building trembles
//   1.0 - 2.8  it caves in floor by floor, throwing up a dust cloud
//   after that a smoking pile of rubble with a few flames left
const rnd = i => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const easeIn = t => t * t * t;

function drawCollapse(ctx, game) {
  const t = game.deathTime || 0;
  const x = PROD.x + 2, w = PROD.w - 4, ground = BUILDING_GROUND;
  const top = buildingTop(game);
  const height = ground - top;
  const fall = easeIn(Math.min(1, Math.max(0, (t - 1.0) / 1.8)));   // 0 -> 1 while it caves in
  const heat = Math.min(1, t / 0.9);                                  // how far the fire has spread
  const shake = (t < 2.9 ? 0.6 + fall * 2.4 : 0) * Math.sin(t * 61);

  // glow on the ground around the fire
  const glow = ctx.createRadialGradient(x + w / 2, ground - 10, 4, x + w / 2, ground - 10, 70);
  glow.addColorStop(0, hexA(COLORS.orange, 0.35 * heat * (1 - fall * 0.5)));
  glow.addColorStop(1, hexA(COLORS.orange, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(x - 70, ground - 80, w + 140, 110);

  // the building: it sinks below ground level and gets squashed as the floors pancake
  if (fall < 1) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x - 20, 0, w + 40, ground); ctx.clip();
    ctx.translate(x + w / 2 + shake, ground);
    ctx.scale(1 + fall * 0.08, 1 - fall * 0.55);
    ctx.translate(-(x + w / 2), -ground + fall * height * 0.75);
    drawBuildingBody(ctx, game);
    // soot: the building chars as it burns
    ctx.fillStyle = `rgba(0, 10, 20, ${0.55 * heat})`;
    ctx.fillRect(x, top, w, height);
    // windows lit by the fire
    for (let fy = 110; fy > top + 2; fy -= 12) {
      for (let k = 0; k < 4; k++) {
        const seed = fy * 7 + k;
        if (rnd(seed) > heat * 1.1) continue;
        const flick = 0.6 + 0.4 * Math.sin(t * (9 + rnd(seed + 1) * 8) + seed);
        ctx.fillStyle = hexA(rnd(seed + 2) > 0.5 ? '#F59E0B' : COLORS.orange, flick);
        ctx.fillRect(x + 6 + k * 11, fy + 2, 7, 7);
      }
    }
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = hexA('#F59E0B', heat * (0.6 + 0.4 * Math.sin(t * 13 + k)));
      ctx.fillRect(x + 16 + k * 11, 134, 7, 8);
      ctx.fillRect(x + 16 + k * 11, 150, 7, 8);
    }
    // flames licking out of the roof and the sides
    for (let i = 0; i < 6; i++) {
      const fx = x + 4 + (i / 5) * (w - 8);
      drawFlame(ctx, fx, top + 2, (10 + rnd(i) * 10) * heat, t, i);
    }
    for (let i = 0; i < 4; i++) {
      if (rnd(i + 30) > heat) continue;
      const fy = top + 14 + rnd(i + 20) * (height - 30);
      drawFlame(ctx, i % 2 ? x + w - 2 : x + 2, fy, (7 + rnd(i + 40) * 6) * heat, t, i + 10);
    }
    ctx.restore();
  }

  // rubble pile growing as the building comes down
  const pile = Math.min(1, fall * 1.3);
  if (pile > 0) {
    const ph = 16 * pile;
    const pileY = px => ground - Math.sin(((px - x + 8) / (w + 16)) * Math.PI) * ph;
    ctx.fillStyle = COLORS.navy3;
    ctx.beginPath();
    ctx.moveTo(x - 8, ground);
    for (let i = 0; i <= 10; i++) {
      const px = x - 8 + (i / 10) * (w + 16);
      ctx.lineTo(px, ground - (ground - pileY(px)) * (0.75 + rnd(i + 50) * 0.5));
    }
    ctx.lineTo(x + w + 8, ground);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = COLORS.s600; ctx.lineWidth = 1; ctx.stroke();
    // broken slabs sticking out
    ctx.fillStyle = COLORS.s500;
    for (let i = 0; i < 7; i++) {
      const bx = x + rnd(i + 60) * w, by = ground - rnd(i + 70) * ph * 0.8 - 2;
      ctx.save();
      ctx.translate(bx, by); ctx.rotate((rnd(i + 80) - 0.5) * 1.6);
      ctx.fillRect(-4, -1.5, 8 + rnd(i + 90) * 6, 3);
      ctx.restore();
    }
    // the sign survives, tilted in the rubble
    ctx.save();
    ctx.translate(x + w / 2 + 4, ground - ph * 0.7 - 3); ctx.rotate(0.22);
    ctx.globalAlpha = pile;
    ctx.fillStyle = '#fff'; ctx.fillRect(-16, -5, 32, 10);
    ctx.fillStyle = COLORS.navy; ctx.font = `900 7px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('NEXIOS', 0, 0.5);
    ctx.restore();
    // the fire keeps going in the rubble
    for (let i = 0; i < 5; i++) {
      const fx = x + 2 + rnd(i + 100) * (w - 4);
      drawFlame(ctx, fx, pileY(fx) + ph * 0.2, (5 + rnd(i + 110) * 7) * pile, t, i + 20);
    }
  }

  // dust cloud billowing out at street level while it caves in
  if (t > 1.0) {
    const d = Math.min(1, (t - 1.0) / 2.4);
    const alpha = Math.sin(d * Math.PI) * 0.7;
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const spread = (0.3 + rnd(i + 120) * 0.9) * d;
      const px = x + w / 2 + side * (w / 2 + 30 * spread) * (0.4 + rnd(i + 130) * 0.8);
      const py = ground - 4 - rnd(i + 140) * 26 * d;
      ctx.fillStyle = hexA(COLORS.s400, alpha * (0.25 + rnd(i + 150) * 0.25));
      ctx.beginPath(); ctx.arc(px, py, 5 + d * (8 + rnd(i + 160) * 10), 0, Math.PI * 2); ctx.fill();
    }
  }

  // smoke rising, from the roof at first and from the rubble afterwards
  const smokeBase = ground - 10 - (1 - fall) * height * 0.8;
  const smokeIn = Math.min(1, t / 0.6);
  for (let i = 0; i < 16; i++) {
    const life = (t * (0.35 + rnd(i + 170) * 0.2) + rnd(i + 180)) % 1;
    const sx = x + 6 + rnd(i + 190) * (w - 12) + Math.sin(life * 4 + i) * 6 + life * 14;
    const sy = smokeBase - life * 90;
    ctx.fillStyle = hexA(COLORS.s600, (1 - life) * 0.45 * smokeIn);
    ctx.beginPath(); ctx.arc(sx, sy, 4 + life * 13, 0, Math.PI * 2); ctx.fill();
  }

  // embers floating up
  for (let i = 0; i < 12; i++) {
    const life = (t * (0.5 + rnd(i + 200) * 0.4) + rnd(i + 210)) % 1;
    const ex = x + rnd(i + 220) * w + Math.sin(life * 9 + i) * 5;
    const ey = smokeBase + 6 - life * 70;
    ctx.fillStyle = hexA(rnd(i + 230) > 0.5 ? '#F59E0B' : COLORS.orange, (1 - life) * heat);
    ctx.fillRect(ex, ey, 1.6, 1.6);
  }
}

// A flickering three-layer flame with its base at (x, y).
function drawFlame(ctx, x, y, size, t, seed) {
  if (size <= 0.5) return;
  const h = size * (1 + 0.28 * Math.sin(t * (14 + (seed % 5)) + seed * 2.3));
  const sway = Math.sin(t * 7 + seed) * size * 0.18;
  for (const [color, k] of [[COLORS.orange, 1], ['#F59E0B', 0.68], ['#FDE68A', 0.36]]) {
    const hw = size * 0.42 * k, hh = h * k;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - hw, y);
    ctx.quadraticCurveTo(x - hw, y - hh * 0.55, x + sway * k, y - hh);
    ctx.quadraticCurveTo(x + hw, y - hh * 0.55, x + hw, y);
    ctx.quadraticCurveTo(x, y + hw * 0.6, x - hw, y);
    ctx.fill();
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
  const r = bug.radius ?? def.radius;   // a bug may grow or shrink (e.g. a memory leak)
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
  if (def.drawIcon) { try { def.drawIcon(ctx, r, bug); } catch (e) { console.error(e); } }
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
