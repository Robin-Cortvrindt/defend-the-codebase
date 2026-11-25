# Developer Effects Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hovering a developer on the board shows a card with its totals and one named line per active effect (upgrades, team bonuses, investments, power-ups, event).

**Architecture:** Content defs get an optional `describeEffect(game, dev, level?)`. A DOM-free collector `devEffects(game, dev)` in `src/engine/effects.js` gathers and groups the lines. A new `src/engine/effects-card.js` renders the card, and `ui.js` calls it each frame. Game math is unchanged. Inline factors are extracted into exported constants that both the effect and its description use.

**Tech Stack:** Plain ES modules, CSS, `node --test` (`npm test`).

**Spec:** `docs/superpowers/specs/2026-11-25-developer-effects-card-design.md`

## Global Constraints

- Game math must not change: every existing test stays green unmodified, except tests that import a renamed constant.
- Hook signature: `describeEffect(game, dev, level?) -> string | string[] | {name?, text, group?} | Array<…> | null`. `null` or `[]` means no line.
- Groups and order: `upgrade`, `team`, `investment`, `powerup`, `event`.
- The line name is the source's display name, unless the hook returns `{ name }`. An investment's name includes its level, e.g. `Better laptops 3`. An aura line is named `<upgrade name> (nearby)`.
- Percent text uses `pctText(factor)`: `Math.round((factor - 1) * 100)`, prefixed `+` or `−` (U+2212), e.g. `+30%`, `−50%`.
- Numbers come from the same exported constant or state the effect uses. Events show only their own factor, and write no line when it is exactly 1.
- Investments come from `game.investmentLevels` (set by `applyInvestments`), not from storage.
- A hook that throws is logged as `[effects <kind> <id>]` and skipped.
- Card copy: header `<developer name> · <level name>`, totals `Damage <n> · <r>/s · range <c>` (damage rounded, rate 1 decimal, range in cells 1 decimal), empty state `No active effects`.
- The card shows when the hovered cell has a developer that is not `view.selected`, in phase `building`/`wave`/`bell`, or in `review` with the review screen minimised, including while paused. `pointer-events: none`.

## Review Focus

1. A developer hovered while its click panel is open: no second card. Task 4, manual check plus the visibility helper test.
2. An effect that starts or ends while hovering (the CEO expiring, an event ending at sprint end): the line disappears live. Task 4 `effectsCardKey` test.
3. Investments bought between runs don't change the current run's lines. Task 1 test.
4. A teammate's content with a broken `describeEffect`: the other lines still show. Task 1 test.
5. Two Enterprise Architects near one developer: one aura line, not two (same rule as `devStats`). Task 1 test.

---

### Task 1: Effects collector and applied investment levels

**Files:**
- Create: `src/engine/effects.js`
- Modify: `src/engine/investments.js` (`applyInvestments`, lines ~95-104)
- Test: `tests/effects.test.js`

**Interfaces:**
- Produces (`src/engine/effects.js`):
  - `GROUPS = ['upgrade', 'team', 'investment', 'powerup', 'event']`
  - `pctText(factor: number) -> string`
  - `statsText(stats: {damage?, fireRate?, range?}) -> string`, e.g. `damage 40, range 2.6` (keys in that order, as given)
  - `devEffects(game, dev) -> Array<{ group, name, text }>`
- Produces: `game.investmentLevels: { [id]: level }`, set in `applyInvestments` (only levels > 0). Also add `investmentLevels: {}` to `createGame` in `src/engine/game.js`.
- Collector rules:
  - **upgrade:** level-2 upgrade when `dev.level >= 1`, `dev.upgrade` when `dev.level === 2`. Text from `upgrade.describeEffect(game, dev)` if present, else `statsText(upgrade.stats)` if it has stats, else `upgrade.description`. Name `upgrade.name`.
  - **team:** first the developer def's `describeEffect` (name = def.name unless overridden). Then auras: for each other dev whose `upgrade.aura?.describe` exists, within `aura.radius * CELL`, each distinct `upgrade.id` once → name `<upgrade.name> (nearby)`. Then any line with `group: 'team'` from other sources.
  - **investment:** for each `getInvestments()` def with a hook and `game.investmentLevels[id] > 0`, call `describeEffect(game, dev, level)`. Default name `${def.name} ${level}`.
  - **powerup:** for each `getPowerups()` def with a hook where `powerupState(game, id).active`, call `describeEffect(game, dev)`. Name `def.name`.
  - **event:** `getEvent(game.activeEvent)?.describeEffect(game, dev)`. Name `def.name`.
  - Features: `getFeatures()` hooks are collected too. Their group defaults to `team`.
  - Results are sorted by `GROUPS` order, stable within a group. A `{ group }` override moves a line.

- [ ] **Step 1: Write failing tests** in `tests/effects.test.js` with synthetic content (`resetRegistry`, register a dev `{ id: 'd', name: 'Dev', damage: 10, fireRate: 1, range: 2, upgrades: { level2: { id: 'u2', name: 'Up Two', stats: { damage: 40, range: 2.6 } }, level3: [{ id: 'u3', name: 'Up Three', description: 'does a thing' }] } }`):
  - `pctText(1.3) === '+30%'`, `pctText(0.5) === '−50%'`, `pctText(1.15) === '+15%'`
  - Level-2 dev → `[{ group: 'upgrade', name: 'Up Two', text: 'damage 40, range 2.6' }]`. Level-3 dev adds `{ name: 'Up Three', text: 'does a thing' }`.
  - An investment `{ id: 'inv', name: 'Inv', describeEffect: (g, d, lvl) => `damage +${lvl * 10}%` }` with `game.investmentLevels = { inv: 3 }` → `{ group: 'investment', name: 'Inv 3', text: 'damage +30%' }`. With level 0 or missing → no line.
  - **Review Focus 3:** store `{ levels: { inv: 2 } }` via `setStorage` + `saveProgress`, `startGame` → `game.investmentLevels.inv === 2`. Then `saveProgress({ levels: { inv: 5 } })` → the line still says level 2.
  - A power-up with a hook: no line while inactive, a line while `powerupState(g, id).active = true`.
  - The event hook is used only when `game.activeEvent` is its id.
  - An investment hook returning `{ text: 't', group: 'team' }` lands in `team`, before investments.
  - **Review Focus 4:** a hook that throws (with `console.error` silenced in the test) is skipped, and the other lines still return.
  - **Review Focus 5:** two other devs with the same aura upgrade id in radius → exactly one `(nearby)` line. A dev out of radius → none.
  - The order of a mixed result follows `GROUPS`.
- [ ] **Step 2: Run** `node --test tests/effects.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `src/engine/effects.js` and the `investmentLevels` changes.
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: effects collector for developer hover card`

### Task 2: Investment and power-up descriptions

**Files:**
- Modify: `src/content/investments/better-laptops.js`, `agile-coaching.js`, `bigger-monitors.js`, `security-training.js`, `cross-functional.js`, `full-stack-squad.js`, `garbage-collection.js`
- Modify: `src/content/powerups/ceo.js`, `training-manager.js`
- Test: `tests/effects-content.test.js`

**Interfaces:**
- Consumes: Task 1 `pctText`, `devEffects`, `game.investmentLevels`.
- Produces exported constants, used by both `apply` and `describeEffect`:
  - `DAMAGE_PER_LEVEL = 0.10` (better-laptops), `FIRE_RATE_PER_LEVEL = 0.08` (agile-coaching), `RANGE_PER_LEVEL = 0.05` (bigger-monitors)
  - `BALANCED_BONUS` (cross-functional, already exists)
  - CEO and training manager: export their existing `factor(game)` as `ceoFactor` / `trainingFactor`
- Texts:
  - Better laptops: `damage ${pctText(1 + DAMAGE_PER_LEVEL * level)}`
  - Agile coaching: `attack speed …`
  - Bigger monitors: `range …`
  - Cross-functional: `{ group: 'team', text: 'attack speed +25%' }` (from `BALANCED_BONUS`), only when `isBalanced(game)`
  - Full-stack squad: `{ group: 'team', text: 'hits bounce to a second bug for 50%' }`, only when `isSquadReact(game, dev)`
  - Garbage collection: `{ group: 'team', text: 'every 10th kill slows bugs nearby' }`, only when `inJavaSquare(game, dev)`
  - Security training: `{ group: 'team', text: 'part of a firewall' }`, only when `dev` is in a pair from `findFirewalls(game)`
  - CEO: `attack speed ${pctText(st.factor)} (${Math.ceil(st.remaining)} s left)`
  - Training manager: `XP ×${st.factor} (${Math.ceil(st.remaining)} s left)`

- [ ] **Step 1: Write failing tests** in `tests/effects-content.test.js`, loading the real content (`loadModules(CONTENT_URLS)` as tests/hire-card.test.js does), on a started game:
  - Better laptops at level 3 (set `g.investmentLevels['better-laptops'] = 3`) → line `{ name: 'Better laptops 3', text: 'damage +30%' }`
  - Agile coaching at level 2 → `attack speed +16%`. Bigger monitors at level 3 → `range +15%`.
  - CEO activated with `usePowerup` during a wave → text starts with `attack speed +50%` and contains `s left`. After the duration expires → no CEO line.
  - Cross-functional: one each of React/Java/.NET with the investment at level 1 → a `team` line for each dev. With 2 React, 1 Java, 1 .NET → none.
  - Math unchanged: `devStats` for a Java dev at Better laptops 3 equals what it was before (assert damage `def.damage * 1.3`).
- [ ] **Step 2: Run** `node --test tests/effects-content.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the hooks and constant extractions.
- [ ] **Step 4: Run** `npm test`. Expected: all pass, with no existing test edited (except ones importing a renamed export, if any).
- [ ] **Step 5: Commit** `feat: investments and power-ups describe their effect on a developer`

### Task 3: Event and developer descriptions

**Files:**
- Modify: `src/content/events/heating-out.js`, `no-coffee.js`, `no-redbull.js`, `wine-tasting.js`
- Modify: `src/content/developers/react.js`, `java.js`, `dotnet.js`
- Test: `tests/effects-content.test.js` (extend)

**Interfaces:**
- Consumes: Task 1 `pctText`, `devEffects`.
- Produces constants:
  - react.js: `REACT_BONUS_PER = 0.1`, `REACT_BONUS_MAX_OTHERS = 5` (used by `modifyStats` and the hook)
  - java.js: `ARCHITECT_OWN = 0.9`, `ARCHITECT_AURA = 1.15`
- Texts:
  - Heating out: `attack speed ${pctText(game.heatingOutFactor)}`, no line when the factor is 1
  - Out of coffee: Java only, from `game.coffeeFactor`. Out of Red Bull: .NET only, from `game.redbullFactor`. Both write no line when the factor is 1.
  - Wine tasting: `tipsy: shoots at random bugs`
  - React def: `{ name: 'React team', text: `attack speed ${pctText(…)}` }`, only when there is at least 1 other React. Name it `React team (N others)`.
  - Architect upgrade: `describeEffect` → `damage ${pctText(ARCHITECT_OWN)}, ${pctText(ARCHITECT_AURA)} damage to developers nearby`. Its `aura.describe` → `damage ${pctText(ARCHITECT_AURA)}`.
  - Azure upgrade: `describeEffect` → `triple area damage, 1 White Monster / 0.5 s` (the 3 comes from `AZURE_DAMAGE_MULT`)
  - Other upgrades use the Task 1 defaults (stats or description).

- [ ] **Step 1: Write failing tests** (extend `tests/effects-content.test.js`):
  - Heating out active (`game.activeEvent = 'heating-out'`, `game.heatingOutFactor = 0.5`) → `attack speed −50%`. Factor 1 → no line.
  - Out of coffee with factor 0.5: Java dev gets a line, React dev doesn't.
  - React with 3 other Reacts → `{ group: 'team', name: 'React team (3 others)', text: 'attack speed +30%' }`. With 7 others → `+50%` (cap). With 0 → none.
  - Java dev near an Architect → `{ name: 'Enterprise Architect (nearby)', text: 'damage +15%' }`. The Architect itself → upgrade line `damage −10%, +15% damage to developers nearby` and no `(nearby)` line for itself.
  - Spring Boot Java dev → upgrade line `{ name: 'Spring Boot Dev', text: 'damage 40, range 2.6' }`.
  - Azure dev → `triple area damage, 1 White Monster / 0.5 s`.
- [ ] **Step 2: Run** `node --test tests/effects-content.test.js`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: events and developers describe their effect on a developer`

### Task 4: The hover card

**Files:**
- Create: `src/engine/effects-card.js`
- Modify: `src/engine/ui.js` (call each frame, next to `updateSelPanel`), `style.css`, `CONTRIBUTING.md` (one row explaining `describeEffect` per content type)
- Test: `tests/effects-card.test.js`

**Interfaces:**
- Consumes: Task 1 `devEffects`, `devStats`, `levelName`, `devAt` (from devs.js), `popoverPosition` (popover.js), and `h`/`toggle` (dom.js).
- Produces (DOM-free, exported from `src/engine/effects-card.js`):
  - `hoveredDev(game, view, reviewMinimized: boolean) -> dev | null`: the visibility rule from Global Constraints
  - `totalsText(game, dev) -> string`: e.g. `Damage 44 · 1.9/s · range 2.9`
  - `effectsCardKey(game, dev) -> string`: changes when the line list changes (ids, names, texts minus countdown digits), so the DOM is only rebuilt then
- Produces (DOM): `updateEffectsCard(app, reviewMinimized)`, which creates or updates one `.effects-card` element in the stage, placed with `popoverPosition` like the selected panel, with `pointer-events: none`.

- [ ] **Step 1: Write failing tests** `tests/effects-card.test.js`:
  - `hoveredDev`: null when `view.hover` is null, when the cell is empty, when the dev is `view.selected`, when the phase is `menu`/`lost`, or `review` with `reviewMinimized` false. Returns the dev in `wave`, in `review` with `reviewMinimized` true, and with `view.paused` true.
  - `totalsText` for a dev whose `devStats` are `{ damage: 44.4, fireRate: 1.94, range: 2.94 * CELL }` → `Damage 44 · 1.9/s · range 2.9`
  - **Review Focus 2:** `effectsCardKey` is equal for the same lines with different `s left` numbers, and changes when a line is added or removed
- [ ] **Step 2: Run** `node --test tests/effects-card.test.js`. Expected: FAIL.
- [ ] **Step 3: Implement** the helpers and `updateEffectsCard`, wire it into `ui.js` (pass `reviewMinimized`), add CSS matching `.sel-panel`/`.popover` (header bold, totals small, lines `name` bold + text, grouped in order, `No active effects` when empty), and the CONTRIBUTING row.
- [ ] **Step 4: Run** `npm test` and `node --check src/engine/ui.js src/engine/effects-card.js`. Expected: all pass.
- [ ] **Step 5: Manual check (browser, if available):** hover a developer during a wave with the CEO active and see the countdown tick. The card doesn't show for a selected developer (Review Focus 1). It hides on mouseleave. It shows while paused. If no browser is available, list these as not run.
- [ ] **Step 6: Commit** `feat: hover a developer to see every effect acting on it`
