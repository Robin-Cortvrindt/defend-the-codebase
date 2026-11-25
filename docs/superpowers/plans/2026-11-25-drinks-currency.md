# Drinks Currency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old Warrants with three drinks (Coffee/Java, White Monster/.NET, Red Bull/React) that bugs drop on the board and the player clicks to collect, rename Nexios Coins to Warrants, and make power-ups free with cooldowns only.

**Architecture:** A new `drinks` content type (registry + `src/content/drinks/*`) and a wallet in `src/engine/drinks.js` (`game.drinks = { coffee, monster, redbull }`) used by every purchase, refund, reward, theft and multiplier. Drops live in `game.drops`, managed by `src/engine/drops.js` (spawn on kill, tick, collect, click hit-test). After Task 5 the old `game.warrants` is gone, so Task 6 renames `game.coins` → `game.warrants`.

**Tech Stack:** Plain ES modules, canvas rendering, `node --test` (run with `npm test`).

**Spec:** `docs/superpowers/specs/2026-11-25-drinks-currency-design.md`

## Global Constraints

- Work on branch `feat/drinks-currency` from `main`. `npm test` is green after every task. Baseline: 221 passing.
- `src/engine/` stays DOM-free and runs in Node. The one exception is the existing `ui.js` / `input.js` / `render.js` / `menu.js`.
- Drinks: `coffee` → Java (`'Coffee'`), `monster` → .NET (`'White Monster'`), `redbull` → React (`'Red Bull'`).
- `START_DRINKS = 50` of each drink. Developer and upgrade prices are unchanged numbers, paid in the developer's own drink.
- `DROP_TTL = 10` s of game time. A drop blinks for its last 3 s. Drops tick only in `wave` and `bell`.
- A normal bug drops 1 random drink (`game.random()`) worth `max(1, round(reward × mods.drinkMultiplier))`. The boss (`def.boss`) drops one of **each** drink worth `max(1, round(reward × mods.drinkMultiplier / nDrinks))`.
- Sprint bonus `20 + 5 × (sprint+1)`, task rewards and phishing theft are split as `ceil(total / nDrinks)` of each drink. Theft floors each drink at 0. Sprint bonus and task rewards are **not** multiplied.
- Sell refunds `floor(dev.spent × 0.5)` in the developer's drink. Azure bills 1 White Monster per 0.5 s, with no debt.
- Power-ups cost nothing. Claude `cooldown: 90`. Enterprise plan: −10% Claude cooldown per level. A free-Claude voucher lets Claude fire during its cooldown.
- `mods.warrantMultiplier` → `mods.drinkMultiplier`. Business manager ×(2 + 0.25·level) and yearly review ×1.1 / ×1.2 act on it.
- Quarter end (last sprint of a quarter): `checkEnd` waits until there are no bugs **and** no drops.
- No pickups while `app.view.paused`.
- Nexios Coins → **Warrants** everywhere (code: `game.coins` → `game.warrants`, `CAO_COINS` → `CAO_WARRANTS`). The random event names are unchanged.
- Copy: the HUD drink counters use the drink names. The upgrade popover says `Needs ${cost} ${drinkName}`. The yearly review says "Drinks +10%" / "Drinks +20%".

## Review Focus

1. Claude squashes a crowd at once, so many drops land on top of each other. One click must collect exactly **one** drop (the nearest one), not several and not zero.
2. Balances never go negative: phishing theft when a drink is below its share, Azure at 0 White Monster, and selling after a balance hits 0.
3. Sell after an upgrade refunds half of hire + upgrade **in the developer's drink**, and other drinks are untouched.
4. The quarter-end hold must release on its own. If the player ignores the drops, the review opens once they expire. It must also never hold an ordinary sprint.
5. A new run, quit or loss with drops still on the board leaves no drops behind. A drop from the previous run can't be clicked in the next one.

Each of these has a test in the task that owns the code (Tasks 2, 4, 7).

---

### Task 1: Drinks content type and wallet

**Files:**
- Modify: `src/engine/registry.js` (add `drinks` map, `registerDrink`, `getDrinks`, `getDrink`, clear in `resetRegistry`)
- Create: `src/engine/drinks.js`
- Create: `src/content/drinks/coffee.js`, `src/content/drinks/monster.js`, `src/content/drinks/redbull.js`
- Modify: `src/content/manifest.js` (drinks block **above** developers), `src/main.js` `CORE` list (add the 3 drink files first)
- Modify: `src/content/developers/java.js` (`drink: 'coffee'`), `dotnet.js` (`drink: 'monster'`), `react.js` (`drink: 'redbull'`)
- Create: `tests/helpers/drinks.js`, `tests/drinks.test.js`

**Interfaces:**
- Produces (`src/engine/drinks.js`):
  - `START_DRINKS = 50`
  - `startingDrinks(): Record<string, number>`: every registered drink at `START_DRINKS`
  - `drinkFor(typeId: string): string | undefined`: `getDeveloper(typeId)?.drink ?? getDrinks()[0]?.id` (the fallback keeps test developers without `drink` working)
  - `drinkName(id: string): string`: `getDrink(id)?.name ?? id`
  - `addDrink(game, id, amount: number): void`: adds and counts into `game.stats.drinksCollected`
  - `canAfford(game, id, amount): boolean` and `spendDrink(game, id, amount): boolean` (false and no change when short)
  - `addEachDrink(game, total): number`: gives `ceil(total / n)` of each and returns that per-drink amount
  - `takeEachDrink(game, total): number`: takes `ceil(total / n)` from each, floored at 0, and returns that per-drink amount
  - `randomDrink(game): string | null`: `ids[Math.floor(game.random() * ids.length)]`
- Produces (`tests/helpers/drinks.js`): `registerTestDrinks()` registers `coffee`, `monster`, `redbull` (name/color/icon) for engine tests.
- Drink defs: `{ id, name, color, icon }`. Suggested defaults: coffee `#92400E` ☕, monster `#64748B` "M", redbull `#2563EB` "R". The look is the builder's call.

- [ ] **Step 1: Create the branch.** `git checkout -b feat/drinks-currency`
- [ ] **Step 2: Write failing tests** in `tests/drinks.test.js` (beforeEach: `resetRegistry(); registerTestDrinks();` and register a developer `{ id: 'j', drink: 'coffee', ... }` and one with no drink):
  - `startingDrinks` → `{ coffee: 50, monster: 50, redbull: 50 }`
  - `drinkFor('j') === 'coffee'`, and a developer without `drink` → `'coffee'` (the first registered one)
  - `spendDrink(g,'coffee',60)` with 50 → `false`, balance still 50. `spendDrink(g,'coffee',30)` → `true`, balance 20.
  - `addEachDrink(g, 35)` returns 12 and each drink goes +12. `stats.drinksCollected` grows by 36.
  - `takeEachDrink(g, 100)` with coffee 10 / monster 50 / redbull 50 → returns 34 and leaves coffee 0, monster 16, redbull 16
  - `randomDrink` with `g.random = () => 0.99` → `'redbull'`, with `() => 0` → `'coffee'`
- [ ] **Step 3: Run** `node --test tests/drinks.test.js`. Expected: FAIL (module not found).
- [ ] **Step 4: Implement** the registry additions, `drinks.js`, the three content files, the manifest/CORE lines and the developer `drink` fields. Add `drinksCollected: 0` to `stats` in `createGame` (keep `warrantsEarned` for now).
- [ ] **Step 5: Run** `npm test`. Expected: all pass (221 + new).
- [ ] **Step 6: Commit** `feat: drinks content type and wallet`

### Task 2: Pay for developers in their drink

**Files:**
- Modify: `src/engine/game.js` (`createGame`: `drinks: startingDrinks()`, remove `START_WARRANTS` and the `warrants` field)
- Modify: `src/engine/devs.js` (`canPlace`, `placeDev`, `sellDev`, `upgradeStatus`, `buyUpgrade`)
- Modify: `src/content/developers/dotnet.js` (Azure billing)
- Modify: `src/engine/ui.js` (hire button `poor` + price label with drink icon, upgrade line `Needs ${up.cost} ${drinkName(drinkFor(dev.type))}`, sell label `Sell +N <drink>`)
- Modify: `src/main.js` (demo: every drink 1000)
- Modify tests: `tests/devs.test.js`, `tests/dev-upgrades.test.js`, `tests/firewall.test.js`, `tests/full-stack-squad.test.js`, `tests/garbage-collection.test.js`, `tests/cross-functional.test.js`, and any other test that sets `g.warrants` to afford hires. Call `registerTestDrinks()` in beforeEach and set/read `g.drinks.<id>`.

**Interfaces:**
- Consumes: Task 1 `drinkFor`, `canAfford`, `spendDrink`, `addDrink`, `startingDrinks`, `drinkName`.
- Produces: `upgradeStatus` failure reason `'drink'` (was `'warrants'`). `emit('dev:sold', { game, dev, refund, drink })`.
- Note: other `game.warrants` uses (killBug, sprint bonus, power-ups, mailbox) keep working against a **temporary** `warrants: 100` field. Leave that field in `createGame` until Task 5 removes it, with a `// removed in Task 5` comment.

- [ ] **Step 1: Write failing tests** (in `tests/devs.test.js` and `tests/dev-upgrades.test.js`, developers with `drink: 'coffee'` and `drink: 'redbull'`):
  - Hiring a coffee developer (cost 50) takes coffee 50 → 0, and redbull stays at 50
  - With coffee 49, the hire is refused and balances are unchanged. With coffee 0 and redbull 999 it is still refused (wrong drink)
  - `upgradeStatus` with too little of the developer's drink → `{ ok: false, reason: 'drink' }`
  - **Review Focus 3:** hire (50) + upgrade (40), then `sellDev` returns `45` and coffee goes up by 45, other drinks unchanged
  - **Review Focus 2:** Azure with monster 1 bills once and stops at 0. `dev.state.bill` resets, monster never goes below 0, and the update returns `false` at 0
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** The Azure `update` uses `game.drinks.monster` the same way it used `game.warrants`.
- [ ] **Step 4: Run** `npm test`. Expected: all pass. Fix the old tests that asserted `g.warrants` after a hire or sell by switching them to drinks.
- [ ] **Step 5: Commit** `feat: hire, upgrade, sell and Azure use the developer's drink`

### Task 3: Earn drinks (direct pay, before drops) and drink multiplier

**Files:**
- Modify: `src/engine/game.js` (`mods.warrantMultiplier` → `mods.drinkMultiplier`, keep `addWarrants` exported for now because `mailbox.js` still imports it (Task 4 removes both), `killBug` pays via a new `payKill(game, def)` from `drops.js`, sprint bonus via `addEachDrink`, yearly review multiplies `drinkMultiplier`, banner text "Drinks +10%" / "Drinks +20%", `stats.warrantsEarned` removed)
- Create: `src/engine/drops.js` with `payKill` only (Task 7 turns it into a drop)
- Modify: `src/content/powerups/business-manager.js` (`drinkMultiplier`, description `'Double drinks'`, describe `×N drinks`), `src/content/investments/sales-targets.js` (text: drinks)
- Modify: `src/engine/ui.js` (sprint-cleared eyebrow `+${each} of each drink · +1 coin` (Task 6 renames coin), game-over stat `Drinks collected` from `stats.drinksCollected`, yearly review choice copy "Drinks +10%/+20%")
- Modify tests: `tests/game.test.js`, `tests/powerups.test.js`, `tests/investments.test.js` (anything on `warrantMultiplier` / `addWarrants`)

**Interfaces:**
- Produces: `payKill(game, def): void` in `src/engine/drops.js`. For now it adds directly: a normal bug gives `randomDrink` × `max(1, round(reward × drinkMultiplier))`, and a `def.boss` bug gives every drink `max(1, round(reward × drinkMultiplier / n))`. No drinks registered → no-op.
- Produces: `mods.drinkMultiplier` (number, default 1).

- [ ] **Step 1: Write failing tests** in `tests/game.test.js`:
  - Kill a reward-3 bug with `g.random = () => 0` → coffee +3. With `drinkMultiplier = 2` → coffee +6
  - Kill a reward-1 bug with `drinkMultiplier = 0.4` → +1 (minimum 1)
  - Kill a `boss: true` reward-30 bug → each drink +10
  - Clear sprint 1 (bonus `20 + 5×1 = 25`) → each drink `+9`
  - `chooseYearReview(g, 'accept')` → `g.mods.drinkMultiplier` ≈ 1.1
- [ ] **Step 2: Run** `npm test`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: bugs and sprint bonus pay drinks; multipliers act on drinks`

### Task 4: Mailbox rewards and phishing in drinks

**Files:**
- Modify: `src/content/features/mailbox.js` (`payReward` → `addEachDrink`, `steal` → `takeEachDrink`, reward text `+${ceil(n/3)} each`, claim banner `+N of each drink`, steal banner ``That wasn't ${from}. ${each} of each drink gone.``. Remove the `addWarrants` import)
- Modify: `src/engine/game.js` (delete `addWarrants`, which now has no callers)
- Modify: `tests/mailbox.test.js`

**Interfaces:**
- Consumes: Task 1 `addEachDrink`, `takeEachDrink`. `stealAmount(mail)` stays as the **total** (`CLAUDE_STEAL = 100` for a Claude mail).

- [ ] **Step 1: Write failing tests:**
  - Claiming a real 60-reward task → each drink +20
  - **Review Focus 2:** the steal penalty on a 60-reward mail with redbull at 5 → redbull 0, coffee and monster −20
  - A phished free-Claude mail takes 34 of each
- [ ] **Step 2: Run** `node --test tests/mailbox.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: task rewards and phishing theft use drinks`

### Task 5: Free power-ups, Claude cooldown, voucher skips cooldown

**Files:**
- Modify: `src/engine/powerups.js` (remove `powerupCost` and the `cost` field in `powerupMod`. `canUse` drops the balance check and allows `st.cooldownLeft > 0` when `def.skipCooldown?.(game)` is true. `usePowerup` emits `powerup:activated` with `{ game, id, skippedCooldown: boolean }`)
- Modify: `src/content/powerups/claude.js` (`cooldown: 90`, remove `getCost`, `BASE_COST`, `COST_GROWTH`)
- Modify: `src/content/investments/enterprise-plan.js` (description `'Claude comes back sooner: -10% cooldown per level'`, `apply` → `powerupMod(game,'claude').cooldown *= 1 - 0.10 * level`, effectText `Claude -N% cooldown`)
- Modify: `src/content/features/mailbox.js` (`wrapClaude` sets `def.skipCooldown = g => g.mailbox?.vouchers > 0`. The listener decrements a voucher only when `skippedCooldown`)
- Modify: `src/engine/ui.js` (power-up cards: no price, ready text `ready` / `during waves`)
- Modify: `src/engine/game.js` (**remove the temporary `warrants` field**)
- Modify: `src/content/features/example-feature.js` (Pizza: `addEachDrink(game, 25)`, hint `+9 of each drink`. Standing desks: `+5 × level` of each drink at run start, effect text `+N starting drinks each`. The price comment says "price in the developer's drink". This must happen here: after Task 6, `game.warrants` means the renamed Coins, and old code would silently pay the wrong currency)
- Modify tests: `tests/powerups.test.js`, `tests/mailbox.test.js`, `tests/investments.test.js`

**Interfaces:**
- Produces: optional power-up hook `skipCooldown(game): boolean`.

- [ ] **Step 1: Write failing tests:**
  - With every drink at 0, `usePowerup(g,'ceo')` during a wave → `true`
  - Claude: use it, then `canUse` is false. After `tickPowerups(g, 90)` it is true again
  - Enterprise plan level 2 → `effectiveCooldown(g,'claude') === 72`
  - Voucher: Claude on cooldown with `mailbox.vouchers = 1` → `usePowerup` true and vouchers 0. Using Claude **off** cooldown with a voucher leaves vouchers at 1
  - `grep -rn "game.warrants\|g.warrants" src` returns nothing (manual check in Step 4)
- [ ] **Step 2: Run** `npm test`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` and `grep -rn "warrants" src tests`. Expected: all pass, and no old-Warrant uses are left (`Coins` hasn't been renamed yet).
- [ ] **Step 5: Commit** `feat: power-ups are free with cooldowns; Claude 90 s; voucher skips cooldown`

### Task 6: Rename Nexios Coins to Warrants

**Files:**
- Modify: `src/engine/game.js` (`coins` → `warrants`, `CAO_COINS` → `CAO_WARRANTS`, banners `CAO +10 Warrants`)
- Modify: `src/engine/upgrades.js` (`game.coins` → `game.warrants`, comments)
- Modify: `src/engine/ui.js` (HUD stat label `Warrants`, ref `refs.warrants`, quarter review `${g.warrants} Warrants`, CAO copy, sprint-cleared `+1 Warrant`)
- Modify: `src/content/features/side-panel.js` (`buildingInfo` key `warrants`, label `'Warrants'`, class `sp-warrants`) + matching CSS selector in `style.css`
- Modify: `src/engine/menu.js` (how-to-play: `['Quarterly review', 'Every 7 sprints, spend Warrants on the building.']`)
- Modify tests: `tests/upgrades.test.js`, `tests/counter-upgrades.test.js`, `tests/side-panel.test.js`, `tests/game.test.js`

- [ ] **Step 1: Rename the tests first** (`g.coins` → `g.warrants`, `info.coins` → `info.warrants`, `CAO_COINS` → `CAO_WARRANTS`). Run `npm test`. Expected: FAIL.
- [ ] **Step 2: Rename the code.**
- [ ] **Step 3: Run** `npm test` and `grep -rni "coin" src tests style.css`. Expected: all pass. The only "coin" hits left are unrelated words, if any.
- [ ] **Step 4: Commit** `refactor: Nexios Coins are now called Warrants`

### Task 7: Drops on the board

**Files:**
- Modify: `src/engine/drops.js` (`payKill` → `dropDrinks`, plus tick/collect/pick)
- Modify: `src/engine/game.js` (`createGame` + `startGame`: `drops: []`. `killBug` calls `dropDrinks(game, bug, def)`. `step` calls `tickDrops` in `wave` and `bell`. `checkEnd` quarter hold. `loseRun` clears drops)
- Create: `tests/drops.test.js`. Update the Task 3 tests that expected direct pay (they now collect the drop first).

**Interfaces:**
- Produces (`src/engine/drops.js`):
  - `DROP_TTL = 10`, `BLINK_AT = 3`, `PICK_RADIUS = 20` (logical px)
  - `dropDrinks(game, bug, def): Drop[]`: same amounts as Task 3's `payKill`, but pushes `{ id: game.nextId++, x, y, drink, amount, ttl: DROP_TTL }` at the bug's position plus jitter of ±8 px from `game.random()`, and emits `drop:spawned` `{ game, drop }`
  - `tickDrops(game, dt): void`
  - `collectDrop(game, drop): boolean`: `addDrink`, removes it, emits `drop:collected` `{ game, drop }`, adds a `pop` effect `+N` in the drink colour
  - `pickDrop(game, x, y): Drop | null`: only in `wave` / `bell`. Picks the **nearest** drop within `PICK_RADIUS` and collects it
  - `clickDrop(game, view, x, y): Drop | null`: `null` when `view.paused`, otherwise `pickDrop`

- [ ] **Step 1: Write failing tests** in `tests/drops.test.js`:
  - Killing a reward-3 bug adds 1 drop `{ drink: 'coffee', amount: 3, ttl: 10 }` (seeded random). Balances are unchanged until it's collected
  - The boss kill → 3 drops, one per drink, 10 each
  - `tickDrops(g, 9.9)` keeps it, `tickDrops(g, 0.2)` removes it, and the balance is unchanged
  - Pause: `clickDrop(g, { paused: true }, x, y)` → `null`, the drop stays. With `{ paused: false }` → collected and coffee +3
  - A click 25 px away picks nothing
  - **Review Focus 1:** two drops 4 px apart, one click → exactly one collected (the nearer one), one left
  - **Review Focus 4:** at the last sprint of a quarter (`g.sprint = 6`), clearing the bugs with a drop still on the board keeps `phase === 'wave'`. After `step` for 10 s the phase becomes `'review'`. An ordinary sprint (`g.sprint = 0`) with a drop on the board goes to `'bell'` straight away, and the drop survives into `bell`
  - **Review Focus 5:** `quitRun(g)` / loss → `g.drops` is empty. `startGame` on a fresh `createGame()` → `drops` is `[]`
- [ ] **Step 2: Run** `node --test tests/drops.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement.** Quarter hold in `checkEnd`: after the bugs/queue check, `if (sprintInfo(game.sprint).sprint === SPRINTS_PER_QUARTER && game.drops.length) return;`
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: bugs drop drinks that must be clicked within 10 s`

### Task 8: Drops on screen: click, draw, HUD counters

**Files:**
- Modify: `src/engine/input.js` (at the top of the canvas click handler, after the phase check: `if (clickDrop(g, app.view, x, y)) return;`)
- Modify: `src/engine/render.js` (`drawDrops(ctx, game)` above bugs and below effects: a circle in the drink colour with its icon, a pop-in scale for the first 0.2 s, blinking when `ttl < BLINK_AT`)
- Modify: `src/engine/ui.js` (replace the HUD Warrants-drinks stat with three counters `icon + number` in drink colours. The `raise` badge sits next to them. Hire buttons show the drink icon next to the price)
- Modify: `src/main.js` (`on('drop:collected', () => playSound('mail'))` or another existing short sound)
- Modify: `style.css` (counter styles)
- Modify: `src/engine/menu.js` (how-to-play step: `['Grab drinks', 'Squashed bugs drop Coffee, White Monster or Red Bull. Click them within 10 s. Each developer is paid in its own drink.']`)

- [ ] **Step 1: Run** `npm test`. Expected: all pass (no engine change).
- [ ] **Step 2: Manual check:** serve with `npx serve .` (or the project's usual static server) and open `/?demo=1`:
  - drops appear where bugs die, blink near the end and vanish after 10 s
  - a click collects one, `+N` floats up, and the counter rises
  - a click on a drop over a developer doesn't select the developer, and shift-hire doesn't trigger
  - pause, then click a drop → nothing. Resume → it can be collected
  - at the end of sprint 7 the review waits until the last drop is gone
- [ ] **Step 3: Commit** `feat: draw drops, click to collect, drink counters in the HUD`

### Task 9: Sim pickup model, README and CONTRIBUTING

**Files:**
- Modify: `scripts/sim.mjs` (listen to `drop:spawned`. With probability `PICKUP` (flag `--pickup 0.7`, default 1) schedule `collectDrop` 1 s later. `buy()` uses `canAfford(g, drinkFor(type), hireCost(g, type))`)
- Modify: `README.md` (currency section, power-ups free, tasks/phishing in drinks, Coins → Warrants), `CONTRIBUTING.md` (new `drinks` content type, `drink:` on developers)

- [ ] **Step 1:** Run `node scripts/sim.mjs` on `main` (git stash or a worktree) and on the branch at `--pickup 1` and `--pickup 0.7`. Save the three outputs for the PR.
- [ ] **Step 2: Run** `npm test`. Expected: all pass.
- [ ] **Step 3: Commit** `docs: drinks in README and CONTRIBUTING; sim pickup model`
