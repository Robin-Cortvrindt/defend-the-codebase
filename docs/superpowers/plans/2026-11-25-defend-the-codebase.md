# Defend the Codebase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A complete, playable browser tower defense game (10 waves, 3 developers, 3 bugs, levelling, 4 power-ups, victory bell, start, win and lose screens), built so teammates can extend it one file at a time.

**Architecture:** A pure simulation core (`src/engine/*`, no DOM) holds all game rules, so it can be unit-tested in Node. It is driven by content files that register themselves through `registry.js`. A thin browser layer (`render.js`, `ui.js`, `input.js`, `sound.js`, `main.js`) draws the state on a canvas and wires the DOM to it. Extension happens through registries, the event bus, `game.mods` and `registerFeature`.

**Tech Stack:** Plain HTML, CSS and JavaScript ES modules. No dependencies and no build. Tests run with Node 26's built-in `node --test`. Hosted on GitHub Pages from `main` at `/`.

**Spec:** `docs/superpowers/specs/2026-11-25-defend-the-codebase-design.md`

## Global Constraints

- No build step, no npm dependencies. `package.json` exists only for `"type": "module"` and `"scripts": { "test": "node --test" }`.
- Every asset path is relative (no leading `/`), so the `/defend-the-codebase/` sub-path works.
- Engine files (`src/engine/` except `render.js`, `ui.js`, `input.js`, `sound.js`) must not touch `window`, `document` or `Audio`.
- Grid is 16 × 8 cells of 40 px, a 640 × 320 logical canvas. Path waypoints are `(0,60) → (180,60) → (180,260) → (420,260) → (420,140) → (576,140)` and the path is 36 px wide. The PROD box is at x 576–632, y 106–174.
- Start with **100 Warrants** and **20 production lives**. There are 10 waves. The wave bonus is `20 + 5 × waveNumber`.
- Colours: navy `#001E32`, React blue `#2563EB`, Java orange `#EA580C`, .NET fuchsia `#C026D3`, green `#16A34A`, slate `#475569 #64748B #94A3B8 #E2E8F0 #EEF1F5`. Use the Lato font.
- Interface copy: no emoji, sentence case, no exclamation marks.
- The wordmark is `assets/nexios-wordmark-white.webp` as an `<img>`/`drawImage`, never re-typeset or stretched.
- Event names are exactly: `game:start wave:start wave:cleared bell:rung bug:spawned bug:killed bug:leaked dev:placed dev:levelup dev:sold powerup:activated claude:backfire game:won game:lost`.

## Review Focus

1. **Claude used with 0 bugs on the map, or when you can't afford it.** Expect it to be refused with no charge and no price increase. The test goes in Task 6.
2. **Placing a developer on the path, on PROD, on an occupied cell, off the grid, or without enough Warrants.** Expect it to be refused and the Warrants unchanged. The test goes in Task 4.
3. **The last bug of a wave dies and leaks in the same tick, or the final life is lost on wave 10's last bug.** Expect lost to win over cleared, and no bell after a loss. The test goes in Task 3.
4. **A content file that throws on import.** Expect the game to still boot, with the failure logged. The test goes in Task 1.
5. **A Claude backfire during a large wave.** Expect the doubled bugs to keep their path progress and health, and the wave not to end until all of them, clones included, are gone. The test goes in Task 6.

---

### Task 1: Contract — registry, events, modifiers, guarded loader

**Files:**
- Create: `package.json`, `src/engine/registry.js`, `src/engine/events.js`, `src/engine/loader.js`
- Test: `tests/registry.test.js`, `tests/events.test.js`, `tests/loader.test.js`

**Interfaces:**
- Produces:
  - `events.js`: `on(name, fn) -> unsubscribe()`, `emit(name, data)`, `clearAll()`. A listener that throws is caught and logged, and other listeners still run.
  - `registry.js`: `registerDeveloper(def)`, `registerBug(def)`, `registerPowerup(def)`, `registerWaves(waves)`, `registerFeature(def)`, `getDevelopers() -> def[]` (in registration order), `getDeveloper(id)`, `getBug(id)`, `getPowerups()`, `getWaves()`, `getFeatures()`, `resetRegistry()`. Registering a duplicate id replaces the old entry and warns.
  - Developer def: `{ id, name, accent, cost, damage, fireRate, range /*cells*/, counters /*bug id*/, drawIcon?(ctx, size) }`
  - Bug def: `{ id, name, ring, radius, hp, speed /*px/s*/, livesLost, reward, onHit?, onDeath?, update? }`
  - Powerup def: `{ id, name, description, duration /*s*/, cooldown /*s*/, getCost?(game), canActivate?(game), activate(game), deactivate?(game) }`
  - Waves: `[{ groups: [{ bug, count, interval /*s*/, delay /*s*/ }] }]`
  - Feature def: `{ id, init?(game), update?(game, dt), draw?(ctx, game), hudButtons?: [{ label, onClick(game) }] }`
  - `loader.js`: `async loadModules(paths, importFn = p => import(p)) -> { loaded: string[], failed: {path, error}[] }`. Each import is awaited separately inside its own try/catch.

- [ ] **Step 1: Write the failing tests**
  - `events: on/emit delivers data; unsubscribe stops delivery; throwing listener does not block the next`
  - `registry: getDevelopers returns registration order; duplicate id replaces; resetRegistry empties all`
  - `loader: loadModules(['ok','bad','ok2'], fakeImport)` where `'bad'` rejects → `loaded` deep-equals `['ok','ok2']` and `failed[0].path === 'bad'`
- [ ] **Step 2:** Run `node --test`. Expect it to FAIL (the modules are missing).
- [ ] **Step 3:** Implement the three modules and `package.json` as in Interfaces.
- [ ] **Step 4:** Run `node --test`. Expect PASS.
- [ ] **Step 5:** Commit: `feat: add registry, event bus and guarded loader`

### Task 2: Map and path

**Files:**
- Create: `src/engine/map.js`
- Test: `tests/map.test.js`

**Interfaces:**
- Produces: `CELL = 40`, `COLS = 16`, `ROWS = 8`, `WIDTH = 640`, `HEIGHT = 320`, `WAYPOINTS`, `PATH_WIDTH = 36`, `PROD = {x:576,y:106,w:56,h:68}`, `PATH_LENGTH`, `pointAt(distance) -> {x, y}` (clamped to the ends), `isBuildable(col, row) -> boolean` (false if off-grid, if a 36 px-wide path stroke overlaps the cell centre by less than 20 + 18 px, or if the cell overlaps PROD), `cellCenter(col,row) -> {x,y}`, `cellAt(x,y) -> {col,row}`.

- [ ] **Step 1: Write the failing tests:** `PATH_LENGTH === 180+200+240+120+156`; `pointAt(0)` = `{0,60}`; `pointAt(190)` = `{180,70}`; `pointAt(1e9)` = `{576,140}`; `isBuildable(0,1) === false` (on the path); `isBuildable(3,3) === true`; `isBuildable(15,3) === false` (PROD); `isBuildable(-1,0) === false`.
- [ ] **Step 2:** `node --test tests/map.test.js`. Expect FAIL.
- [ ] **Step 3:** Implement. `isBuildable` uses the distance from the cell centre to the nearest path segment `< PATH_WIDTH/2 + CELL/2 - 2`.
- [ ] **Step 4:** Run. Expect PASS.
- [ ] **Step 5:** Commit: `feat: add map grid and path geometry`

### Task 3: Game state, spawning, bug movement, wave flow

**Files:**
- Create: `src/engine/game.js`
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: registry getters, `emit`, `pointAt`, `PATH_LENGTH`.
- Produces:
  - `createGame() -> game` with `{ phase: 'menu'|'building'|'wave'|'bell'|'won'|'lost', wave: 0 /*index of the current or next wave*/, warrants: 100, lives: 20, bugs: [], devs: [], effects: [], mods: { xpMultiplier:1, warrantMultiplier:1, fireRateMultiplier:1, damageMultiplier:1, bugSpeedMultiplier:1, rangeMultiplier:1 }, powerups: {}, stats: { squashed:0, warrantsEarned:0, seniors:0, backfires:0 }, time: 0, nextId: 1 }`
  - `startGame(game)` sets phase to `building` and emits `game:start`.
  - `startWave(game)`: only from `building` or `bell`. Builds a spawn queue from `getWaves()[game.wave]`, sets phase to `wave` and emits `wave:start {wave}`. `ringBell(game)` emits `bell:rung` and then calls `startWave`.
  - `spawnBug(game, bugId, distance = 0, hp?) -> bug`. A bug is `{ id, type, hp, maxHp, distance, x, y, slow:1 }`. Emits `bug:spawned`.
  - `killBug(game, bug, killerDev?)`: removes the bug, adds `round(reward × mods.warrantMultiplier)` Warrants, increases stats and emits `bug:killed {bug, dev}`. XP is handled in Task 4 through `grantXp` (imported).
  - `step(game, dt)`: advances `time`, the spawn queue, bug movement (`speed × mods.bugSpeedMultiplier × dt`), leaks (lose `livesLost`, emit `bug:leaked`), power-up timers (Task 6 hook: `tickPowerups(game, dt)`), devs (Task 4 hook: `tickDevs(game, dt)`), feature `update`s, and the end conditions, in this order: **lives ≤ 0 → `lost` (emit `game:lost`) takes priority**. Otherwise, if the queue is empty and no bugs are left: if it was the last wave, go to `won` (emit `game:won`). Otherwise add the bonus `20 + 5 × (wave+1)`, emit `wave:cleared`, increment `wave` and set phase to `bell`.
  - Task 3 stubs `tickDevs` and `tickPowerups` as no-ops imported from `devs.js` and `powerups.js`. Create those files with empty exported functions.

- [ ] **Step 1: Write the failing tests** (register two test waves and a test bug in `beforeEach` after `resetRegistry()`):
  - `startWave spawns the configured count over time` (step 10 s and count spawned)
  - `bug that reaches the end leaks and costs livesLost`
  - `clearing a wave pays 20+5*n, moves to bell, increments wave`
  - `clearing the last wave → won and emits game:won`
  - `Review Focus 3: last life lost on last bug of final wave → lost, not won; no bell`
  - `bugSpeedMultiplier 0.5 halves distance travelled`
- [ ] **Step 2:** `node --test tests/game.test.js`. Expect FAIL.
- [ ] **Step 3:** Implement `game.js` and the stub `devs.js` and `powerups.js`.
- [ ] **Step 4:** Run. Expect PASS.
- [ ] **Step 5:** Commit: `feat: add game state, spawner and wave flow`

### Task 4: Developers — placing, selling, targeting, combat, levelling

**Files:**
- Modify: `src/engine/devs.js`
- Test: `tests/devs.test.js`

**Interfaces:**
- Consumes: `game`, `getDeveloper`, `getBug`, `isBuildable`, `cellCenter`, `killBug`, `emit`.
- Produces:
  - `LEVELS = [{name:'Junior Consultant', badge:'J', xp:0}, {name:'Consultant', badge:'C', xp:10}, {name:'Senior Consultant', badge:'S', xp:30}]`. Each level above Junior gives ×1.25 damage and ×1.15 fire rate, stacking multiplicatively.
  - `placeDev(game, typeId, col, row) -> dev | null`. A dev is `{ id, type, col, row, x, y, level:0, xp:0, cooldown:0, spent }`. Returns null if the cell isn't buildable, is occupied, or Warrants are less than the cost. Emits `dev:placed`.
  - `sellDev(game, dev) -> refund`: `floor(spent × 0.5)`. Removes the dev and emits `dev:sold`.
  - `devStats(game, dev) -> { damage, fireRate, range /*px*/ }`, including level and `mods`.
  - `grantXp(game, dev, amount)`: adds `amount × mods.xpMultiplier` and levels up past thresholds (can skip levels). Emits `dev:levelup {dev, level}` and increases `stats.seniors` on reaching level 2.
  - `tickDevs(game, dt)`: each dev's cooldown counts down. When it reaches ≤ 0, target the bug **furthest along** (`max distance`) within range. Hit for `damage × (bug.type === def.counters ? 2 : 1)`, push an effect `{kind:'beam', from, to, color, ttl:0.12}` and, on a counter hit, `{kind:'pop', x, y, text:'×2', ttl:0.6}`. Call the bug's `onHit`. If hp ≤ 0, call `killBug(game, bug, dev)` and `grantXp(game, dev, 1)`. Then reset the cooldown to `1/fireRate`.
- Also add to `game.js`: `step` decrements effect `ttl` values and removes expired effects.

- [ ] **Step 1: Write the failing tests:**
  - `Review Focus 2: placeDev refuses path, PROD, occupied, off-grid, unaffordable; warrants unchanged each time`
  - `placeDev deducts cost; sellDev refunds floor(50%)`
  - `targets furthest-along bug in range, ignores out-of-range`
  - `counter hit deals double damage`
  - `kill grants reward and 1 xp; 10 xp → Consultant emits dev:levelup; 30 → Senior increments stats.seniors`
  - `xpMultiplier 2 doubles xp; fireRateMultiplier 1.5 shortens cooldown`
- [ ] **Step 2:** Run. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test`. Expect all PASS.
- [ ] **Step 5:** Commit: `feat: add developers, combat and levelling`

### Task 5: Content — developers, bugs, waves

**Files:**
- Create: `src/content/developers/react.js`, `java.js`, `dotnet.js`; `src/content/bugs/typo.js`, `nullpointer.js`, `legacy.js`; `src/content/waves.js`; `src/content/manifest.js`
- Test: `tests/content.test.js`

**Interfaces:**
- Produces: `manifest.js` exports `CONTENT = [...relative module paths...]`. **This is the single line teammates add to.** The values are:

| id | cost | damage | fireRate | range | counters | accent |
|---|---|---|---|---|---|---|
| react | 50 | 6 | 4 | 2.2 | typo | #2563EB |
| java | 75 | 18 | 1.5 | 2.2 | nullpointer | #EA580C |
| dotnet | 110 | 55 | 0.6 | 2.6 | legacy | #C026D3 |

| id | name | radius | hp | speed | livesLost | reward | ring |
|---|---|---|---|---|---|---|---|
| typo | Typo bug | 5 | 10 | 70 | 1 | 1 | #2563EB |
| nullpointer | Null pointer | 9 | 45 | 45 | 1 | 3 | #EA580C |
| legacy | Legacy bug | 14 | 200 | 25 | 3 | 8 | #C026D3 |

- `drawIcon(ctx, size)` draws the white glyph from the mockups (`docs/mockups/game-states.html`, defs `dReact`/`dJava`/`dNet`): atom, cup with steam, `.NET` text. Waves: wave 1 is 12 typo bugs. Null pointers arrive in wave 2. Legacy bugs arrive in wave 4. Counts rise to wave 10, roughly 60 typo + 25 null pointer + 8 legacy, at intervals of 0.25–1.5 s.

- [ ] **Step 1: Write the failing test:** importing every path in `CONTENT` registers 3 developers, 3 bugs and 10 waves; each developer's `counters` names a registered bug; every wave group's `bug` is registered; wave 1 contains only `typo`.
- [ ] **Step 2:** Run. Expect FAIL.
- [ ] **Step 3:** Write the content files.
- [ ] **Step 4:** Run. Expect PASS.
- [ ] **Step 5:** Commit: `feat: add developer, bug and wave content`

### Task 6: Power-ups — Thomas, Jeroen, Bart, Claude

**Files:**
- Modify: `src/engine/powerups.js`
- Create: `src/content/powerups/thomas.js`, `jeroen.js`, `bart.js`, `claude.js` (and add them to the manifest)
- Test: `tests/powerups.test.js`

**Interfaces:**
- Produces in `powerups.js`: `powerupState(game, id) -> { active:boolean, remaining, cooldownLeft, uses }`, `canUse(game, id) -> boolean` (phase must be `wave`, not active, cooldown 0, `canActivate?` true, and Warrants ≥ `getCost?`), `usePowerup(game, id) -> boolean` (deducts the cost, calls `activate`, starts the duration and emits `powerup:activated`), and `tickPowerups(game, dt)` (counts down the active time and then calls `deactivate`; counts down the cooldown in every phase).
- Thomas: `xpMultiplier` ×2, 15 s, cooldown 45 s. Jeroen: `warrantMultiplier` ×2, 15 s / 45 s. Bart: `fireRateMultiplier` ×1.5, 10 s / 40 s. Each multiplies on activate and divides on deactivate, so they stack with features.
- Claude: duration 0, cooldown 0. `getCost(game) = round(150 × 1.5^uses)`. `canActivate(game) = game.bugs.length > 0`. On activate: `uses++`. If `game.random() < 0.25`, it backfires: every current bug is cloned with the same type, distance and hp, `stats.backfires++`, and `claude:backfire` is emitted. Otherwise every bug is killed with `killBug(game, bug, null)`. Push an effect `{kind:'banner', title, text, ttl:2.5}`, with the backfire copy `Claude · backfire` / `Hallucinated a fix — bug count doubled` and the success copy `Claude · success` / `Every bug squashed`.
- `createGame` gets `random: Math.random` so tests can inject a fixed random value.

- [ ] **Step 1: Write the failing tests:**
  - `Thomas doubles xpMultiplier for 15s then restores; cannot reuse until 45s cooldown done`
  - `cooldown keeps ticking in bell phase`
  - `power-ups refused outside wave phase`
  - `Claude success kills all bugs, pays rewards, price 150 → 225 → 338`
  - `Review Focus 1: Claude with 0 bugs or insufficient warrants → refused, no charge, uses unchanged`
  - `Review Focus 5: Claude backfire (random=0.1) doubles bug count, clones keep distance & hp, still charged; wave not cleared until clones die`
- [ ] **Step 2:** Run. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `node --test`. Expect all PASS.
- [ ] **Step 5:** Commit: `feat: add Thomas, Jeroen, Bart and Claude power-ups`

### Task 7: Browser layer — render, UI, input, sound, boot

**Files:**
- Create: `src/engine/render.js`, `src/engine/ui.js`, `src/engine/input.js`, `src/engine/sound.js`, `src/main.js`, `style.css`, `assets/sounds/` (generated with WebAudio, see below)
- Modify: `index.html` (replace the placeholder)

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `main.js`: imports `CONTENT` and runs `loadModules`, logging failures. Then `createGame()`, calls the feature `init`s, and runs a `requestAnimationFrame` loop with `step(game, min(dt, 0.05))` followed by `render(ctx, game, ui)` and `updateUI(game)`.
  - `render(ctx, game, view)`: map grid, path, PROD with lives shown as green bars, devs as 36 px rounded accent tiles with `drawIcon` and a J/C/S badge at the top-right corner (+19,−19), the range circle and XP bar for the selected dev, a hover preview showing whether the cell is buildable (accent ghost or slate X), bugs (light `#E2E8F0` body with a `ring` stroke and legs on the larger ones, plus an hp bar when damaged), effects (beam, pop, banner, and a white flash on Claude success), then feature `draw`s. The canvas is scaled to fit the container with `devicePixelRatio` handled.
  - `ui.js`: builds the DOM HUD (wordmark, Warrants, production bar, `Wave n / 10`, wave button), the hire bar (one button per `getDevelopers()` with name and cost; disabled when unaffordable), the power-up bar (one card per `getPowerups()` in its ready, active or cooldown state with a progress bar; Claude shows its cost), feature `hudButtons`, the selected-dev panel (type, level name, XP, sell button), and overlays for the start, bell, won and lost screens with the copy from spec §4. The bell is an inline SVG copied from the mockup's state 02 and swings on click with a CSS animation before `ringBell`.
  - `input.js`: when a developer is selected in the hire bar, clicking a cell places it. Clicking a dev selects it. Esc or right-click cancels.
  - `sound.js`: `playSound(name)` for `bell | hit | levelup | claude | backfire | lost | won`, synthesised with WebAudio oscillators (no files needed). It's a silent no-op if audio is unavailable. Hooked up through `on(...)` events in `main.js`.

- [ ] **Step 1:** Implement the files.
- [ ] **Step 2:** Run `node --test`. Expect all PASS (the engine is untouched).
- [ ] **Step 3:** Serve with `python -m http.server 8000`, then take a headless Edge screenshot of `http://localhost:8000/` (`msedge --headless=new --screenshot=... --window-size=1400,900`). Expect the start screen with the wordmark and no blank canvas.
- [ ] **Step 4:** Add a temporary `?demo=1` query flag in `main.js` that starts the game, places one of each dev and starts wave 1 (this stays as a handy test hook). Screenshot after `--virtual-time-budget=8000`. Expect the devs drawn, bugs on the path and the HUD numbers updated. Check the browser console for errors with `--enable-logging=stderr --v=0`. Expect no uncaught errors.
- [ ] **Step 5:** Commit: `feat: add canvas rendering, HUD, screens, input and sound`

### Task 8: Extension example, docs and deploy

**Files:**
- Create: `src/content/features/example-feature.js` (commented and **not** in the manifest), `CONTRIBUTING.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: the full contract.

- [ ] **Step 1:** Write `example-feature.js`: on `wave:cleared` it shows a `{kind:'banner'}` effect. Its comments show how to add a power-up, a developer, a bug and a feature, using the "one file plus one manifest line" rule.
- [ ] **Step 2:** Write `CONTRIBUTING.md`. Keep it to one page: how to run locally and run the tests, the four registration shapes, the event list, the `game.mods` keys, the push-to-main rule (play one wave first), the 15:30 freeze, and to log breakages in `REGRET.md`.
- [ ] **Step 3:** Run `node --test`. Expect all PASS. Play-check locally once.
- [ ] **Step 4:** Commit and `git push`. Wait for the Pages run (`gh run watch`), then `curl` the live URL and expect 200. Take a headless screenshot of the live URL with `?demo=1`. Expect the game running.
