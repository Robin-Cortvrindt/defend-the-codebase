// The bug lane, drawn as a trace on a circuit board carrying a stream of source code towards production.
// Purely decoration: reads nothing but the map and the time.
import { WAYPOINTS, PATH_WIDTH, PATH_LENGTH, WIDTH, HEIGHT, PROD, pointAt, headingAt, isPathCell, cellAt } from './map.js';

const TEAL_EDGE = 'rgba(45,212,191,.45)';
const TEAL_TRACE = 'rgba(45,212,191,.22)';
const TEAL_PAD = 'rgba(45,212,191,.4)';
const BODY = '#0B3448';
const SIGNAL = '#5EEAD4';
const CODE_FONT = '500 7.5px "JetBrains Mono", ui-monospace, monospace';
const CODE_SPEED = 18;      // px/s towards production
const ROW_GAP = 7;          // px between code rows
const ROWS = [-2, -1, 0, 1, 2];
const TRACE_EVERY = 110;    // px along the lane between side traces

const CODE = [
  'if (user == null) return;', 'const res = await fetch(url);', 'try { save(order); }', 'catch (e) { log(e); }',
  'for (int i = 0; i <= n; i++)', 'SELECT * FROM users;', 'public void deploy() {', 'return items.map(x => x.id);',
  'var cfg = Load("prod");', '// TODO: fix later', 'throw new Exception();', 'useEffect(() => {}, []);',
];
// Keywords in the colour of the developer whose stack they belong to.
const KEYWORDS = {
  if: '#2563EB', const: '#2563EB', await: '#2563EB', return: '#2563EB', useEffect: '#2563EB',
  try: '#EA580C', catch: '#EA580C', for: '#EA580C', public: '#EA580C', void: '#EA580C',
  var: '#C026D3', throw: '#C026D3', new: '#C026D3', SELECT: '#C026D3', FROM: '#C026D3',
};

const SEGMENTS = WAYPOINTS.slice(1).map((b, i) => {
  const a = WAYPOINTS[i];
  return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x) };
});

const tracePath = ctx => { ctx.beginPath(); WAYPOINTS.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); };

// Side traces off the lane: about one every TRACE_EVERY px, alternating sides. Each leaves the lane
// edge, runs 12 px diagonally forward and then 30 px straight out, ending in a pad. Traces that would
// end on the lane, off the board or at the building are dropped.
let traces = null;
export function sideTraces() {
  if (traces) return traces;
  traces = [];
  let side = 1;
  const clear = ([x, y]) => {
    const c = cellAt(x, y);
    return x > 4 && x < WIDTH - 4 && y > 4 && y < HEIGHT - 4 && !isPathCell(c.col, c.row)
      && !(x > PROD.x - 6 && y > PROD.y - 6 && y < PROD.y + PROD.h + 6);
  };
  for (let d = TRACE_EVERY / 2; d < PATH_LENGTH - 40; d += TRACE_EVERY, side = -side) {
    const p = pointAt(d), h = headingAt(d);
    const tx = Math.cos(h), ty = Math.sin(h);
    // preferred side first; if that runs into the lane or off the board, the other side, then shorter
    for (const [s, out] of [[side, 30], [-side, 30], [side, 20], [-side, 20]]) {
      const nx = -ty * s, ny = tx * s;
      const start = [p.x + nx * (PATH_WIDTH / 2), p.y + ny * (PATH_WIDTH / 2)];
      const mid = [start[0] + (nx + tx) * 12, start[1] + (ny + ty) * 12];
      const end = [mid[0] + nx * out, mid[1] + ny * out];
      if (clear(mid) && clear(end)) { traces.push([start, mid, end]); break; }
    }
  }
  return traces;
}

// The code as one long tape of coloured tokens, laid out once per context (it needs measureText).
let tape = null;
// Lay it out again once the code font has loaded (the first frames may measure a fallback font).
globalThis.document?.fonts?.ready?.then(() => { tape = null; });
function codeTape(ctx) {
  if (tape) return tape;
  const tokens = [];
  let x = 0;
  for (const line of CODE) {
    for (const text of line.split(/(\s+)/)) {
      if (!text) continue;
      const color = KEYWORDS[text.replace(/[^\w]/g, '')];
      const w = ctx.measureText(text).width;
      if (text.trim()) tokens.push({ text, x, color });
      x += w;
    }
    x += 14;
  }
  return (tape = { tokens, width: x });
}

function drawCode(ctx, time) {
  ctx.save();
  // clip to the inside of the trace
  const inner = PATH_WIDTH - 4;
  ctx.beginPath();
  for (const { a, b } of SEGMENTS) {
    ctx.rect(Math.min(a.x, b.x) - inner / 2, Math.min(a.y, b.y) - inner / 2, Math.abs(b.x - a.x) + inner, Math.abs(b.y - a.y) + inner);
  }
  ctx.clip();
  ctx.font = CODE_FONT; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const { tokens, width } = codeTape(ctx);
  let along = 0;
  SEGMENTS.forEach(seg => {
    ctx.save();
    ctx.translate(seg.a.x, seg.a.y); ctx.rotate(seg.angle);
    const from = -PATH_WIDTH / 2, to = seg.len + PATH_WIDTH / 2;
    for (const row of ROWS) {
      // tape position under local x = 0; moving the tape back makes the text flow forward
      const start = ((along + row * 137 + 900 - time * CODE_SPEED) % width + width) % width;
      for (const wrap of [0, width]) {
        for (const t of tokens) {
          const x = t.x + wrap - start;
          if (x < from - 60 || x > to) continue;
          ctx.fillStyle = t.color || '#94A3B8';
          ctx.globalAlpha = t.color ? 0.42 : 0.2;
          ctx.fillText(t.text, x, row * ROW_GAP);
        }
      }
    }
    ctx.restore();
    along += seg.len;
  });
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawTraces(ctx, time) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  sideTraces().forEach((tr, i) => {
    ctx.strokeStyle = TEAL_TRACE; ctx.lineWidth = 2;
    ctx.beginPath(); tr.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    const [ex, ey] = tr[2];
    ctx.fillStyle = '#001E32'; ctx.beginPath(); ctx.arc(ex, ey, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = TEAL_PAD; ctx.lineWidth = 1.5; ctx.stroke();
    // a signal running from the pad into the lane, then a pause
    const legs = [[tr[2], tr[1]], [tr[1], tr[0]]];
    const lens = legs.map(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]));
    const total = lens[0] + lens[1];
    let d = (time * 30 + i * 37) % (total + 60);
    if (d >= total) return;
    const k = d < lens[0] ? 0 : 1;
    if (k) d -= lens[0];
    const [p, q] = legs[k], f = d / lens[k];
    ctx.globalAlpha = 0.8; ctx.fillStyle = SIGNAL;
    ctx.beginPath(); ctx.arc(p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  });
}

export function drawLane(ctx, time = 0) {
  ctx.save();
  drawTraces(ctx, time);
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  ctx.strokeStyle = TEAL_EDGE; ctx.lineWidth = PATH_WIDTH; tracePath(ctx); ctx.stroke();
  ctx.strokeStyle = BODY; ctx.lineWidth = PATH_WIDTH - 4; tracePath(ctx); ctx.stroke();
  drawCode(ctx, time);
  // hollow solder rings at the corners, so the code shows through
  ctx.strokeStyle = 'rgba(45,212,191,.5)'; ctx.lineWidth = 2;
  for (const p of WAYPOINTS.slice(1, -1)) { ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
