// The board's floor: Nexios office carpet tiles with a few plants, desks and a coffee machine.
// Purely decoration, drawn under the lane; developers can be hired on decorated cells and stand on top.
import { COLS, ROWS, CELL, WIDTH, HEIGHT } from './map.js';

const SHADES = ['#132A3E', '#152E44', '#11283B'];
const GRAIN = 'rgba(255,255,255,.025)';
const EDGE = 'rgba(0,0,0,.25)';

// Fixed cells, chosen away from the lane and the PROD column (tests check they stay buildable).
export const DECORATIONS = [
  { kind: 'plant', col: 2, row: 11 }, { kind: 'plant', col: 11, row: 0 }, { kind: 'plant', col: 12, row: 0 },
  { kind: 'desk', col: 1, row: 9 }, { kind: 'desk', col: 2, row: 9 },
  { kind: 'desk', col: 20, row: 0 }, { kind: 'desk', col: 21, row: 0 },
  { kind: 'coffee', col: 22, row: 11 },
];

export function drawOffice(ctx) {
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const x = c * CELL, y = r * CELL;
      ctx.fillStyle = SHADES[(c * 7 + r * 3) % 3];
      ctx.fillRect(x, y, CELL, CELL);
      // carpet grain, alternating direction like laid tiles
      ctx.strokeStyle = GRAIN;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 6; k < CELL; k += 6) {
        if ((c + r) % 2) { ctx.moveTo(x + k, y); ctx.lineTo(x + k, y + CELL); }
        else { ctx.moveTo(x, y + k); ctx.lineTo(x + CELL, y + k); }
      }
      ctx.stroke();
    }
  }
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c++) { ctx.moveTo(c * CELL + 0.5, 0); ctx.lineTo(c * CELL + 0.5, HEIGHT); }
  for (let r = 1; r < ROWS; r++) { ctx.moveTo(0, r * CELL + 0.5); ctx.lineTo(WIDTH, r * CELL + 0.5); }
  ctx.stroke();
  for (const d of DECORATIONS) DRAW[d.kind](ctx, d.col * CELL, d.row * CELL);
}

const DRAW = {
  plant(ctx, x, y) {
    const cx = x + CELL / 2, cy = y + CELL / 2;
    ctx.fillStyle = '#7C4A2A';
    ctx.fillRect(cx - 6, cy + 2, 12, 9);
    ctx.fillStyle = '#16A34A';
    for (const [dx, dy, s] of [[-5, -2, 6], [5, -2, 6], [0, -7, 7], [0, 0, 6]]) {
      ctx.beginPath(); ctx.arc(cx + dx, cy + dy, s, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(74,222,128,.5)';
    ctx.beginPath(); ctx.arc(cx - 2, cy - 8, 3, 0, Math.PI * 2); ctx.fill();
  },
  desk(ctx, x, y) {
    ctx.fillStyle = '#C8A67A';
    ctx.fillRect(x + 4, y + 6, 32, 18);
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(x + 13, y + 9, 14, 8);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(x + 14, y + 10, 12, 6);
    ctx.fillStyle = '#334155';
    ctx.beginPath(); ctx.arc(x + 20, y + 32, 6, 0, Math.PI * 2); ctx.fill();
  },
  coffee(ctx, x, y) {
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(x + 9, y + 6, 22, 28);
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(x + 13, y + 10, 14, 8);
    ctx.fillStyle = '#7C4A2A';
    ctx.fillRect(x + 17, y + 24, 6, 6);
  },
};
