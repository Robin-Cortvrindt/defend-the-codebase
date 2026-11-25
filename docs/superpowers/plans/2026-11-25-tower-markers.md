# Tower Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep each tower's level badge, "ready" marker and XP bar inside its own 40×40 cell, while the level stays a readable number and "ready" stays easy to spot.

**Architecture:** A pure `devLayout()` in `src/engine/render.js` returns the rectangles for a tower's tile, badge, ready outline and XP bar relative to its centre; a Node test checks they stay in the cell. `drawDev` draws from that layout; the ready marker becomes a pulsing outline driven by `game.time`.

**Tech Stack:** Plain JavaScript ES modules, Canvas 2D, `node --test` (Node 20+).

**Spec:** `docs/superpowers/specs/2026-11-25-tower-markers-design.md`

## Global Constraints

- Cell is `CELL` = 40 px; everything drawn for a tower stays within ±20 px of its centre (range circles and effects excepted).
- Tile on the map 32 px (was 36); the hire bar's tiles (`drawDevTile(c, def, 16, 16, 28)` in ui.js) are unchanged.
- Badge: 14×14, spans x ∈ [5, 19], y ∈ [−19, −5]; number in `900 10px` Lato; white/navy, green/white at max level.
- Ready: green `#16A34A` 2 px outline around the tile, ≤ 19 px from the centre, opacity pulsing ~0.45–1 about once a second from `game.time`. Replaces the corner triangle.
- XP bar (selected only): 32 px wide, y ∈ [16, 19].
- No emoji, sentence case. Branch `feat/tower-upgrades`; do not push.

## Review Focus

1. **Two towers in adjacent cells (side by side and diagonal):** no rectangle of one reaches into the other's cell. Test in Task 1.
2. **Max level vs ready:** a max-level tower never shows the ready outline (`upgradeUnlocked` is false); the badge turns green. Test in Task 1 (layout) — drawing checked in the browser.
3. **Selected tower:** the XP bar stays inside the cell and doesn't overlap the badge. Test in Task 1.
4. **The badge must not hide the icon's centre.** Test in Task 1.
5. **Hover preview while hiring** uses the same 32 px tile so placement matches what you get. Checked in Task 1 Step 3.

---

### Task 1: Markers inside the cell

**Files:**
- Modify: `src/engine/render.js` (`drawDev`, `drawHover`'s `drawDevTile` call, new export `devLayout`)
- Test: `tests/render-layout.test.js`

**Interfaces:**
- Produces: `devLayout() → { tile: Rect, badge: Rect, ready: Rect, xp: Rect }`, `Rect = { x, y, w, h }` relative to the tower centre, values from Global Constraints (`tile` = x −16, y −16, 32×32; `badge` = x 5, y −19, 14×14; `ready` = the outline's outer box, x −19, y −19, 38×38; `xp` = x −16, y 16, 32×3). Also `export const MAP_TILE = 32`.

- [ ] **Step 1: Write the failing test `tests/render-layout.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { devLayout, MAP_TILE } from '../src/engine/render.js';
import { CELL } from '../src/engine/map.js';

const inCell = r => r.x >= -CELL / 2 && r.y >= -CELL / 2 && r.x + r.w <= CELL / 2 && r.y + r.h <= CELL / 2;

test('every tower marker stays inside its own cell', () => {
  const L = devLayout();
  for (const [name, r] of Object.entries(L)) assert.ok(inCell(r), `${name} ${JSON.stringify(r)} leaves the cell`);
});

test('tile is 32 px; badge is 14 px in the top-right corner', () => {
  const { tile, badge } = devLayout();
  assert.equal(MAP_TILE, 32);
  assert.deepEqual(tile, { x: -16, y: -16, w: 32, h: 32 });
  assert.deepEqual(badge, { x: 5, y: -19, w: 14, h: 14 });
});

test('badge does not cover the icon centre; XP bar does not touch the badge', () => {
  const { badge, xp } = devLayout();
  assert.ok(badge.x > 0 && badge.y + badge.h < 0, 'badge clear of the centre');
  assert.ok(xp.y >= badge.y + badge.h, 'xp bar below the badge');
});
```

- [ ] **Step 2: Run and see it fail**

Run: `node --test tests/render-layout.test.js`
Expected: FAIL — `devLayout` is not exported.

- [ ] **Step 3: Implement**

- `devLayout()` and `MAP_TILE` in render.js as in Interfaces.
- `drawDev`: tile via `drawDevTile(ctx, def, dev.x, dev.y, MAP_TILE)`; badge drawn in `badge` (rounded radius 3, number centred); when `upgradeUnlocked(dev)`, stroke a rounded 2 px green outline inset 1 px inside `ready` (so its outer edge stays at 19) with `globalAlpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(game.time * 2 * Math.PI))`, then restore alpha; remove the triangle; selected XP bar uses `xp`. `drawDev` needs `game` for the pulse — pass it from `render`.
- `drawHover`: `drawDevTile(ctx, def, x, y, MAP_TILE)` so the preview matches.

- [ ] **Step 4: Run all tests**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/render.js tests/render-layout.test.js
git commit -m "fix: keep tower level badge, ready marker and XP bar inside the cell"
```
