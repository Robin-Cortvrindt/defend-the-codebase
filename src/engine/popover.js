// Pure layout helper for the upgrade popover. No DOM access: this module is
// imported by Node tests.

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/**
 * Place a popover next to a tower.
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
 * @returns {{ left: number, top: number, side: 'right'|'left', arrowY: number }}
 */
export function popoverPosition({
  x, y, scale, stageW, stageH, popW, popH, gap = 10, towerHalf = 22,
}) {
  const cx = x * scale;
  const cy = y * scale;
  const off = towerHalf * scale + gap;

  let side;
  let left;
  if (cx + off + popW <= stageW) {
    side = 'right';
    left = cx + off;
  } else {
    side = 'left';
    left = Math.max(0, cx - off - popW);
  }

  const top = clamp(cy - popH / 2, 0, Math.max(0, stageH - popH));
  const arrowY = clamp(cy - top, 12, popH - 12);

  return { left, top, side, arrowY };
}
