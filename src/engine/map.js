// The single map: a 16 x 8 grid with one winding path to PROD.
export const CELL = 40;
export const COLS = 16;
export const ROWS = 8;
export const WIDTH = COLS * CELL;
export const HEIGHT = ROWS * CELL;
export const PATH_WIDTH = 36;
export const WAYPOINTS = [
  { x: 0, y: 60 }, { x: 180, y: 60 }, { x: 180, y: 260 },
  { x: 420, y: 260 }, { x: 420, y: 140 }, { x: 576, y: 140 },
];
export const PROD = { x: 576, y: 106, w: 56, h: 68 };

const SEGMENTS = WAYPOINTS.slice(1).map((b, i) => {
  const a = WAYPOINTS[i];
  return { a, b, len: Math.hypot(b.x - a.x, b.y - a.y) };
});
export const PATH_LENGTH = SEGMENTS.reduce((s, seg) => s + seg.len, 0);

export function pointAt(distance) {
  let d = Math.max(0, distance);
  for (const { a, b, len } of SEGMENTS) {
    if (d <= len) {
      const t = len === 0 ? 0 : d / len;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    d -= len;
  }
  const end = WAYPOINTS[WAYPOINTS.length - 1];
  return { x: end.x, y: end.y };
}

// The direction a bug at `distance` walks, in radians (0 = right, π/2 = down).
export function headingAt(distance) {
  let d = Math.max(0, distance);
  let seg = SEGMENTS[0];
  for (const s of SEGMENTS) {
    seg = s;
    if (d <= s.len) break;
    d -= s.len;
  }
  return Math.atan2(seg.b.y - seg.a.y, seg.b.x - seg.a.x);
}

function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export const cellCenter = (col, row) => ({ x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 });
export const cellAt = (x, y) => ({ col: Math.floor(x / CELL), row: Math.floor(y / CELL) });

const inGrid = (col, row) => col >= 0 && row >= 0 && col < COLS && row < ROWS;
const PATH_CLEARANCE = PATH_WIDTH / 2 + CELL / 2 - 2;
const touchesPath = (col, row) => {
  const c = cellCenter(col, row);
  return SEGMENTS.some(({ a, b }) => distToSegment(c, a, b) < PATH_CLEARANCE);
};

// A cell the path runs through (bugs walk here; nobody can be hired on it).
export const isPathCell = (col, row) => inGrid(col, row) && touchesPath(col, row);

export function isBuildable(col, row) {
  if (!inGrid(col, row)) return false;
  if (touchesPath(col, row)) return false;
  const x0 = col * CELL, y0 = row * CELL;
  // The Nexios building grows upward with floors, so the whole column above PROD stays free.
  const overlapsProd = x0 < PROD.x + PROD.w && x0 + CELL > PROD.x && y0 < PROD.y + PROD.h;
  return !overlapsProd;
}
