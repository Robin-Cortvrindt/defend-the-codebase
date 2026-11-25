# Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A permanent panel on the right of the board with three sections: Building, Developers and Tasks. Mail becomes a 6-second offer that you accept by clicking it.

**Architecture:**
- **Layout:** `index.html` and `style.css` put `#stage` and `<aside id="side-panel">` side by side in a new `#play` grid.
- **Building and Developers:** a new feature, `src/content/features/side-panel.js`, renders those two sections.
- **Tasks:** `src/content/features/mailbox.js` is reworked. Offers replace direct delivery, the inbox UI is removed, and it renders the Tasks section.
- **Testing:** all logic is plain functions tested in Node. The DOM code is guarded and checked in headless Edge.

**Tech Stack:** Vanilla ES modules, `node:test`, DOM and CSS. Headless Edge through `puppeteer-core` for browser checks; it's a scratch tool, not a project dependency.

**Spec:** `docs/superpowers/specs/2026-11-25-side-panel-design.md`. Mockup: `docs/mockups/side-panel.html`.

## Global Constraints

- **No engine changes.** Nothing under `src/engine/` changes. The shared files touched are `index.html` and `style.css` (decided), plus content files, tests and docs.
- **Bus listeners.** `on(...)` is called at the top level of each file, never in `init`.
- **Unchanged constants:**
  - `MAX_MAILS = 4`
  - `FIRST_MAIL_DELAY = 5`
  - `MAIL_INTERVAL = 30`
  - `PHISH_CHANCE = 1/6`
  - `CLAUDE_REWARD_CHANCE = 1/8`
  - `CLAUDE_STEAL = 100`
  - `LOCK_SECONDS = 10`

  Templates, rewards and penalties are unchanged too, including their safety caps.
- **New constant:** `OFFER_SECONDS = 6`, counted in **real** seconds and frozen while paused.
- **Phases:**
  - The offer timer runs in `building`, `wave` and `bell`.
  - Claim works in `building`, `wave`, `bell` and `review`.
  - Claim is disabled in `menu`, `lost` and while paused.
- **Phishing:** it looks identical to a real offer and task, and only reveals itself on Claim.
- **Layout values:**
  - `#app max-width: 1380px`
  - panel width `280px`
  - the panel's height equals the board's
  - Tasks has a minimum height of `160px`
  - the task list scrolls, while the Tasks header and the offer card stay pinned
  - at `max-width: 720px` the panel stacks below the board, and Building shows a one-line upgrade summary
- **Style:** Nexios palette, Lato, sentence case, no emoji, no exclamation marks.
- **Run tests in bash with:** `export PATH="/c/Program Files/nodejs:$PATH"; node --test`.

## Review Focus

1. **Restart while an offer is showing.** The offer is gone after `init`, and no ghost card stays in the panel. Pinned in Task 1.
2. **10× game speed.** An offer still lasts 6 real seconds: `tickMailbox` with a huge `dt` must not expire it. Pinned in Task 1.
3. **Offer pending when the quarter review opens.** It's dropped as missed and emits `mail:missed`. Pinned in Task 1.
4. **Claim on the game-over or start screen.** `claimMail` returns `null` and changes nothing. Pinned in Task 1.
5. **A section is missing from the page** (old cached `index.html`, or a teammate removed it). Neither feature throws, and the game runs. Pinned in Task 3 and Task 4 with a browser check that removes `#side-panel` before load.

---

### Task 1: Offer flow (logic only)

**Files:**
- Modify: `src/content/features/mailbox.js`
- Test: `tests/mailbox.test.js`

**Interfaces:**
- **Produces:**
  - `createMailbox()` returns `{ mails: [], offer: null, timer: FIRST_MAIL_DELAY, nextId: 1, vouchers: 0, locks: [], pendingMalware: 0, flash: 0 }`. The `open` field is removed.
  - `Offer = { mail: Mail, remaining: number }`. `Mail` keeps its shape minus `unread`.
  - `makeOffer(game): Mail | null` replaces `deliverMail`.
    - It returns `null` when an offer is already pending or `mails.length >= MAX_MAILS`.
    - The pool excludes templates of accepted tasks **and** of the pending offer.
    - It sets `box.offer = { mail, remaining: OFFER_SECONDS }` and emits `'mail:offered'` `{ game, mail }`.
    - The roll order stays: template, phishing, reward kind.
  - `tickMailbox(game, dt)`:
    - If an offer is pending and the phase isn't in `building`, `wave` or `bell`, it calls `missOffer(game)` first.
    - The timer only runs with no pending offer, fewer than 4 tasks, and an active phase. When it fires: `makeOffer`, then `timer = MAIL_INTERVAL`.
  - `tickOffer(game, realDt)`:
    - It counts `offer.remaining` down and calls `missOffer` at 0 or below.
    - It also misses the offer when the phase isn't active.
    - This is the only thing that expires offers in normal play.
  - `acceptOffer(game): Mail | null`. It moves the offer's mail to the **front** of `mails`, sets `offer = null` and emits `'mail:accepted'` `{ game, mail }`. It returns `null` if there's no offer.
  - `missOffer(game): void`. It sets `offer = null` and emits `'mail:missed'` `{ game, mail }`. The timer is already counting `MAIL_INTERVAL` from when the offer was made.
  - `canClaim(game): boolean` is true only in `building`, `wave`, `bell` and `review`.
  - `claimMail(game, id)` returns `null` when `!canClaim(game)`. Otherwise it's unchanged.
- **Removed:**
  - `deliverMail`
  - the `'mail:received'` event
  - the `open` and `unread` fields
  - the `hudButtons` entry
  - the `sprint:cleared` listener that closed the inbox
  - `openInbox`, the toast, the card badge and all inbox DOM code (Task 4 adds the new DOM)

  To keep the game loadable between Task 1 and Task 4, `draw` only calls `drawPenalties` in this task. The browser shows no mail UI until Task 4.

- [ ] **Step 1: Update the tests** in `tests/mailbox.test.js`:
  - **Rewrite the helper.** `give(id, opts)` now calls `makeOffer`, then `acceptOffer`.
  - **Delete** these tests, which describe removed behaviour:
    - `a new mail is unread…` (replace it with `an accepted task starts at 0 and has a Warrants reward`)
    - `deliverMail emits mail:received`
    - the two inbox/bell tests at the end of the file
  - **Edit:** the `init resets state` test sets `g.mailbox.offer = { mail: {}, remaining: 3 }` instead of `open = true`.
  - **Add:**
    - `the timer makes an offer, not a task`: tick 5 s, then `offer !== null` and `mails.length === 0`.
    - `accepting an offer adds the task at the front with progress 0`, and emits `mail:accepted`.
    - `an offer expires after 6 real seconds and adds nothing`: `tickOffer(g, 5.9)` leaves it pending; `tickOffer(g, 0.2)` gives `offer === null`, `mails.length === 0` and `mail:missed` emitted.
    - `game time does not expire an offer` (Review Focus 2): `tickMailbox(g, 1000)` leaves the offer pending.
    - `no new offer while one is pending`: with an offer pending, `tickMailbox(g, 100)` keeps the same offer `mail.id`.
    - `no offers while 4 tasks are accepted`.
    - `the pending offer's template is not offered again` (`g.random = () => 0`).
    - `an offer pending when the review opens is missed` (Review Focus 3): set `g.phase = 'review'`, `tickMailbox(g, 0.016)`, then `offer === null` and `mail:missed` emitted. Repeat via `tickOffer` for `menu`.
    - `restart drops a pending offer` (Review Focus 1). This is covered by the deep-equal in `init resets state`.
    - `a phishing offer can be accepted and penalises only on Claim`: the accepted task has `phishing === true`, accepting changes no Warrants, and claiming returns a penalty kind.
    - `claim is refused on the start and game-over screens` (Review Focus 4): for `menu` and `lost`, `claimMail` returns `null`, and Warrants and the mail list are unchanged.
    - `claim works during the quarter review`: in `review`, a done real task returns `'reward'`.
  - Keep every progress, claim, penalty, voucher and lock test, adapted to `give`.
  - Import `makeOffer`, `acceptOffer`, `tickOffer`, `missOffer`, `canClaim` and `OFFER_SECONDS`, and assert `OFFER_SECONDS === 6`.

- [ ] **Step 2: Run `node --test tests/mailbox.test.js`.** Expected: FAIL. The new exports don't exist yet.

- [ ] **Step 3: Implement** the interfaces above in `mailbox.js` and delete the removed code. `feature.update` stays `tickMailbox` plus `tickPenalties`.

- [ ] **Step 4: Run `node --test`.** Expected: all pass. That includes `tests/content.test.js`, because the manifest still loads in Node.

- [ ] **Step 5: Commit**: `git commit -am "feat: mail arrives as an offer you accept"`. Stage the test file too.

### Task 2: Page layout with the panel shell

**Files:**
- Modify: `index.html` (wrap `#stage`), `style.css`
- Test: browser check (scratch script, outside the repo)

**Interfaces:**
- **Produces** this DOM, which Tasks 3 and 4 render into:

  ```html
  <div id="play">
    <div id="stage">…unchanged…</div>
    <aside id="side-panel" aria-label="Your run">
      <div class="sp-inner">
        <section id="panel-building" class="sp-sec"></section>
        <section id="panel-devs" class="sp-sec"></section>
        <section id="panel-tasks" class="sp-sec sp-tasks"></section>
      </div>
    </aside>
  </div>
  ```

- **Produces** these CSS classes for the sections to use: `.sp-sec`, `.sp-title` (section header), `.sp-tasks`. `.sp-tasks` is the flex child that takes the remaining height, with `min-height: 160px`.

**CSS:**
- **Grid:** `#play { display: grid; grid-template-columns: minmax(0, 1fr) 280px; }`.
- **Panel:** `#side-panel { position: relative; border-left: 1px solid var(--navy3); background: #001A2B; }`.
- **Inner wrapper:** `.sp-inner { position: absolute; inset: 0; display: flex; flex-direction: column; overflow-y: auto; }`. The absolute inner wrapper keeps the board in charge of the row height.
- **Width:** `#app { max-width: 1380px; }`.
- **Phones:** under the existing `@media (max-width: 720px)`:
  - `#play { grid-template-columns: 1fr; }`
  - `#side-panel { border-left: 0; border-top: 1px solid var(--navy3); }`
  - `.sp-inner { position: static; }`
- The section styling itself belongs to Tasks 3 and 4. Each feature injects its own `<style>`, like the mailbox does today, or the classes go here; the builder chooses.

- [ ] **Step 1: Write the browser check** in the scratch folder: `layout.mjs`, using puppeteer-core with Edge, served at `http://127.0.0.1:8000/`. Assertions:
  - at a 1366×900 viewport: `#side-panel` is to the right of `#stage` (`panel.left >= stage.right - 1`)
  - `stage.width >= 760`
  - `|panel.height - stage.height| <= 1`
  - the canvas width equals the stage width within 1 px
  - at 700×900: the panel's `top >= stage.bottom - 1`
  - no page errors
- [ ] **Step 2: Run it.** Expected: FAIL, because `#side-panel` doesn't exist.
- [ ] **Step 3: Change `index.html` and `style.css`** as above.
- [ ] **Step 4: Run the check, and `node --test`.** Expected: both pass. Take a screenshot at 1366 and look at it: the board and an empty panel sit side by side, and the HUD, power-ups and hire bar still span the full width.
- [ ] **Step 5: Commit**: `git commit -am "feat: page layout with a permanent side panel"`.

### Task 3: Building and Developers sections

**Files:**
- Create: `src/content/features/side-panel.js`
- Modify: `src/content/manifest.js`. Add `'./features/side-panel.js',` **before** `'./features/mailbox.js'`.
- Test: `tests/side-panel.test.js`, plus the browser check

**Interfaces:**
- **Produces** these pure helpers:
  - `buildingInfo(game): { floors, lives, maxLives, coins }`
  - `buildingRows(game): Array<{ id, name, description, level, maxLevel }>`. It covers every registered upgrade except `id === 'floor'`, in registry order. `level` comes from `upgradeLevel(game, id)`, and `maxLevel` from `def.maxLevel ?? 3`.
  - `upgradeSummary(game): { levels, max }`, the sums over `buildingRows`, for the phone line `"${levels} of ${max} levels"`.
  - `devCounts(game): Array<{ id, name, accent, count }>`. It covers every registered developer, in registry order, with `count` = the number of `game.devs` of that type.
- **Produces** a feature `{ id: 'side-panel', init, draw }`:
  - `draw` re-renders `#panel-building` and `#panel-devs` only when a key string built from the helpers changes.
  - If a section element is missing, it does nothing.

**Content:**
- **Building:** a `.sp-title` reading "Nexios building", then:
  - the Floors row
  - the Production row as `lives / maxLives` with a bar, orange at 40% or below
  - the Nexios Coins row, in coin yellow `#FACC15`
  - one row per upgrade: the name, `description` in small text, and `maxLevel` pips with `level` of them filled
  - a phone-only line `.sp-summary` with "N of M levels". CSS shows it only under 720 px and hides the upgrade rows there.
- **Developers:** a `.sp-title` reading "Developers", then one row per type: a 20 px icon (a small canvas with `drawDevTile` from `src/engine/render.js`, as in the hire bar), the name and the count in bold. Below that, a total line: "N developers", or "No developers hired yet" at 0.

- [ ] **Step 1: Write the failing tests** in `tests/side-panel.test.js`, using a fresh registry per test with `resetRegistry`, two upgrades (one with id `floor`) and two developers:
  - `buildingInfo reads floors, lives and coins`
  - `buildingRows skips the floor upgrade and reports levels`: set `game.upgrades.coffee = 2` and expect `level 2, maxLevel 3`.
  - `upgradeSummary adds up levels and maximums`
  - `devCounts counts developers per type in registry order, including zero`
- [ ] **Step 2: Run `node --test tests/side-panel.test.js`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the helpers and the feature, and add the manifest line.
- [ ] **Step 4: Run `node --test`.** Expected: all pass.
- [ ] **Step 5: Browser check.** Add to the scratch script, at `?demo=1`:
  - Developers shows React 1, Java 1 and .NET 1. Hiring one more React through `game.game` and the hire flow shows 2 within a frame.
  - Building shows 5 upgrade rows.
  - Removing `#side-panel` with `page.evaluateOnNewDocument`, which deletes it on `DOMContentLoaded`, still loads the game with no page errors (Review Focus 5).

  Expected: pass. Screenshot and compare with mockup state 1.
- [ ] **Step 6: Commit**: `git add` the feature, the test and the manifest, then `git commit -m "feat: building and developers in the side panel"`.

### Task 4: Tasks section with the offer card

**Files:**
- Modify: `src/content/features/mailbox.js` (the DOM layer only)
- Modify: `README.md`, the Inbox bullet
- Test: browser check

**Interfaces:**
- **Consumes:** `makeOffer`, `acceptOffer`, `tickOffer`, `canClaim`, `claimMail`, `isDone` and `game.mailbox` from Task 1, and the `#panel-tasks` and `.sp-title` classes from Task 2.
- **Produces:** DOM only. Everything is guarded by `HAS_DOM` and by `#panel-tasks` existing.

**What to build:**
- **Structure:** `#panel-tasks` contains:
  - a header `.sp-title`: "Tasks", with `x/4` on the right
  - a pinned offer slot `.mb-offer-slot`
  - a scrolling list `.mb-list`, with `flex: 1; min-height: 0; overflow-y: auto`

  The section is a flex column filling the rest of the panel.
- **Offer card:** a green-edged card with:
  - `New mail · ${from}`
  - the subject
  - the reward (`+N W` or `Free Claude`)
  - a "Click to accept" button
  - a 3 px bar whose width is `remaining / OFFER_SECONDS`

  Clicking anywhere on the card calls `acceptOffer`, plays `'mail'`, briefly highlights the new task and releases focus. The card slides in on `mail:offered` with the `'mail'` chime, and slides out on a miss.
- **Real-time countdown:**
  - A module variable `updatedSinceDraw` is set to true at the end of `feature.update`.
  - In `feature.draw`, with `now = performance.now()`: if `updatedSinceDraw` is true, call `tickOffer(game, Math.min(0.25, (now - lastDraw) / 1000))`. Then set `lastDraw = now` and `updatedSinceDraw = false`.
  - So while the game is paused, the countdown stops. The 0.25 cap keeps a backgrounded tab from expiring the offer in one jump.
- **Task list:** each task shows the sender, subject, reward, a progress bar and `progress/target`. A done task gets a Claim button.
  - The button is disabled when `!canClaim(game) || paused`, where `paused` is `!updatedSinceDraw` for the current frame (computed before resetting).
  - Empty state: "No tasks yet. Click new mail when it pops up to accept it."
  - Claim calls `claimMail`, plays `'mail'` for a reward or `'phished'` for a penalty, and releases focus.
  - The list re-renders only when a key string changes (ids, progress, claimable).
- **Restart:** `init` empties the section and resets `lastDraw` and `updatedSinceDraw`.
- **README:** change the Inbox bullet to describe the Tasks section and the 6-second offer, in house style.

- [ ] **Step 1: Write the browser check** in the scratch `check.mjs`, rewritten for the panel, at `?demo=1`:
  - an offer card appears in `#panel-tasks` within 7 s
  - its rect doesn't intersect `#stage`'s rect
  - clicking it adds a `.mb-task` and removes the card
  - forcing a second offer (`game.game.mailbox.timer = 0.01`) and waiting 6.5 s with no click leaves the task count unchanged and the card gone
  - pausing (`game.view.paused = true`) for 3 s doesn't change `offer.remaining` by more than 0.05
  - a done real task's Claim pays Warrants
  - a forced phishing claim shows the Phished banner
  - Claim is disabled while paused
  - with 4 tasks plus an offer, `.mb-list` has `scrollHeight > clientHeight` on a 1366×700 viewport, and the offer card stays inside `#panel-tasks`'s visible rect
  - no page errors besides favicon 404s
- [ ] **Step 2: Run it.** Expected: FAIL, no offer card.
- [ ] **Step 3: Implement** the DOM layer and update the README.
- [ ] **Step 4: Run the browser check, the Task 2 and Task 3 checks, and `node --test`.** Expected: all pass. Screenshot at 1366 and compare with mockup states 1 to 3. Play one full sprint hands-off with no page errors.
- [ ] **Step 5: Commit**: `git add src/content/features/mailbox.js README.md` and run `git commit -m "feat: tasks and mail offers in the side panel"`. Don't push.
