# Developer effects card: design

## Intent

Hovering a developer on the board shows everything currently affecting it: its upgrades, the investments that change it, active power-ups, the running event and team bonuses. Each source is named, together with what it does. The player can then see why one developer hits harder or slower than another, and what their investments and positioning are buying them.

## Goals

- Hovering an occupied cell on the board shows a card next to that developer.
- The card has a header with the developer's name, its level name and its current totals (damage, shots per second, range in cells), as `devStats` computes them.
- Below the header, one line per active source: the source's name and what it does to *this* developer now, for example `CEO · attack speed +50% (8 s left)`.
- Only sources that are active and apply to this developer are listed. A non-Java developer during "Out of coffee" shows nothing for that event.
- New content can add its own line by adding one optional function in its own file. No engine edit is needed.

## Non-goals

- Changing any game math. Damage, attack speed, range and XP stay exactly as they are (user picked approach A).
- Effects that don't act on developers: the business manager (drinks), Claude, heat wave (bug speed), PROD is down, goblin, robot vacuum, recruitment network (hire price), sales investments. They write no line.
- Investments that only tune a power-up (Training budget, Training planning, Leadership coaching, CEO calendar, Prompt engineering, Enterprise plan). Their effect shows inside the power-up's own line, for example `Training manager · XP ×2.5`.
- Touch devices (there's no hover); the click panel stays as it is.

## Anti-goals

- A card whose numbers disagree with what the developer actually does. Every described number is read from the same constant or state the effect uses, and the main ones are tested.
- A broken describe function in a teammate's file crashing or blanking the card. Each source is guarded and skipped on error, as content hooks already are.
- The card getting in the way: it never takes clicks, and it doesn't show for a developer whose click panel is already open.

## Approaches

- **A. Each source describes itself (chosen by the user).** Content definitions get an optional `describeEffect(game, dev)`, and an engine collector gathers the lines. The math is untouched, so there's no balance risk. The cost is that the described number lives next to, not inside, the applied number, so tests pin the important ones.
- B. Rebuild effects as a list of named modifiers that `devStats` folds and the card reads. The text can never drift from the math, but it's a rewrite of `devStats` and ~15 content files, with balance-regression risk. Not chosen.

## Design

### The hook

`describeEffect(game, dev) -> string | string[] | null`. It returns the effect text (or several lines), or `null`/`[]` when the source isn't active or doesn't apply to `dev`. The source's display name is not part of the text; the collector adds it.

Where it can live:

| Content | Name shown | Example text |
|---|---|---|
| Developer def (`registerDeveloper`) | its own label, given as `{ name, text }` objects (see below) | React: `React team (3 others) · attack speed +30%` |
| Level-2 / level-3 upgrade objects | `upgrade.name` | `Spring Boot Dev · damage 40, range 2.6` |
| Upgrade `aura` (on another developer) | the aura owner's upgrade name + "(nearby)" | `Enterprise Architect (nearby) · damage +15%` |
| Investment (`registerInvestment`) | investment name + level | `Better laptops 3 · damage +30%` |
| Power-up (`registerPowerup`) | power-up name | `CEO · attack speed +50% (8 s left)` |
| Event (`registerEvent`) | event name | `The heating is out · attack speed −50%` |
| Feature (`registerFeature`) | feature name | for team mechanics that live in features |

A hook may also return objects `{ name, text, group? }` to override the shown name and/or group. This is for developer defs and features that describe a team bonus under its own label. The four unlock investments (Security training, Cross-functional team, Full-stack squad, Garbage collection) return `group: 'team'` so they list with the team bonuses, under their investment name *(my call)*.

**Auras.** An upgrade's `aura` gets an optional `describe(game, dev) -> string`. The collector applies the same rule as `devStats`: each distinct aura upgrade id once, only when its owner is another developer within `aura.radius * CELL`. The line is named `<upgrade name> (nearby)` *(my call)*.

### The collector

New DOM-free module `src/engine/effects.js`:

`devEffects(game, dev) -> Array<{ group, name, text }>`. The groups, in this order:

1. `upgrade`: the level-2 upgrade if `dev.level >= 1`, the level-3 upgrade if `dev.level === 2`.
2. `team`: the developer def's own hook (React's per-React bonus), the auras of other developers in range (same rule as `devStats`: each distinct aura upgrade once), and team unlocks (firewall, cross-functional, full-stack squad, garbage collection).
3. `investment`: investments applied to this run, with a hook. `applyInvestments` stores the levels it applied in `game.investmentLevels` (`{ id: level }`, a small engine change), and the collector passes that level to the hook as a third argument: `describeEffect(game, dev, level)`. Reading storage instead could disagree with the run if the player bought more between runs *(my call)*.
4. `powerup`: power-ups currently active (`powerupState(game, id).active`).
5. `event`: the running `game.activeEvent`.

Every call is wrapped in try/catch, logs `[effects <kind> <id>]` and is skipped on error. Strings and arrays are normalised to `{ group, name, text }`.

### Which sources describe what (initial content)

| Source | Line when active for this dev |
|---|---|
| Upgrades with `stats` | the stats they set, e.g. `damage 40, range 2.6`; plus `description` for behaviour-only upgrades (Next.js chain, useEffect Hell, Garbage Collector, Visual Studio Enterprise, Azure Function `triple area damage, 1 White Monster / 0.5 s`) |
| Java Enterprise Architect (own) | `damage −10%, +15% damage to developers nearby` |
| Enterprise Architect aura (on others) | `damage +15%` |
| React per-React bonus | `attack speed +N%` (only if at least 1 other React) |
| Better laptops | `damage +10×level%` |
| Agile coaching | `attack speed +8×level%` |
| Bigger monitors | `range +5×level%` |
| Cross-functional team | `attack speed +25%`, only while `isBalanced(game)` |
| Full-stack squad | `hits bounce to a second bug for 50%`, only for a React where `isSquadReact` |
| Garbage collection | `every 10th kill slows bugs nearby`, only for a Java where `inJavaSquare` |
| Security training (firewall) | `part of a firewall`, only for a .NET in a pair from `findFirewalls` |
| Training manager | `XP ×N (s left)` |
| CEO | `attack speed +N% (s left)` |
| Heating out | `attack speed −N%` (from `game.heatingOutFactor`) |
| Out of coffee | Java only: `attack speed −N%` |
| Out of Red Bull | .NET only: `attack speed −N%` |
| Wine tasting | `tipsy: shoots at random bugs` |

Percentages are computed from the same factors the effect uses, never retyped. Where a factor is inline today, it gets extracted into a small exported constant or function in the same file, used by both `apply`/`activate` and `describeEffect` *(my call, in scope)*: Better laptops `0.10`, Agile coaching `0.08`, Bigger monitors `0.05` per level; React `0.1` per other React, capped at 5; CEO and Training manager reuse their existing `factor(game)` (or `st.factor` while active); the Enterprise Architect's `0.9` own and `1.15` aura.

**Event lines show only that event's own factor** (`game.heatingOutFactor`, `game.coffeeFactor`, `game.redbullFactor`), not the combined total, which the totals line already shows. When an event's factor is exactly 1 (fully countered by its building upgrade), it writes no line *(my call)*.

### The card

- **Trigger:** `app.view.hover` (a cell, set by `input.js` mousemove; `null` after mouseleave) holds a developer per `devAt`, that developer is not `app.view.selected`, and the board is visible: phase `building`, `wave` or `bell`, or `review` with the review screen minimised. It also shows while paused, so the player can inspect calmly *(my call)*. It hides when the mouse leaves the canvas or the cell.
- **Code:** the DOM part lives in a new `src/engine/effects-card.js` (mirroring `hire-card.js`), called from `ui.js` each frame, so `ui.js` doesn't grow further *(my call)*.
- **Where:** a DOM element next to the developer, placed with the existing `popoverPosition` helper (as the click panel is), so it never covers the developer and stays inside the stage. `pointer-events: none`.
- **Look:** same style as the click panel and hire card. Header `Java · Spring Boot Dev`, a totals line `Damage 44 · 1.9/s · range 2.9`, then the lines grouped in the order above, each `Name` in bold plus the text. If nothing is active, it shows `No active effects`.
- **Updating:** it refreshes each UI frame while shown, so countdowns tick and lines appear or disappear live. The DOM is only rebuilt when the line list changes; the timers update in place.

### Tests

- `devEffects` returns the right lines for: Better laptops level 3 → `damage +30%`; CEO active → `attack speed +50%`; CEO inactive → no line; heating out with an aircon-style resistance → the factor-based percentage; out of coffee for Java vs React; the Enterprise Architect aura for a developer in range vs out of range; the React bonus with 0 vs 3 other Reacts; cross-functional balanced vs not; Spring Boot `damage 40, range 2.6`.
- A throwing hook is skipped and the other lines still come back.
- `game.investmentLevels` holds the applied levels after `startGame`, and an investment bought afterwards doesn't change this run's line.
- Out of coffee fully countered (factor 1) writes no line.
- Order of groups is stable.

### Docs

CONTRIBUTING gets one row explaining `describeEffect` on each content type.

## Left to the builder

- Exact wording and number formatting (rounding to whole percents, `−` vs `-`).
- Card width and spacing, matching the click panel.
- Whether upgrade lines are generated from `stats` automatically or written per upgrade, as long as they match the table.
