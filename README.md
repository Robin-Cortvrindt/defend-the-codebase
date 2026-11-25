# Defend the Codebase

A browser tower defense game for the Intent Engineering Bootcamp hackathon. Bugs crawl toward production. You hire React, Java and .NET developers to squash them, and Thomas, Jeroen, Bart and Claude lend a hand.

**Play:** https://robin-cortvrindt.github.io/defend-the-codebase/

## How it plays

- **Hire developers** next to the path with Warrants, the currency. Squashed bugs pay Warrants.
- **Counters:** React (blue) is fast and light and counters typo bugs. Java (orange) is balanced and counters null pointers. .NET (fuchsia) is slow and heavy and counters legacy bugs. A bug's ring colour shows which developer counters it, and counters do double damage.
- **Upgrades:** squashing bugs earns XP. 10 XP unlocks level 2 and 30 XP unlocks a choice of two level-3 branches, one steady and one a gamble. Levels here count from 1; in code and events they count from 0, so level 2 is `level: 1`. You pay for each upgrade in Warrants, so every bell is a choice between hiring and upgrading.

  | Developer | Level 1 | Level 2 | Level 3 steady | Level 3 gamble |
  |---|---|---|---|---|
  | Java | Junior Java Dev | Spring Boot Dev: more damage and range | Enterprise Architect: a little less damage itself, +15% damage to developers within 7 cells | Garbage Collector: stops for 1 s every 8 s, then a big pulse hits every bug in range for 2× |
  | React | Create React App | Vite: faster fire | Next.js: each shot also hits the next 2 bugs | useEffect Hell: harder hits, and each hit has a 20% chance to hit again, up to 10 times |
  | .NET | .NET Framework 4.8 | .NET Core: faster fire | Visual Studio Enterprise: one huge hit | Azure Function: area damage, billed 1 Warrant every 0.5 s while it fires. Toggle it in the panel. |

  React developers fire 10% faster for each other React developer on the map, up to +50%.
- **Power-ups:**
  - **Thomas:** double XP.
  - **Jeroen:** double Warrants.
  - **Bart:** attack speed +50%.
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
