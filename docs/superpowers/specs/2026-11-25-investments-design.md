# Investments (permanent upgrades between runs): design

## Intent

Give the game a reason to play again. When production goes down, you go looking for new investors. How much they put in depends on how far you got, and you spend that **Investor Capital** on permanent **investments** that make every later run start stronger. Investments improve the baseline of all developers, make the power-ups stronger and bring them back sooner, and unlock new mechanics. The first of these is a .NET firewall.

## Goals

- A persistent currency, **Investor Capital**, earned on every loss and based on how far the run got.
- A shop (**Investments**) reached from the start menu and the game-over screen.
- Investments that:
  - raise the baseline of **all developers at once** (not per developer type);
  - make each power-up **more effective** and reduce its **cooldown**;
  - **unlock new mechanics**. The first unlock is the .NET firewall. React and Java unlocks come later, so the system must make adding one easy.
- Teammates add a new investment with **one file plus one manifest line** (CONTRIBUTING.md rule).
- Progress survives a page reload (browser `localStorage`).

## Non-goals

- Per-developer-type stat upgrades (decided: all developers at once for now).
- Unlocks for React and Java. Those are designed later, but this system must support them.
- Selling or refunding investments.
- Syncing progress across devices or browsers.

## Anti-goals (failure even if it works)

- Investments that make the first sprints trivial forever. A run should still feel like a fight. Each bonus is small and capped.
- Breaking the engine's testability: `src/engine/` must keep running in Node without `localStorage` or the DOM.
- A broken investment file that crashes the game. Like all content, it must be skipped and logged.

## Approaches

1. **New `investments` content type, one file per investment (chosen by the user).** `registerInvestment(...)` in the registry, files in `src/content/investments/`, and a small engine module for balance, buying, saving and applying. It mirrors how quarter-review upgrades, power-ups and events already work.
2. **One hard-coded table in a single engine file.** Faster to write, but every new investment means editing engine code, which breaks the "one file plus one line" rule.
3. **Reuse the quarter-review upgrade registry with a `permanent: true` flag.** The least new code, but the two kinds differ in currency (Coins vs Capital), timing (mid-run vs run start) and screen, so filtering would be needed everywhere.

Option 1 was picked because it matches the rest of the project.

## Decided with the user

- **Theme:** after a loss you find new investors, and they give a set amount of Investor Capital depending on how far you got.
- **Developer upgrades apply to all developers at once.**
- **Power-up upgrades:** effectiveness and cooldown.
- **Unlocks exist as a kind of investment.** First one: **Security training for .NET → firewall.**
- **Firewall rule:** when two .NET developers are opposite each other with only the lane between them, they build a firewall that does a small amount of damage to bugs passing through.
- **A firewall kill gives experience to both developers.**
- **Delivery:** no deadline (the 15:30 freeze doesn't apply). Build on one feature branch, on top of the latest `origin/main`.
- **Tuning targets** (approved): the firewall can be afforded after about **3 runs**, the whole catalog after about **20–25 runs**, and a fully upgraded player in `scripts/sim.mjs` **still loses in Year 2 or 3**. Costs, bonuses and the capital formula below are starting values, adjusted until the sim meets these targets. The plan includes a sim mode that takes an investment profile (none / fully maxed) and reports where the run ends.

## Design

### Earning Investor Capital

Paid once, when the game is lost (`game:lost`). `s = game.sprint` (sprints cleared):

```
capital = s  +  5 * floor(s / 7)  +  15 * floor(s / 28)
           per sprint   per quarter        per year
```

Examples: dying in Q1 Sprint 5 (s = 4) earns 4, dying in Q2 Sprint 3 (s = 9) earns 14, and reaching Year 2 (s = 28) earns 28 + 20 + 15 = 63. *(My call; tune with `scripts/sim.mjs`.)*

- The `?demo=1` mode earns nothing. *(My call: it's a testing shortcut.)*
- The game-over screen shows **"New investors put in +X Investor Capital"** and the new balance.

### Persistence

- One `localStorage` key, `dtc-investments`: `{ capital: number, levels: { [investmentId]: number } }`.
- Every read and write goes through try/catch, and an empty or broken value means `{ capital: 0, levels: {} }`, as `recordBest` does today.
- The engine module takes a storage object (default: `globalThis.localStorage` when it exists, otherwise an in-memory store), so Node tests run without a browser.

### Registry and content shape

`registerInvestment(def)`, `getInvestments()`, `getInvestment(id)` in `src/engine/registry.js`, cleared by `resetRegistry()`.

```js
{
  id, name, description,
  group: 'developers' | 'powerups' | 'unlocks',   // shop section
  maxLevel,                                        // 1 for an unlock
  getCost(level),                                  // cost of the next level (level = current level, 0-based)
  apply(game, level),                              // called once at run start when level > 0
  effectText?(level),                              // e.g. "+20% damage", for the shop
}
```

### Engine: `src/engine/investments.js`

- `loadProgress()` / `saveProgress()` (storage above).
- `investmentLevel(id)`, `investmentCost(id)`, `canInvest(id)`, `invest(id)`: deducts capital, raises the level, saves, emits `investment:bought`.
- `awardCapital(game)`: computes and adds capital on loss, saves, returns the amount. Called once per run (guarded by a flag on `game`).
- `applyInvestments(game)`: calls each owned investment's `apply(game, level)` with a try/catch around each one. It's called from `startGame()`, so every run (including after `restart()`) gets the bonuses.
- `resetProgress()`: a "Reset progress" button in the shop, with a confirm dialog. *(My call: needed for demos and testing.)*

### New hooks in the engine

These are the only engine changes beyond the new module. Content files then read them:

- `game.mods.devCostMultiplier` (default 1): `canPlace`/`placeDev` use `Math.round(def.cost * multiplier)`, and the hire buttons show the reduced price.
- `game.powerupMods[id] = { cooldown: 1, effect: 0 }` (default per power-up): `usePowerup`/`tickPowerups` multiply the cooldown by `cooldown`. `effect` is a level count each power-up file reads to make its effect stronger.
- `game.unlocks = {}`: unlock flags, e.g. `game.unlocks.firewall = true`.
- `game.claudeBackfireChance` (default `BACKFIRE_CHANCE`) and the Claude base cost are read from the game so investments can change them.

The power-up files (training, business, CEO) store the factor they applied on their state (`st.factor`), so `deactivate` undoes exactly what `activate` did, as the heat wave event does.

### The investment catalog (v1)

Costs are per level. *(All numbers are my calls, to be tuned.)*

| Group | Investment | Per level | Max | Costs |
|---|---|---|---|---|
| Developers | **Better laptops**: damage | +10% | 5 | 10, 20, 35, 55, 80 |
| Developers | **Agile coaching**: attack speed | +8% | 5 | 10, 20, 35, 55, 80 |
| Developers | **Bigger monitors**: range | +5% | 3 | 15, 30, 50 |
| Developers | **Recruitment network**: hiring cost | −5% | 3 | 15, 30, 50 |
| Power-ups | **Training budget**: training manager XP multiplier | ×2 → +0.25 | 3 | 10, 25, 45 |
| Power-ups | **Training planning**: training manager cooldown | −10% | 3 | 10, 25, 45 |
| Power-ups | **Sales targets**: business manager Warrant multiplier | ×2 → +0.25 | 3 | 10, 25, 45 |
| Power-ups | **Sales pipeline**: business manager cooldown | −10% | 3 | 10, 25, 45 |
| Power-ups | **Leadership coaching**: CEO attack speed | +50% → +10% | 3 | 10, 25, 45 |
| Power-ups | **CEO's calendar**: CEO cooldown | −10% | 3 | 10, 25, 45 |
| Power-ups | **Prompt engineering**: Claude backfire chance | 25% → −5 points | 3 | 15, 30, 50 |
| Power-ups | **Enterprise plan**: Claude base price | −10% | 3 | 15, 30, 50 |
| Unlocks | **Security training (.NET)**: firewall | unlock | 1 | 40 |

Claude has no cooldown, so its "effectiveness" is a lower backfire chance and its "cooldown" is a lower base price (decided in the conversation, with no objection).

Investment files: `src/content/investments/<id>.js`, one per row, each listed in the manifest.

### Firewall (unlock)

**Where a firewall forms.** The lane is one grid cell wide and every straight stretch runs along a row or a column (`src/engine/map.js`). A firewall forms when two .NET developers are:
- in the **same column, rows r−1 and r+1**, and cell (col, r) is a lane cell; or
- in the **same row, columns c−1 and c+1**, and cell (c, row) is a lane cell.

"Lane cell" means not buildable *because of the path* (not just off-map or the PROD area). Lane corners don't qualify, because they don't line up with an opposite pair. One developer can be part of several firewalls. Selling a developer removes its firewalls on the next tick, since firewalls are recomputed from the current developers (cheap: at most a few dozen developers).

```
  row 0   [.NET]
  row 1   ══════╪══════   ← lane, firewall on this cell
  row 2   [.NET]
```

**Effect.** Every bug whose position is inside a firewall cell takes **10 damage per second** (`dt`-scaled, during the wave only). Bosses take it too. It doesn't count as a counter hit (no ×2), and it isn't scaled by developer damage bonuses. *(My calls.)*

**Kill.** When firewall damage kills a bug: `killBug(game, bug, null)` (Warrants as normal), then `grantXp(game, dev, 1)` **for both developers** of that firewall (decided by the user), and each developer's `kills` goes up by 1.

**Look.** A glowing fuchsia (.NET accent `#C026D3`) bar across the lane cell between the pair, pulsing slightly, drawn under the bugs.

**Where the code lives.** `src/content/investments/security-training.js` registers the investment (`apply` sets `game.unlocks.firewall = true`) **and** a feature (`registerFeature`) whose `update` finds pairs and applies damage, and whose `draw` renders the bars. Both are gated on `game.unlocks.firewall`. That keeps the firewall in one file with one manifest line and makes it the example for future React and Java unlocks.

### Screens

**Start menu:** a second button next to Start: **"Investments · 💼 N"** (N = capital).

**Shop overlay** (from the menu and the game-over screen):

```
┌ Investments ─────────────────────── 💼 63 ┐
│ Developers                                │
│  Better laptops   +20% damage   Lv 2/5  [35] │
│  Agile coaching   +0% speed     Lv 0/5  [10] │
│  ...                                      │
│ Power-ups                                 │
│  Training budget  ×2.25 XP      Lv 1/3  [25] │
│  ...                                      │
│ Unlocks                                   │
│  Security training (.NET) — firewall  [40] │
│                                           │
│ [Reset progress]                 [Back]   │
└───────────────────────────────────────────┘
```

Buy buttons are disabled when you can't afford them or the investment is at max level. Maxed rows show "Max". The visual style reuses the quarter-review shop's classes.

**Game-over screen:** adds a line **"New investors put in +X 💼"**, then an **Investments** button next to "Hotfix and retry →".

### Tests (Node, `tests/investments.test.js`)

- The capital formula at s = 0, 4, 7, 28.
- Buying deducts capital, raises the level, respects max level and saves.
- Broken or empty storage falls back to zero.
- `applyInvestments` raises damage, fire rate, range, cost and power-up modifiers, and a throwing `apply` is skipped.
- Power-ups: cooldown is reduced, and activate → deactivate leaves `game.mods` exactly as it was.
- Firewall: a pair is detected across a horizontal and a vertical lane; no firewall without the unlock, at corners, or with only one developer; it damages a bug inside the cell; on a kill both developers get XP.
- Capital is awarded once per lost game, and not in demo mode.

### Docs

README "How it plays" gets an Investments bullet. CONTRIBUTING gets a `registerInvestment` row, the `investment:bought` event, and a note on `game.unlocks` / `game.powerupMods`.

### Smaller calls (mine)

- Level bonuses add up rather than compound: Better laptops level 3 means +30% damage, not 1.1³.
- Selling refunds 50% of what you actually paid, so a discounted hire refunds the discounted price. That is how `dev.spent` already works.
- Power-up buttons show the upgraded numbers (e.g. "×2.25 XP"), and hire buttons show the discounted price.

## Left to the builder

- The exact CSS and layout of the shop, within the existing style.
- Whether `effectText` is required or generated from the level.
- How firewall pairs are cached, if at all.
- Updating `scripts/sim.mjs` so it can run with a given investment profile, for tuning.
