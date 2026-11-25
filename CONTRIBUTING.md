# Adding to Defend the Codebase

**The rule: one new file plus one line in `src/content/manifest.js`.** Don't edit `src/engine/` to add content. A file that fails to load is skipped and logged in the browser console, so it can't take the game down. Your feature just won't show up.

Start from `src/content/features/example-feature.js`. It has a working example of every type.

## Run and test

```
python -m http.server 8000     # then open http://localhost:8000
node --test                    # engine tests (Node 20+)
node scripts/sim.mjs           # bot plays all 10 waves: balance check
```

Handy URL: `http://localhost:8000/?demo=1` starts wave 1 with one developer of each type and 1000 Warrants. In the browser console, `game.game` is the live state, e.g. `game.game.warrants = 9999`.

## What you can register (`src/engine/registry.js`)

| Call | Shape |
|---|---|
| `registerDeveloper` | `{ id, name, accent, blurb, cost, damage, fireRate, range /*cells*/, counters /*bug id*/, drawIcon(ctx, size) }` |
| `registerBug` | `{ id, name, ring, radius, hp, speed /*px/s*/, livesLost, reward, legs?, boss?, onHit?, onDeath?, update?, drawIcon?(ctx, radius) }` |
| `registerPowerup` | `{ id, name, description, duration /*s, 0 = instant*/, cooldown, getCost?(game), canActivate?(game), describe?(game) /*button text, overrides description*/, activate(game, st), deactivate?(game, st) }` |
| `registerFeature` | `{ id, init?(game), update?(game, dt), draw?(ctx, game), hudButtons?: [{ label, hint, onClick(game) }] }` |
| `registerEvent` | `{ id, name, description, accent?, weight? /*default 1*/, minWave? /*default 2*/, start(game), end(game), draw?(ctx, game, view) }`: a random event. Each wave from wave 2 has a 25% chance to start one; it lasts until the wave ends. `view.cursor` is the mouse position or `null` (`src/content/events/`) |
| `registerUpgrade` | `{ id, name, description, maxLevel?, getCost(game, level), apply(game, level) }` — appears in the quarter-review shop |
| `registerInvestment` | `{ id, name, description, group: 'developers' \| 'powerups' \| 'unlocks', maxLevel, getCost(level), apply(game, level), effectText?(level) }`: a permanent upgrade bought between runs with Investor Capital. `apply` runs once at the start of every run (`src/content/investments/`) |
| `registerWaves` | `[{ hp /*health multiplier*/, boss? /*bug id, spawns 3 s after the last bug*/, groups: [{ bug, count, interval, delay }] }]` (`src/content/waves.js`) |

## Events (`on(name, fn)` from `src/engine/events.js`)

Subscribe with `on(...)` at the **top level of your file**, not inside `init`. `init` runs again on every restart, so listeners added there would double up.

`game:start` · `sprint:start` · `sprint:cleared` · `quarter:review` · `year:review` · `upgrade:bought` · `wave:start` · `wave:cleared` · `bell:rung` · `bug:spawned` · `bug:killed` · `bug:leaked` · `dev:placed` · `dev:levelup` · `dev:sold` · `powerup:activated` · `claude:backfire` · `event:start` · `event:end` · `game:won` · `game:lost` · `investment:bought` (passes `{ id, level }`, no game: it happens between runs)

Each one passes `{ game, ... }`, for example `bug:killed` gives `{ game, bug, dev }`.

## Changing the rules: `game.mods`

`xpMultiplier` · `warrantMultiplier` · `fireRateMultiplier` · `damageMultiplier` · `bugSpeedMultiplier` · `rangeMultiplier` · `timeScale` (whole simulation speed) · `devFireRate` (object keyed by developer id, e.g. `devFireRate.java`; a missing key counts as 1)

Multiply when your effect starts and divide when it ends, so effects stack.

## Permanent bonuses (investments)

- `game.mods.devCostMultiplier` scales hiring cost. Use `hireCost(game, typeId)` from `src/engine/devs.js`, not `def.cost`.
- `powerupMod(game, id)` from `src/engine/powerups.js` returns `{ cooldown, effect, cost }` for a power-up: a cooldown multiplier, an effect level your power-up reads in `activate`, and a price multiplier. Store the factor you applied on `st` and divide by exactly that in `deactivate`.
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
- `game.coins`, `game.floors`, `game.heatResistance` (0..1, from air conditioning) and `game.raise` (total yearly-review multiplier) are plain fields on the game.

## Counter-upgrades for events

Every random event has an upgrade that counters it. For a new event, add one with:

```js
import { counterUpgrade } from '../../engine/upgrades.js';
registerUpgrade(counterUpgrade({ id: 'my-fix', name: 'My fix', description: 'Counters: my event', counters: 'my-event' }));
```

In the event, scale the effect with `resistanceTo(game, 'my-event')` (0 = full effect, 1 = none). To show it on the building, add a drawing in `src/engine/building.js`.
