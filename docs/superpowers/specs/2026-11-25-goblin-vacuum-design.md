# Scattered loot, Greedy goblin + Goblin trap, Robot vacuum (design)

Mockup: `docs/mockups/goblin-vacuum.html`

## Intent
Make collecting drinks more of a game. Loot no longer sits where the bug died: it flies to a random spot on the
office floor. A new random event sends a greedy goblin to steal that loot, with a building upgrade that slows it
(like every other event has a counter). A new investment buys a robot vacuum that collects loot for you, faster
with every level.

## Goals
- Drops land spread over the whole office, so where you look matters.
- The goblin is a visible, fast threat to your drinks for one wave, and the Goblin trap makes it slower.
- The vacuum is a **helper**: it takes some of the clicking off your hands, but clicking loot yourself still works
  exactly as today and stays the main way to collect (Robin). It's a permanent bonus that pays off over a run.

## Non-goals
- You can't click the goblin to scare it off or kill it. Your answer is to click the loot faster, or the trap/vacuum.
- No change to how long drops last (10 s), how much they're worth, or the drink balance.
- The vacuum and goblin don't interact (no fights, no blocking).

## Anti-goals
- A drop that lands where it can't be seen or clicked (under PROD, under the HUD, outside the board).
- A goblin that stands still or looks stuck.
- A vacuum so good that clicking loot stops mattering.

## Approaches (picked in conversation)
- **Goblin:** A (picked) one goblin for the whole wave, always running to the nearest loot; B every ~10 s a new
  goblin grabs one drink and leaves. A fits how events work (one per wave) and is easier to read.
- **Goblin counter:** building upgrade in the quarter-review shop (picked) vs a power-up button. Matches the other events.
- **Vacuum:** first proposal was a fixed route sweeping the whole office (Robin's idea). With 10 s drops and a
  ~5,400 px lap it would only catch ~15-28%, so Robin picked **nearest loot** instead.

## Behaviour

### 1. Scattered loot (engine: `src/engine/drops.js`, `src/engine/render.js`)
- When a bug dies, each drop picks a random **landing cell**: inside the grid, not a lane cell (`isPathCell`),
  not overlapping PROD/the building column (use `isBuildable`), and not a cell with a developer. Landing spot =
  cell centre + jitter of ±8 px (as today). If no cell is free (should not happen), fall back to the bug's position.
- A boss's three drops each pick their own cell.
- The drop **flies** from the bug to that spot in `FLIGHT = 0.5` s in an arc (rises ~30 px in the middle), spinning
  slightly. While flying it can't be picked up by anyone (player, vacuum, goblin), and its 10 s `ttl` starts on landing.
- Drop fields: `x, y` = landing spot; `fromX, fromY`, `flight` (seconds left in the air, 0 once landed).
- Randomness uses `game.random()` (gameplay), so seeded sims stay deterministic.
- Export a helper `landedDrops(game)` and `nearestDrop(game, x, y)` (landed only) for the goblin and vacuum.
- Export `stealDrop(game, drop)`: removes a drop without giving drinks, emits `drop:stolen` `{ game, drop }`.
- The vacuum uses the existing `collectDrop` (gives drinks, `+N` pop, emits `drop:collected`).

### 2. Event "Greedy goblin" (`src/content/events/goblin.js`)
- `registerEvent({ id: 'goblin', name: 'A greedy goblin', description: 'It steals your dropped drinks', accent: '#65A30D' })`.
  Default weight and `minWave`.
- The same file registers a **feature** (events have no `update` hook) that moves the goblin while
  `game.activeEvent === 'goblin'` and `game.phase` is `wave` or `bell`.
- `start`: the goblin appears just off the **right edge** at a random height inside the board (`x = WIDTH + 16`),
  `game.goblin = { x, y, carried: 0 }`.
- Movement: it runs straight (ignores the lane, developers, PROD) to the nearest landed drop at
  `GOBLIN_SPEED = 160` px/s × `(1 - 0.6 * resistanceTo(game, 'goblin'))` → 160 / 128 / 96 / 64 px/s for trap
  levels 0-3. It is affected by `game.mods.timeScale` like everything else via `dt`, not by `bugSpeedMultiplier`
  (it's not a bug, so heat wave doesn't speed it).
- Within 12 px of its target it calls `stealDrop`, shows a red `-N` pop and its sack gets a little fuller.
  If its target is collected first, it re-targets the nearest drop.
- No drops: it wanders slowly towards the middle of the board and waits (small idle bounce), so it never looks frozen.
- `end` (wave over): it runs off the right edge (purely visual; it can't steal any more), then `game.goblin = null`.
  Simpler alternative the builder may take: remove it at once.
- Drawing (`draw` hook of the event, below drops): a small green goblin (~14 px), facing where it runs, with a brown
  sack over its shoulder that grows with `carried`, and a running bob. See mockup.

### 3. Building upgrade "Goblin trap" (`src/content/upgrades/trap.js`, id `trap`)
- `counterUpgrade({ id: 'trap', name: 'Goblin trap', description: 'Counters: greedy goblin', counters: 'goblin' })`,
  3/5/7 Warrants like the others. Unlike the other counters it doesn't cancel the event at level 3: it slows the
  goblin to 40% speed.
- Building visual: a trap by the building entrance, a little more sprung per level; side panel tile label "Trap".
  Look per the mockup.

### 4. Investment "Robot vacuum" (`src/content/investments/robot-vacuum.js`)
- Built like `security-training.js`: one investment + one feature, gated on `game.unlocks.vacuum` (the level, 0-3).
- `group: 'unlocks'`, `maxLevel: 3`, `getCost(level)` → `[40, 30, 50]`, effectText `Robot vacuum: N px/s`.
  Description: "A robot vacuum collects dropped drinks for you. Each level makes it faster."
- Speed per level: `[70, 100, 130]` px/s, always slower than an untrapped goblin.
- Dock: bottom-left corner of the board. It starts each run there.
- Movement (only while `game.phase` is `wave` or `bell`): drives straight to the nearest landed drop, turning
  smoothly (it ignores lane and developers: it drives under the desks). Within 14 px it calls `collectDrop`.
  No drops: it heads back to the dock and parks.
- Drawing (feature `draw`): round grey robot (~13 px radius) with a bumper and a blinking light, a short brush
  sweep while moving. See mockup.

## Constraints
- Content rule: new things are one file + one manifest line; the engine change is only in drops.js/render.js.
- Everything runs on game time (`dt`), so it stops while paused.
- Tests run with `node --test`; sims (`scripts/sim.mjs`) keep working (they collect via `collectDrop`).

## Tests
- Drops: landing cell is never a lane/PROD/developer cell; a flying drop can't be picked; ttl starts on landing.
- Goblin: moves towards the nearest drop, steals it (no drinks given, `drop:stolen` emitted), speed scales with trap level.
- Trap: counter-upgrade test includes `trap` ↔ `goblin`.
- Vacuum: off without the investment; collects the nearest drop (drinks given); faster per level; returns to dock.
- Manifest/content test lists the new files. README and CONTRIBUTING (`drop:stolen` event) updated.

## Calls made after the builder check (Claude's, Robin can overrule)
- **Goblin only during the wave.** Events end as soon as the last bug dies (`checkEnd` → `endEvent`, before the
  bell), so the goblin steals while bugs are on the board, then runs off the right edge. Drops left during the
  bell are safe from it. No change to how events end.
- **Engine files beyond drops.js/render.js are fine where precedent exists:** the trap gets a `drawTrap` in
  `building.js`, a `trap` entry in `buildingSpec` (render.js) and a `Trap` label in `SHORT` (side-panel.js),
  exactly like the water cooler.
- **Multi-level unlock in the investments menu:** `menu.js` hides pips for unlocks and shows "Owned". Change it to
  show pips and the next-level price for unlocks with `maxLevel > 1`; "Owned" only at max for one-level unlocks
  ("Max" for multi-level, like the other groups).
- **Drops on buildable cells:** a click on a drop keeps winning (today's `input.js` order): it collects the drop, and
  a second click hires. Hiring onto a cell where a drop lies is allowed; the drop stays clickable on top.
- **Board size:** all code uses `COLS`, `ROWS`, `WIDTH`, `HEIGHT`, `isBuildable`, never hard-coded sizes, so it works
  on the 16 × 8 board and on the 24 × 12 board from the visual refresh. Landing cells and the goblin's idle spot
  avoid the centred bell card area only if the refresh lands first.
- **Order:** Robin approved the design and mockup and said "build it": built now on the 16 × 8 board, before the
  visual refresh. Whoever merges the refresh keeps landing cells clear of the centred bell card.

## Left to the builder
- Exact art within the mockup's look, flight arc easing, re-targeting tie-breaks, and file/test layout.
