# Defend the Codebase

A browser tower defense game for the Intent Engineering Bootcamp hackathon. Bugs crawl toward production. You hire React, Java and .NET developers to squash them, and the training manager, business manager, CEO and Claude lend a hand.

**Play:** https://robin-cortvrindt.github.io/defend-the-codebase/

## How it plays

- **Drinks:** squashed bugs drop a drink: Coffee, White Monster or Red Bull. It flies to a random free spot on the office floor; click it within 10 s of landing or it's gone; one click on a drink also grabs every other drink close by. Each developer is paid in its own drink: Java in Coffee, .NET in White Monster, React in Red Bull. A security risk drops all three. You start with 100 of each: a mixed team keeps roughly today's pace, while a team of one kind grows slower. Drops don't time out or get picked up while the game is paused.
- **Hire developers** next to the path, paying in the developer's drink.
- **Counters:** React (blue) is fast and light and counters typo bugs. Java (orange) is balanced and counters null pointers. .NET (fuchsia) is slow and heavy and counters legacy bugs. A bug's main colour shows which developer counters it, and counters do double damage. Each bug has its own look: typos are blue spelling-mistake squiggles, null pointers orange ∅ beetles, legacy bugs floppy-disk beetles.
- **Grey bugs** have no counter, so everybody chips in. From sprint 5, a **merge conflict** (a green + / red − diff bug) splits into two smaller, faster halves when squashed. From sprint 7, a **memory leak** (a memory module whose chips light up as it fills) grows bigger and tougher the longer it lives, up to twice its health, so squash it early.
- **Boss:** every sprint ends with a **security risk** (a red armoured beetle with an open padlock). It's big, slow and tough, no developer counters it, and letting it through costs 5 lives.
- **Developer upgrades:** squashing bugs earns XP. 10 XP unlocks level 2 and 30 XP unlocks a choice of two level-3 branches, one steady and one a gamble. Levels here count from 1; in code and events they count from 0, so level 2 is `level: 1`. You pay for each upgrade in the developer's drink, so every sprint is a choice between hiring and upgrading.

  | Developer | Level 1 | Level 2 | Level 3 steady | Level 3 gamble |
  |---|---|---|---|---|
  | Java | Junior Java Dev | Spring Boot Dev: more damage and range | Enterprise Architect: a little less damage itself, +15% damage to developers nearby | Garbage Collector: stops for 1 s every 8 s, then a big pulse hits every bug in range for 2× |
  | React | Create React App | Vite: faster fire | Next.js: each shot also hits the next 2 bugs | useEffect Hell: harder hits, and each hit has a 20% chance to hit again, up to 10 times |
  | .NET | .NET Framework 4.8 | .NET Core: faster fire | Visual Studio Enterprise: one huge hit | Azure Function: area damage, billed 1 White Monster every 0.5 s while it fires. Toggle it in the panel. |

  React developers fire 10% faster for each other React developer on the map, up to +50%.
- **Power-ups** are free. Each one has a cooldown instead of a price, and cooldowns only count down during a sprint:
  - **Training manager:** double XP.
  - **Business manager:** double drinks.
  - **CEO:** attack speed +50%.
  - **Claude:** squashes every bug on the map. Cooldown 90 s, and there's a 25% chance it backfires and doubles the bugs. The free Claude from a task reward lets you fire it even during the cooldown, and resets the cooldown. The Enterprise plan investment shortens it.
- **Side panel:** always on the right of the board. It shows your Nexios building (floors, production, Warrants and every upgrade level), how many developers of each kind you have, and your tasks.
- **Tasks:** during a sprint, new mail pops up at the top of the Tasks section for 6 seconds, such as "Hire 3 .NET developers" or "Survive 2 more sprints". Click it to accept the task; miss it and it's gone. You can hold up to 4 tasks. Finish one and press Claim for drinks (split evenly over the three), or now and then a free Claude. Watch out: about 1 in 6 mails is phishing, and you only find out when you claim it, and then it steals drinks, split evenly too.
- **Sprints and quarters:** waves are sprints, 7 sprints make a quarter, 4 quarters make a year, and it never ends. Between sprints you ring the Nexios victory bell.
- **Warrants:** the building's currency (it used to be called Nexios Coins). You get 1 per sprint and 3 more per quarter. The **quarter review** opens once the last bug is gone and every drop is collected or has expired. There you spend them on the Nexios building: **add a floor** (+5 production, heals 5; the building grows) or a counter-upgrade for each random event, 3 levels each: **air conditioning** (heat wave), **server heat recovery** (heating out), **coffee bar** (out of coffee), **energy drink fridge** (out of Red Bull), **backup generator** (PROD is down) **water cooler** (Thomas organized a wine tasting: developers shoot random bugs in range, with zigzagging shots) and **goblin trap** (a greedy goblin runs in from the right and steals dropped drinks; each level slows it, to 40% at level 3). Every upgrade shows on the building.
- **Yearly review** after every Q4: accept a guaranteed +10% on drinks from bugs, or ask for a raise (50% chance of +20%, otherwise nothing). The sprint-end bonus is paid in drinks too.
- **Lose:** when too many bugs reach the Nexios building, production is down. Your best run (year, quarter, sprint) is remembered in the browser.
- **Investments (between runs):** after a loss you find new investors, and they put in **Investor Capital** depending on how far you got: 1 per sprint, 5 more per quarter and 15 more per year. Spend it in **Investments** (start menu or game-over screen) on permanent upgrades for every later run:
  - **Developers** (all at once): more damage, attack speed and range, and cheaper hires.
  - **Power-ups:** a stronger training manager, business manager and CEO with shorter cooldowns, and a Claude that backfires less and has a shorter cooldown (Enterprise plan).
  - **Unlocks:** **Security training (.NET)**. Two .NET developers facing each other across the lane build a **firewall** that damages bugs passing through, and a firewall kill gives XP to both developers. **Cross-functional team**: while you have as many React as Java as .NET developers (1-1-1, 2-2-2, ...), every developer attacks 25% faster. **Full-stack squad**: a React developer with a Java and a .NET developer directly above, below, left or right of it (not diagonally) has its hits bounce to a second bug nearby for half damage. **Garbage collection**: four Java developers in a 2×2 square run a garbage collector, so every 10th kill by one of them slows the bugs in its range by 50% for 1.5 s (bosses 25%). **Robot vacuum** (3 levels): a robot vacuum drives to the nearest dropped drink and collects it for you, faster per level (70 / 100 / 130 px/s); you can still click drinks yourself.
  - Progress is saved in this browser. **Reset progress** in the shop starts over.

Controls:

| Key or action | Does |
|---|---|
| `1` `2` `3` | Hire React, Java or .NET |
| Shift-click | Keep hiring after placing |
| Right-click or `Esc` | Cancel |
| `Space` | Start the wave or ring the bell |
| `P` | Pause |
| `F` / `Shift+F` | Game speed up / down (1×, 2×, 3×, 5×, 10×) |
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
