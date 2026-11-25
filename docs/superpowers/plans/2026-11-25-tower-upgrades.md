# Tower Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Developers are upgraded with Warrants once they have enough XP. Each type has its own path: one level-2 upgrade, then a choice between two level-3 branches.

**Architecture:** `src/engine/devs.js` gets the upgrade mechanics (XP gate, buying, the stats pipeline, firing hooks, fault isolation). Each developer content file declares its own `levelName` and `upgrades`, plus hooks for behaviour. The UI selection panel shows the upgrade buttons. `scripts/sim.mjs` gets seeded runs and branch strategies for balancing by eye.

**Tech Stack:** Plain JavaScript ES modules, Canvas 2D, DOM. `node --test` (Node 20+). No build step, no npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-25-tower-upgrades-design.md`

## Global Constraints

- No build step, no npm dependencies. Plain ES modules.
- House style for all game text: sentence case, no exclamation marks, no emoji. Nexios palette (green `#16A34A`), Lato font.
- XP gates: 10 XP for level 2, 30 XP for level 3. Kills still give 1 XP (× `game.mods.xpMultiplier`).
- Buying needs XP ≥ gate **and** Warrants ≥ cost. It's allowed in any phase where hiring is allowed. The cost is added to `dev.spent`, and selling refunds `floor(spent × 0.5)`.
- The automatic per-level bonuses (`LEVEL_DAMAGE`, `LEVEL_FIRE_RATE`) are removed. Upgrade stats are absolute. Level 3 keeps level 2's stats unless it overrides them.
- Every content hook call is wrapped in try/catch and logged with `console.error`. A throwing hook never stops `step()`.
- Counter damage (×2) applies to every hit, including pierce, chain, splash and pulse.
- `dev.level` stays **0-based** (0, 1, 2). The badge shows `level + 1`.
- Pushing to `main` deploys the live site. Work on branch `feat/tower-upgrades`.
- Log anything that breaks along the way in `REGRET.md`.

## Review Focus

1. **A developer type with no `upgrades` field** (the test fixtures and teammates' existing content): no upgrade buttons, `buyUpgrade` returns false, and the type fires normally. Test in Task 1.
2. **Chain, pierce, splash or pulse hitting a bug that already died earlier in the same shot:** no second kill, no second reward, no second XP. Test in Task 2.
3. **Azure Function with few or no Warrants:** Warrants never drop below 0 or go fractional. It stops firing at 0 and starts again once Warrants come in. Test in Task 6.
4. **Selling an upgraded developer:** the refund is half of hire plus all upgrades. The developer's aura stops right away, and nothing keeps running for a developer that's gone. Test in Task 4 (aura) and Task 1 (refund).
5. **A content hook that throws (`fire`, `update`, `modifyStats`, `aura.apply`):** it's logged, the developer skips that shot or effect, and the rest of the game keeps going. Test in Task 2.

---

## File map

| File | Change |
|---|---|
| `src/engine/devs.js` | Upgrade mechanics, stats pipeline, firing hooks |
| `src/engine/ui.js` | Upgrade buttons and extra content buttons in the selection panel. `LEVELS` is removed. |
| `src/engine/render.js` | Badge 1/2/3, "ready" marker, XP bar to the next gate |
| `src/main.js` | Level-up pop shows the upgrade's name |
| `style.css` | Upgrade button styles |
| `src/content/developers/{java,react,dotnet}.js` | `levelName`, `upgrades`, hooks, jokes |
| `tests/devs.test.js` | Engine tests (fixture types) |
| `tests/upgrades.test.js` (new) | Behaviour of the real content upgrades |
| `scripts/sim.mjs` | Seeds, bot that buys upgrades, branch strategies, report |
| `CONTRIBUTING.md`, `README.md` | Explain upgrades and the new events |

---

### Task 1: Upgrade data, XP gate and buying

**Files:**
- Modify: `src/engine/devs.js`
- Test: `tests/devs.test.js`

**Interfaces:**
- Produces (all exported from `src/engine/devs.js`):
  - Content shape on a developer def:
    - `levelName?: string`
    - `modifyStats?(game, dev, stats)`
    - `upgrades?: { level2: Upgrade, level3: [Upgrade, Upgrade] }`
  - `Upgrade` has these fields:
    - `id`, `name`, `cost`, `description`
    - `kind?: 'steady'|'gamble'`
    - `tooltip?: string`
    - `stats?: { damage?, fireRate?, range? }`
    - `modifyStats?(game, dev, stats)`
    - `aura?: { radius /*cells*/, apply(game, other, stats) }`
    - `update?(game, dev, dt, stats) → false to hold fire`
    - `fire?(game, dev, target, stats)`
    - `panelButtons?(game, dev) → [{ label, onClick(game, dev) }]`
  - The dev object gains `upgrade: Upgrade|null` (the most recently bought upgrade) and `state: {}` (scratch space for content hooks).
  - `XP_GATES = [0, 10, 30]`, indexed by target level.
  - `nextUpgrades(dev) → Upgrade[]`: `[level2]` at level 0, the `level3` pair at level 1, `[]` at level 2 or when the type has no `upgrades`.
  - `upgradeUnlocked(dev) → boolean`: `nextUpgrades(dev).length > 0 && dev.xp >= XP_GATES[dev.level + 1]`.
  - `upgradeStatus(game, dev, upgrade) → { ok: boolean, reason: null|'xp'|'warrants' }`. The XP reason takes priority.
  - `buyUpgrade(game, dev, upgradeId) → boolean`.
  - `levelName(dev) → string`: `dev.upgrade?.name ?? def.levelName ?? def.name`.
  - Events:
    - `dev:levelup { game, dev, level, upgrade }` fires on purchase.
    - `dev:upgradeready { game, dev, level }` fires when `grantXp` crosses `XP_GATES[dev.level + 1]` for a level that has an upgrade. `level` is the level that becomes buyable.

- [ ] **Step 1: Create the branch**

Run: `git checkout -b feat/tower-upgrades`

- [ ] **Step 2: Write failing tests in `tests/devs.test.js`**

In `beforeEach`, also register an upgradeable type:

```js
R.registerDeveloper({ id: 'u', cost: 50, damage: 10, fireRate: 1, range: 2, counters: 'small', levelName: 'Base',
  upgrades: {
    level2: { id: 'two', name: 'Two', cost: 40, description: 'd', stats: { damage: 20, range: 3 } },
    level3: [
      { id: 'a', name: 'A', cost: 60, kind: 'steady', description: 'd', stats: { fireRate: 2 } },
      { id: 'b', name: 'B', cost: 70, kind: 'gamble', description: 'd' },
    ] } });
```

Replace the test `'kill grants reward and 1 xp; levels at 10 and 30'` with `'kill grants reward and 1 xp; xp alone never levels up'`. It keeps the reward and XP assertions, then checks:

```js
grantXp(g, d, 40);
assert.equal(d.level, 0);
```

Change the test `'xpMultiplier 2 doubles xp; …; level boosts damage'` by dropping its last two lines (`d.level = 1` and the damage of 7.5).

Add these tests:

```js
test('upgrade is gated by xp then warrants; spent grows; refund includes upgrades', () => {
  const g = waveGame(); g.warrants = 1000;
  const d = placeDev(g, 'u', 3, 3);
  assert.deepEqual(upgradeStatus(g, d, nextUpgrades(d)[0]), { ok: false, reason: 'xp' });
  assert.equal(buyUpgrade(g, d, 'two'), false);
  grantXp(g, d, 10);
  g.warrants = 39;
  assert.deepEqual(upgradeStatus(g, d, nextUpgrades(d)[0]), { ok: false, reason: 'warrants' });
  g.warrants = 1000;
  assert.equal(buyUpgrade(g, d, 'two'), true);
  assert.equal(g.warrants, 960);
  assert.equal(d.level, 1);
  assert.equal(levelName(d), 'Two');
  assert.equal(d.spent, 90);
  assert.equal(sellDev(g, d), 45);
});

test('level 3 needs 30 xp, is one branch only, inherits level-2 stats', () => {
  const g = waveGame(); g.warrants = 1000;
  const d = placeDev(g, 'u', 3, 3);
  grantXp(g, d, 35);
  assert.equal(buyUpgrade(g, d, 'a'), false);            // must buy level 2 first
  assert.ok(buyUpgrade(g, d, 'two'));
  assert.ok(buyUpgrade(g, d, 'a'));
  assert.equal(buyUpgrade(g, d, 'b'), false);
  assert.deepEqual(nextUpgrades(d), []);
  const s = devStats(g, d);
  assert.equal(s.damage, 20); assert.equal(s.fireRate, 2); assert.equal(s.range, 3 * 40);
  assert.equal(g.stats.seniors, 1);
});

test('events: upgradeready on crossing a gate, levelup on purchase', () => {
  const g = waveGame(); g.warrants = 1000;
  const d = placeDev(g, 'u', 3, 3);
  const ready = [], ups = [];
  on('dev:upgradeready', e => ready.push(e.level));
  on('dev:levelup', e => ups.push([e.level, e.upgrade.id]));
  grantXp(g, d, 9); grantXp(g, d, 1); grantXp(g, d, 5);
  assert.deepEqual(ready, [1]);
  buyUpgrade(g, d, 'two');
  grantXp(g, d, 15);
  assert.deepEqual(ready, [1, 2]);
  assert.deepEqual(ups, [[1, 'two']]);
});

test('Review Focus 1: a type without upgrades has none and still fires', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  grantXp(g, d, 50);
  assert.deepEqual(nextUpgrades(d), []);
  assert.equal(upgradeUnlocked(d), false);
  assert.equal(buyUpgrade(g, d, 'two'), false);
  const b = spawnBug(g, 'other', 300);
  tickDevs(g, 0.01);
  assert.equal(b.hp, 94);
});
```

- [ ] **Step 3: Run the tests and check they fail**

Run: `node --test tests/devs.test.js`
Expected: FAIL. `nextUpgrades`, `buyUpgrade` and the other new functions aren't exported yet.

- [ ] **Step 4: Implement the Interfaces above in `src/engine/devs.js`**

- `devStats(game, dev)` builds stats in this order:
  1. The base def stats.
  2. `level2.stats` if `level ≥ 1`.
  3. The chosen level-3 `stats` if `level = 2`.
  4. `def.modifyStats`.
  5. `dev.upgrade.modifyStats`.
  6. Auras (Task 4 fills this step in; leave a marked spot).
  7. `game.mods` multipliers.

  Range is in cells until it's multiplied by `CELL`.
- Remove `LEVEL_DAMAGE` and `LEVEL_FIRE_RATE`. **Keep `LEVELS` exported for now**, because `ui.js` and `render.js` still import it. Task 3 removes it.
- `grantXp` no longer changes `dev.level`. It emits `dev:upgradeready` when the XP crosses the next gate.
- `buyUpgrade` increments `game.stats.seniors` when it buys level 3.
- `placeDev` initialises `upgrade: null` and `state: {}`.
- Wrap both `modifyStats` calls in try/catch.

- [ ] **Step 5: Run all the tests and check they pass**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/devs.js tests/devs.test.js
git commit -m "feat: buy developer upgrades with Warrants once XP unlocks them"
```

---

### Task 2: Firing hooks and fault isolation

**Files:**
- Modify: `src/engine/devs.js` (`tickDevs`)
- Test: `tests/devs.test.js`

**Interfaces:**
- Consumes: `devStats` and `Upgrade.update` / `Upgrade.fire` from Task 1.
- Produces (exported from `devs.js`):
  - `bugsInRange(game, dev, range) → bug[]`: the live bugs within `range` px, sorted from furthest along the path (`distance`) to nearest. The first one is the default target.
  - `hitBug(game, dev, bug, damage) → boolean`: returns `false` without doing anything if `bug.dead`. Otherwise it applies the damage (×2 if the bug is the developer's counter, plus the "×2" pop), calls `onHit`, and if hp ≤ 0 it calls `killBug`, then `dev.kills++` and `grantXp(game, dev, 1)`. Returns whether the hit killed the bug.
  - `shotBeam(game, dev, bug, color?, damage?)`: adds the beam effect that the default shot draws today.

- [ ] **Step 1: Write failing tests**

```js
test('update returning false holds fire; fire hook replaces the default shot', () => {
  R.registerDeveloper({ id: 'h', cost: 10, damage: 10, fireRate: 1, range: 2, counters: 'small',
    upgrades: { level2: { id: 'h2', name: 'H2', cost: 0, description: 'd',
      update: (game, dev) => dev.state.on === true,
      fire: (game, dev, target, stats) => { for (const b of bugsInRange(game, dev, stats.range)) hitBug(game, dev, b, 5); } },
      level3: [] } });
  const g = waveGame();
  const d = placeDev(g, 'h', 3, 3); d.xp = 10; buyUpgrade(g, d, 'h2');
  const b1 = spawnBug(g, 'other', 260), b2 = spawnBug(g, 'other', 300);
  tickDevs(g, 0.01);
  assert.equal(b1.hp, 100);
  d.state.on = true; tickDevs(g, 0.01);
  assert.deepEqual([b1.hp, b2.hp], [95, 95]);
});

test('Review Focus 2: hitting an already-dead bug gives no second reward or xp', () => {
  const g = waveGame();
  const d = placeDev(g, 'r', 3, 3);
  const b = spawnBug(g, 'other', 300, 1);
  const w = g.warrants;
  assert.equal(hitBug(g, d, b, 10), true);
  assert.equal(hitBug(g, d, b, 10), false);
  assert.equal(g.warrants, w + 1);
  assert.equal(d.xp, 1);
  assert.equal(d.kills, 1);
});

test('Review Focus 5: throwing hooks are logged and the game keeps stepping', () => {
  const boom = () => { throw new Error('boom'); };
  R.registerDeveloper({ id: 'x', cost: 10, damage: 10, fireRate: 1, range: 2, counters: 'small', modifyStats: boom,
    upgrades: { level2: { id: 'x2', name: 'X2', cost: 0, description: 'd', update: boom, fire: boom, modifyStats: boom,
      aura: { radius: 2, apply: boom } }, level3: [] } });
  const g = waveGame();
  const d = placeDev(g, 'x', 3, 3); d.xp = 10; buyUpgrade(g, d, 'x2');
  placeDev(g, 'r', 2, 3);
  spawnBug(g, 'other', 300);
  const errors = []; const orig = console.error; console.error = (...a) => errors.push(a);
  try { for (let i = 0; i < 5; i++) step(g, 0.1); } finally { console.error = orig; }
  assert.ok(errors.length > 0);
  assert.ok(devStats(g, d).damage > 0);
});
```

(Import `step` from `game.js` and `bugsInRange` and `hitBug` from `devs.js`. The aura part of the last test only gets exercised once Task 4 lands. It must already pass now.)

- [ ] **Step 2: Run them and check they fail**

Run: `node --test tests/devs.test.js`
Expected: FAIL. `hitBug` and `bugsInRange` aren't exported yet.

- [ ] **Step 3: Rewrite `tickDevs` on top of `bugsInRange`, `hitBug` and `shotBeam`**

Each tick, for each developer:
1. Lower the cooldown.
2. Call `dev.upgrade?.update(game, dev, dt, stats)`, guarded. If it returns `false`, skip the developer and keep the cooldown at 0, so it fires as soon as it's released.
3. If the cooldown is still above 0, stop here.
4. Pick the target: the first of `bugsInRange`.
5. Fire: `dev.upgrade?.fire`, guarded, or else the default (`shotBeam` + `hitBug(stats.damage)`).
6. Set `cooldown = 1 / fireRate`.

`update` runs every tick, even while cooling down, so timers such as GC and the Azure bill keep moving. If `fire` throws, log it and still set the cooldown.

- [ ] **Step 4: Run all the tests and check they pass**

Run: `node --test`
Expected: all PASS, including the targeting and counter tests that already existed.

- [ ] **Step 5: Commit**

```bash
git add src/engine/devs.js tests/devs.test.js
git commit -m "feat: let upgrades hold or replace a developer's shot"
```

---

### Task 3: Upgrade UI and map markers

**Files:**
- Modify: `src/engine/ui.js` (`updateSelPanel`, imports), `src/engine/render.js` (`drawDev`), `src/main.js` (`dev:levelup` handler), `src/engine/devs.js` (remove `LEVELS`), `style.css`

**Interfaces:**
- Consumes these from Tasks 1 and 2:
  - `nextUpgrades`, `upgradeStatus`, `buyUpgrade`, `upgradeUnlocked`
  - `levelName`, `XP_GATES`
  - `Upgrade.panelButtons`, `Upgrade.tooltip`, `Upgrade.kind`

- [ ] **Step 1: Selection panel in `ui.js`**

The title is `` `${def.name} · ${levelName(dev)}` ``. The subline is `XP {floor xp} / {XP_GATES[level+1]} · {kills} squashed`, or `Max level · {kills} squashed` at level 2.

Add one button per entry in `nextUpgrades(dev)`:
- **First line:** the name, plus the cost on the right.
- **Second line:** `Steady · ` or `Gamble · ` when `kind` is set, then either `description` (when `ok`), `Needs {gate} XP` (reason `xp`), or `Needs {cost} Warrants` (reason `warrants`).
- **Behaviour:** `disabled` unless `ok`, `title` set to `tooltip`, and clicking calls `buyUpgrade`.

Then add one `btn ghost` button for each entry `dev.upgrade?.panelButtons?.(game, dev)` returns (guarded). Then the existing Sell button.

The panel's cache key must include everything it shows: id, level, floor xp, kills, each status `reason`, and the panel button labels.

Remove the `LEVELS` import, and remove `LEVELS` from `devs.js`.

- [ ] **Step 2: `style.css`**

- `.sel-panel` wraps (`flex-wrap: wrap`).
- `.upgrade-btn` is a two-line button with the accent left border, in the same family as `.hire-btn`.
- `.upgrade-btn:disabled` is dimmed.
- It's readable at projector size: name 13px bold, subline 12px.

- [ ] **Step 3: `render.js` `drawDev`**

- **Badge:** text `String(dev.level + 1)`. Keep the existing white style, and the green style at level 2. Drop the underline that marks the middle level.
- **Ready marker:** when `upgradeUnlocked(dev)`, draw a small green (`COLORS.green`) upward triangle in the top-left corner of the tile.
- **XP bar for the selected developer:** fill = `min(1, xp / XP_GATES[level+1])`, and full at level 2.

- [ ] **Step 4: `main.js` `dev:levelup` handler**

The pop text becomes `upgrade.name`, read from the event payload. Keep the ring and the `levelup` sound.

- [ ] **Step 5: Run the tests and check the page in a browser**

Run: `node --test`
Expected: all PASS.

Run: `python -m http.server 8000`, then open `http://localhost:8000/?demo=1`. In the console, run `game.game.devs.forEach(d => d.xp = 40); game.game.warrants = 2000`. The upgrade content arrives in Tasks 4 to 6, so for now check that a developer can be selected without errors, the panel shows the XP line and Sell, and there are no console errors. Look at the upgrade buttons again at the end of Task 6.

- [ ] **Step 6: Commit**

```bash
git add src/engine/ui.js src/engine/render.js src/main.js src/engine/devs.js style.css
git commit -m "feat: upgrade buttons, ready marker and level badge"
```

---

### Task 4: Java path and auras

**Files:**
- Modify: `src/content/developers/java.js`, `src/engine/devs.js` (aura step in `devStats`)
- Create: `tests/upgrades.test.js`

**Interfaces:**
- Consumes: `hitBug`, `bugsInRange`, `shotBeam`, `buyUpgrade` (Tasks 1 and 2), `addEffect` from `game.js`, `on` from `events.js`.
- Produces: the aura rule in `devStats`. For each **distinct upgrade id** that has an `aura`, if at least one other developer with that upgrade is within `aura.radius × CELL` px of this developer, call `aura.apply(game, dev, stats)` **once** (so the same aura doesn't stack). A developer never gets its own aura. Auras apply before `game.mods`.

`tests/upgrades.test.js` setup: load the real content **once** at the top level with `await loadModules(CONTENT_URLS)` (ES modules don't re-run, so don't call `resetRegistry` or `clearAll` in this file). Add a helper:

```js
function devAt(g, type, col, row, ...upgradeIds) {
  g.warrants = 10000;
  const d = placeDev(g, type, col, row); d.xp = 30;
  for (const id of upgradeIds) assert.ok(buyUpgrade(g, d, id), id);
  return d;
}
```

`waveGame()` is the same as in `devs.test.js`. Buildable cells near the path: (3,3) centre (140,140), (3,4) centre (140,180), (2,3) centre (100,140). (4,3) is path. Points on the path: `pointAt(220)` = (180,100), 260 = (180,140), 300 = (180,180), 340 = (180,220), which is out of Java and React range from (3,3). Freeze a spawned bug with `bug.slow = 0`. Compare floats with `Math.abs(a - b) < 1e-9`.

- [ ] **Step 1: Write failing tests**

```js
test('java: Spring Boot stats; names', () => {
  const g = waveGame();
  const d = devAt(g, 'java', 3, 3);
  assert.equal(levelName(d), 'Junior Java Dev');
  buyUpgrade(g, d, 'springboot');
  assert.equal(levelName(d), 'Spring Boot Dev');
  assert.equal(devStats(g, d).damage, 26);
  assert.equal(devStats(g, d).range, 2.6 * 40);
  assert.equal(d.spent, 75 + 60);
});

test('java: Enterprise Architect deals x0.6 itself and gives +15% to neighbours, once, not to itself', () => {
  const g = waveGame();
  const ea = devAt(g, 'java', 3, 3, 'springboot', 'architect');
  const ea2 = devAt(g, 'java', 3, 4, 'springboot', 'architect');
  const r = devAt(g, 'react', 2, 3);
  near(devStats(g, ea).damage, 26 * 0.6 * 1.15); // gets ea2's aura, not its own
  near(devStats(g, r).damage, 6 * 1.15);         // two architects, applied once
  sellDev(g, ea); sellDev(g, ea2);
  assert.equal(devStats(g, r).damage, 6);                // Review Focus 4: aura ends on sell
});

```

(`near(a, b)` is a small helper: `assert.ok(Math.abs(a - b) < 1e-9)`.)

- **`java: Garbage Collector holds fire 1 s every 8 s, then pulses 3x to all in range`**
  - Set up a GC at (3,3) and two frozen `typo` bugs with hp 10000 at distances 260 and 300.
  - Step `tickDevs` in 0.05 s ticks, recording hp after each tick.
  - Ticks that end between 8.0 s and 9.0 s change no hp.
  - The first tick at or past 9 s takes exactly 78 (3 × 26) off **both** bugs, plus the regular shot on the furthest one if it fires that tick. Assert that the nearer bug lost exactly 78.
- **`java: "Initializing 847 beans…" pop for 1 s on placement, java only`**
  - Placing Java adds a `pop` effect with that exact text and `ttl` 1.
  - Placing React adds no such effect.

- [ ] **Step 2: Run them and check they fail**

Run: `node --test tests/upgrades.test.js`
Expected: FAIL. The upgrade `springboot` doesn't exist yet.

- [ ] **Step 3: Implement the aura step in `devStats`, then the Java content**

In `java.js`:
- `levelName: 'Junior Java Dev'`.
- `level2`: `{ id: 'springboot', name: 'Spring Boot Dev', cost: 60, description: '+damage, +range', stats: { damage: 26, range: 2.6 } }`.
- `level3[0]`, `architect`:
  - `name: 'Enterprise Architect'`, `kind: 'steady'`, `cost: 120`
  - `description: '+15% damage to developers nearby'`
  - `tooltip: "I don't code anymore, I enable."`
  - `modifyStats` multiplies its own damage by 0.6.
  - `aura: { radius: 2, apply: stats.damage *= 1.15 }`
- `level3[1]`, `gc`:
  - `name: 'Garbage Collector'`, `kind: 'gamble'`, `cost: 120`
  - `description: 'Stop-the-World, then a pulse'`
  - `update` keeps `dev.state.gcT`. It returns `false` while `gcT` is in [8, 9).
  - When `gcT` reaches 9, it calls `hitBug(…, 3 × stats.damage)` on every bug in `bugsInRange` and adds a `ring` effect, then resets `gcT` to 0.
  - At the moment it stops, it adds a `pop` "Stop-the-World".
- Flavour: a top-level `on('dev:placed', …)` that, for `dev.type === 'java'`, calls `addEffect(game, { kind: 'pop', x: dev.x, y: dev.y - 26, text: 'Initializing 847 beans…', ttl: 1 })`.

- [ ] **Step 4: Run all the tests and check they pass**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/developers/java.js src/engine/devs.js tests/upgrades.test.js
git commit -m "feat: Java upgrades: Spring Boot, Enterprise Architect, Garbage Collector"
```

---

### Task 5: React path and ecosystem bonus

**Files:**
- Modify: `src/content/developers/react.js`
- Test: `tests/upgrades.test.js`

**Interfaces:**
- Consumes: `hitBug`, `bugsInRange`, `shotBeam`, and `def.modifyStats` from Tasks 1 and 2, plus `game.random`.

- [ ] **Step 1: Write failing tests**

- **`react: Vite fire rate, names, tooltip`**
  - The level-0 name is `Create React App`.
  - After `vite`, the name is `Vite` and `fireRate` is 6.
  - `getDeveloper('react').upgrades.level2.tooltip === 'CRA is deprecated, sorry.'`
- **`react: ecosystem +10% fire rate per other React dev, capped at +50%`**
  - One React developer on its own has a fire rate of 4.
  - With 2 others it's 4 × 1.2.
  - With 7 others it's 4 × 1.5.
  - A Java developer nearby doesn't count.
- **`react: Next.js hits the target and the next 2 bugs behind it`**
  - Four frozen `nullpointer` bugs (not React's counter) with hp 1000, at distances 220, 240, 260 and 280, all in range of (3,3).
  - After one shot, the 3 furthest-along bugs each lose 6 (the base damage), and the fourth loses nothing.
- **`react: useEffect Hell chains at 20%, capped at 10`**
  - Set `g.random = () => 0.1` (every roll chains). One shot on a 1000-hp `nullpointer` costs it 11 × 6 = 66: 1 hit plus 10 chained hits.
  - Set `g.random = () => 0.5`. One shot costs 6.
  - With `0.1` and a 6-hp target plus a second bug in range, the chain carries on to the second bug once the first dies.

- [ ] **Step 2: Run them and check they fail**

Run: `node --test tests/upgrades.test.js`
Expected: the new React tests FAIL.

- [ ] **Step 3: Implement the React content**

In `react.js`:
- `levelName: 'Create React App'`.
- Developer-level `modifyStats`: `stats.fireRate *= 1 + 0.1 * min(5, other React devs on the map)`.
- `level2`, `vite`: `name: 'Vite'`, `cost: 40`, `description: 'Much faster rate of fire'`, `tooltip: 'CRA is deprecated, sorry.'`, `stats: { fireRate: 6 }`.
- `level3[0]`, `nextjs`:
  - `name: 'Next.js'`, `kind: 'steady'`, `cost: 90`
  - `description: 'Hits pierce 2 more bugs'`
  - `tooltip: 'Renders before they arrive.'`
  - `fire`: hit the target plus the next 2 entries after it in `bugsInRange`, with a beam to each.
- `level3[1]`, `effecthell`:
  - `name: 'useEffect Hell'`, `kind: 'gamble'`, `cost: 80`
  - `description: '20% chance each hit re-renders'`
  - `fire`: hit the target. Then, while fewer than 10 chain hits have happened and `game.random() < 0.2`, hit again: the same target if it's alive, or else the first entry of `bugsInRange`. Stop when there's no target left.

- [ ] **Step 4: Run all the tests and check they pass**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/content/developers/react.js tests/upgrades.test.js
git commit -m "feat: React upgrades: Vite, Next.js, useEffect Hell, ecosystem bonus"
```

---

### Task 6: .NET path and Azure billing

**Files:**
- Modify: `src/content/developers/dotnet.js`
- Test: `tests/upgrades.test.js`

**Interfaces:**
- Consumes: `hitBug`, `bugsInRange`, `shotBeam`, `Upgrade.update`, `Upgrade.panelButtons`.

- [ ] **Step 1: Write failing tests**

- **`dotnet: names and stats`**
  - Level 0 is `.NET Framework 4.8`.
  - `core` makes it `.NET Core` with a fire rate of 0.9.
  - `vs` makes it `Visual Studio Enterprise` with damage 160 and fire rate 0.6.
- **`dotnet: Azure splashes everything within 1 cell of the target`**
  - Three frozen `typo` bugs with hp 1000 at distances 300 (the target), 270 (30 px behind it) and 220 (80 px away, still in range of (3,3)).
  - After one shot, the target and its neighbour each lose 55 and the third loses nothing.
- **`Review Focus 3: Azure bills 1 Warrant per 0.5 s with a bug in range, never below 0, stops at 0`**
  - Starting at 3 Warrants, with a bug in range, step `tickDevs` for 2 s in 0.05 s steps. Warrants go 3 → 0 and are always whole numbers.
  - After Warrants hit 0, the bug's hp stays the same.
  - Set Warrants to 5 and step again. The hp drops.
  - With no bug in range, 2 s of ticks charge nothing.
- **`dotnet: Azure toggle`**
  - Right after purchase, `panelButtons(g, d)[0].label === 'Azure on'`.
  - `onClick` turns it off: the label becomes `'Azure off'`, it doesn't fire, and it isn't billed.

- [ ] **Step 2: Run them and check they fail**

Run: `node --test tests/upgrades.test.js`
Expected: the new .NET tests FAIL.

- [ ] **Step 3: Implement the .NET content**

In `dotnet.js`:
- `levelName: '.NET Framework 4.8'`.
- `level2`, `core`: `name: '.NET Core'`, `cost: 90`, `description: 'Faster attacks'`, `stats: { fireRate: 0.9 }`.
- `level3[0]`, `vs`: `name: 'Visual Studio Enterprise'`, `kind: 'steady'`, `cost: 160`, `description: 'Huge single hit'`, `stats: { damage: 160, fireRate: 0.6 }`.
- `level3[1]`, `azure`:
  - `name: 'Azure Function'`, `kind: 'gamble'`, `cost: 140`
  - `description: 'Area damage, pay-as-you-go'`
  - The on/off state is `dev.state.azureOff` (undefined means on).
  - `update`:
    - When off, return `false`.
    - With no bug in range, return `true` without billing.
    - Otherwise add `dt` to `dev.state.bill`, and while `bill ≥ 0.5` and `warrants > 0`, take 1 Warrant and subtract 0.5 from the bill.
    - Return `game.warrants > 0`.
  - `fire`: `hitBug` every bug within 40 px of the target, with a `ring` effect at the target.
  - `panelButtons`: `[{ label: on ? 'Azure on' : 'Azure off', onClick: toggle }]`.

- [ ] **Step 4: Run all the tests and check they pass**

Run: `node --test`
Expected: all PASS.

- [ ] **Step 5: Play-check all three paths in the browser**

Run `python -m http.server 8000` and open `/?demo=1`. In the console, run `game.game.devs.forEach(d => d.xp = 40); game.game.warrants = 5000`. For each type, buy level 2 and then each branch on separate developers. Check:
- the buttons show Steady or Gamble and a lock reason, and the tooltips appear,
- the ready marker shows and then clears,
- the beans pop appears on placing a Java developer,
- the Azure toggle works and Warrants drain,
- the GC pause and pulse show,
- there are no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/content/developers/dotnet.js tests/upgrades.test.js
git commit -m "feat: .NET upgrades: .NET Core, Visual Studio Enterprise, Azure Function"
```

---

### Task 7: Seeded balance sim, tuning and docs

**Files:**
- Modify: `scripts/sim.mjs`, `CONTRIBUTING.md`, `README.md`, possibly the numbers in the three developer files.

**Interfaces:**
- Consumes: `nextUpgrades`, `upgradeStatus`, `buyUpgrade` (Task 1).

- [ ] **Step 1: Seeds**

Add `mulberry32(seed) → () => number` to `sim.mjs`. `play()` takes a seed and sets `g.random = mulberry32(seed)` right after `createGame()`. The `[seed-count]` argument (default 10) sets how many seeds each strategy runs.

- [ ] **Step 2: Upgrading bot**

`play(order, usePowers, branch, seed)`, where `branch` is `'A'`, `'B'` or `'alt'`. At every bell, before hiring:
1. Repeatedly buy the cheapest `ok` upgrade among all developers.
2. At level 1, pick `level3[0]` for `'A'` and `level3[1]` for `'B'`. With `'alt'`, alternate per developer by `dev.id % 2`.
3. Then hire as today.

Remove the unused `grantXp` import.

- [ ] **Step 3: Strategies and report**

Strategies:
- The four existing strategies with `'alt'`, with and without powers.
- Then for each type: `'{type} A'` and `'{type} B'`, single-type order, with powers.

For each strategy print one line: name, `wins x/N`, average wave reached, average lives left, and level-3 purchases per upgrade id (for example `architect 31 gc 0`).

Run: `node scripts/sim.mjs 10`
Expected: the report prints with no errors. Every branch id shows purchases above 0 in its own strategy.

- [ ] **Step 4: Tune**

Done when both of these hold:
1. **Every strategy that wins today still wins** most seeds. Baseline on `main` before this change (one unseeded run each):

   ```
   react only   no powers : lost wave 10   powers : won  lives 11
   java only    no powers : won  lives 14  powers : won  lives 20
   mixed        no powers : won  lives 17  powers : won  lives 20
   dotnet only  no powers : lost wave 2    powers : lost wave 2
   ```

   So java only, mixed and react-with-powers must keep winning. React without powers and .NET only may stay losing. .NET only loses because one developer can't hold wave 1, which upgrades don't change.
2. **For each type, the A and B lines are close by eye.** Neither branch clearly wins more or keeps clearly more lives.

Adjust only costs and the numbers in the content files. Note each change in the commit message.

- [ ] **Step 5: Docs**

In `CONTRIBUTING.md`:
- Add an "Upgrades" section with the `levelName` and `upgrades` shape and the hooks list (from the Task 1 and Task 2 Interfaces), with a short Java example.
- Add `dev:upgradeready` to the events list, and note that `dev:levelup` now fires on purchase with `{ game, dev, level, upgrade }`.
- Change the rule to: "To add an upgrade, edit your developer's own file."

In `README.md`: replace the "Levels" bullet with the upgrade paths, and remove the Junior / Consultant / Senior wording.

- [ ] **Step 6: Final verification**

Run: `node --test && node scripts/sim.mjs 10`
Expected: all tests PASS, and the sim meets the Step 4 bar. Play one wave in the browser.

- [ ] **Step 7: Commit**

```bash
git add scripts/sim.mjs CONTRIBUTING.md README.md src/content/developers/
git commit -m "feat: seeded balance sim with branch strategies; docs for upgrades"
```
