# Sprint retrospective: design

## Intent

When a run ends, show a short sprint retrospective: some fun stats about the run, written as awards. It's just for a laugh at the end of every run. Nothing to share, nothing to act on.

## Goals

- **When it shows:** after the building has collapsed at the end of a lost run, a retrospective card appears on its own screen.
- **Continue:** a "Continue" button closes it and reveals today's game-over screen, unchanged (stats, investors, retry, Investments, main menu).
- **What it shows:** five or six awards picked from what happened in the run. An award with nothing to report is skipped.

## Non-goals

- Sharing, copying or saving the retrospective.
- Changing the game-over screen itself.
- Stats across runs. Each retrospective covers one run only.

## Anti-goals

- Delaying the player more than one click before they can retry.
- Breaking or covering the game-over screen once Continue is pressed.
- A retrospective after **quitting** a run from the menu (my call: if you chose to stop, you want the menu, not a recap).

## Approaches

1. **One new feature file (chosen).** `src/content/features/retrospective.js` plus one manifest line.
   - It tallies the run from bus events and shows its own card on top of the board after the collapse.
   - The mailbox gets one new event for phishing.
   - Trade-off: it follows the house rule and leaves the busy engine files alone. It has to time itself to the collapse animation.
2. **Built into the engine's game-over screen** (`game.js` stats plus a step in `ui.js`).
   - Trade-off: simpler timing, but it edits shared engine files the team is actively changing, so merge conflicts are likely.

Option 1 won: everything it needs already exists as events, and it can't break the game-over screen.

## Design

### Tally (during the run, from bus events)

| Award | Source |
|---|---|
| MVP developer | `bug:killed` `{ dev }`: kills per developer id, remembering `dev.type` (and the level-3 upgrade name if it has one). It counts sold developers too. |
| Works on my machine | `bug:leaked` `{ bug }`: leaks per `bug.type`. |
| Fell for it | a new `mail:phished` `{ game, mail, kind }` event, emitted by `mailbox.js` when a claim turns out to be phishing (`kind` is `stolen`, `malware` or `compromised`). |
| Caffeine intake | `drop:collected` `{ drop }`: amounts per drink id. |
| Asked Claude | `powerup:activated` with `id === 'claude'` counts uses; `claude:backfire` counts backfires. |
| Survived | `game:lost` `{ info }` gives the year, quarter and sprint; `game.stats.squashed` gives the total. |

The tally lives on the game (`game.retro`), is created in `init` and resets on every restart. Listeners are at the top level of the file.

### The card

```
+--------------------------------------------------+
|  SPRINT RETROSPECTIVE                            |
|  Year 1 · Q3 · Sprint 4                          |
|                                                  |
|  MVP developer        React dev (Next.js) · 214  |
|  Works on my machine  Memory leak got through 6x |
|  Fell for it          2 phishing mails. IT has   |
|                       been notified.             |
|  Caffeine intake      312 Coffee · 140 White     |
|                       Monster · 88 Red Bull      |
|  Asked Claude         5 times · backfired twice  |
|  Survived             Y1 · Q3 · S4 · 1,204 bugs  |
|                                                  |
|                               [ Continue → ]     |
+--------------------------------------------------+
```

- **Placement:** a DOM card inside `#stage`, above `#overlay`, in the look of the existing screen cards (navy, Lato, eyebrow plus title, Nexios palette, no emoji, sentence case, no exclamation marks).
- **Timing:** it appears once `deathAnimDone(game)` is true, the same moment the game-over screen appears, and only when `!game.quit`. It shows once per run.
- **Continue:** removes the card. Today's game-over screen is already rendered underneath. Focus moves to the Continue button when the card opens, so Enter or Space presses it.
- **Skipping awards:** an award with nothing to report is left out. That covers no kills, no leaks (impossible on a loss, but guarded anyway), no phishing, no Claude and no drinks. "Survived" always shows.
- **Phone:** the card fits the board width and scrolls inside itself if it's too tall.

### Copy (my calls, tune freely)

- **MVP developer:** "`<Type> developer` (`<upgrade>`) · `<n>` bugs squashed". Ties go to the developer hired first.
- **Works on my machine:** "`<Bug name>` got through `<n>` times". Ties go to the bug that leaked first.
- **Fell for it:** "`<n>` phishing mail(s). IT has been notified."
- **Caffeine intake:** per drink with an amount above 0: "`<n>` `<Drink name>`", joined with " · ".
- **Asked Claude:** "`<n>` times", plus " · backfired `<m>` times" if `m` is above 0.
- **Survived:** "Year y · Qq · Sprint s · `<squashed>` bugs squashed".

### Tests

- **Node:** a pure `retroAwards(game): Array<{ title, text }>` built from `game.retro` and `game.stats`, with tests for:
  - each award
  - skipping empty ones
  - ties
  - the reset on `init`
  - the tally from emitted events, including a sold developer's kills
  - no card or awards needed for a quit run (`shouldShow(game)`)
- **Browser:**
  - after a loss the card appears only once the collapse is done
  - Continue reveals the normal game-over screen with its buttons working
  - a quit run shows no card
  - restarting shows a fresh tally
  - no page errors

## Left to the builder

- The exact spacing, and the order of the awards (the table order above is the default).
- The ellipsis rules for long names on narrow screens.
