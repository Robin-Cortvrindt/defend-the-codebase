# Defend the Codebase

A browser tower defense game for the Intent Engineering Bootcamp hackathon. Bugs crawl toward production. You hire React, Java and .NET developers to squash them, and the training manager, business manager, CEO and Claude lend a hand.

**Play:** https://robin-cortvrindt.github.io/defend-the-codebase/

## How it plays

- **Hire developers** next to the path with Warrants, the currency. Squashed bugs pay Warrants.
- **Counters:** React (blue) is fast and light and counters typo bugs. Java (orange) is balanced and counters null pointers. .NET (fuchsia) is slow and heavy and counters legacy bugs. A bug's ring colour shows which developer counters it, and counters do double damage.
- **Levels:** developers go from Junior Consultant to Consultant to Senior Consultant as they squash bugs.
- **Power-ups:**
  - **Training manager:** double XP.
  - **Business manager:** double Warrants.
  - **CEO:** attack speed +50%.
  - **Claude:** squashes every bug on the map. The price goes up each use, and there's a 25% chance it backfires and doubles the bugs.
- **Between waves**, ring the Nexios victory bell to start the next wave.
- **Win or lose:** survive 10 waves. If too many bugs reach PROD, production is down.

Controls:

| Key or action | Does |
|---|---|
| `1` `2` `3` | Hire React, Java or .NET |
| Shift-click | Keep hiring after placing |
| Right-click or `Esc` | Cancel |
| `Space` | Start the wave or ring the bell |
| `P` | Pause |
| `F` | 2× speed |
| `M` | Sound on or off |

## Run locally

ES modules don't load from `file://`, so serve the folder:

```
python -m http.server 8000
```

Open http://localhost:8000, or http://localhost:8000/?demo=1 to jump straight into a wave.

## Extending it

See **[CONTRIBUTING.md](CONTRIBUTING.md)**. In short: one new file plus one line in `src/content/manifest.js`.

## Docs

- Design: `docs/superpowers/specs/2026-11-25-defend-the-codebase-design.md`
- Plan: `docs/superpowers/plans/2026-11-25-defend-the-codebase.md`
- Mockups: `docs/mockups/game-states.html`
- Breakage log: `REGRET.md`
