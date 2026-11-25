# Random Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sometimes a wave starts with an office mishap (PROD down, heating out, no coffee, no Red Bull, heat wave) that handicaps the player for that wave.

**Architecture:** New content type `registerEvent` (mirrors power-ups). A small engine module `src/engine/random-events.js` rolls one event in `startWave` and ends it in `checkEnd` (wave cleared or lost). Three engine hooks make the effects possible: `game.mods.timeScale`, `game.mods.devFireRate[typeId]`, and `view.cursor` passed to the active event's `draw`.

**Tech Stack:** Vanilla ES modules, canvas 2D, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-random-events-design.md`

## Global Constraints

- Content rule: each event is one file in `src/content/events/` plus one line in `src/content/manifest.js`.
- Chance: `EVENT_CHANCE = 0.25` per wave start, only from wave 2 (`game.wave >= 1`), using `game.random`. At most one event per wave.
- Mods convention: `start` multiplies, `end` divides.
- Every call into event content is wrapped in try/catch (`console.error('[event <id>]', e)`); a broken event must never break the game.
- Copy: sentence case, no emoji, no exclamation marks. Palette: navy `#001E32`, orange `#EA580C` (Java), fuchsia `#C026D3` (.NET), green `#16A34A`, slate greys. Font Lato.
- Don't name anything `events.js` in the engine: that's the event bus.
- Working tree has pre-existing modified files; only `git add` the files each task lists.

## Review Focus

1. Game lost mid-event, then restart: the new game must have all mods at 1 and no `activeEvent` (fresh `createGame`). Test in Task 2.
2. An event whose `start` throws: game keeps running, `activeEvent` stays null, and `end` is not called later. Test in Task 2.
3. Cursor leaves the canvas during PROD down: screen stays fully dark, no crash on `view.cursor === null`. Test in Task 3.
4. Last wave cleared (`game:won` path in `checkEnd`) during an event: the event must still end. Test in Task 2.
5. Float drift from multiply/divide: after start then end, mods must equal 1 (use exact factors 0.5 / 1.5 / 2 so this holds). Test in Task 3.

---

### Task 1: Engine hooks for time scale and per-developer fire rate

**Files:**
- Modify: `src/engine/game.js` (`createGame` mods, `step`)
- Modify: `src/engine/devs.js` (`devStats`)
- Test: `tests/game.test.js`, `tests/devs.test.js`

**Interfaces:**
- Produces: `game.mods.timeScale` (number, default 1); `game.mods.devFireRate` (object keyed by developer type id, default `{}`, missing key = 1).

- [ ] **Step 1: Write the failing tests**

In `tests/game.test.js`:
```js
test('timeScale 0.5 halves how far bugs move', () => {
  const g = createGame(); startGame(g); startWave(g);
  g.spawnQueue = []; g.bugs = [];
  const bug = spawnBug(g, 'b', 0);
  g.mods.timeScale = 0.5;
  step(g, 0.1);
  assert.equal(bug.distance, 5); // speed 100 * 0.1 * 0.5
});
```
In `tests/devs.test.js` (use that file's existing setup/registrations):
```js
test('devFireRate scales only the named developer type', () => {
  const g = createGame();
  g.mods.devFireRate = { java: 0.5 };
  // devStats(g, javaDev).fireRate === base java fireRate * 0.5
  // devStats(g, otherDev).fireRate === its base fireRate
});
```
- [ ] **Step 2: Run** `node --test` → the two new tests FAIL.
- [ ] **Step 3: Implement.** Add `timeScale: 1, devFireRate: {}` to `createGame().mods`. In `step`, after the menu/won/lost early return, set `dt *= game.mods.timeScale ?? 1` (menu effects stay unscaled). In `devStats`, multiply `fireRate` by `(game.mods.devFireRate?.[dev.type] ?? 1)`.
- [ ] **Step 4: Run** `node --test` → all PASS.
- [ ] **Step 5: Commit** `git add src/engine/game.js src/engine/devs.js tests/game.test.js tests/devs.test.js` → `feat: add timeScale and per-developer fire rate mods`

---

### Task 2: Event registry and the random-events engine module

**Files:**
- Modify: `src/engine/registry.js`
- Create: `src/engine/random-events.js`
- Modify: `src/engine/game.js` (`createGame`, `startWave`, `checkEnd`)
- Test: `tests/random-events.test.js`

**Interfaces:**
- Consumes: `addEffect` from `game.js`, `emit` from `events.js`.
- Produces:
  - `registerEvent(def)`, `getEvents()`, `getEvent(id)` in `registry.js`; `resetRegistry` also clears events. Def shape: `{ id, name, description, accent?, weight? = 1, minWave? = 2, start(game), end(game), draw?(ctx, game, view) }`.
  - `EVENT_CHANCE = 0.25`, `rollEvent(game) -> def | null`, `endEvent(game) -> void` in `random-events.js`.
  - `game.activeEvent` (id string or `null`, default `null` in `createGame`).
  - Bus events `event:start` `{ game, event }` and `event:end` `{ game, event }`.

Behaviour of `rollEvent`: return null if `game.activeEvent` is set, if `game.wave < 1`, or if `game.random() >= EVENT_CHANCE`. Otherwise pick among events with `minWave <= game.wave + 1` by weight using a second `game.random()` draw. Call `start` (guarded; on throw return null and leave `activeEvent` null), set `activeEvent`, add a banner `addEffect(game, { kind: 'banner', title: def.name, text: def.description, accent: def.accent ?? '#EA580C', ttl: 3 })`, emit `event:start`. `endEvent`: no-op if none active; call `end` (guarded), set `activeEvent = null`, emit `event:end`.

Wiring: `startWave` calls `rollEvent(game)` right before `emit('wave:start', ...)`. `checkEnd` calls `endEvent(game)` at the top of each of the three exits (lost, won, cleared) before their emit.

- [ ] **Step 1: Write the failing tests** in `tests/random-events.test.js` (setup like `tests/game.test.js`: reset registry, `clearAll()`, one bug, two waves; register a test event `{ id: 'cold', name: 'Cold', description: 'x', start: g => g.mods.timeScale *= 0.5, end: g => g.mods.timeScale /= 0.5 }`; force rolls with `g.random = () => 0` / `() => 0.99`):
  - `no event on wave 1` → `g.wave = 0`, `random = () => 0`, `startWave` → `g.activeEvent === null`.
  - `event fires on wave 2 when the roll is under 0.25` → `g.wave = 1; g.phase = 'building'`, `random = () => 0` → `activeEvent === 'cold'`, `mods.timeScale === 0.5`, a `banner` effect titled `'Cold'` exists, `event:start` emitted once.
  - `no event when the roll is 0.25 or more` → `random = () => 0.25` → null.
  - `minWave is respected` → event with `minWave: 5` on wave 2 never fires.
  - `weight picks proportionally` → two events weights 1 and 3; second draw 0.3 picks the second (draw sequence `[0, 0.3]`).
  - `event ends when the wave is cleared` → after start, clear `spawnQueue`/`bugs`, `step` → `activeEvent === null`, `timeScale === 1`, `event:end` emitted.
  - `event ends when the game is lost` → set `g.lives = 0`, `step` → phase `'lost'`, `activeEvent === null`, `timeScale === 1`.
  - `event ends when the last wave is won` → on the final wave, clear and `step` → phase `'won'`, `activeEvent === null`.
  - `throwing start leaves no active event and end is never called` → silence `console.error`; `start` throws, `end` sets a flag → `activeEvent === null`, game phase `'wave'`, after clearing the wave the flag is still false.
  - `restart gives a clean game` → `createGame()` has `activeEvent === null`, `timeScale === 1`, `devFireRate` deep-equals `{}`.
- [ ] **Step 2: Run** `node --test` → new tests FAIL.
- [ ] **Step 3: Implement** the registry functions, `random-events.js`, and the `game.js` wiring above.
- [ ] **Step 4: Run** `node --test` → all PASS.
- [ ] **Step 5: Commit** `git add src/engine/registry.js src/engine/random-events.js src/engine/game.js tests/random-events.test.js` → `feat: add random events engine and registerEvent`

---

### Task 3: The five events, cursor tracking, rendering and HUD

**Files:**
- Create: `src/content/events/prod-down.js`, `heating-out.js`, `no-coffee.js`, `no-redbull.js`, `heat-wave.js`
- Modify: `src/content/manifest.js` (new `// Events` section), `src/main.js` (`CORE` list)
- Modify: `src/engine/input.js` (`view.cursor`), `src/main.js` (`view` gets `cursor: null`)
- Modify: `src/engine/render.js` (call active event's `draw` after bugs, before `drawEffects`)
- Modify: `src/engine/ui.js` (HUD stat `Incident`, shows active event name or `None`)
- Test: `tests/content.test.js`

**Interfaces:**
- Consumes: `registerEvent`, `getEvent` (Task 2), `game.mods.timeScale` / `devFireRate` (Task 1), `game.activeEvent`.
- Produces: `view.cursor` = `{ x, y }` in logical canvas pixels (640×320), or `null` off-canvas.

Events (exact names and effects):

| id | name | description | accent | start / end |
|---|---|---|---|---|
| `prod-down` | PROD is down | Find the bugs in the dark | `#94A3B8` | no mods; `draw` only |
| `heating-out` | The heating is out | Everyone moves at half speed | `#2563EB` | `timeScale` ×0.5 / ÷0.5 |
| `no-coffee` | Out of coffee | Java developers work at half speed | `#EA580C` | `devFireRate.java` ×0.5 / ÷0.5 (treat missing as 1) |
| `no-redbull` | Out of Red Bull | .NET developers work at half speed | `#C026D3` | `devFireRate.dotnet` ×0.5 / ÷0.5 |
| `heat-wave` | Heat wave | Bugs move 50% faster | `#EA580C` | `bugSpeedMultiplier` ×1.5 / ÷1.5 |

PROD-down `draw(ctx, game, view)`: fill the 640×320 canvas with `rgba(0, 8, 16, 0.96)`; if `view.cursor`, cut a soft hole with `globalCompositeOperation = 'destination-out'` and a radial gradient radius `2.5 * CELL` (import `CELL`, `WIDTH`, `HEIGHT` from `map.js`), opaque centre fading at the edge. Draw on an offscreen canvas if `destination-out` would erase the map underneath. Exact softness is the builder's call.

- [ ] **Step 1: Write the failing tests** in `tests/content.test.js`:
  - Extend the manifest test: `R.getEvents().map(e => e.id)` deep-equals `['prod-down', 'heating-out', 'no-coffee', 'no-redbull', 'heat-wave']`.
  - `each event's end exactly undoes its start` → for every event: `g = createGame(); e.start(g); e.end(g);` then `g.mods.timeScale === 1`, `g.mods.bugSpeedMultiplier === 1`, `(g.mods.devFireRate.java ?? 1) === 1`, `(g.mods.devFireRate.dotnet ?? 1) === 1`.
  - `prod-down draws with or without a cursor` → call `draw` with a stub ctx (every method a no-op, `createRadialGradient` returns `{ addColorStop() {} }`) and `view = { cursor: null }`, then `{ cursor: { x: 100, y: 100 } }`; neither throws. If you use an offscreen canvas, guard it so the stub path works in Node.
- [ ] **Step 2: Run** `node --test` → FAIL.
- [ ] **Step 3: Implement** the five files, add them to the manifest and `CORE`, then the cursor, render and HUD wiring.
- [ ] **Step 4: Run** `node --test` → all PASS. Run `node scripts/sim.mjs` → completes without errors.
- [ ] **Step 5: Manual check.** `python -m http.server 8000`, open `http://localhost:8000/?demo=1`. In the console, force each event: `game.game.random = () => 0` before ringing the bell for wave 2, or call the event directly. Confirm: banner shows; HUD `Incident` shows the name; PROD down shows the flashlight following the cursor and goes fully dark off-canvas; heating out visibly slows everything; all clear when the wave ends.
- [ ] **Step 6: Commit** `git add src/content/events src/content/manifest.js src/main.js src/engine/input.js src/engine/render.js src/engine/ui.js tests/content.test.js` → `feat: add PROD down, heating, coffee, Red Bull and heat wave events`

---

### Task 4: Contributor docs

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1:** Add a `registerEvent` row to the register table with the def shape from Task 2. Add `event:start` and `event:end` to the events list. Add `timeScale` and `devFireRate` (an object keyed by developer id) to the mods list. Add a 3-line `registerEvent` example to `src/content/features/example-feature.js` in its commented "Other things you can register" block.
- [ ] **Step 2:** Run `node --test` → PASS.
- [ ] **Step 3: Commit** `git add CONTRIBUTING.md src/content/features/example-feature.js` → `docs: document random events`
