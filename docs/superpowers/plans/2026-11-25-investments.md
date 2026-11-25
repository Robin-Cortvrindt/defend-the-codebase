# Investments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanent upgrades between runs. A loss pays Investor Capital based on how far you got, and you spend it on investments that strengthen developers, power-ups, and unlock the .NET firewall.

**Architecture:** There's a new content type (`registerInvestment`), with one file per investment under `src/content/investments/`. A new engine module, `src/engine/investments.js`, owns the saved balance and levels (in `localStorage`, with storage you can inject for Node), buying, the capital award, and applying bought levels at `startGame()`. Small engine hooks (`mods.devCostMultiplier`, `game.powerupMods`, `game.unlocks`) let content files read the bonuses. The firewall is a feature registered by its own investment file.

**Tech Stack:** Vanilla ES modules, Canvas 2D, DOM overlay, `node --test` (Node 20+), no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-25-investments-design.md`

## Global Constraints

- One investment = one file in `src/content/investments/` + one line in `src/content/manifest.js`. Content never imports DOM.
- `src/engine/` must run in Node: no bare `localStorage`, `document` or `window` in engine modules (the UI layer `ui.js` is the exception, as today).
- Every content hook call (`apply`, `getCost`, `effectText`, feature `update`/`draw`) is wrapped in try/catch, so a broken file is logged and skipped.
- Storage key: `dtc-investments`, shape `{ capital: number, levels: { [id]: number } }`.
- Capital on loss: `s + 5*floor(s/7) + 15*floor(s/28)`, where `s = game.sprint`. Demo mode (`?demo=1`) earns nothing.
- Level bonuses add up (level 3 of +10% = +30%), and are not compounded.
- Firewall: 10 damage/s, also hits bosses, no counter ×2, not scaled by developer bonuses. A kill gives 1 XP and +1 kill to **both** developers.
- Tuning targets: firewall (cost 40) affordable after about **3 runs**, whole catalog after about **20–25 runs**, and a fully maxed bot in the sim **still loses in Year 2 or 3**.
- Copy: currency name "Investor Capital", icon 💼. Shop title "Investments". Game-over line "New investors put in +X 💼".

## Review Focus

1. **Opening the shop from the game-over screen and pressing Back** re-renders the lost screen. Capital must not be paid twice, and "Best run: New" must not turn into an old record. (Task 1 tests the award guard. Task 5 stores the best result on the game.)
2. **Hand-edited or corrupt storage** (not JSON, negative capital, a level above max, unknown ids, `null`) must load as a sane state, never crash or give free levels. (Task 1)
3. **An investment file that was removed** while its id is still in saved levels is ignored at apply time, and the rest still applies. (Task 1)
4. **Power-up symmetry:** a boosted CEO or training manager running while an event also changes the same multiplier must leave `game.mods` exactly as before once both end. (Task 3)
5. **Selling a .NET developer mid-wave** removes its firewall on the very next tick: no damage and no XP to a sold developer. (Task 4)
6. **`startGame` called twice** on one game (demo path, menu) applies bonuses only once. (Task 1)

---

### Task 1: Investments engine (registry, storage, buying, capital, applying)

**Files:**
- Modify: `src/engine/registry.js`: add an `investments` Map, `registerInvestment`, `getInvestments`, `getInvestment`, and clear it in `resetRegistry`.
- Create: `src/engine/investments.js`
- Modify: `src/engine/game.js`: `createGame()` adds `unlocks: {}`, `powerupMods: {}`, `mods.devCostMultiplier: 1`, `investmentsApplied: false`, `capitalEarned: null`. `startGame()` calls `applyInvestments(game)`.
- Test: `tests/investments.test.js`

**Interfaces:**
- Produces (`src/engine/registry.js`): `registerInvestment(def)`, `getInvestments(): def[]`, `getInvestment(id)`. Def shape: `{ id, name, description, group: 'developers'|'powerups'|'unlocks', maxLevel, getCost(level), apply(game, level), effectText?(level) }`.
- Produces (`src/engine/investments.js`):
  - `setStorage(storage | null)`: storage is `{ getItem, setItem, removeItem }`; `null` means an in-memory store. The default is `globalThis.localStorage` if reading it doesn't throw, otherwise in-memory.
  - `loadProgress(): { capital, levels }` and `saveProgress(progress)`. The loader sanitizes: capital is a finite number ≥ 0, else 0; each level is an integer clamped to `[0, def.maxLevel]` when the def is registered; non-numeric levels are dropped.
  - `investmentLevel(id): number`, `investmentCost(id): number` (`Infinity` when maxed, unknown, or `getCost` throws), `canInvest(id): boolean`, `invest(id): boolean` (saves, emits `investment:bought` with `{ id, level }`).
  - `capitalFor(sprint): number`, the formula from Global Constraints.
  - `awardCapital(game): number`: adds `capitalFor(game.sprint)` once and saves. It sets `game.capitalEarned`, and returns the stored value on later calls without adding again.
  - `applyInvestments(game)`: when `game.investmentsApplied` is false, calls `apply(game, level)` for each registered def with level > 0, each one in try/catch, then sets the flag.
  - `resetProgress()`: saves `{ capital: 0, levels: {} }`.
  - `const CAPITAL_KEY = 'dtc-investments'`.

- [ ] **Step 1: Write the failing tests** in `tests/investments.test.js`. `beforeEach`: `resetRegistry(); clearAll(); setStorage(null);` and register a test investment `{ id: 'x', group: 'developers', maxLevel: 2, getCost: l => [10, 20][l], apply: (g, l) => { g.mods.damageMultiplier *= 1 + 0.1 * l; } }`.

```js
test('capitalFor: 1/sprint, +5/quarter, +15/year', () => {
  assert.deepEqual([0, 4, 7, 9, 28].map(capitalFor), [0, 4, 12, 14, 63]);
});
test('invest deducts, raises level, saves, respects max', () => {
  saveProgress({ capital: 100, levels: {} });
  assert.equal(invest('x'), true);
  assert.deepEqual(loadProgress(), { capital: 90, levels: { x: 1 } });
  assert.equal(investmentCost('x'), 20);
  invest('x');
  assert.equal(investmentCost('x'), Infinity);
  assert.equal(invest('x'), false);
  assert.equal(loadProgress().capital, 70);
});
test('cannot invest without enough capital', () => { saveProgress({ capital: 5, levels: {} }); assert.equal(invest('x'), false); });
test('Review Focus 2: corrupt storage loads as a sane state', () => {
  for (const raw of ['not json', 'null', '{"capital":-5,"levels":{"x":99,"y":"a"}}']) {
    const store = { getItem: () => raw, setItem() {}, removeItem() {} };
    setStorage(store);
    const p = loadProgress();
    assert.ok(p.capital >= 0);
    assert.ok(!p.levels.x || p.levels.x <= 2);
    assert.equal(p.levels.y, undefined);
  }
});
test('Review Focus 1: awardCapital pays once per game', () => {
  const g = createGame(); g.sprint = 9;
  assert.equal(awardCapital(g), 14);
  assert.equal(awardCapital(g), 14);
  assert.equal(loadProgress().capital, 14);
});
test('Review Focus 3+6: applyInvestments skips unknown ids and throwing applies, and runs once', () => {
  registerInvestment({ id: 'boom', group: 'developers', maxLevel: 1, getCost: () => 1, apply() { throw new Error('x'); } });
  saveProgress({ capital: 0, levels: { x: 2, boom: 1, gone: 3 } });
  const g = createGame(); startGame(g); startGame(g);
  assert.ok(Math.abs(g.mods.damageMultiplier - 1.2) < 1e-9);
});
test('resetProgress clears capital and levels', () => { saveProgress({ capital: 50, levels: { x: 1 } }); resetProgress(); assert.deepEqual(loadProgress(), { capital: 0, levels: {} }); });
```

- [ ] **Step 2: Run `node --test tests/investments.test.js`.** Expected: FAIL (module/exports not found).
- [ ] **Step 3: Implement** the registry additions, `src/engine/investments.js` and the `game.js` changes above. `game.js` imports `applyInvestments` from `./investments.js`. `investments.js` must not import from `game.js` (that would be a cycle); it only needs `registry.js` and `events.js`.
- [ ] **Step 4: Run `node --test`.** Expected: all tests pass (old and new).
- [ ] **Step 5: Commit:** `git add src/engine/registry.js src/engine/investments.js src/engine/game.js tests/investments.test.js && git commit -m "feat: investments engine — Investor Capital, buying, saving, applying at run start"`

---

### Task 2: Developer investments

**Files:**
- Modify: `src/engine/devs.js`: add `hireCost(game, typeId)`, and use it in `canPlace` and `placeDev` (`dev.spent = hireCost(...)`).
- Modify: `src/engine/ui.js`: hire buttons show `hireCost(g, def.id)` and use it for the `poor` class (update the cost text in `updateUI`, which the `set()` helper keeps cheap).
- Modify: `scripts/sim.mjs`: replace `getDeveloper(type).cost` with `hireCost(g, type)`.
- Create: `src/content/investments/better-laptops.js`, `agile-coaching.js`, `bigger-monitors.js`, `recruitment-network.js`
- Modify: `src/content/manifest.js`: add a `// Investments (permanent, bought between runs)` section with the four lines.
- Test: `tests/investments.test.js` (append)

**Interfaces:**
- Consumes: `registerInvestment` and `applyInvestments` from Task 1; `game.mods.devCostMultiplier` from Task 1.
- Produces: `hireCost(game, typeId): number = Math.round(def.cost * game.mods.devCostMultiplier)` (`Infinity` for an unknown type).

Starting values (tuned in Task 6). All are `group: 'developers'`:

| file / id | name | per level | max | costs | apply |
|---|---|---|---|---|---|
| `better-laptops` | Better laptops | +10% damage | 5 | 10, 20, 35, 55, 80 | `mods.damageMultiplier *= 1 + 0.10*level` |
| `agile-coaching` | Agile coaching | +8% attack speed | 5 | 10, 20, 35, 55, 80 | `mods.fireRateMultiplier *= 1 + 0.08*level` |
| `bigger-monitors` | Bigger monitors | +5% range | 3 | 15, 30, 50 | `mods.rangeMultiplier *= 1 + 0.05*level` |
| `recruitment-network` | Recruitment network | −5% hiring cost | 3 | 15, 30, 50 | `mods.devCostMultiplier *= 1 - 0.05*level` |

Each file exports its def as `default` (so tests can re-register it after `resetRegistry`), and has `effectText(level)`, e.g. `+20% damage`.

- [ ] **Step 1: Write the failing tests.** A helper `withLevels(levels)` saves `{ capital: 0, levels }`, creates a game and calls `startGame`. Register the four defs from their files in `beforeEach`, plus a developer `{ id: 'r', cost: 50, damage: 6, fireRate: 4, range: 2.2 }`.

```js
test('developer investments raise damage, attack speed, range and cut hiring cost', () => {
  const g = withLevels({ 'better-laptops': 3, 'agile-coaching': 2, 'bigger-monitors': 1, 'recruitment-network': 2 });
  assert.ok(Math.abs(g.mods.damageMultiplier - 1.3) < 1e-9);
  assert.ok(Math.abs(g.mods.fireRateMultiplier - 1.16) < 1e-9);
  assert.ok(Math.abs(g.mods.rangeMultiplier - 1.05) < 1e-9);
  assert.equal(hireCost(g, 'r'), 45);
  const dev = placeDev(g, 'r', 3, 3);
  assert.equal(dev.spent, 45);
  assert.equal(g.warrants, 100 - 45);
});
test('no investments: hireCost equals the base cost', () => { assert.equal(hireCost(withLevels({}), 'r'), 50); });
```

- [ ] **Step 2: Run `node --test tests/investments.test.js`.** Expected: FAIL.
- [ ] **Step 3: Implement** `hireCost`, the four files, the manifest lines and the UI/sim cost changes.
- [ ] **Step 4: Run `node --test` and `node scripts/sim.mjs`.** Expected: all tests pass, and the sim runs with unchanged output shape (no investments saved in Node, so the results are as before).
- [ ] **Step 5: Commit:** `git commit -m "feat: developer investments — damage, attack speed, range, cheaper hires"` (stage the files listed above).

---

### Task 3: Power-up investments

**Files:**
- Modify: `src/engine/powerups.js`: add `powerupMod(game, id)` and `effectiveCooldown(game, id)`, and use the effective cooldown in `usePowerup` and `tickPowerups`.
- Modify: `src/engine/ui.js`: the power-up status shows `def.describe?.(g) ?? def.description` (in try/catch), and the cooldown bar uses `effectiveCooldown`.
- Modify: `src/content/powerups/training-manager.js`, `business-manager.js`, `ceo.js`, `claude.js`
- Create: `src/content/investments/training-budget.js`, `training-planning.js`, `sales-targets.js`, `sales-pipeline.js`, `leadership-coaching.js`, `ceo-calendar.js`, `prompt-engineering.js`, `enterprise-plan.js`
- Modify: `src/content/manifest.js` (8 lines)
- Test: `tests/powerups.test.js` (append)

**Interfaces:**
- Consumes: `game.powerupMods` (Task 1), `registerInvestment`.
- Produces:
  - `powerupMod(game, id): { cooldown: number, effect: number, cost: number }`, which creates the entry `{ cooldown: 1, effect: 0, cost: 1 }` on `game.powerupMods[id]` when it's missing.
  - `effectiveCooldown(game, id): number = (def.cooldown || 0) * powerupMod(game, id).cooldown`.
  - Power-up defs gain an optional `describe(game): string` (document it in CONTRIBUTING in Task 7).
- Power-up effect formulas (`e = powerupMod(game, id).effect`). Each `activate` stores the factor on `st.factor`, and `deactivate` divides by `st.factor`:
  - training: `st.factor = 2 + 0.25*e` on `xpMultiplier`, describe `×{factor} XP`
  - business: `st.factor = 2 + 0.25*e` on `warrantMultiplier`, describe `×{factor} Warrants`
  - ceo: `st.factor = 1.5 + 0.10*e` on `fireRateMultiplier`, describe `Attack speed +{round((factor-1)*100)}%`
  - claude: backfire chance `max(0.10, BACKFIRE_CHANCE - 0.05*e)`; `getCost` multiplies by `powerupMod(game,'claude').cost`; describe `Squash every bug · {round(chance*100)}% backfire`
- Investments (`group: 'powerups'`, `maxLevel` 3):

| id | name | apply |
|---|---|---|
| `training-budget` | Training budget | `powerupMod(g,'training').effect += level` |
| `training-planning` | Training planning | `powerupMod(g,'training').cooldown *= 1 - 0.10*level` |
| `sales-targets` | Sales targets | `powerupMod(g,'business').effect += level` |
| `sales-pipeline` | Sales pipeline | `powerupMod(g,'business').cooldown *= 1 - 0.10*level` |
| `leadership-coaching` | Leadership coaching | `powerupMod(g,'ceo').effect += level` |
| `ceo-calendar` | CEO's calendar | `powerupMod(g,'ceo').cooldown *= 1 - 0.10*level` |
| `prompt-engineering` | Prompt engineering | `powerupMod(g,'claude').effect += level` |
| `enterprise-plan` | Enterprise plan | `powerupMod(g,'claude').cost *= 1 - 0.10*level` |

Costs: 10, 25, 45 for the training/business/CEO ones; 15, 30, 50 for both Claude ones.

- [ ] **Step 1: Write the failing tests** (append to `tests/powerups.test.js`; register the eight investment defs in that file's `fresh()`, and call `setStorage(null)`).

```js
test('effect level makes training stronger; activate→deactivate restores exactly', () => {
  const g = waveGame(); powerupMod(g, 'training').effect = 2; spawnBug(g, 'b', 10);
  usePowerup(g, 'training'); assert.equal(g.mods.xpMultiplier, 2.5);
  tickPowerups(g, 15.01); assert.equal(g.mods.xpMultiplier, 1);
});
test('cooldown level shortens the cooldown', () => {
  const g = waveGame(); powerupMod(g, 'ceo').cooldown = 0.7;
  usePowerup(g, 'ceo'); tickPowerups(g, 10.01);
  assert.ok(Math.abs(powerupState(g, 'ceo').cooldownLeft - 28) < 0.05);
});
test('Review Focus 4: CEO boost + another fireRate change in between unwind cleanly', () => {
  const g = waveGame(); powerupMod(g, 'ceo').effect = 3;
  usePowerup(g, 'ceo'); g.mods.fireRateMultiplier *= 0.5;   // e.g. heating out starts
  tickPowerups(g, 10.01); g.mods.fireRateMultiplier /= 0.5; // CEO ends, then event ends
  assert.ok(Math.abs(g.mods.fireRateMultiplier - 1) < 1e-9);
});
test('Claude: prompt engineering lowers backfire, enterprise plan lowers price', () => {
  const g = waveGame(); powerupMod(g, 'claude').effect = 3; powerupMod(g, 'claude').cost = 0.7;
  assert.equal(powerupCost(g, 'claude'), 105);
  g.random = () => 0.12; g.warrants = 1000; spawnBug(g, 'b', 10);
  usePowerup(g, 'claude'); assert.equal(g.bugs.length, 0);   // 0.12 ≥ 0.10 → success
});
test('investment files apply to powerupMods via startGame', () => {
  saveProgress({ capital: 0, levels: { 'training-budget': 1, 'ceo-calendar': 2 } });
  const g = createGame(); startGame(g);
  assert.equal(powerupMod(g, 'training').effect, 1);
  assert.ok(Math.abs(powerupMod(g, 'ceo').cooldown - 0.8) < 1e-9);
});
```

- [ ] **Step 2: Run `node --test tests/powerups.test.js`.** Expected: the new tests FAIL, and the existing ones still pass.
- [ ] **Step 3: Implement** the engine helpers, the power-up file changes, the eight investment files, the manifest lines, and the UI description/cooldown bar.
- [ ] **Step 4: Run `node --test`.** Expected: all pass.
- [ ] **Step 5: Commit:** `git commit -m "feat: power-up investments — stronger effects, shorter cooldowns, safer and cheaper Claude"`

---

### Task 4: Security training (.NET) and the firewall

**Files:**
- Modify: `src/engine/map.js`: add `isPathCell(col, row): boolean`, meaning in bounds and the cell centre is within the same `minDist` of a path segment that `isBuildable` uses (share the constant/helper; don't duplicate the maths).
- Create: `src/content/investments/security-training.js`
- Modify: `src/content/manifest.js` (1 line)
- Test: `tests/firewall.test.js`

**Interfaces:**
- Consumes: `registerInvestment`, `registerFeature`, `killBug` (game.js), `grantXp` (devs.js), `cellAt`, `isPathCell`, `CELL` (map.js).
- Produces (exported from `security-training.js` for tests): `default` (the investment def), `firewallFeature` (the feature def), `FIREWALL_DPS = 10`, `findFirewalls(game): Array<{ col, row, devs: [devA, devB] }>`, `tickFirewalls(game, dt)`.
- Investment: `{ id: 'security-training', name: 'Security training (.NET)', group: 'unlocks', maxLevel: 1, getCost: () => 40, apply: g => { g.unlocks.firewall = true; }, effectText: () => 'Opposite .NET pairs build a firewall' }`.
- Feature `{ id: 'firewall', update(game, dt), draw(ctx, game) }`. `update` calls `tickFirewalls` only when `game.unlocks?.firewall && game.phase === 'wave'`. `draw` renders nothing without the unlock.

`findFirewalls`: for each .NET developer `d` (`type === 'dotnet'`), look at `(d.col, d.row + 2)` and `(d.col + 2, d.row)`. If another .NET developer stands there and the cell in between `isPathCell`, push a firewall on that middle cell. If two pairs share a middle cell, merge them into one entry whose `devs` holds all of their developers. It's recomputed every call, with no cache.

`tickFirewalls`: for each bug where `cellAt(bug.x, bug.y)` matches a firewall cell, `bug.hp -= FIREWALL_DPS * dt` (at most once per tick per bug). If `hp <= 0`: `killBug(game, bug, null)`, then for every developer in that firewall run `grantXp(game, dev, 1); dev.kills++`.

Draw: a fuchsia (`#C026D3`) bar across the lane cell, perpendicular to the lane. Pulse alpha 0.35–0.6 from `game.time`, plus a thin bright core line. Features draw after bugs (`render.js`), so the bar must stay translucent enough that bugs remain visible. *(This differs from the spec's "drawn under the bugs": that would need an engine render hook, and translucency gets the same result.)*

- [ ] **Step 1: Write the failing tests** in `tests/firewall.test.js`. Register the `dotnet` developer from its file, a bug `{ id: 'b', hp: 100, speed: 0, livesLost: 1, reward: 3, radius: 5 }`, a boss bug, waves `[{ groups: [] }]`, and `firewallFeature`. Lane facts from `map.js`: row 1 is a horizontal lane at columns 0–3 (y=60), and column 4 is a vertical lane at rows 2–5 (x=180).

```js
function dotnetGame() { const g = createGame(); startGame(g); startWave(g); g.spawnQueue = []; g.warrants = 9999; g.unlocks.firewall = true; return g; }
test('pair across a horizontal lane forms a firewall on the lane cell', () => {
  const g = dotnetGame(); placeDev(g, 'dotnet', 2, 0); placeDev(g, 'dotnet', 2, 2);
  assert.deepEqual(findFirewalls(g).map(f => [f.col, f.row]), [[2, 1]]);
});
test('pair across a vertical lane forms a firewall', () => {
  const g = dotnetGame(); placeDev(g, 'dotnet', 3, 4); placeDev(g, 'dotnet', 5, 4);
  assert.deepEqual(findFirewalls(g).map(f => [f.col, f.row]), [[4, 4]]);
});
test('no firewall: one dev, non-lane gap, other dev types', () => {
  const g = dotnetGame(); placeDev(g, 'dotnet', 2, 0);
  assert.equal(findFirewalls(g).length, 0);
  placeDev(g, 'dotnet', 7, 0); placeDev(g, 'dotnet', 9, 0);    // gap cell (8,0) is not lane
  assert.equal(findFirewalls(g).length, 0);
});
test('damages a bug inside the cell at 10/s, also a boss, not one outside', () => { /* spawn at the distance whose pointAt is in cell (2,1); step tickFirewalls(g, 1); hp 90; bug elsewhere stays 100 */ });
test('kill pays Warrants and gives XP + kill to both developers', () => { /* bug hp 5, tick 1 s → bug gone, warrants +3, both devs xp 1 and kills 1 */ });
test('without the unlock the feature does nothing', () => { /* g.unlocks.firewall = false; firewallFeature.update(g, 1) → hp unchanged */ });
test('Review Focus 5: selling one developer removes the firewall immediately', () => { /* sellDev(g, a); tickFirewalls(g,1) → hp unchanged, sold dev xp 0 */ });
test('buying security-training then startGame sets game.unlocks.firewall', () => { /* saveProgress levels {'security-training':1}; startGame → true */ });
```

Find the spawn distance for cell (2,1): the horizontal stretch starts at x=0, so distance 100 → x=100, y=60 → cell (2,1).

- [ ] **Step 2: Run `node --test tests/firewall.test.js`.** Expected: FAIL.
- [ ] **Step 3: Implement** `isPathCell`, `security-training.js` and the manifest line.
- [ ] **Step 4: Run `node --test`.** Expected: all pass.
- [ ] **Step 5: Commit:** `git commit -m "feat: Security training investment unlocks the .NET firewall"`

---

### Task 5: Shop screen, menu button, game-over payout

**Files:**
- Modify: `src/engine/ui.js`: add an "Investments · 💼 N" button on the menu card; add `renderInvestments(ov)` (the shop) and `showShop()`/`closeShop()`; on the lost screen, the payout line and an Investments button; store the best-run result on the game.
- Modify: `src/main.js`: compute `const DEMO = new URLSearchParams(location.search).has('demo')` once (reuse it for the demo block) and add `on('game:lost', ({ game }) => { if (!DEMO && game === app.game) awardCapital(game); })`.
- Modify: `style.css`: shop styles, reusing `.screen-card`, `.shop`, `.shop-row` and adding only what's missing (section headings, a level badge, a disabled buy button).

**Interfaces:**
- Consumes: `getInvestments`, `loadProgress`, `investmentLevel`, `investmentCost`, `canInvest`, `invest`, `resetProgress` (Task 1); `game.capitalEarned` (set by `awardCapital`).
- Produces: none for later tasks.

Behaviour:
- The shop replaces the overlay contents. **Back** calls `showOverlay(app.game.phase)` again.
- Sections in this order: Developers, Power-ups, Unlocks (by `group`). Each row shows the name, `effectText(level)` (or `description` when level is 0 or `effectText` is missing), `Lv a/b` (hidden for unlocks), and a button `💼 cost` / `Max` / `Owned` (unlock). The button is disabled when `!canInvest(id)`. After buying, play `powerup` and re-render the shop.
- **Reset progress** uses `window.confirm('Reset all investments and Investor Capital?')`, then resets and re-renders.
- Lost screen: compute `recordBest` once per game (`g.bestResult ??= recordBest(g.sprint)`) so re-rendering after Back keeps "New". Show `New investors put in +${g.capitalEarned ?? 0} 💼` in the eyebrow/lede area, plus an `Investments` button (`btn ghost big`) next to "Hotfix and retry →".
- Menu: the button label reads the balance fresh each time the menu renders.

- [ ] **Step 1: Implement** the above.
- [ ] **Step 2: Run `node --test`.** Expected: all pass (no UI tests; this guards against engine regressions).
- [ ] **Step 3: Browser check.** Run `python -m http.server 8000`, open `http://localhost:8000`, then:
  - The menu shows `Investments · 💼 0`.
  - In the console, set `localStorage.setItem('dtc-investments', JSON.stringify({capital: 200, levels: {}}))` and reload: the menu shows 💼 200.
  - Open the shop, buy Better laptops and Security training: the balance drops, the rows update, and Back returns to the menu.
  - Start, place .NET at (2,0) and (2,2), start the wave: a fuchsia bar shows on the lane and typo bugs crossing it lose HP.
  - In the console, set `game.game.lives = 1` and let one bug leak. After the collapse, the game-over screen shows "New investors put in +N 💼".
  - Open Investments and press Back: the payout and "Best run" are unchanged, and the balance went up only once.
  - Hotfix and retry: hire buttons show the discounted price if Recruitment network is owned.
  - Open `?demo=1`, lose: the payout is +0.
  - There are no console errors throughout.
- [ ] **Step 4: Commit:** `git commit -m "feat: Investments shop on the menu and game-over screen; investors pay out on a loss"`

---

### Task 6: Balance — sim profiles and tuning

**Files:**
- Modify: `scripts/sim.mjs`
- Possibly modify: the investment files' costs/bonuses and `capitalFor` in `src/engine/investments.js` (and the matching test values).

**Interfaces:**
- Consumes: everything above. Use `setStorage(null)` and `saveProgress` to drive profiles.

Add two modes and keep the default mode unchanged:
- `node scripts/sim.mjs --profile max`: saves every investment at `maxLevel` before each run, buys the firewall, and the bot also places .NET developers in opposite pairs when it hires .NET (pick pairs from `findFirewalls`-valid cell pairs). It prints the same result lines as today.
- `node scripts/sim.mjs --meta [runs=30]`: starts from empty progress. Each run: play with the `mixed` strategy and power-ups, `awardCapital`, then greedily buy the cheapest affordable investment until nothing is affordable. It prints `run N · died <label> · +capital · total bought k/13`, the run on which the firewall was bought, and the run on which the catalog completed (or "not within N").

- [ ] **Step 1: Implement both modes.**
- [ ] **Step 2: Run `node scripts/sim.mjs --meta 40` and `node scripts/sim.mjs --profile max`.** Record the output.
- [ ] **Step 3: Tune** costs, per-level bonuses and the capital formula until: firewall bought on run 2–4; catalog complete on run 18–27; every `--profile max` strategy line ends `lost` in Year 2 or Year 3. Prefer changing costs and the capital formula over bonuses. Update the test values that pin changed numbers.
- [ ] **Step 4: Run `node --test`.** Expected: all pass. Paste the final sim output into the commit message body.
- [ ] **Step 5: Commit:** `git commit -m "balance: tune investments to the pacing targets; sim --meta and --profile max"`

---

### Task 7: Docs

**Files:**
- Modify: `README.md`: add an "Investments" bullet under "How it plays" (currency, payout, the three groups, the firewall).
- Modify: `CONTRIBUTING.md`: add a `registerInvestment` row to the table, `investment:bought` to the events list, a "Permanent bonuses" note on `game.powerupMods` / `powerupMod()`, `game.unlocks`, `mods.devCostMultiplier`, and power-up `describe(game)`; and point at `security-training.js` as the template for future React and Java unlocks.
- Modify: `src/content/features/example-feature.js`: add a commented example investment, only if that file shows every other type (it does; keep the pattern).

- [ ] **Step 1: Write the docs.**
- [ ] **Step 2: Run `node --test`.** Expected: all pass (`content.test.js` loads the example feature).
- [ ] **Step 3: Commit:** `git commit -m "docs: investments in README and CONTRIBUTING"`
