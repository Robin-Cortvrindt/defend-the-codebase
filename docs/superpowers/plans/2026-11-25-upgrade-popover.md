# Upgrade Popover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the selected developer's panel out of the hire bar into a popover next to the tower on the map, keep the hire buttons a fixed size, and make the level-3 step read as a choice.

**Architecture:** A pure function computes the popover's position from the tower's map coordinates and the stage size (unit-tested in Node). `ui.js` renders the existing panel content into a popover element inside `#stage` and positions it every frame. CSS turns `#hire` into three fixed columns.

**Tech Stack:** Plain JavaScript ES modules, DOM, CSS. `node --test` (Node 20+). No build step, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-25-upgrade-popover-design.md`

## Global Constraints

- No build step, no npm dependencies.
- House style: sentence case, no exclamation marks, no emoji. Nexios palette, Lato. Readable on a projector: names 13–14px, sublines 12px.
- Panel content is unchanged: title `{type} · {level name}`, XP / squashed line, upgrade buttons, extra content buttons (Azure toggle), Sell. Content hooks stay guarded with try/catch.
- Keep the stable rebuild key from the current `updateSelPanel` (rebuild only when id, level, upgrade status reasons or extra-button labels change; update the XP line in place). Kills must not rebuild the popover.
- `Element.append` does not flatten arrays — spread lists (see commit 3321375).
- The popover sits above the canvas and below `#overlay` (bell, review, game-over screens).
- Branch: `feat/tower-upgrades`. Do not push.

## Review Focus

1. **A tower at the right edge of the map** (column 14–15): the popover opens on the left and stays fully inside the stage. Test in Task 1.
2. **A tower in the top or bottom row**: the popover is clamped inside the stage vertically; its arrow still points at the tower. Test in Task 1.
3. **A popover taller than the stage** (narrow screen): top clamps to 0 rather than going negative. Test in Task 1.
4. **Selecting, deselecting and selecting another developer**: the popover hides on deselect and moves to the new tower; the hire bar's size never changes. Verified in Task 2 with the headless DOM check.
5. **Buying the level-2 upgrade with the popover open**: it rebuilds in place into the "Choose one" layout without closing. Verified in Task 2 with the headless DOM check.

---

### Task 1: Popover position

**Files:**
- Create: `src/engine/popover.js`
- Test: `tests/popover.test.js`

**Interfaces:**
- Produces: `popoverPosition({ x, y, scale, stageW, stageH, popW, popH, gap = 10, towerHalf = 22 }) → { left, top, side: 'right'|'left', arrowY }`.
  - `x, y` are the tower centre in map coordinates; `scale` = stage CSS width / `WIDTH`.
  - Tower centre in stage pixels: `cx = x * scale`, `cy = y * scale`. Horizontal offset `off = towerHalf * scale + gap`.
  - `side = 'right'` and `left = cx + off` when `cx + off + popW <= stageW`; otherwise `side = 'left'` and `left = max(0, cx - off - popW)`.
  - `top = clamp(cy - popH / 2, 0, max(0, stageH - popH))`.
  - `arrowY = clamp(cy - top, 12, popH - 12)` (arrow position inside the popover).

- [ ] **Step 1: Write the failing tests in `tests/popover.test.js`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { popoverPosition } from '../src/engine/popover.js';

const base = { scale: 1, stageW: 640, stageH: 320, popW: 240, popH: 160 };

test('opens to the right of a tower with room, centred vertically', () => {
  const p = popoverPosition({ ...base, x: 140, y: 140 });
  assert.deepEqual(p, { left: 140 + 22 + 10, top: 60, side: 'right', arrowY: 80 });
});

test('Review Focus 1: opens to the left near the right edge and stays inside', () => {
  const p = popoverPosition({ ...base, x: 580, y: 140 });
  assert.equal(p.side, 'left');
  assert.equal(p.left, 580 - 32 - 240);
  assert.ok(p.left >= 0 && p.left + base.popW <= base.stageW);
});

test('Review Focus 2: clamps vertically at top and bottom rows; arrow still points at the tower', () => {
  const top = popoverPosition({ ...base, x: 140, y: 20 });
  assert.equal(top.top, 0); assert.equal(top.arrowY, 20);
  const bottom = popoverPosition({ ...base, x: 140, y: 300 });
  assert.equal(bottom.top, 160); assert.equal(bottom.arrowY, 140);
});

test('Review Focus 3: a popover taller than the stage clamps top to 0', () => {
  assert.equal(popoverPosition({ ...base, x: 140, y: 140, popH: 400 }).top, 0);
});

test('scale multiplies map coordinates and the tower half-size', () => {
  const p = popoverPosition({ ...base, scale: 0.5, stageW: 320, stageH: 160, popW: 100, popH: 60, x: 140, y: 140 });
  assert.deepEqual(p, { left: 70 + 11 + 10, top: 40, side: 'right', arrowY: 30 });
});
```

- [ ] **Step 2: Run and check they fail**

Run: `node --test tests/popover.test.js`
Expected: FAIL — cannot find module `src/engine/popover.js`.

- [ ] **Step 3: Implement `popoverPosition` in `src/engine/popover.js`** as specified in Interfaces (no DOM access in this file).

- [ ] **Step 4: Run all tests**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/popover.js tests/popover.test.js
git commit -m "feat: compute the upgrade popover position next to a tower"
```

---

### Task 2: Popover on the map, fixed hire bar, level-3 choice

**Files:**
- Modify: `src/engine/ui.js` (`buildHire`, `updateSelPanel`), `style.css` (`#hire`, `.sel-panel*`, `.upgrade-btn`, the `max-width: 720px` block)

**Interfaces:**
- Consumes: `popoverPosition` (Task 1); `WIDTH` from `src/engine/map.js`; existing `nextUpgrades`, `upgradeStatus`, `buyDevUpgrade`, `levelName`, `XP_GATES`, `sellDev`, `h`, `set`, `toggle`.

- [ ] **Step 1: Move the panel into the stage**

In `buildHire`, stop appending `refs.selPanel` to `#hire`. Create it once (keep the `sel-panel hidden` classes, add `popover`) and insert it into `#stage` **before** `#overlay`, so overlay screens stay on top. Add a child `refs.selArrow = h('i', { class: 'popover-arrow' })` that is re-appended on each rebuild.

- [ ] **Step 2: Content and the level-3 choice in `updateSelPanel`**

Keep the current content, the rebuild key and the in-place XP update. When `nextUpgrades(dev).length === 2` (the level-3 choice), render instead of two plain buttons:
- a heading `h('div', { class: 'choice-head' }, h('b', {}, 'Choose one'), h('small', {}, "You can't change this later."))`
- a row `h('div', { class: 'choice' }, btnA, h('span', { class: 'choice-or' }, 'or'), btnB)`

Each branch button keeps its `Steady · ` / `Gamble · ` line, cost, tooltip and disabled state. With one upgrade, render it as today. Then the extra buttons and Sell.

- [ ] **Step 3: Position every frame**

At the end of `updateSelPanel` (both the rebuild and the in-place path, while a developer is selected):
- `scale = stage.clientWidth / WIDTH`; `stageW = stage.clientWidth`; `stageH = stage.clientHeight`; `popW = p.offsetWidth`; `popH = p.offsetHeight`.
- `const { left, top, side, arrowY } = popoverPosition({ x: dev.x, y: dev.y, scale, stageW, stageH, popW, popH })`.
- Write them with `set(p.style, 'left', ...px)`, `set(p.style, 'top', ...px)`, toggle class `left` for `side === 'left'`, and `set(refs.selArrow.style, 'top', ...px)`.

- [ ] **Step 4: CSS**

- `#hire`: `grid-template-columns: repeat(3, minmax(0, 1fr))` (also in the 720px block); remove the `.sel-panel { grid-column }` rule there.
- `.sel-panel.popover`: `position: absolute; z-index: 5; width: 260px; line-height: 1.4; flex-direction: column; align-items: stretch;` with the existing navy background, accent left border and radius; a drop shadow so it separates from the map. Keep `.sel-panel.hidden { visibility: hidden; }` (also `pointer-events: none` when hidden).
- `.popover-arrow`: a 12px square rotated 45°, same background, positioned on the left edge (`left: -6px`); with `.popover.left` it moves to the right edge.
- `.choice`: `display: flex; gap: 6px; align-items: stretch;` with `.choice .upgrade-btn { min-width: 0; flex: 1 1 0; }`; `.choice-or`: centred 12px slate text; `.choice-head small`: 12px slate.
- In the 720px block: `.sel-panel.popover { width: min(240px, 70%); }`.

- [ ] **Step 5: Verify headless and run tests**

Run: `node --test` — Expected: all PASS.

Run a headless DOM check (a stand-in DOM like the one used for commit 3321375; keep it out of the repo) that:
- selects a Java developer with 40 XP: the popover is a child of `#stage`, `#hire` contains exactly the 3 hire buttons, and no child of the popover is a stringified array;
- buys `springboot`, calls `updateUI()` again: the popover contains a `.choice` with two `.upgrade-btn` and the text `Choose one`;
- deselects (`view.selected = null`, `updateUI()`): the popover has class `hidden`.

Expected: all three checks pass. Say in the report that no real browser was run.

- [ ] **Step 6: Commit**

```bash
git add src/engine/ui.js style.css
git commit -m "feat: upgrade options open next to the selected developer; level 3 is a clear choice"
```
