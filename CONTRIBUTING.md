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
| `registerBug` | `{ id, name, ring, radius, hp, speed /*px/s*/, livesLost, reward, legs?, onHit?, onDeath?, update? }` |
| `registerPowerup` | `{ id, name, description, duration /*s, 0 = instant*/, cooldown, getCost?(game), canActivate?(game), activate(game), deactivate?(game) }` |
| `registerFeature` | `{ id, init?(game), update?(game, dt), draw?(ctx, game), hudButtons?: [{ label, hint, onClick(game) }] }` |
| `registerWaves` | `[{ hp /*health multiplier*/, groups: [{ bug, count, interval, delay }] }]` (`src/content/waves.js`) |

## Events (`on(name, fn)` from `src/engine/events.js`)

Subscribe with `on(...)` at the **top level of your file**, not inside `init`. `init` runs again on every restart, so listeners added there would double up.

`game:start` · `wave:start` · `wave:cleared` · `bell:rung` · `bug:spawned` · `bug:killed` · `bug:leaked` · `dev:placed` · `dev:levelup` · `dev:sold` · `powerup:activated` · `claude:backfire` · `game:won` · `game:lost`

Each one passes `{ game, ... }`, for example `bug:killed` gives `{ game, bug, dev }`.

## Changing the rules: `game.mods`

`xpMultiplier` · `warrantMultiplier` · `fireRateMultiplier` · `damageMultiplier` · `bugSpeedMultiplier` · `rangeMultiplier`

Multiply when your effect starts and divide when it ends, so effects stack.

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
