# Main menu — design

Mockup: `docs/mockups/main-menu.html` (approved 2026-11-25).

## Intent

The game opens on a card laid over the empty board, while the HUD stats, power-up bar and hire bar all show even though no run is going. The player should get a real title screen before a run, and only see the game screen during a run.

## Goals

- **Main menu** (title screen): wordmark, title, one-line tagline, and three buttons: Start run, How to play, Investments (💼 capital). On the right are tiles for Best run, Investor capital (owned / affordable counts) and the developer→bug counter legend. A footer shows the sound toggle. No "Intent Engineering Bootcamp" line.
- **How to play**: four steps (hire next to the path, earn Warrants, ring the bell, quarterly review) and the keyboard help line. Back and Start run buttons.
- **Investments**: all 16 on one screen. There are three columns (Developers, Power-ups, Unlocks) of compact two-line rows: the name with level pips, a short effect line, and the price button. The full description shows on hover. One header row holds the title, capital, Back and Start run. Back returns to wherever the shop was opened from (menu or game-over screen).
- **While the menu, How to play or Investments is showing**, and on the game-over screen, the board is hidden on menu screens. The HUD shows only the wordmark (plus Sound on the end screens), and the power-up and hire bars are hidden.
- **The keyboard help footer** is removed from the game screen. It now lives only on How to play.
- **In a run**: a **Quit** button next to Pause. Clicking it pauses the game and opens a confirm box ("Quit this run?", Keep playing / Quit run). Esc closes it.
- **Quit run** counts as a normal loss: investors pay out (`awardCapital`) and the run counts toward Best run. The building collapse plays as it does for a real loss. Afterwards the game goes **straight to the main menu**, without the "Production is down" card. The menu then shows a **Last run** tile (how far you got, + capital paid) until the next run starts.
- **Game over** card gets a **Main menu** button next to Hotfix and retry and Investments.

## Non-goals

- No in-run menu/pause screen (only Quit).
- No settings screen.
- No change to game balance or investment prices.

## Approaches

- **A. Screens inside the game area (chosen).** Menu, How to play and Investments are overlay screens in `#stage`, as the menu and shop already are. A `data-screen` attribute on `#app` drives CSS that hides the board, the bars and the HUD run items. This reuses the overlay and shop code, and the game-over screen's Investments button keeps working.
- B. A separate menu section beside the game. Rejected: the shop would have to live in two places, or the game-over screen would need to jump across sections, and nothing visible would differ.

## How

- New `src/engine/menu.js` holds the menu, How to play and investments screens (moved out of `ui.js`). `ui.js` keeps the HUD, bars and in-run overlays.
- `#app[data-screen]` is set whenever an overlay screen is shown (`menu`, `howto`, `invest`, `lost`, `won`, plus the in-run phases). CSS hides `#hud .stat/.run-only`, `#powerups`, `#hire` and the canvas as each screen needs.
- Quit: `game.js` gets `quitRun(game)`, which sets `game.quit = true` and ends the run through the same path as running out of lives (phase `lost`, `game:lost` emitted, so payout and sound behave the same). When `deathAnimDone` and `game.quit`, the UI calls `app.restart()` and passes along a last-run summary (sprint, capital earned) for the menu tile.
- Best run is recorded for quit runs as well (`recordBest`).

## Left to the builder

- The exact short effect text per investment: use `effectText(level)` where it exists, otherwise a trimmed `description`.
- Whether the Last run tile survives a page reload (default: no, in-memory only).
