# Sprint Retrospective Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a run ends, by loss or by quitting, show a card of fun awards about that run. "Continue" reveals the game-over screen or the main menu.

**Architecture:**
- **One feature file:** `src/content/features/retrospective.js`.
- **Tallying:** it tallies the run from bus events into `game.retro`.
- **Awards:** `retroAwards(game)` turns the tally into award lines. It's a pure function, tested in Node.
- **The card:** a DOM card on top of `#stage`. For a lost run, `draw` shows it once the collapse is done. For a quit run, the engine has already gone to the menu, so `init` shows it for the previous game.
- **Phishing:** `mailbox.js` gets one new `mail:phished` event.

**Tech Stack:** Vanilla ES modules, `node:test`, DOM. Headless Edge (`puppeteer-core`, scratch only) for browser checks.

**Spec:** `docs/superpowers/specs/2026-11-25-sprint-retrospective-design.md`

## Global Constraints

- **No engine changes.** Nothing under `src/engine/` changes. The touched files are the new feature, one manifest line, `mailbox.js` (the event), tests and README.
- **Bus listeners** are added with `on(...)` at the top level of the file, never in `init`.
- **Showing the card:** it shows exactly once per ended run, for a loss and for a quit. The flag is `game.retro.shown`.
- **MVP** counts only developers still in `game.devs` at the end, by `dev.kills`. Ties go to the lowest `dev.id`. It's skipped when there are no developers or no kills.
- **Empty awards are skipped.** "Survived" always shows.
- **Copy** (from the spec):
  - MVP developer: `${typeName} developer (${levelName(dev)}) · ${n} bugs squashed`
  - Works on my machine: `${bugName} got through ${n} times`
  - Fell for it: `${n} phishing mail${n === 1 ? '' : 's'}. IT has been notified.`
  - Caffeine intake: `${n} ${drinkName}` parts joined with ` · `, only amounts above 0
  - Asked Claude: `${n} time${s}` plus ` · backfired ${m} time${s}` when `m > 0`
  - Survived: `Year ${y} · Q${q} · Sprint ${s} · ${squashed} bugs squashed`
- **Award titles, in this order:** `MVP developer`, `Works on my machine`, `Fell for it`, `Caffeine intake`, `Asked Claude`, `Survived`.
- **Style:** Nexios palette, Lato, sentence case, no emoji, no exclamation marks.
- **Run tests in bash:** `export PATH="/c/Program Files/nodejs:$PATH"; node --test`.

## Review Focus

1. **Retry from the game-over screen.** The ended game's card must not show again, and the new run starts with a fresh tally. Pinned in Task 1 (`init` reset) and Task 2 (browser check).
2. **Quit during the quarter review or the bell.** `quitRun` works in those phases. The card must still appear over the menu after the collapse. Pinned in Task 2's browser check (quit from the bell).
3. **Ties and zero values** (two developers with equal kills, no leaks recorded, drinks all 0). They give stable, sensible lines, or the award is skipped. Pinned in Task 1.
4. **A developer type or bug type missing from the registry** (unregistered content). It falls back to the raw id, with no crash. Pinned in Task 1.
5. **Keyboard.** Focus is on Continue when the card opens. Pressing Space must continue, and must not trigger the game's Space action underneath (ringing the bell or starting a sprint). Pinned in Task 2's browser check.

---

### Task 1: Tally and awards (logic)

**Files:**
- Create: `src/content/features/retrospective.js`
- Modify: `src/content/manifest.js`. Add `'./features/retrospective.js',` after `'./features/mailbox.js'`.
- Modify: `src/content/features/mailbox.js`. In `claimMail`, when `mail.phishing`, call `const kind = applyPenalty(game, mail)`, then `emit('mail:phished', { game, mail, kind })`, then `return kind`.
- Test: `tests/retrospective.test.js`

**Interfaces:**
- **Produces:**
  - `createRetro(): { leaks: {}, phished: 0, drinks: {}, claudeUses: 0, claudeBackfires: 0, info: null, shown: false }`.
    - `leaks` is keyed by bug type: the count, plus the order of first leak.
    - `drinks` is keyed by drink id: the amount.
  - `attachListeners()`, exported and called once at the top level. It covers:
    - `bug:leaked`: increments `leaks[bug.type]`, recording first-leak order for ties.
    - `mail:phished`: `phished++`.
    - `drop:collected`: `drinks[drop.drink] += drop.amount`.
    - `powerup:activated` with `id === 'claude'`: `claudeUses++`.
    - `claude:backfire`: `claudeBackfires++`.
    - `game:lost`: `info = data.info`.

    Each handler ignores games without `game.retro`.
  - `retroAwards(game): Array<{ title: string, text: string }>`, in the title order from Global Constraints, with empty awards skipped.
    - Names come from `getDeveloper(type)?.name ?? type`, `getBug(type)?.name ?? type`, `getDrink(id)?.name ?? id` and `levelName(dev)` from `src/engine/devs.js`.
    - Survived uses `game.retro.info ?? sprintInfo(game.sprint)` and `game.stats.squashed`.
  - The feature `{ id: 'retrospective', init(game) }`. In this task, `init` only sets `game.retro = createRetro()`.
- **Check first:** if `getDrink` doesn't exist in `registry.js`, use `getDrinks().find(d => d.id === id)`.

- [ ] **Step 1: Write the failing tests** in `tests/retrospective.test.js`. Mirror `tests/mailbox.test.js`'s setup: `beforeEach` runs `resetRegistry`, `clearAll`, `attachListeners()`, then registers two developers (`react` "React", `java` "Java"), two bugs (`typo` "Typo bug", `leak` "Memory leak") and two drinks (`coffee` "Coffee", `redbull` "Red Bull"), then `createGame()`, `startGame()` and `feature.init(g)`.
  - `tallies leaks, phishing, drinks and Claude from events`: emit each event and check the `game.retro` fields.
  - `MVP is the developer on the board with most kills`: `g.devs = [{id:1,type:'react',kills:5},{id:2,type:'java',kills:9}]`, and the MVP text matches `/^Java developer \(.+\) · 9 bugs squashed$/`.
  - `MVP ignores sold developers`: after a `dev:sold`, only `g.devs` counts, because the tally doesn't track kills.
  - `MVP tie goes to the lowest id`
  - `MVP is skipped with no developers or no kills`
  - `Works on my machine picks the most leaked bug, tie to the first leaked`: the text is `Memory leak got through 3 times`.
  - `Fell for it pluralises`: the texts are `1 phishing mail. IT has been notified.` and `2 phishing mails. IT has been notified.`
  - `Caffeine intake lists drinks above 0 in registry order`: the text is `12 Coffee · 3 Red Bull`.
  - `Asked Claude with and without backfires`: the texts are `3 times` and `3 times · backfired 1 time`.
  - `Survived always shows`: with an empty tally, `retroAwards` returns exactly one award, titled `Survived`. Its text matches `/^Year 1 · Q1 · Sprint 1 · 0 bugs squashed$/`.
  - `unknown developer and bug types fall back to their id` (Review Focus 4)
  - `init resets the tally` (Review Focus 1)
  - `mailbox emits mail:phished on a phishing claim`: use mailbox's exported `makeOffer`/`acceptOffer`, set `phishing = true` and `progress = target`, set the phase to `'wave'`, then `claimMail`. It emits once with `kind` set to the returned value. Import the mailbox module and call its `attachListeners`/`init` as the mailbox tests do.
- [ ] **Step 2: Run `node --test tests/retrospective.test.js`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the interfaces, the manifest line and the mailbox event.
- [ ] **Step 4: Run `node --test`.** Expected: all pass, including `tests/content.test.js` and the mailbox tests.
- [ ] **Step 5: Commit:** `git add src/content/features/retrospective.js src/content/manifest.js src/content/features/mailbox.js tests/retrospective.test.js` and `git commit -m "feat: retrospective tally and awards"`.

### Task 2: The card, its timing, and README

**Files:**
- Modify: `src/content/features/retrospective.js` (DOM only, guarded by `typeof document !== 'undefined'`)
- Modify: `README.md`. Add one bullet after "Lose:": "**Sprint retrospective:** when a run ends, by losing or quitting, a card shows some fun stats about it: your MVP developer, the bug that got through most, phishing mails you fell for, drinks, Claude and how far you got."
- Test: a browser check in the scratch folder (`retro.mjs`)

**Interfaces:**
- **Consumes:** `retroAwards`, `game.retro` (Task 1), and `deathAnimDone(game)` from `src/engine/game.js`.
- **Produces:** the DOM element `div.rt-card` inside `#stage`, with a title, eyebrow, award list (`.rt-award` rows with `b` title and `span` text) and `button.rt-continue`.

**Behaviour:**
- **Remembering the run:** a module-level `ended = null` holds the last game whose card is pending.
- **`draw(ctx, game)` (every frame):** if `game.phase === 'lost' && !game.quit && deathAnimDone(game) && !game.retro.shown`, then show the card for `game` and set `shown = true`.
- **`init(game)`:**
  - First, if the module-level `previous` game exists, has `phase === 'lost'`, has `quit === true` and hasn't been shown, show the card for `previous` (over the menu) and set its `shown = true`.
  - Then set `previous = game` and `game.retro = createRetro()`.
  - Don't remove a card that's showing in `init`. `toMenu` calls `init` right after a quit, and the card has to survive that.
- **Showing the card:** it builds the card, appends it to `#stage` with `z-index` above `#overlay` and `line-height: 1.4`, and focuses `.rt-continue`.
- **Continue:** a click, or Enter/Space on the focused button, removes the card. Handle `keydown` on the card with `ev.stopPropagation()` so the game's Space/Enter handler (`src/engine/input.js`) doesn't also fire.
- **Styles:** injected once as `<style id="rt-style">`, in the look of `.screen-card`: navy panel, eyebrow "Sprint retrospective", h2 with `Year y · Qq · Sprint s`, a two-column award grid (title left in slate, text right), and Continue as `.btn.primary`. On phones, the card is `max-height: 100%` with `overflow-y: auto`.

- [ ] **Step 1: Write the browser check** `retro.mjs`, at `http://127.0.0.1:8000/` with `?demo=1`, 1366×900:
  - **Lost run:** set `game.game.lives = 0` to force a loss, then:
    - no `.rt-card` before the collapse is done (check right away)
    - after `deathAnimDone`, the `.rt-card` is visible with a "Survived" row and at least 2 award rows
    - focus is on `.rt-continue`
    - pressing Space removes the card, and the game-over screen (`#overlay .screen.lost`) is there with its retry button
    - the phase is still `lost` and no sprint started (Review Focus 5)
  - **Retry:** click retry, then `.rt-card` is absent and `game.game.retro` is fresh (Review Focus 1).
  - **Quit from the bell:** in a new run, end a sprint by clearing `spawnQueue` and bugs, wait for `phase === 'bell'`, then quit through the UI's quit flow (the menu button's quit confirmation, or `quitRun` from `src/engine/game.js` imported through `window.game` if no UI route is reachable; note which in the ledger). After the collapse:
    - the main menu is visible and the `.rt-card` is on top
    - Continue reveals the menu
  - no page errors
- [ ] **Step 2: Run it.** Expected: FAIL, no `.rt-card`.
- [ ] **Step 3: Implement** the DOM layer and the README line.
- [ ] **Step 4: Run the browser check and `node --test`.** Expected: both pass. Screenshot the card after a lost run and after a quit; it should match the spec's sketch.
- [ ] **Step 5: Commit:** `git add src/content/features/retrospective.js README.md` and `git commit -m "feat: sprint retrospective card after a run ends"`. Don't push.
