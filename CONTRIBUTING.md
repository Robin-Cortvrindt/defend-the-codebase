# Adding to Defend the Codebase

**The rule: one new file plus one line in `src/content/manifest.js`.** To add an upgrade, edit your developer's own file. Don't edit `src/engine/` to add content. A file that fails to load is skipped and logged in the browser console, so it can't take the game down. Your feature just won't show up.

Start from `src/content/features/example-feature.js`. It has a working example of every type.

## Run and test

```
python -m http.server 8000     # then open http://localhost:8000
node --test                    # engine tests (Node 20+)
node scripts/sim.mjs [seeds]   # bot plays all 10 waves per seed (default 10): balance check
```

Handy URL: `http://localhost:8000/?demo=1` starts wave 1 with one developer of each type and 1000 Warrants. In the browser console, `game.game` is the live state, e.g. `game.game.warrants = 9999`.

## What you can register (`src/engine/registry.js`)

| Call | Shape |
|---|---|
| `registerDeveloper` | `{ id, name, accent, blurb, cost, damage, fireRate, range /*cells*/, counters /*bug id*/, drawIcon(ctx, size), levelName?, modifyStats?(game, dev, stats), upgrades? }` (see Upgrades) |
| `registerBug` | `{ id, name, ring, radius, hp, speed /*px/s*/, livesLost, reward, legs?, onHit?, onDeath?, update? }` |
| `registerPowerup` | `{ id, name, description, duration /*s, 0 = instant*/, cooldown, getCost?(game), canActivate?(game), activate(game), deactivate?(game) }` |
| `registerFeature` | `{ id, init?(game), update?(game, dt), draw?(ctx, game), hudButtons?: [{ label, hint, onClick(game) }] }` |
| `registerWaves` | `[{ hp /*health multiplier*/, groups: [{ bug, count, interval, delay }] }]` (`src/content/waves.js`) |

## Upgrades

Each developer declares its own upgrade path in its file: one level-2 upgrade, then a choice between two level-3 branches. 10 XP unlocks level 2 and 30 XP unlocks level 3. The player still pays the upgrade's cost in Warrants.

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

For `fire` and `update`, use the helpers in `src/engine/devs.js`: `bugsInRange(game, dev, range)` (furthest along first), `hitBug(game, dev, bug, damage)` (counter damage, reward, XP and kill in one call) and `shotBeam(game, dev, bug)`.

A short example, trimmed from `src/content/developers/java.js`:

```js
registerDeveloper({
  id: 'java', /* ...base stats... */
  levelName: 'Junior Java Dev',
  upgrades: {
    level2: { id: 'springboot', name: 'Spring Boot Dev', cost: 25, description: '+damage, +range', stats: { damage: 40, range: 2.6 } },
    level3: [
      {
        id: 'architect', name: 'Enterprise Architect', kind: 'steady', cost: 30,
        description: '+15% damage to developers nearby',
        modifyStats(game, dev, stats) { stats.damage *= 0.6; },
        aura: { radius: 2, apply(game, dev, stats) { stats.damage *= 1.15; } },
      },
      {
        id: 'gc', name: 'Garbage Collector', kind: 'gamble', cost: 120,
        description: 'Stop-the-World, then a pulse',
        update(game, dev, dt, stats) { /* hold fire 1 s every 8 s, then hitBug every bug in range for 3x */ },
      },
    ],
  },
});
```

Check a change with `node scripts/sim.mjs`: the `{type} A` and `{type} B` lines should stay close. For .NET, compare the `react+dotnet A` and `react+dotnet B` lines, because .NET only can't hire before wave 1.

## Events (`on(name, fn)` from `src/engine/events.js`)

Subscribe with `on(...)` at the **top level of your file**, not inside `init`. `init` runs again on every restart, so listeners added there would double up.

`game:start` · `wave:start` · `wave:cleared` · `bell:rung` · `bug:spawned` · `bug:killed` · `bug:leaked` · `dev:placed` · `dev:upgradeready` · `dev:levelup` · `dev:sold` · `powerup:activated` · `claude:backfire` · `game:won` · `game:lost`

Each one passes `{ game, ... }`, for example `bug:killed` gives `{ game, bug, dev }`. `dev:upgradeready` gives `{ game, dev, level }` when XP unlocks the next upgrade. `dev:levelup` fires when an upgrade is bought and gives `{ game, dev, level, upgrade }`.

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
