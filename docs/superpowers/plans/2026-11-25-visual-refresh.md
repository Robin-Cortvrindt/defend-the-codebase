# Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 24 × 12 board with a 10-corner route that fits the screen without scrolling, a Nexios office background, a year-roadmap top bar, and a centred stacked bell that locks the game while it waits.

**Architecture:** The map stays one module (`src/engine/map.js`); everything that draws or places things reads its constants, so the building and lane follow the new route. New small modules hold the office background (`src/engine/office.js`) and the roadmap model (`src/engine/roadmap.js`, pure, tested); `ui.js` renders the model. The bell lock lives in the engine (refusals during `phase === 'bell'`), and the UI only reflects it.

**Tech Stack:** Vanilla ES modules, canvas 2D, plain CSS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-visual-refresh-design.md`

## Global Constraints

- Work on branch `visual-refresh`, one commit per task.
- Mockups are the visual reference: `docs/mockups/playing-field.html` (B), `field-backgrounds.html` (5), `top-bar.html` (B, `#roadmap`), `bell-new-board.html` (3, `#locked`).
- No emoji in shipped UI; icons are inline SVG.
- Route: `(0,60) → (300,60) → (300,220) → (140,220) → (140,420) → (460,420) → (460,140) → (620,140) → (620,380) → (780,380) → (780,260) → (896,260)`; PROD `{ x: 896, y: 226, w: 56, h: 68 }`; `COLS 24`, `ROWS 12`, `CELL 40`.
- Balance baseline (`node scripts/sim.mjs`, 30 trials, before any change), median sprints cleared, no powers / powers: react 6 / 6, java 2 / 2, mixed 10 / 21, dotnet 1 / 1. Target after the change: each median within ±1.
- `node --test` stays green after every task.

## Review Focus

1. A window shorter than the HUD + bars (e.g. 1366 × 600): the board shrinks but never below 240 px tall, and the page may scroll only then. → Task 3 manual check.
2. A selection popover open when a sprint ends: it closes when the bell appears, and nothing can reopen it until the bell is rung. → Task 4 test `bell clears selection and hire mode`.
3. A mail offer showing when the sprint ends: its 6 s countdown pauses during the bell and it can't be accepted; it resumes after the bell. → Task 4 test.
4. A merge conflict splitting mid-sprint: "x / y bugs" grows y and still ends at y / y. → Task 6 test.
5. The building with many floors on the new PROD position still fits above PROD and never overlaps the lane. → Task 1 test.

---

### Task 1: Bigger board and new route

**Files:**
- Modify: `src/engine/map.js` (constants, header comment)
- Modify: `src/engine/building.js:12-13` (`BUILDING` derived from `PROD`)
- Modify: `src/engine/render.js:80` (`BUILDING_GROUND` from `BUILDING.ground`)
- Modify: `scripts/sim.mjs`, `scripts/sim-upgrades.mjs` (loops use `COLS`/`ROWS`)
- Test: `tests/map.test.js`, plus coordinate fixes in `tests/firewall.test.js` and any other test that breaks

**Interfaces:**
- Produces: `COLS = 24`, `ROWS = 12`, `WIDTH = 960`, `HEIGHT = 480`, new `WAYPOINTS`, `PROD`; `BUILDING = { x: PROD.x + 2, w: 52, ground: PROD.y + 72, groundTop: PROD.y + 12, minTop: 8 }`.

- [ ] **Step 1: Rewrite `tests/map.test.js` for the new route**
  - `PATH_LENGTH === 2216`
  - `pointAt(0)` → `{x:0,y:60}`; `pointAt(310)` → `{x:300,y:70}`; `pointAt(1e9)` → `{x:896,y:260}`
  - `isBuildable`: `(0,1)` false (lane), `(3,3)` true, `(22,3)` false (column above PROD), `(23,11)` true, `(24,0)` false, `(-1,0)` false
  - `headingAt(10) === 0`, `headingAt(310) === π/2`, corner at 300 is halfway (`π/4`)
  - new test `building fits above PROD`: `BUILDING.ground === PROD.y + 72`, `BUILDING.minTop >= 0`, and no lane segment passes within `PATH_WIDTH/2` of the rectangle `x BUILDING.x..+w, y minTop..PROD.y`.
- [ ] **Step 2:** `node --test tests/map.test.js` → FAIL (old constants).
- [ ] **Step 3:** Change the constants in `map.js`, derive `BUILDING` in `building.js` from `PROD` (import it), replace the `BUILDING_GROUND` literal in `render.js` with `BUILDING.ground`, update the comments that mention 16 × 8 / x 576.
- [ ] **Step 4:** `node --test` → fix every test that used old-map cells (e.g. firewall pairs across `(4,4)` now need a real lane cell such as `(3,6)`/`(3,8)` across `(3,7)`... pick cells by checking `isPathCell`). Keep each test's intent; change only coordinates.
- [ ] **Step 5:** Replace the hard-coded `16`/`8` in both sims with `COLS`/`ROWS`; `node scripts/sim.mjs --trials 3` runs without errors.
- [ ] **Step 6:** Commit `feat: 24 x 12 board with a longer, twistier route`.

### Task 2: Nexios office background

**Files:**
- Create: `src/engine/office.js`
- Modify: `src/engine/render.js` `drawMap` (replace navy fill + grid with `drawOffice`)
- Test: `tests/office.test.js`

**Interfaces:**
- Produces: `export const DECORATIONS: Array<{ kind: 'plant'|'desk'|'coffee', col, row }>`; `export function drawOffice(ctx)`.

- [ ] **Step 1: Write `tests/office.test.js`**: every decoration cell `isBuildable(col,row)` and `!isPathCell(col,row)`; no two decorations share a cell; `drawOffice(stubCtx)` doesn't throw (use `tests/stub-ctx.js`).
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** Implement from the mockup's `office()` in `docs/mockups/field-backgrounds.html`: tiles in `#132A3E/#152E44/#11283B` picked by `(c*7 + r*3) % 3`, alternating grain, cell edges `rgba(0,0,0,.25)`. Decorations: plants `(0,11) (11,0) (12,0)`, desks `(1,9) (2,9) (20,0) (21,0)`, coffee `(22,11)`. Draw the static tiles once into an offscreen canvas when `document` exists (fallback: draw directly) so frames stay cheap.
- [ ] **Step 4:** `node --test` → PASS.
- [ ] **Step 5:** Commit `feat: Nexios office floor behind the lane`.

### Task 3: Board fits the window

**Files:**
- Modify: `src/main.js` `resize()`
- Modify: `style.css` (`#stage` centring)

- [ ] **Step 1:** `resize()`: available width = `#play` width − side panel width (side panel width 0 when the media query stacks it); available height = `innerHeight − 32 (body padding) − (#app height − #stage height)`; `cssW = max(480, min(availW, max(240, availH) * WIDTH / HEIGHT))`; set `#stage` and canvas width/height to it. Also call `resize()` on `ResizeObserver` of `#app` (the HUD can wrap).
- [ ] **Step 2:** CSS: `#stage { justify-self: center; }` and a background on `#play`'s first column (`#001725`) so the side gaps look intentional.
- [ ] **Step 3: Verify:** `python -m http.server 8000`, open `http://localhost:8000/?demo=1` at 1366 × 650 and 1920 × 950 (Edge headless screenshots): no vertical scroll, hire row visible, popover still lines up with the clicked developer.
- [ ] **Step 4:** Commit `feat: board scales to fit the window`.

### Task 4: Nothing changes while the bell waits (engine)

**Files:**
- Modify: `src/engine/devs.js` (`canPlace`, `sellDev`, `buyUpgrade`)
- Modify: `src/engine/input.js` (click: during `bell` only `clickDrop`; hotkeys 1–3 ignored)
- Modify: `src/engine/ui.js` (`updateUI`: in `bell`, clear `view.selected` and `view.hire`; `selectHire` refuses in `bell`; panel buttons not rendered)
- Modify: `src/content/features/mailbox.js` (`CLAIM_PHASES` without `bell`; offer timer holds and `acceptOffer` refuses during `bell`)
- Modify: `scripts/sim.mjs`, `scripts/sim-upgrades.mjs` (in `bell`: `ringBell` first, then buy)
- Test: `tests/bell-lock.test.js`, adjust `tests/mailbox.test.js` where it claims during `bell`

**Interfaces:**
- Produces: `export const isLocked = game => game.phase === 'bell'` in `src/engine/game.js`.

- [ ] **Step 1: Write `tests/bell-lock.test.js`**: with `phase = 'bell'`: `placeDev` → `null`, `sellDev` → `0` and the dev stays, dev `buyUpgrade` → `false`, `usePowerup` → `false`, `claimMail` → `null`, `acceptOffer` → `null` and the offer stays, `tickOffer(game, 5)` leaves `remaining` unchanged; the same calls succeed in `wave`. Test `bell clears selection and hire mode` via the exported view-reset helper (`lockView(view)` in `ui.js` is DOM-heavy, so put the reset in `game.js`: `export function lockedView(view)` returning `{ ...view, selected: null, hire: null }`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement the guards with `isLocked`. Drop pickup stays allowed during the bell (drops still expire then).
- [ ] **Step 4:** `node --test` → PASS. Sims run with `--trials 3`.
- [ ] **Step 5:** Commit `feat: the game is locked while the bell waits`.

### Task 5: Centred, stacked bell card and locked bars

**Files:**
- Modify: `src/engine/ui.js` `showOverlay('bell')` (stacked markup, copy "Click the bell or press Space"); `updateUI` toggles `#app.bell-locked`
- Modify: `style.css` (bell overlay centred, dim `.55`, stacked card; `.bell-locked` greys `#powerups`/`#hire` children, `pointer-events: none`, a centred "Locked until you ring the bell" note with an inline-SVG lock on `#hire::before`, canvas `cursor: default`)

- [ ] **Step 1:** Implement per `bell-new-board.html#locked`: card `width ~26%` of the stage, bell ~48% of card width, centred.
- [ ] **Step 2: Verify** in the browser (`?demo=1`, finish a sprint at 10×): card centred, bars greyed with the note, clicks on the board do nothing, Space rings the bell, bars return after.
- [ ] **Step 3:** `node --test` → PASS. Commit `feat: centred bell card; hire and power-up bars lock with it`.

### Task 6: Year roadmap top bar

**Files:**
- Create: `src/engine/roadmap.js`
- Modify: `src/engine/game.js` (`waveSpawned` counter: reset in `startWave`, `++` in `spawnBug` while `phase === 'wave'`; `export function waveProgress(game) → { done, total }` with `total = waveSpawned + spawnQueue.length`, `done = waveSpawned − bugs.length`)
- Modify: `src/engine/ui.js` `buildHud`/`updateUI` (roadmap replaces Sprint + Incident stats; incident chip; icon buttons for Pause/Resume, Sound on/off, Quit with `title` tooltips; speed stays text)
- Modify: `style.css` (roadmap and chip styles from `top-bar.html`)
- Test: `tests/roadmap.test.js`

**Interfaces:**
- Produces: `roadmapModel(game) → { year, quarter, sprint, quarters: Array<{ label: 'Q1'..'Q4', state: 'past'|'current'|'future', sprints: Array<'done'|'now'|'todo'> }>, nowFill: 0..1, right: string }`.
  - `right` = `"N sprints to quarter review"` outside a sprint, `N = 7 − sprint + 1`; `"x / y bugs"` during a sprint (from `waveProgress`).
  - `nowFill` = `done / total` during a sprint, else 0.

- [ ] **Step 1: Write `tests/roadmap.test.js`**: sprint index 9 (Y1 Q2 S3) in `bell` → Q1 all `done`, Q2 `[done, done, now, todo×4]`, Q3/Q4 `todo`, `right === '5 sprints to quarter review'`; index 28 → year 2, all Q1 todo except `now`; `waveProgress` with 2 queued, 3 spawned, 1 alive → `{ done: 2, total: 5 }`; a split (extra `spawnBug` during the wave) raises `total` and the sprint ends at `done === total`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `roadmap.js`, `waveProgress`, then the HUD markup and CSS from the mockup (stars at quarter ends gold once past, trophy SVG at Q4; chip only while `activeEvent`).
- [ ] **Step 4:** `node --test` → PASS. Browser check at 1366 wide: one row, nothing wraps.
- [ ] **Step 5:** Commit `feat: year roadmap in the top bar`.

### Task 7: Re-tune the balance

**Files:**
- Modify: `src/content/waves.js` (and the generated-sprint scaling in `src/engine/game.js` `getSprintDef` if the hand-made sprints alone can't match)

- [ ] **Step 1:** `node scripts/sim.mjs` on the new board; compare medians with the baseline in Global Constraints.
- [ ] **Step 2:** Adjust one lever at a time (first a shared HP factor across sprints, then bug speed if the spread is uneven) until every median is within ±1. Record the final table in the commit message.
- [ ] **Step 3:** `node scripts/sim-upgrades.mjs` runs; no branch's survival changes by more than the baseline's own spread.
- [ ] **Step 4:** `node --test` → PASS. Commit `balance: re-tune sprints for the longer route and the bell lock`.

### Task 8: Docs and final check

**Files:**
- Modify: `README.md` (bell locks the game; top bar roadmap; board), `CONTRIBUTING.md` if it mentions the grid size
- Add: the approved mockups and the spec (`docs/mockups/{bell-position,bell-new-board,playing-field,field-backgrounds,top-bar}.html`, the spec, this plan)

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** `node --test`; Edge headless screenshots of menu, a running sprint and the bell at 1366 × 650.
- [ ] **Step 3:** Commit `docs: README and mockups for the visual refresh`.
