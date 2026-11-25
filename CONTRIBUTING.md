# Adding to Defend the Codebase

**The rule: one new file plus one line in `src/content/manifest.js`.** To add an upgrade, edit your developer's own file. Don't edit `src/engine/` to add content. A file that fails to load is skipped and logged in the browser console, so it can't take the game down. Your feature just won't show up.

Start from `src/content/features/example-feature.js`. It has a working example of every type.

## Run and test

```
python -m http.server 8000     # then open http://localhost:8000
node --test                    # engine tests (Node 20+)
node scripts/sim.mjs           # bot plays until production goes down; --profile max / --meta for investments
node scripts/sim-upgrades.mjs [seeds] [sprints]   # developer-upgrade balance: seeded strategies per level-3 branch
# sim.mjs also takes --trials N (default 30): seeded trials per row, prints mean / median / p10 of sprints cleared
# both sims take --pickup <p> (default 1): the bot collects each drop with chance p, 1 s after it appears
# sim.mjs --trojan: the bot summons a Trojan horse at every bell it can afford; prints squashed / leaked % and net drinks per horse
```

Handy URL: `http://localhost:8000/?demo=1` starts wave 1 with one developer of each type and 1000 of each drink. In the browser console, `game.game` is the live state, e.g. `game.game.drinks.coffee = 9999` (`game.game.warrants` is the building currency).

## What you can register (`src/engine/registry.js`)

| Call | Shape |
|---|---|
| `registerDrink` | `{ id, name, color, icon, drawIcon?(ctx, size) }`: a drink that bugs drop and developers are paid in (`src/content/drinks/`, one file and one manifest line, e.g. `coffee.js`). `drawIcon` draws it centred on (0, 0), `size` px across, on the map drops, the HUD and cost labels (`drawCanLid` and `drawCupTop` in `src/engine/drink-icons.js` draw the current ones). Without it you get a disc in `color` with `icon`, a short emoji or text. Each drink starts at 100 per run |
| `registerDeveloper` | `{ id, name, accent, drink /*drink id: what this developer costs and sells in*/, blurb, cost, damage, fireRate, range /*cells*/, counters /*bug id*/, drawIcon(ctx, size, dev?, time?), drawAttack?(ctx, { from, to, progress /*0→1*/, time, seed, shot, counter, tipsy, accent }), attackDuration? /*s, default 0.12*/, attackHitAt? /*0..1, when it lands, default 0*/, attackJolt? /*px the bug is knocked back on screen when it lands*/, levelName?, modifyStats?(game, dev, stats), upgrades? }` (see Developer upgrades). `dev`/`time` are only given on the board. Damage lands at once; `drawAttack` is only the animation, and `to` follows the bug. `tipsy` is true for a shot fired during the wine tasting: draw it along `zigzagPoint(from, to, s, seed, amp)` from `src/engine/zigzag.js`. Without `drawAttack` you get a straight beam (see `src/content/developers/java.js`) |
| `registerBug` | `{ id, name, ring, radius, hp, speed /*px/s*/, livesLost, reward, legs?, boss?, onHit?, onDeath?, update?(bug, game, dt), drawIcon?(ctx, radius, bug), draw?(ctx, radius, bug, time) }`. Set `bug.radius` in `update` to draw one bug bigger or smaller than `radius`. `draw` replaces the default oval: draw at the origin facing right (+x), the game turns it the way the bug walks; keep the `ring` colour the main colour so players can see who counters it. `drawBugLegs` in `render.js` gives you walking legs (see `src/content/bugs/nullpointer.js`) |
| `registerPowerup` | `{ id, name, description, duration /*s, 0 = instant*/, cooldown /*s; power-ups are free, the cooldown is the only limit*/, canActivate?(game), describe?(game) /*button text, overrides description*/, activate(game, st), deactivate?(game, st) }` |
| `registerFeature` | `{ id, init?(game), update?(game, dt), draw?(ctx, game), hudButtons?: [{ label, hint, onClick(game) }], bellActions?: [{ id, label(game), hint?(game), cost?(game) /*{ drinkId: amount }, shown with drink icons*/, enabled(game), onClick(game) }] }`. `bellActions` are buttons on the victory bell card and the quarter-review bell (not while the yearly review is open); the card re-renders after a click (`src/engine/bell.js`, used by `src/content/features/trojan-horse.js`) |
| `registerEvent` | `{ id, name, description, accent?, weight? /*default 1*/, minWave? /*default 2*/, start(game), end(game), draw?(ctx, game, view) }`: a random event. Each wave from wave 2 has a 25% chance to start one; it lasts until the wave ends. `view.cursor` is the mouse position or `null` (`src/content/events/`) |
| `registerUpgrade` | `{ id, name, description, maxLevel?, getCost(game, level), apply(game, level) }` — appears in the quarter-review shop |
| `registerInvestment` | `{ id, name, description, group: 'developers' \| 'powerups' \| 'unlocks', maxLevel, getCost(level), apply(game, level), effectText?(level) }`: a permanent upgrade bought between runs with Investor Capital. `apply` runs once at the start of every run (`src/content/investments/`) |
| `registerWaves` | `[{ hp /*health multiplier*/, boss? /*bug id, spawns 3 s after the last bug*/, groups: [{ bug, count, interval, delay }] }]` (`src/content/waves.js`) |

## Developer upgrades

These are the developers' own upgrades, bought with the developer's drink. (Building upgrades in the quarter-review shop are separate: see `registerUpgrade`.) Each developer declares its own upgrade path in its file: one level-2 upgrade, then a choice between two level-3 branches. 10 XP unlocks level 2 and 30 XP unlocks level 3. The player still pays the upgrade's cost in that drink.

In code, `dev.level` is 0-based: 0 for level 1, 1 after the level-2 upgrade, 2 after level 3.

| Field | Shape |
|---|---|
| `levelName` | Name shown at level 1, e.g. `'Junior Java Dev'`. Each upgrade's `name` replaces it once bought. |
| `modifyStats?(game, dev, stats)` | On the developer itself: changes `stats` at every level (React's ecosystem bonus). |
| `upgrades` | `{ level2: Upgrade, level3: [Upgrade, Upgrade] }`. `level3[0]` is the steady branch, `level3[1]` the gamble. |
| `Upgrade` | `{ id, name, cost, kind /*'steady' or 'gamble', level 3 only*/, description, tooltip?, ...hooks }` |

Hooks on an upgrade, all optional and all guarded (a hook that throws is logged and skipped):

| Hook | Does |
|---|---|
| `stats: { damage?, fireRate?, range? }` | Absolute stats from this level on. Level 3 keeps level 2's stats unless it overrides them. |
| `modifyStats(game, dev, stats)` | Changes this developer's own stats. |
| `aura: { radius /*cells*/, apply(game, other, stats) }` | Changes the stats of other developers in range. The same upgrade's aura applies once, however many there are. |
| `update(game, dev, dt, stats)` | Runs every tick. Return `false` to hold fire. |
| `fire(game, dev, target, stats)` | Replaces the normal shot. |
| `panelButtons(game, dev)` | Returns `[{ label, onClick(game, dev) }]`, extra buttons in the selection panel. |

For `fire` and `update`, use the helpers in `src/engine/devs.js`: `bugsInRange(game, dev, range)` (furthest along first), `hitBug(game, dev, bug, damage)` (counter damage, reward, XP and kill in one call) and `shotBeam(game, dev, bug)` (shows the developer's own attack animation, or a beam if it has none).

A short example, trimmed from `src/content/developers/java.js`:

```js
registerDeveloper({
  id: 'java', /* ...base stats... */
  levelName: 'Junior Java Dev',
  upgrades: {
    level2: { id: 'springboot', name: 'Spring Boot Dev', cost: 25, description: '+damage, +range', stats: { damage: 40, range: 2.6 } },
    level3: [
      {
        id: 'architect', name: 'Enterprise Architect', kind: 'steady', cost: 40,
        description: 'Less damage itself, +15% damage to developers nearby',
        modifyStats(game, dev, stats) { stats.damage *= 0.9; },
        aura: { radius: 5, apply(game, dev, stats) { stats.damage *= 1.15; } },
      },
      {
        id: 'gc', name: 'Garbage Collector', kind: 'gamble', cost: 120,
        description: 'Stop-the-World, then a pulse',
        update(game, dev, dt, stats) { /* hold fire 1 s every 8 s, then hitBug every bug in range for 2x */ },
      },
    ],
  },
});
```

Check a change with `node scripts/sim-upgrades.mjs`: the `{type} A` and `{type} B` lines should stay close, mainly the no-powers ones, and up-first should not clearly beat hire-first. For .NET, compare the `react+dotnet A` and `react+dotnet B` lines, because .NET only can't hire before the first sprint.

## Events (`on(name, fn)` from `src/engine/events.js`)

Subscribe with `on(...)` at the **top level of your file**, not inside `init`. `init` runs again on every restart, so listeners added there would double up.

`game:start` · `sprint:start` · `sprint:cleared` · `quarter:review` · `year:review` · `upgrade:bought` · `wave:start` · `wave:cleared` · `bell:rung` · `bug:spawned` · `bug:killed` · `drop:spawned` (`{ game, drop }`, a dead bug left a drink on the board) · `drop:collected` (`{ game, drop }`, the player picked it up) · `bug:leaked` · `dev:placed` · `dev:upgradeready` · `dev:levelup` · `dev:sold` · `dev:hit` (passes `{ game, dev, bug, damage, counter }` once per shot, after the shot's hits and kills; `bug` is the shot's main target, also for upgrades that pierce, chain or splash) · `powerup:activated` · `claude:backfire` · `event:start` · `event:end` · `game:won` · `game:lost` · `investment:bought` (passes `{ id, level }`, no game: it happens between runs)

Each one passes `{ game, ... }`, for example `bug:killed` gives `{ game, bug, dev }`. `dev:upgradeready` gives `{ game, dev, level }` when XP unlocks the next upgrade. `dev:levelup` fires when an upgrade is bought and gives `{ game, dev, level, upgrade }`. In both, `level` is 0-based like `dev.level`: 1 for the level-2 upgrade, 2 for level 3.

## Changing the rules: `game.mods`

`xpMultiplier` · `drinkMultiplier` · `fireRateMultiplier` · `damageMultiplier` · `bugSpeedMultiplier` · `rangeMultiplier` · `timeScale` (whole simulation speed) · `devFireRate` (object keyed by developer id, e.g. `devFireRate.java`; a missing key counts as 1)

Multiply when your effect starts and divide when it ends, so effects stack.

## Permanent bonuses (investments)

- `game.mods.devCostMultiplier` scales hiring cost. Use `hireCost(game, typeId)` from `src/engine/devs.js`, not `def.cost`.
- `powerupMod(game, id)` from `src/engine/powerups.js` returns `{ cooldown, effect }` for a power-up: a cooldown multiplier and an effect level your power-up reads in `activate`. Store the factor you applied on `st` and divide by exactly that in `deactivate`.
- `game.unlocks` holds flags for unlocked mechanics, e.g. `game.unlocks.firewall`.
- **New unlock:** copy `src/content/investments/security-training.js` (or `cross-functional.js` for a passive bonus that switches on and off). It registers the investment (its `apply` sets a `game.unlocks` flag) and a feature whose `update`/`draw` do nothing until the flag is set. One file, one manifest line.
- In the browser console, `localStorage.setItem('dtc-investments', JSON.stringify({ capital: 999, levels: {} }))` and a reload give you capital to test with.

## Effects and sound

- `addEffect(game, {...})` from `src/engine/game.js` takes one of these kinds:
  - `banner` (`title`, `text`, `accent`)
  - `pop` (`x`, `y`, `text`, `color`)
  - `ring` (`x`, `y`, `color`)
  - `flash`
  - `beam` (`from`, `to`, `color`)

  Each also takes a `ttl` in seconds.
- `playSound(name)` and `registerSound(name, (ctx, tone) => ...)` live in `src/engine/sound.js`.

## Style

Use the Nexios palette: navy `#001E32`, blue `#2563EB` (React), orange `#EA580C` (Java), fuchsia `#C026D3` (.NET), green `#16A34A`, and the slate greys. Use the Lato font. No emoji, sentence case, no exclamation marks.

## Team workflow

- Pull before you start. Keep commits small. Before every push, run `node --test` and play at least one wave locally.
- Pushing to `main` deploys the live site within about a minute: https://robin-cortvrindt.github.io/defend-the-codebase/
- **Freeze at 15:30.** After that, only push fixes.
- Something that worked broke? Log it in `REGRET.md`.

## Sprints, quarters and the building

- `game.sprint` is the 0-based global sprint index (`game.wave` is an alias). `sprintInfo(n)` from `src/engine/game.js` gives `{ year, quarter, sprint, label }`.
- Hand-made sprints come from `waves.js`; after those, `getSprintDef(n)` generates harder ones forever.
- `game.warrants`, `game.floors`, `game.heatResistance` (0..1, from air conditioning) and `game.raise` (total yearly-review multiplier) are plain fields on the game.

## Counter-upgrades for events

Every random event has an upgrade that counters it. For a new event, add one with:

```js
import { counterUpgrade } from '../../engine/upgrades.js';
registerUpgrade(counterUpgrade({ id: 'my-fix', name: 'My fix', description: 'Counters: my event', counters: 'my-event' }));
```

In the event, scale the effect with `resistanceTo(game, 'my-event')` (0 = full effect, 1 = none). To show it on the building, add a drawing in `src/engine/building.js`.
