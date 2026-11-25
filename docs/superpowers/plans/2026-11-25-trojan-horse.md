# Trojan Horse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A boss the player pays to summon at the victory bell: 3× the security risk, instant loss if it leaks, a scattered 2× jackpot if squashed, untouchable by Claude.

**Architecture:** One engine hook (`bellActions` on features, read through a pure `getBellActions(game)` in `src/engine/bell.js`, rendered by `ui.js`) plus a small `placeDrop` helper in `drops.js`. Everything else is content: the bug (`src/content/bugs/trojan-horse.js`), the summon feature (`src/content/features/trojan-horse.js`) and a flag check in `src/content/powerups/claude.js`.

**Tech Stack:** Vanilla ES modules, canvas, `node --test`. Node is not on PATH here: run it as `& "C:\Program Files\nodejs\node.exe"` (PowerShell). Baseline: 327 tests pass.

**Spec:** `docs/superpowers/specs/2026-11-25-trojan-horse-design.md`

## Global Constraints

- Price per drink: `round(100 × (1 + 0.1 × s))`, `s` = 0-based global sprint the horse appears in (`game.sprint` at the bell). Not affected by any investment or multiplier.
- Horse: id `trojan-horse`, `boss: true`, `hp: 900`, `speed: 22`, radius 20, `livesLost: Infinity`, `reward: 0`, `claudeImmune: true`, neutral ring (not `#2563EB`, `#EA580C`, `#C026D3`); no developer counters it.
- Loot per drink = `round(2 × price × game.mods.drinkMultiplier)`; the sum of **every** drop the horse leaves (including the 1-per-drink boss drop from `dropDrinks`) equals it exactly.
- Loot drops land inside the map; ttl = `DROP_TTL` (10) + up to 5 s, growing with throw distance.
- Horse spawns `BOSS_DELAY` (3 s) after the sprint's boss entry; one horse per sprint; no refund.
- Offer shown only in phase `bell` or `review` and never while `pendingYearReview`.
- Engine changes limited to: `src/engine/bell.js` (new), `ui.js` (render bell actions), `drops.js` (`placeDrop`). No other engine edits.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Exactly enough drinks** (each drink == price) → summon allowed, drinks drop to 0. Test in Task 3.
2. **Claude with the horse as the only bug** → Claude can't be activated (no wasted cooldown). Test in Task 2.
3. **Non-integer drink multiplier** (raise 1.1, business manager 2.2) → loot total still exact, every drop amount ≥ 1 integer. Test in Task 2.
4. **Horse dies near the map edge** → every loot drop inside `[0, WIDTH] × [0, HEIGHT]`. Test in Task 2.
5. **Summon on the quarter-review bell, then the yearly review opens** — not reachable (offer hidden during `pendingYearReview`), but a summon made earlier in `review` must still spawn after the bell. Test in Task 3.

---

### Task 1: Bell actions hook

**Files:**
- Create: `src/engine/bell.js`
- Modify: `src/engine/ui.js` (bell card ~line 363, review minimised card ~line 429, review foot ~line 494)
- Modify: `CONTRIBUTING.md` (registerFeature row)
- Test: `tests/bell.test.js`

**Interfaces:**
- Produces: feature field `bellActions: [{ id, label(game): string, hint?(game): string, cost?(game): { [drinkId]: number }, enabled(game): boolean, onClick(game) }]`
- Produces: `getBellActions(game): Array<{ feature: string, action }>` from `src/engine/bell.js` — every feature's actions in registry order, `[]` unless `game.phase` is `'bell'` or `'review'` and `!game.pendingYearReview`. Non-array `bellActions` are ignored.

- [ ] **Step 1: Write failing tests** in `tests/bell.test.js` (pattern: `R.resetRegistry(); clearAll();` in `beforeEach`, register a feature with one action):
  - `bell actions show at the bell and in the quarter review` — phase `'bell'` → length 1, `feature` = the feature id; phase `'review'` → length 1.
  - `bell actions hide during a sprint, in the menu and during the yearly review` — phases `'wave'`, `'building'`, `'menu'` → `[]`; phase `'review'` with `pendingYearReview = true` → `[]`.
  - `features without bellActions are skipped` — a second feature with `bellActions: 'x'` adds nothing.
- [ ] **Step 2: Run** `& "C:\Program Files\nodejs\node.exe" --test tests/bell.test.js` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement `getBellActions(game)`** in `src/engine/bell.js`.
- [ ] **Step 4: Run** the same command — Expected: PASS.
- [ ] **Step 5: Render in `ui.js`.** Add `bellActionsEl(g, rerender)` returning a `div.bell-actions` (or `null` when empty) with one `button.btn.bell-action` per action: `<b>label</b>`, then the cost as `span.cost` items (`drinkIconEl(id, 14)` + amount, as on hire buttons), then `<small>hint</small>`; `disabled` when `!enabled(g)`; `onClick` wrapped in try/catch, then `playSound('powerup')` and a re-render. Append it inside the text column of the bell card, the review minimised card and the review foot. Bell card re-render: call the existing overlay render for phase `bell`; review: `rerender`. Style `.bell-actions` in `style.css` to sit under the heading, matching `.choice` buttons.
- [ ] **Step 6: Document** `bellActions` in the `registerFeature` row of `CONTRIBUTING.md` (shape above, "shown on the victory bell and the quarter-review bell, not during the yearly review").
- [ ] **Step 7: Run full suite** `& "C:\Program Files\nodejs\node.exe" --test` — Expected: all pass.
- [ ] **Step 8: Commit** `feat: features can add actions to the victory bell`.

### Task 2: The Trojan horse bug, its loot, and Claude immunity

**Files:**
- Modify: `src/engine/drops.js` (add `placeDrop`, use it inside `dropDrinks`)
- Create: `src/content/bugs/trojan-horse.js`
- Modify: `src/content/powerups/claude.js`
- Modify: `src/content/manifest.js` (after `security-risk.js`: `'./bugs/trojan-horse.js', // summoned at the bell; explodes into loot`)
- Modify: `tests/content.test.js` (bug list gains `'trojan-horse'` at the end; title "8 bugs")
- Test: `tests/trojan-horse.test.js`

**Interfaces:**
- Produces (`drops.js`): `placeDrop(game, { x, y, drink, amount, ttl = DROP_TTL }): drop` — pushes `{ id: game.nextId++, x, y, drink, amount, ttl }` to `game.drops`, emits `drop:spawned`, returns it. `dropDrinks` uses it (behaviour unchanged).
- Produces (`trojan-horse.js`): `TROJAN_ID = 'trojan-horse'`, `trojanPrice(sprint: number): number`, `trojanLoot(sprint: number, drinkMultiplier: number): number` (per drink), `MAX_THROW = 260`, `EXTRA_TTL = 5`, `PIECES = 10`, `scatterLoot(game, bug): drop[]`; default export = the bug definition.
- Produces (`claude.js`): a bug whose definition has `claudeImmune: true` is ignored by Claude.

- [ ] **Step 1: Write failing tests** in `tests/trojan-horse.test.js`. Capture definitions after importing the content files (as `memory-leak.test.js` does: `const HORSE = R.getBug('trojan-horse'); const RISK = R.getBug('security-risk'); const CLAUDE = R.getPowerup('claude');`), re-register them plus `registerTestDrinks()` from `tests/helpers/drinks.js` in `beforeEach`, waves `[{ hp: 2, boss: 'security-risk', groups: [] }]`.
  - `price grows 10% of the base per sprint`: `trojanPrice(0) === 100`, `trojanPrice(6) === 160`, `trojanPrice(27) === 370`.
  - `horse has 3x the health of the security risk in the same sprint`: `spawnBug(g,'trojan-horse').maxHp === 3 * spawnBug(g,'security-risk').maxHp`.
  - `a leaked horse ends the run`: `g.lives = 20`, spawn at `distance = PATH_LENGTH - 0.1`, `step(g, 0.05)` → `g.lives === 0`, `g.phase === 'lost'`.
  - `squashed horse drops exactly 2x the price per drink`: at `g.sprint = 6`, `killBug(g, horse)` → for each drink, sum of `g.drops` amounts === `trojanLoot(6, 1)` === 320; every amount is an integer ≥ 1; more than 3 drops per drink.
  - `loot respects the drink multiplier exactly` (Review Focus 3): `g.mods.drinkMultiplier = 1.1` then `2.2` → per-drink sums === `Math.round(2 * 160 * m)`.
  - `loot lands on the map and far drops live longer` (Review Focus 4): kill a horse placed at distance 0 (path start, map edge) with `g.random` seeded (use `mulberry32` from `scripts/pickup.mjs`) → every drop `0 ≤ x ≤ WIDTH`, `0 ≤ y ≤ HEIGHT`, `DROP_TTL ≤ ttl ≤ DROP_TTL + EXTRA_TTL`; at least one jackpot drop farther than `SWEEP_RADIUS` from the horse.
  - `Claude success leaves the horse alive`: horse + one `'security-risk'`, force success (`g.random = () => 0.99`), `CLAUDE.activate(g)` → horse still in `g.bugs` with `hp === maxHp`, risk gone.
  - `Claude backfire does not copy the horse`: `g.random = () => 0` → exactly one horse in `g.bugs`, two risks.
  - `Claude can't fire at a lone horse` (Review Focus 2): only the horse on the map → `CLAUDE.canActivate(g) === false`.
- [ ] **Step 2: Run** `& "C:\Program Files\nodejs\node.exe" --test tests/trojan-horse.test.js` — Expected: FAIL (module not found).
- [ ] **Step 3: Add `placeDrop`** to `drops.js` and route `dropDrinks` through it.
- [ ] **Step 4: Create `src/content/bugs/trojan-horse.js`.** Definition per Global Constraints, `name: 'Trojan horse'`, `legs: false`. `update`: one-off pop "TROJAN HORSE!" (as `security-risk.js`), colour wood brown. `onDeath(bug, game)`: `scatterLoot(game, bug)` plus effects: `addEffect` `flash` (ttl 0.35), two `ring`s at the horse (`radius` 60 and 110, wood/gold colours, ttl 0.6/0.9), a `pop` "JACKPOT!" (size 18, ttl 1.5). `draw`/`drawIcon`: a wooden horse on wheels seen from above, facing +x, with a pulsing boss ring like the security risk; must read differently from the red beetle (builder's design).
  `scatterLoot` algorithm (the part the tests don't pin down):
  ```
  for each drink d:
    jackpot = trojanLoot(game.sprint, game.mods.drinkMultiplier) - 1   // dropDrinks already left 1 of each (boss, reward 0)
    pieces  = min(PIECES, jackpot); split jackpot into `pieces` integers differing by at most 1
    each piece: angle = random·2π, dist = 40 + random·(MAX_THROW − 40)
                x, y = horse + dist·(cos, sin), clamped to [16, WIDTH−16] × [16, HEIGHT−16]
                ttl  = DROP_TTL + EXTRA_TTL · dist / MAX_THROW
                placeDrop(game, { x, y, drink: d, amount, ttl })
  ```
  Use `game.random()` for all randomness.
- [ ] **Step 5: Claude immunity** in `claude.js`: a `hittable(bug)` helper (`!getBug(bug.type)?.claudeImmune`); `canActivate` → `game.bugs.some(hittable)`; success kills only hittable bugs; backfire clones only hittable bugs.
- [ ] **Step 6: Manifest line + update `tests/content.test.js`** bug list.
- [ ] **Step 7: Run full suite** — Expected: all pass.
- [ ] **Step 8: Commit** `feat: trojan horse boss, scattered jackpot, immune to Claude`.

### Task 3: Summoning at the bell

**Files:**
- Create: `src/content/features/trojan-horse.js`
- Modify: `src/content/manifest.js` (features: `'./features/trojan-horse.js', // pay at the bell to summon a trojan horse`)
- Modify: `README.md` (bullet under "How it plays", after "Boss")
- Test: `tests/trojan-summon.test.js`

**Interfaces:**
- Consumes: `trojanPrice`, `TROJAN_ID` (Task 2); `bellActions` shape (Task 1); `spendDrink`, `canAfford` (`drinks.js`); `BOSS_DELAY` (`game.js`).
- Produces: `canSummon(game): boolean`, `summonTrojan(game): boolean`, `attachListeners()`; state `game.trojan = { sprint, price } | undefined`; default export = feature `{ id: 'trojan-horse', bellActions: [...] }`.

- [ ] **Step 1: Write failing tests** in `tests/trojan-summon.test.js` (`beforeEach`: reset registry, `clearAll()`, `attachListeners()`, test drinks, horse + security-risk defs captured as in Task 2, waves `[{ boss: 'security-risk', groups: [{ bug: 'security-risk', count: 2, interval: 1 }] }]`; game at phase `'bell'`, `g.sprint = 3`):
  - `summoning pays the price in every drink`: drinks 500 each → `summonTrojan(g) === true`, each drink `500 - 130`, `g.trojan` = `{ sprint: 3, price: 130 }`.
  - `exactly enough drinks is enough` (Review Focus 1): each drink 130 → true, each 0.
  - `one drink short refuses and charges nothing`: coffee 129 → false, drinks unchanged.
  - `only one horse per sprint`: second `summonTrojan` → false, drinks charged once.
  - `no summon outside the bell`: phase `'wave'` → false; phase `'review'` with `pendingYearReview` → false.
  - `the horse is queued 3 s after the boss and only once`: summon, `ringBell(g)` → exactly one `trojan-horse` entry, its `t === bossEntry.t + BOSS_DELAY`, queue sorted by `t`; `g.trojan` cleared; ringing into the following sprint queues no horse.
  - `a summon made in the quarter review spawns next sprint` (Review Focus 5): phase `'review'`, summon, `ringBell` → horse queued.
  - `bell action reflects state`: `label` is "Let the Trojan horse in" and `cost(g)` maps every drink to 130 before summoning; `enabled` false when short; after summoning `label` is "Trojan horse incoming" and `enabled` false.
  - `a new run starts without a summon`: `createGame().trojan === undefined`.
- [ ] **Step 2: Run** `& "C:\Program Files\nodejs\node.exe" --test tests/trojan-summon.test.js` — Expected: FAIL.
- [ ] **Step 3: Implement the feature.** `canSummon`: phase `bell`/`review`, `!pendingYearReview`, no `game.trojan`, every drink affordable. `summonTrojan`: if `canSummon`, `spendDrink` each, set `game.trojan`, emit `trojan:summoned`. `attachListeners()` subscribes to `sprint:start` (called at module load, like `retrospective.js`): if `game.trojan?.sprint === game.sprint`, insert `{ t: bossT + BOSS_DELAY, bug: TROJAN_ID }` where `bossT` is the `t` of the last entry whose bug is the sprint's boss (`getSprintDef(game.sprint).boss`), falling back to the last entry's `t`; keep the queue sorted; delete `game.trojan`. Bell action: `id: 'summon'`, `hint`: "3× the security risk · squash it for 2× back · if it gets in, production is down".
- [ ] **Step 4: Run** the test file — Expected: PASS.
- [ ] **Step 5: Manifest line, README bullet** (price, 3× health, 2× loot spread over the map, instant loss on leak, Claude can't touch it), run full suite — Expected: all pass.
- [ ] **Step 6: Manual check in the browser:** `python -m http.server 8000`, open `http://localhost:8000/?demo=1`, clear sprint 1, summon at the bell, watch the horse arrive after the security risk, squash it, collect scattered loot; in another run let it through and see the game-over screen. Also check the quarter review (full and minimised card).
- [ ] **Step 7: Commit** `feat: summon a trojan horse at the victory bell`.

### Task 4: Balance report in the sim

**Files:**
- Modify: `scripts/sim.mjs`, `CONTRIBUTING.md` (sim usage line)

**Interfaces:**
- Consumes: `summonTrojan`, `canSummon` (Task 3).

- [ ] **Step 1: Add `--trojan`.** In `play`, at `bell`/`review`, before `buy()`, call `summonTrojan(g)` when the flag is set (bot summons whenever it can). Track per game: horses summoned, squashed (listen to `bug:killed` with type `trojan-horse`), leaked (`bug:leaked`), and net drinks (loot collected from horse drops minus price paid). Print per strategy row: summoned, win %, leak %, mean net drinks per horse.
- [ ] **Step 2: Run** `& "C:\Program Files\nodejs\node.exe" scripts/sim.mjs --trojan --trials 10` and `... --trojan --profile max --trials 10` — Expected: completes; copy the output into the PR description. Report only: if a strategy wins > 90% of horses with positive net drinks, flag it to the owner; do not retune.
- [ ] **Step 3: Commit** `chore: sim reports trojan horse outcomes`.
