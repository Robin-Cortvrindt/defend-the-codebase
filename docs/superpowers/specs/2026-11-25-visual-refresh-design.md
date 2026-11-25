# Visual refresh: bigger board, office background, roadmap top bar, centred bell

Robin approved each part from a mockup on 2026-11-25. The mockups are the reference for the look:

- `docs/mockups/bell-position.html`: option **B** (stacked card, bigger bell)
- `docs/mockups/bell-new-board.html`: option **3, centred, everything locked**
- `docs/mockups/playing-field.html`: option **B** (24 × 12), plus the "fits on one screen" frames
- `docs/mockups/field-backgrounds.html`: option **5, Nexios office**
- `docs/mockups/top-bar.html`: option **B, year roadmap**

## Why

The board felt small and the route short and simple. Robin wants more room to build and a longer, twistier route, and on a laptop the page shouldn't scroll. The sprint display ("Y1 · Q2 · 3 / 7") is just numbers you have to work out. The bell card in the corner didn't feel like a moment.

## Goals

1. **Board 24 × 12** (40 px cells, 960 × 480 game units), with the 10-corner route from the mockup:
   `(0,60) → (300,60) → (300,220) → (140,220) → (140,420) → (460,420) → (460,140) → (620,140) → (620,380) → (780,380) → (780,260) → (896,260)`, PROD at `x 896, y 226`. That makes the route ~2,220 px, up from ~900.
2. **No scrolling:** the canvas is sized from both the width and the height of the window, so the HUD, board, power-ups and hire row always fit in the viewport. On wide screens the board is centred with empty space either side. The side panel stays as it is.
3. **Nexios office background:** carpet tiles in navy shades with faint cell edges, and a few decorations (plants, desks, a coffee machine) on cells away from the lane and PROD. Decorations are only drawn: developers can still be hired on those cells and are drawn on top.
4. **Lane unchanged in look:** the circuit-board trace, flowing code, side traces and solder rings stay exactly as now, just following the new route.
5. **Top bar, year roadmap:** "Sprint" and "Incident" are replaced by a roadmap of 4 quarters × 7 sprints: green for done, blue for the current sprint (filling as its bugs are dealt with during a sprint), a star at each quarter review and a trophy at the yearly review. Above it: "**Year N** · Qn · Sprint n" on the left and, on the right, "N sprints to quarter review ★" between sprints or "x / y bugs squashed" during a sprint. The incident becomes an orange chip that only shows while an event is on. Speed, Pause, Sound and Quit become compact icon buttons with tooltips. The main action button stays as it is.
6. **Bell, stacked and centred:** the sprint-end bell card sits in the middle of the board, bell on top and bigger, with the text centred underneath. Its last line reads "Click the bell or press Space" instead of "Hiring and selling still work".
7. **Nothing changes while the bell waits** (Robin's rule). In the `bell` phase:
   - **Locked:** hiring, selling, upgrading and moving developers; the .NET Azure Function toggle; power-ups; accepting or claiming mail. The board dims a little more (about 55% instead of 35%) and ignores clicks. The hire buttons and power-ups are greyed out, with one "Locked until you ring the bell" note over them.
   - **Still works:** ringing the bell (click or Space), pause, speed, sound and quit.
   - The lock is enforced in the engine (`placeDev`, `sellDev`, upgrades, `usePowerup`, mailbox claim and accept refuse during `bell`), not just hidden in the UI, so hotkeys and the sims follow it too.
   - Ringing the bell still starts the next sprint straight away, so all hiring, selling and upgrading now happens while a sprint runs. Robin accepted that.

## Non-goals

- The power-up cards, a sprint preview, hit feedback and the hire bar (ideas listed in the top-bar mockup) are not part of this. Each can be its own follow-up after a mockup.
- No new mechanics. Firewalls, cross-functional teams, the full-stack squad and garbage collection keep working on the bigger grid as they do now.

## Anti-goals

- Developers and bugs must not become hard to read on a 1366 × 768 laptop.
- The game must not end up much easier just because the route is longer.

## Approaches considered

- **Board size:** 20 × 10 with 8 corners (bigger cells, +89% route) or 24 × 12 with 10 corners (most room, +147% route, about 30% smaller sprites). Robin picked 24 × 12.
- **Background:** circuit board, blueprint dots, code editor, server room, Nexios office. Robin picked the office.
- **Top bar:** sprint pips (smallest change), year roadmap, sprint card with live progress. Robin picked the roadmap.
- **Bell look:** same card centred, or stacked and centred with a bigger bell. Robin picked stacked.
- **Bell position on the new board:** centred (covers the busiest spots), beside the PROD building in the top right (keeps the middle clear), or centred with everything locked. Robin picked centred and locked: with nothing clickable during the bell, the card hides nothing you need.

## What it touches

- `src/engine/map.js`: grid size, waypoints, PROD position.
- `src/engine/lane.js`: nothing in its drawing; it reads the map. Check that the side traces still look right.
- `src/engine/render.js`: background and decorations, replacing the plain grid.
- `src/main.js` `resize()` and `style.css`: fit to the viewport.
- `src/engine/ui.js` and `style.css`: roadmap HUD, incident chip, icon buttons, bell card, locked hire and power-up bars.
- `src/engine/devs.js`, `upgrades` and Azure toggle code, `powerups.js`, `input.js`, `src/content/features/mailbox.js`: refuse actions during `bell`.
- `scripts/sim.mjs`, `scripts/sim-upgrades.mjs`: they hard-code `16` and `8` for the grid; use `COLS` and `ROWS`. Today the bots hire and upgrade during `bell`, so they must now do it right after ringing (at the start of the sprint).
- `src/content/waves.js` (and the generated-sprint scaling in `game.js` if needed): re-tune for the longer route and the bell lock.
- README: anything that describes the board or the HUD.

## Balance target

Before changing anything, run both sims on the current board and save the output as the baseline. After the change, each bot strategy (with and without power-ups) should lose within one sprint of its baseline. Decided by Claude; Robin can override.

## Calls Claude made (Robin to check)

- Only the **sprint-end** bell card moves to the centre and locks the game. The quarter review (its own screen, and the minimised review card in the corner) keeps today's behaviour: you can still use the board while it's minimised. If the lock should apply there too, that's a small addition.
- No new mail arrives during the bell. Mail only stays up for 6 seconds, so mail that arrived during the bell could expire before you were allowed to accept it. Tasks you already hold stay where they are and can be claimed once the sprint starts.

## Left to the builder

- Exactly how "bugs squashed" counts bugs that split (merge conflicts): it should end at y / y when the sprint ends.
- Decoration placement: fixed cells chosen once, not random per run.
- The icons for the buttons: simple inline SVG in the house style, no emoji in the shipped game.
