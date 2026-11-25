// Pure layout helper for the upgrade popover. No DOM access: this module is
// imported by Node tests.

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Place a popover next to a tower so it never covers the tower and, where the
 * stage is too small, is capped to the room that exists.
 *
 * The caller applies `max-width: maxW` and `max-height: maxH` to the popover
 * (with scrolling when content overflows). `left`/`top` already account for
 * the capped `w`/`h`, which are min(popW, maxW) and min(popH, stageH).
 *
 * @param {object} args
 * @param {number} args.x        tower centre x in map coordinates
 * @param {number} args.y        tower centre y in map coordinates
 * @param {number} args.scale    stage CSS width / map WIDTH
 * @param {number} args.stageW   stage width in CSS pixels
 * @param {number} args.stageH   stage height in CSS pixels
 * @param {number} args.popW     popover width in CSS pixels
 * @param {number} args.popH     popover height in CSS pixels
 * @param {number} [args.gap=10]       gap between tower edge and popover
 * @param {number} [args.towerHalf=22] tower half-size in map coordinates
 * @returns {{ left: number, top: number, side: 'right'|'left', arrowY: number,
 *             maxW: number, maxH: number }}
 *   left/top: popover top-left in stage pixels.
 *   side: which side of the tower the popover sits on.
 *   arrowY: arrow position inside the popover, pointing at the tower centre.
 *   maxW/maxH: the largest width/height the popover may take on this side.
 */
export function popoverPosition({
  x, y, scale, stageW, stageH, popW, popH, gap = 10, towerHalf = 22,
}) {
  const cx = x * scale;
  const cy = y * scale;
  const off = towerHalf * scale + gap;

  const roomRight = stageW - (cx + off);
  const roomLeft = cx - off;

  let side;
  if (popW <= roomRight) {
    side = 'right';
  } else if (popW <= roomLeft) {
    side = 'left';
  } else {
    side = roomLeft > roomRight ? 'left' : 'right';
  }

  const maxW = Math.max(0, side === 'right' ? roomRight : roomLeft);
  const w = Math.min(popW, maxW);
  const left = side === 'right' ? cx + off : cx - off - w;

  const maxH = stageH;
  const h = Math.min(popH, maxH);
  const top = clamp(cy - h / 2, 0, stageH - h);
  const arrowY = clamp(cy - top, 12, Math.max(12, h - 12));

  return { left, top, side, arrowY, maxW, maxH };
}
