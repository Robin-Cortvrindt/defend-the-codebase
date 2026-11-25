// The tipsy path of a shot during Thomas's wine tasting (see content/events/wine-tasting.js).
// A point `s` (0..1) of the way from `from` to `to`: straight-line progress plus a triangle-wave
// sideways offset of up to `amp` px. The offset is pinned to 0 at both ends, so the shot still leaves
// the developer and lands on the bug. `seed` shifts the zigs so no two shots look the same.
export function zigzagPoint(from, to, s, seed = 0, amp = 16) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len, zigs = Math.max(2, Math.round(len / 45));
  const ph = s * zigs + seed, tri = 1 - 4 * Math.abs(ph - Math.floor(ph) - 0.5);   // -1..1
  const off = tri * amp * Math.max(0, Math.min(1, s * 6, (1 - s) * 6));
  return { x: from.x + dx * s + nx * off, y: from.y + dy * s + ny * off };
}
