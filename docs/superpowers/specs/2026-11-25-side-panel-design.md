# Side panel: design

## Intent

Give the player one place, always on screen, that shows the state of their run beyond what the HUD shows:

- the Nexios building
- the developers they have hired
- the tasks they are working on

At the same time, tasks become something you have to grab. A task offer pops up for a few seconds. Click it and the task is accepted into the panel. Miss it and the offer is gone.

This replaces the mailbox's Inbox card and its floating inbox panel (`src/content/features/mailbox.js`, merged in PR #1).

## Goals

- A permanent panel on the **right** of the board, visible during the whole run, with three sections: **Building**, **Developers**, **Tasks**.
- **Building** shows:
  - floors
  - production (lives / max lives)
  - Nexios Coins
  - the level of each building upgrade, with what it counters
- **Developers** shows how many developers of each kind are on the board: React, Java, .NET, and any type added later.
- **Tasks** shows the accepted tasks: up to 4, each with progress and a Claim button when done.
- **New mail is an offer.** A popup appears for a few seconds, at the top of the Tasks section in the panel (decided):
  - clicking it accepts the task into the panel
  - if it isn't clicked in time, it disappears and the task is never accepted
- **Phishing stays as it is** (decided): a phishing offer looks identical. It can be accepted like any other, sits in the panel looking real, and springs its trap only when the player presses Claim. Accepting is always safe.

## Non-goals

- Changing task templates, rewards, phishing odds or the three penalties. They stay as they are in `mailbox.js` today.
- Moving HUD stats into the panel. Warrants, production, coins and the sprint stay in the HUD too, and the panel may repeat some of them.
- New building upgrades or new developer types.

## Anti-goals

- A board too small to play on. The panel must not shrink the board noticeably on a normal laptop screen.
- A popup that blocks placing developers, ringing the bell or using the quarter review.
- A phishing tell. Offers and tasks must look the same whether they're real or fake.

## Constraints

- **House rule.** Content goes in one new file plus one manifest line, and `src/engine/` isn't edited.
  - This design touches the shared page layout on purpose: `index.html` and `style.css`. That was the chosen approach (below), and the team should be told.
  - Nothing under `src/engine/` changes.
- **Canvas sizing.** `src/main.js` sizes the canvas from `#stage.clientWidth` on load and on window resize. The board must still size correctly when it sits next to the panel.
- **Style.** Nexios palette, Lato, sentence case, no emoji, no exclamation marks.
- **Phones.** At 720 px wide and below (the existing breakpoint), the panel moves below the board.
- **Tests.** `node --test` stays green, and the logic stays testable in Node without a DOM.

## Approaches

1. **Change the page layout; panel content in feature files (chosen).**
   - `index.html` gets an `<aside id="side-panel">` next to `#stage`, and `style.css` places the two side by side.
   - A new feature, `src/content/features/side-panel.js`, renders the Building and Developers sections.
   - `mailbox.js` becomes the task box and renders the Tasks section.
   - Trade-off: it touches two shared files, but only by a few lines, and the panel becomes a stable part of the page.
2. **Everything from feature files.** A feature wraps `#stage` at runtime to make room for the panel.
   - Trade-off: it keeps the house rule but is fragile: canvas sizing, `resetUI`, and teammates' edits all interact with it. The layout would also be hidden in a feature file.
3. **A new engine content type, `registerPanelSection`.**
   - Trade-off: the most extensible, but the biggest engine change. It's only worth it if many more sections are expected.

Option 1 won because a permanent panel is layout, not an add-on.

## Design

### Layout (`index.html`, `style.css`)

```
+-------------------------------------------------------------+
| HUD (full width, unchanged)                                 |
+----------------------------------------+--------------------+
|                                        | Building           |
|  #stage (board, overlay, pause veil)   | Developers         |
|                                        | Tasks              |
+----------------------------------------+--------------------+
| power-ups (full width; no Inbox card any more)              |
| hire bar (full width)                                       |
| help footer                                                 |
+-------------------------------------------------------------+
```

- `#stage` and a new `<aside id="side-panel" aria-label="Your run">` are wrapped in a new `<div id="play">`, laid out as a grid: board `1fr`, panel `280px`.
- `#app`'s `max-width` goes from `1100px` to `1380px` (my call). The board then keeps roughly its current size, and the panel is added next to it.
- The panel has three `<section>` children, with ids `panel-building`, `panel-devs` and `panel-tasks`, so each feature knows where to render. A feature that fails to load leaves its section empty, and the game still runs.
- **Height.** The panel is as tall as the board. When there's more content than space, the Tasks list scrolls inside its section.
- **Phones.** At `max-width: 720px`, `#play` becomes one column, with the panel below the board.
- **Canvas.** Because `resize()` reads `#stage.clientWidth`, the board shrinks to its grid column automatically.

### Building section (`side-panel.js`)

- **Floors:** `game.floors`.
- **Production:** `game.lives / game.maxLives`, with a small bar. It turns orange at 40% or below, matching the HUD.
- **Nexios Coins:** `game.coins`.
- **Upgrades:** every registered upgrade except `floor`, one row each.
  - Each row shows the name, what it counters (its `description`, e.g. "Counters: heat wave") and the level as 3 pips (`upgradeLevel(game, id)` out of `maxLevel`).
  - Upgrades at level 0 still show, with empty pips, so the player sees what's available.
- It updates every frame from `draw`, re-rendering only when a value changed.

### Developers section (`side-panel.js`)

- One row per registered developer type, in registry order: the type's icon, its name and the count of `game.devs` of that type.
- A total line: "N developers".

### Tasks section (`mailbox.js`, reworked)

**Offers replace mail delivery:**

- **Arrival.** The arrival timer works as today: first after 5 s, then every 30 s of scaled game time, in the `building`, `wave` and `bell` phases. When it fires, it creates an **offer** instead of adding a mail straight to the list.
- **One at a time.** There's at most one pending offer. The timer doesn't run while an offer is pending, or while 4 tasks are accepted.
- **The roll.** Template, phishing roll and reward kind are rolled when the offer is made, as in `deliverMail` today.
- **Expiry.** The offer lasts `OFFER_SECONDS = 6` seconds (my call). The spec says "a few seconds", and missing one now costs the task, so 6 s gives a fair chance.
  - The countdown uses real time, not game time, so 10× speed doesn't make offers impossible to catch.
  - The countdown pauses while the game is paused.
  - **How, without an engine change (my call, from the builder check):**
    - A pure `tickOffer(game, realDt)` counts the offer down, so Node tests can drive it.
    - In the browser, the feature's `draw` (which runs every frame, also while paused) measures wall-clock time with `performance.now()`. It passes that elapsed time to `tickOffer` only when `update` has run since the previous `draw`, which means the game isn't paused.
    - `update` gets scaled `dt` and isn't called while paused, so it can't be used for this.
- **Picking a template:** the pending offer's template is excluded from the pool, the same as accepted tasks. After a miss, the arrival timer restarts at `MAIL_INTERVAL`.
- **Accepting.** Clicking the popup calls `acceptOffer(game)`. The offer becomes a task in the Tasks list with progress 0, and progress counts from that moment.
- **Missing.** If the countdown runs out, the offer is dropped and nothing is added. The next one comes after the normal interval.
- **Bus events:**
  - `mail:offered` `{ game, mail }` when an offer appears
  - `mail:accepted` `{ game, mail }` when it's clicked
  - `mail:missed` `{ game, mail }` when it expires

  They replace `mail:received`. Nothing outside the file uses `mail:received` today; the builder must grep to confirm.
- **Quarter review.** The popup is hidden in `review`, `menu` and `lost`. A pending offer in those phases is dropped as missed. The review screen covers the board, so the player couldn't click it fairly.

**Tasks list:**

- Each task shows the sender, the subject, the reward ("+N W" or "Free Claude"), a progress bar with `progress/target`, and a **Claim** button when done.
- An empty list shows "No tasks yet. Click new mail when it pops up to accept it."
- The header shows "Tasks x/4".
- **When Claim works (my call, from the builder check).** The panel is always visible now, so this needs a rule:
  - Claim works in `building`, `wave`, `bell` and `review`. Claiming during the quarter review is a natural moment: Warrants can be spent on hiring there, malware is queued for the next sprint, and a lock carries over.
  - The Claim button is disabled in `menu` and `lost`, and while the game is paused.
- **Claim works as today.** A real task pays its reward with a green banner. A phishing task triggers one of the three penalties: stolen, malware or compromised, with the same safety caps as today.
- After a click, focus is released so Space still rings the bell.

**Removed:**

- the `Inbox` HUD button
- the floating inbox panel
- the unread badge and unread state
- the close-on-bell rule (there's no inbox to close)

**Popup (the offer card), decided: in the panel, at the top of Tasks**

- The builder check found that every corner of the board is taken:
  - top right: the Nexios building and its upgrades
  - bottom right: the bell card
  - top left: the bug spawn
  - top centre: the banners
  - bottom left: placeable cells

  So the offer lives in the panel and never covers the board.
- It slides in at the top of the Tasks section, above the task list, as a highlighted card with a green left border.
- It shows `New mail · <sender>`, the subject, the reward, a "Click to accept" button and a bar that shrinks as the 6 s run out. The whole card is clickable.
- It plays the `mail` chime when it appears. If it's missed, it slides out and nothing is added.
- When accepted, it is replaced by the new task at the top of the list.
- It's hidden, and the offer is dropped as missed, in `review`, `menu` and `lost`. While paused, it stays visible with its countdown frozen and can still be clicked: accepting is harmless.

### Restart

- `init` resets the mailbox state, including any pending offer, and both features clear their sections.
- Listeners stay at the top level of each file.

### Testing

- **Node tests:** `tests/mailbox.test.js` is updated for the offer flow:
  - an offer appears instead of a task
  - accepting adds a task with progress 0
  - an offer expires after 6 s of real time and adds nothing
  - no new offer while one is pending
  - no offers while 4 tasks are accepted
  - offers are dropped on review
  - a phishing offer can be accepted and penalises only on Claim
  - all existing progress, claim, penalty and voucher tests still pass
- **Side panel logic:** pure helpers such as `buildingRows(game)` and `devCounts(game)` get Node tests.
- **Browser check (headless Edge):**
  - the panel is on the right and the board is still at least 760 px wide on a 1366 px window
  - the panel moves below the board at 700 px wide
  - the offer card in the panel accepts a task on click, and a missed offer adds nothing
  - the offer card never overlaps the board
  - Claim works from the panel
  - no console errors

## Left to the builder (my calls)

- The exact panel spacing, fonts and the pip style, within the Nexios palette and the existing card look.
- Whether the Developers rows reuse `drawDevTile` on a small canvas or a coloured square with the type's accent. The hire bar already draws the icons with `drawDevTile`, so reuse is preferred.
- The wording of the empty states.
- `OFFER_SECONDS = 6`, `#app max-width: 1380px`, panel width `280px`. These are my calls and can be tuned.
