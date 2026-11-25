# Drinks currency: design

## Intent

Change how money works during a run, so the board needs more attention and players lean toward mixed teams:

- **Nexios Coins are renamed to Warrants.** They work exactly as before: you earn them per sprint, per quarter and from the CAO, and you spend them on the building at the quarter review.
- **The old Warrants are removed** and replaced by three drinks, one per developer type:
  - **Coffee** buys and upgrades **Java** developers.
  - **White Monster** buys and upgrades **.NET** developers.
  - **Red Bull** buys and upgrades **React** developers.
- **Drinks are dropped, not paid out.** A squashed bug drops a drink on the board. It stays there for 10 seconds, and the player has to click it to pick it up. If nobody picks it up, it's gone.

## Goals

- Three drink balances replace the Warrant balance in every place that used it (listed under Design).
- Drops on the board are clicked to collect and disappear after 10 s.
- A mixed team grows at about today's pace if the player collects every drop.
- Adding a fourth developer type later means one drink content file plus a `drink:` field on the developer.

## Non-goals

- Changing how Nexios Coins (now Warrants) are earned or spent, the building upgrades, or Investor Capital and the investments between runs (apart from Enterprise plan, below).
- Renaming the random events "out of coffee" and "out of Red Bull". The names stay as they are (user's decision).
- Auto-collecting drops, or upgrades that collect for you.

## Anti-goals (failure even if it works)

- **The game getting much easier or much harder by accident.** Prices and rewards were set so a mixed team keeps today's pace (see Balance).
- **A drop click that also hires or selects** in the same cell.
- **Leftover old-Warrant code**, such as a `game.warrants` that secretly still means drinks, or `coins` in the code while the screen says Warrants.
- **Breaking the engine's testability.** `src/engine/` must keep running in Node.

## Approaches

1. **A drink wallet driven by content (chosen).** Each developer file names its drink, `game.drinks = { coffee, monster, redbull }` holds the balances, and shared helpers handle every purchase, refund, reward, theft and multiplier. A drink content file per drink holds its name, colour and icon. This follows the content-registry pattern the project already uses for developers, bugs and power-ups.
2. **Three hardcoded fields** (`game.coffee`, ...). Quicker to write, but every place money is used needs a three-way branch, and adding a new developer type breaks it.

Option 1 was chosen.

## Decided with the user

- Coins → Warrants (rename only). The old Warrants become three drinks, each tied to one developer type.
- **Every bug drops one random drink** (rule C). The drop isn't tied to which developer counters the bug or which one squashed it.
- **Balance A′:** each drop gives the bug's current `reward` (× multipliers) in that random drink. **Developer and upgrade prices stay as they are**, now priced in the developer's own drink. A run starts with **100 of each drink**.
- **Power-ups are free** and only have a cooldown.
- **The sprint-end bonus and task rewards** pay drinks. **Phishing theft** takes drinks.
- **Azure Function** is billed in White Monster.
- **The yearly review** (+10% / +20%) multiplies drink gains.
- **Selling a developer** refunds 50% of what was spent on it, in that developer's drink.
- **Drops last 10 s.**

## Design

### Drinks

A new content type, `registerDrink({ id, name, color, icon })`, in `src/content/drinks/` with three files (`coffee`, `monster`, `redbull`) plus manifest lines. Each developer gets `drink: 'coffee' | 'monster' | 'redbull'` (Java, .NET, React).

`game.drinks` is created from the registered drinks when a run starts, each at `START_DRINKS = 100`. Engine helpers (in `game.js` or a new `src/engine/drinks.js`):

- `addDrink(game, id, amount)`: adds to the balance and to `stats.drinksCollected`.
- `canAfford(game, id, amount)` and `spendDrink(game, id, amount)`.
- `drinkFor(typeId)`: the drink a developer type uses.

`game.warrants` (old meaning) and `mods.warrantMultiplier` are removed. `mods.warrantMultiplier` becomes `mods.drinkMultiplier` and applies to all drinks.

### Drops

- `killBug` no longer pays. It pushes a drop onto `game.drops`: `{ id, x, y, drink, amount, ttl: 10 }`. The position is where the bug died, with a little jitter so drops from a crowd don't stack exactly. The drink is picked with `game.random()`, so seeded tests stay deterministic. `amount = round(reward × mods.drinkMultiplier)`, with a minimum of 1.
- **The boss (security risk)** drops **three** drops, one of each drink, with `reward / 3` each (10 each at today's 30). *(My call: all three at full reward would triple the boss payout.)*
- Kills by Claude, firewalls and every other source drop drinks the same way.
- `tickDrops(game, dt)` counts the ttl down and removes expired drops. It runs on game time in the `wave` and `bell` phases, so pause freezes it and fast-forward speeds it up. Drops still on the board when an ordinary sprint ends stay and keep counting down through the bell (the bell overlay lets clicks through). A new run or a loss clears them.
- **The quarter review waits for the board to clear (user's decision).** On the last sprint of a quarter, `checkEnd` doesn't end the sprint until there are no bugs **and no drops** left, whether they were picked up or expired. The phase stays `wave` until then, so the review screen (and the yearly review) never covers live drops. A short hint such as "Grab the drops: quarter review in 7 s" is the builder's call. *(My call: the hold only applies at quarter end. Ordinary sprints go to the bell straight away as today.)*
- **Picking up:** `pickDrop(game, x, y)` finds the nearest drop within its click radius, adds its amount and removes it. Emits `drop:collected`. In `input.js`, this check runs **before** the existing select and hire logic, and a successful pick stops the click there (shift-hire is not triggered).
- **No pickups while paused (user's decision).** The click handler skips `pickDrop` when `app.view.paused` is set. Hiring and selecting during a pause keep working as today.
- **Rendering:** the drop is drawn on the canvas as the drink's icon in its colour, with a short pop when it lands. It blinks for its last 3 s. Picking one up plays a sound and floats a "+N" text in the drink's colour. *(The look is the builder's call. Keep it readable next to the bugs.)*

### Everything that used the old Warrants

| Place | Now |
|---|---|
| Hire (`devs.js`) | Costs `hireCost` in the developer's drink. Recruitment network still lowers it. |
| Developer upgrades | Cost in the developer's drink. A failed check's reason is `'drink'`, and the popover says "Needs 25 Coffee". |
| Sell | Refunds `floor(dev.spent × 0.5)` in the developer's drink. |
| Azure Function | 1 White Monster per 0.5 s. Stops at 0 with no debt, as today. |
| Power-ups | No cost. `getCost` and `powerupCost` are removed, and `canUse` checks only the phase, cooldown and `canActivate`. |
| Claude | Gets `cooldown: 90`. The price growth, `BASE_COST` and `COST_GROWTH` are removed. |
| Enterprise plan (investment) | Becomes "Claude comes back sooner: −10% cooldown per level", applied to `powerupMod('claude').cooldown`. |
| Business manager | ×2 (+0.25 per Sales targets level) on `mods.drinkMultiplier`: "Double drinks". Sales targets text is updated to match. |
| Yearly review | ×1.1 / ×1.2 on `mods.drinkMultiplier`. `game.raise` stays as the running total. The banner reads "Drinks +10%". |
| Sprint-end bonus | `20 + 5 × sprint`, split evenly over the three drinks (each `ceil(bonus / 3)`). Not multiplied, as today. |
| Task rewards (mailbox) | `reward` split evenly over the three drinks (`ceil(reward / 3)` each). The row shows "+20 each" (or icons). |
| Free Claude task reward | The voucher now **resets Claude's cooldown**. It can be used while Claude is cooling down, and the mailbox wrap moves from `getCost` to the cooldown check in `canUse` / `usePowerup`. |
| Phishing "stolen" | Takes `ceil(amount / 3)` from each drink, floored at 0. A free-Claude phish takes `CLAUDE_STEAL = 100` the same way. The banner reads "34 of each drink gone". |
| Stats / game over | `warrantsEarned` → `drinksCollected` ("Drinks collected"). |
| Debug cheat (`main.js:96`) | Sets every drink to 1000. |
| `example-feature.js` | Pizza gives drinks, and Standing desks gives +5 starting drinks of each kind per level. |

### Coins → Warrants rename

In code and on screen: `game.coins` → `game.warrants`, `CAO_COINS` → `CAO_WARRANTS`, "Nexios Coins" / "coins" → "Warrants" in the HUD, side panel (`sp-coins` class too), quarter review, yearly review, sprint-cleared line, how-to-play and README. Upgrade logic (`upgrades.js`) is otherwise unchanged.

### HUD and UI

- The HUD's single Warrants stat is replaced by three drink counters (icon + number, in drink colours). The old Coins stat becomes **Warrants**.
- Hire buttons show their price with the drink icon. The "poor" state checks that drink.
- Power-up buttons show only their cooldown (no price).
- How-to-play: "Earn Warrants" → "Grab drinks: squashed bugs drop Coffee, White Monster or Red Bull. Click them within 10 s. Each developer is paid in its own drink."

### Balance

Today N Warrants of bug rewards buys N worth of anything. Now N arrives as about N/3 of each drink at the same prices, so **a mixed team (spending all three) keeps today's pace, and a team of one developer type grows about 3× slower.** Missed drops make it harder still. Starting with 100 of each lets you hire two React developers straight away (Changed from 50 after the final review: with 50, sprint 1 drops (~4 per drink) left nothing affordable for sprint 2; 100 each restores today's pace in the sim.) Java (75) and .NET (110) need a few pickups first.

`scripts/sim.mjs` needs a pickup model, since it can't click: collect each drop with a configurable chance (default 100%, plus a run at about 70%) after a short delay. Retuning the numbers isn't part of this work, but the sim output before and after goes in the PR so the change in difficulty is visible.

### Order of work

One branch, two steps, with tests green after each:

1. Remove the old Warrants and rename Coins → Warrants (power-ups free, Claude cooldown, and so on). Temporarily nothing costs anything, or a placeholder holds the old balance.
2. Add drinks, drops, pickup, HUD and the mailbox/phishing/sell/Azure changes.

### Tests

Update every test that touches `warrants` or `coins`. New tests:

- A kill makes one drop with a seeded random drink and the right amount. The multiplier applies.
- The boss drops three drops, one of each drink.
- A drop expires after 10 s of game time and survives a pause.
- At quarter end, the review doesn't open while a drop is still on the board, and opens once the last one is picked up or expires.
- A click while paused doesn't pick anything up.
- `pickDrop` adds to the right balance, and a click in an empty spot doesn't pick anything up.
- Hire, upgrade and sell use the developer's drink. You can't hire with the wrong drink.
- Power-ups need no balance. Claude respects its cooldown, and the voucher resets it.
- The sprint bonus, task rewards and phishing split over the three drinks and never go below 0.
- Azure stops when White Monster runs out.

## Left to the builder

- The drink icons and the drop animation (readable, on-brand, distinct at small size).
- The click radius of a drop (generous enough to hit on fast-forward).
- Whether drink helpers live in `game.js` or a new `drinks.js`.
- The exact HUD layout of three counters, as long as it fits next to Lives / Sprint / Warrants.
- Updating README, CONTRIBUTING (new drink content type) and REGRET if something breaks.
