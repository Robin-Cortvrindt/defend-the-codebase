# Scattered loot, Greedy goblin, Goblin trap, Robot vacuum: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drops fly to a random empty floor cell; a goblin event steals them; a Goblin trap upgrade slows it; a Robot vacuum investment collects them.

**Architecture:** The only engine logic change is in `src/engine/drops.js` (landing cell, flight, steal, nearest-drop helpers) plus drawing in `render.js`. The goblin is one content file (event + feature); the vacuum is one content file (investment + feature, like `security-training.js`). The trap follows the water cooler exactly (counterUpgrade + building art + side-panel label).

**Tech Stack:** Vanilla ES modules, canvas 2D, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-goblin-vacuum-design.md` · Mockup: `docs/mockups/goblin-vacuum.html` (approved)

## Global Constraints
- Use `COLS`, `ROWS`, `WIDTH`, `HEIGHT`, `CELL`, `isBuildable` from `src/engine/map.js`; no hard-coded board sizes.
- Gameplay randomness only via `game.random()`; drawing randomness never uses it.
- Everything moves on `dt` (game time), so it stops while paused.
- `FLIGHT = 0.5` s; `DROP_TTL` stays 10 s and starts on landing.
- Goblin: `GOBLIN_SPEED = 160` px/s × `(1 - 0.6 * resistanceTo(game, 'goblin'))`; steal radius 12 px; accent `#65A30D`.
- Vacuum: speeds `[70, 100, 130]` px/s for levels 1-3; collect radius 14 px; costs `[40, 30, 50]`; dock `{ x: 22, y: HEIGHT - 18 }`.
- Trap: `counterUpgrade` 3/5/7 Warrants, id `trap`, counters `goblin`.
- Clicking drops works exactly as today (PICK_RADIUS / SWEEP_RADIUS), only on landed drops.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus
1. **A drop still flying is clicked / swept / reached by the goblin or vacuum** → nothing happens to it until it lands (Task 1 test `flying drops can't be picked, swept, stolen or found`).
2. **The goblin's target is clicked away by the player mid-run** → it re-targets the next nearest drop the same tick, never runs to an empty spot (Task 2 test `re-targets when its drop is gone`).
3. **Restarting a run while a goblin is on the board / the vacuum is out** → new run starts with no goblin and the vacuum at its dock (Task 2 and Task 4 `init` tests).
4. **Last sprint of a quarter waits for drops** (`quarterHoldLeft`) → counts flight time, so the hold doesn't release while a drop is in the air (Task 1 test `quarterHoldLeft includes flight`).
5. **Every free cell is taken** (board full of developers) → drop lands at the bug's position instead of throwing (Task 1 test `no free cell: lands where the bug died`).

---

### Task 1: Scattered loot (engine)

**Files:**
- Modify: `src/engine/drops.js`, `src/engine/render.js` (`drawDrops`)
- Test: `tests/drops.test.js`, `tests/render-drops.test.js`

**Interfaces:**
- Produces (from `src/engine/drops.js`):
  - `export const FLIGHT = 0.5`
  - `landingSpot(game, fromX, fromY) -> { x, y }`: random free cell centre ± 8 px jitter; a free cell is `isBuildable(col,row)` and no developer (`game.devs` col/row). Order of `game.random()` calls: cell index, then x jitter, then y jitter. No free cell → `{ x: fromX, y: fromY }`.
  - Drop shape: `{ id, x, y, fromX, fromY, flight, drink, amount, ttl }` (`x, y` = landing spot).
  - `isLanded(drop) -> boolean` (`!(drop.flight > 0)`; drops pushed by old tests without `flight` count as landed).
  - `nearestDrop(game, x, y) -> drop | null` (landed only).
  - `stealDrop(game, drop) -> boolean`: removes without paying, emits `drop:stolen` `{ game, drop }`, adds a red `#F87171` pop `-N`.
  - `tickDrops(game, dt)`: flight runs down first; only the remaining dt comes off `ttl`.
  - `pickDrop` only considers landed drops (both PICK_RADIUS hit and SWEEP_RADIUS sweep).
  - `quarterHoldLeft` returns `max(flight + ttl)`.

- [ ] **Step 1: Update existing tests to the new timing and add the new ones** in `tests/drops.test.js`:
  - Existing tests that click right after a kill: land first with `tickDrops(g, FLIGHT)` before reading `g.drops[0].x/y`.
  - `drops expire after 10 s`: `tickDrops(g, FLIGHT + 9.9)` → still 1; `+0.2` → 0.
  - `Review Focus 4: last sprint holds`: loop 220 steps instead of 200.
  - `quarterHoldLeft`: right after the kill expect `DROP_TTL + FLIGHT`; after `tickDrops(g, 4)` expect `DROP_TTL + FLIGHT - 4`.
  - New `a drop lands on a free floor cell, never the lane, PROD or a developer`: register a developer, hire one at a buildable cell, kill 200 bugs with the real `Math.random`-seeded `g.random`, assert every drop's `cellAt(x, y)` is `isBuildable` and has no developer, and `fromX/fromY` equal the bug's position.
  - New `flying drops can't be picked, swept, stolen or found`: right after a kill `pickDrop(g, d.x, d.y) === 0`, `nearestDrop(g, d.x, d.y) === null`; after `tickDrops(g, FLIGHT)` `nearestDrop` returns it and `ttl === DROP_TTL`.
  - New `stealDrop removes without paying and emits drop:stolen`: drinks unchanged, listener called once with the drop.
  - New `no free cell: lands where the bug died`: stub `isBuildable`-blocking by filling every buildable cell with a developer (loop `COLS × ROWS`, `placeDev` where buildable) then kill → drop `x,y` within 0 of bug.
  - New `nearestDrop picks the closest landed drop`.
- [ ] **Step 2: Run** `node --test tests/drops.test.js` → new tests FAIL (missing exports).
- [ ] **Step 3: Implement** the Interfaces above in `drops.js` (import `isBuildable, cellCenter, COLS, ROWS` from `./map.js`). `dropDrinks` keeps "drink first" then calls `landingSpot` per drop. Keep `JITTER = 8`.
- [ ] **Step 4: Draw the flight** in `render.js` `drawDrops`: while `flight > 0`, with `s = 1 - flight / FLIGHT`, `e = s * (2 - s)`, position = from→to lerp by `e`, lifted by `sin(π s) * 30`, rotated `s * 4` rad, scale 0.8, plus a shadow ellipse on the ground line (see mockup `drawDrops`). Blink/pop-in unchanged for landed drops. Add a `tests/render-drops.test.js` case: a drop with `flight: 0.25` renders without throwing.
- [ ] **Step 5: Run** `node --test` → all PASS. Run `node scripts/sim.mjs --trials 5` → completes (no crash).
- [ ] **Step 6: Commit** `feat: drops fly to a random free floor cell`

### Task 2: Greedy goblin event

**Files:**
- Create: `src/content/events/goblin.js`
- Modify: `src/content/manifest.js` (after wine-tasting: `'./events/goblin.js',  // steals dropped drinks`), `tests/content.test.js` (event list gains `'goblin'`)
- Test: `tests/goblin.test.js`

**Interfaces:**
- Consumes: `nearestDrop`, `stealDrop`, `isLanded` (Task 1); `resistanceTo` from `src/engine/upgrades.js`.
- Produces: `export default` event `{ id: 'goblin', name: 'A greedy goblin', description: 'It steals your dropped drinks', accent: '#65A30D' }`; `export const goblinFeature` (id `goblin`); `export const GOBLIN_SPEED = 160`; `export goblinSpeed(game) -> number`. State `game.goblin = { x, y, carried, face /*-1|1*/, moving, leaving }` or `null`.

Behaviour (spec §2): `start` puts it at `x = WIDTH + 16`, `y = 40 + game.random() * (HEIGHT - 80)`. Feature `init(game)` sets `game.goblin = null`. Feature `update(game, dt)`:
- `leaving`: run right at `goblinSpeed`; remove when `x > WIDTH + 20`.
- else if `game.activeEvent === 'goblin'` and phase `wave`/`bell`: move to `nearestDrop` (re-picked every tick); within 12 px → `stealDrop`, `carried++`. No drop: drift at 30 px/s to the board centre.
`end`: sets `game.goblin.leaving = true` (if any). Drawing is in the **feature** `draw` (it must keep drawing while leaving, after the event ended): goblin per mockup `drawGoblin`, sack radius `4 + min(8, carried) * 0.75`, facing `face`, bob from `game.time`.

- [ ] **Step 1: Write failing tests** in `tests/goblin.test.js` (setup like `wine-tasting.test.js`; register the event and feature; game in `wave`, `g.activeEvent = 'goblin'`, call `event.start(g)`):
  - `starts just off the right edge` → `g.goblin.x === WIDTH + 16`.
  - `runs to the nearest landed drop and steals it` → push two landed drops; step the feature until one is gone; the nearer one was stolen, drinks unchanged, `carried === 1`.
  - `speed scales with the trap` → `goblinSpeed` is 160 at resistance 0, 64 at resistance 1; one `update(g, 0.1)` moves 16 px vs 6.4 px.
  - `re-targets when its drop is gone` → collect its target mid-run; next update moves towards the other drop.
  - `ignores flying drops` → only a flying drop on the board: nothing stolen after 0.4 s.
  - `end: it runs off the right and disappears; init clears it` → after `end`, steps until `g.goblin === null`; no steals while leaving; `init(g)` on a game with a goblin sets null.
  - `draw doesn't throw` with stub ctx (from `tests/stub-ctx.js` or the Proxy in `render-drops.test.js`) for carried 0 and 8.
- [ ] **Step 2: Run** `node --test tests/goblin.test.js` → FAIL.
- [ ] **Step 3: Implement** `src/content/events/goblin.js` (`registerEvent` + `registerFeature`), add manifest line, update `tests/content.test.js`.
- [ ] **Step 4: Run** `node --test` → PASS.
- [ ] **Step 5: Commit** `feat: greedy goblin event steals dropped drinks`

### Task 3: Goblin trap (building upgrade)

**Files:**
- Create: `src/content/upgrades/trap.js`
- Modify: `src/content/manifest.js` (after water: `'./upgrades/trap.js',`), `src/main.js` CORE list (add `'events/goblin.js'` and `'upgrades/trap.js'` like wine-tasting/water), `src/engine/building.js` (`drawTrap`, header comment `levels` list), `src/engine/render.js` `buildingSpec` (`trap: u.trap || 0`), `src/content/features/side-panel.js` `SHORT` (`trap: 'Trap'`), `README.md` (upgrade list: **goblin trap** (a greedy goblin steals dropped drinks))
- Test: `tests/counter-upgrades.test.js`, the building visual test next to the water cooler one (`grep -n "water cooler" tests/`)

**Interfaces:**
- Produces: upgrade `{ id: 'trap', name: 'Goblin trap', description: 'Counters: greedy goblin', counters: 'goblin' }` via `counterUpgrade`.

- [ ] **Step 1: Tests:** add `trap` to `UPGRADES`, `goblin` to `EVENTS`, `trap: 'goblin'` to `COUNTERS` in `counter-upgrades.test.js`; add a building test mirroring the water-cooler one: levels 0-3 draw without throwing and level 3 draws more than level 1 (same technique the water-cooler test uses). Note the generic counter test asserts `resistanceTo === 1` at level 3; that holds (the goblin interprets 1 as 40% speed).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** `trap.js` (copy `water.js`), `drawTrap(ctx, cx, floorY, level, t)` in `building.js` per mockup `drawTrap` (plate, jaws, `2 + level` teeth, coffee bait, swinging cage at level 3), called as `if (L.trap) drawTrap(ctx, x + w / 2 - 2, ground - 6, L.trap, t);` after the water cooler. Wire `buildingSpec`, `SHORT`, manifest, CORE, README.
- [ ] **Step 4: Run** `node --test` → PASS.
- [ ] **Step 5: Commit** `feat: Goblin trap slows the greedy goblin`

### Task 4: Robot vacuum (investment)

**Files:**
- Create: `src/content/investments/robot-vacuum.js`
- Modify: `src/content/manifest.js` (after garbage-collection: `'./investments/robot-vacuum.js',   // unlock: vacuum collects drops`), `src/engine/menu.js` (unlock pips), `README.md` (investments list), `CONTRIBUTING.md` (`drop:stolen` in the events list)
- Test: `tests/robot-vacuum.test.js`

**Interfaces:**
- Consumes: `nearestDrop`, `collectDrop` (Task 1).
- Produces: `export default` investment `{ id: 'robot-vacuum', name: 'Robot vacuum', description: 'A robot vacuum collects dropped drinks for you. Each level makes it faster.', group: 'unlocks', maxLevel: 3, getCost(level) → [40, 30, 50][level] ?? Infinity, apply(game, level) → game.unlocks.vacuum = level, effectText(level) → \`Robot vacuum: ${VACUUM_SPEEDS[level - 1]} px/s\` }`; `export const VACUUM_SPEEDS = [70, 100, 130]`; `export const DOCK`; `export const vacuumFeature` (id `robot-vacuum`). State `game.vacuum = { x, y, angle, moving }`.

Feature: `init(game)` → `game.vacuum = { ...DOCK, angle: 0, moving: false }`. `update(game, dt)`: nothing unless `game.unlocks?.vacuum` and phase `wave`/`bell`; target = `nearestDrop` or `DOCK`; move at `VACUUM_SPEEDS[level - 1]`; angle eases towards heading (`diff * min(1, dt * 8)`); within 14 px of the drop → `collectDrop`. `draw`: nothing unless unlocked; dock plate + vacuum per mockup `drawVacuum` (brushes spin only while `moving`).

menu.js: `const unlock = group === 'unlocks' && max === 1;` (one change: multi-level unlocks get pips and "Max", one-level unlocks keep "Owned").

- [ ] **Step 1: Tests** (`tests/robot-vacuum.test.js`, setup like `garbage-collection.test.js`):
  - `the investment: 40/30/50, 3 levels, unlocks group` and via `saveProgress({ levels: { 'robot-vacuum': 2 } })` + `startGame` → `g.unlocks.vacuum === 2`.
  - `off without the investment` → a landed drop stays after 5 s of updates.
  - `drives to the nearest landed drop and collects it (drinks paid)`.
  - `faster per level` → one `update(g, 0.1)` moves 7 / 10 / 13 px.
  - `returns to the dock and parks when the floor is clean`.
  - `ignores flying drops`; `init puts it back at the dock`; `draw doesn't throw` (stub ctx).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the file, manifest line, menu.js change, README + CONTRIBUTING lines.
- [ ] **Step 4: Run** `node --test` → PASS. Run `node scripts/sim.mjs --trials 5` → completes.
- [ ] **Step 5: Manual check** with `python -m http.server 8000`: give capital with `localStorage.setItem('dtc-investments', JSON.stringify({ capital: 999, levels: {} }))`, reload, buy the vacuum (pips show, level 2 price shows), start a run: drops fly out, clicking works, the vacuum collects. For the goblin, in the console during a sprint: `const m = await import('./src/content/events/goblin.js'); m.default.start(game.game); game.game.activeEvent = 'goblin';`.
- [ ] **Step 6: Commit** `feat: Robot vacuum investment collects dropped drinks`
