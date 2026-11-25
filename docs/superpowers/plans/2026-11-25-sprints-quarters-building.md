# Sprints, Quarters and the Nexios Building — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the 10-wave game into an endless sprint/quarter/year run with Nexios Coins, a quarter-review building shop (floors and air conditioning) and a yearly review. The heat wave itself belongs to the random-events work; this plan only provides `game.heatResistance`.

**Architecture:** The rules go in the pure engine. `game.js` gets the sprint calendar, endless sprint generation, coins and review phases. A new `upgrades.js` handles the shop, and upgrade definitions are content files. The browser layer gets the building drawing, the heat haze, the HUD fields and the review overlays.

**Tech Stack:** Unchanged: vanilla ES modules, `node --test`, no build.

**Spec:** `docs/superpowers/specs/2026-11-25-defend-the-codebase-design.md` §9 (on top of §1–8)

## Global Constraints

- 7 sprints per quarter, 4 quarters per year, endless. HUD label: `Year Y · QN · Sprint S / 7`.
- Coins: +1 per cleared sprint, +3 more on a cleared quarter (sprint 7). Start at 0.
- Floor: +5 max lives and heals 5. Costs `3 + floorsBought`. Unlimited.
- Air conditioning: levels 1–3, costing 3, 5 and 7. `game.heatResistance = level / 3`.
- Heat wave: owned by random events. Air conditioning only sets `game.heatResistance`.
- Yearly review after every Q4: accept gives `warrantMultiplier ×1.1`. A raise has a 50% chance of `×1.2`, otherwise nothing.
- `wave:start` and `wave:cleared` are still emitted alongside `sprint:start` and `sprint:cleared`. `game.wave` stays readable and writable as an alias of `game.sprint`.
- Copy: no emoji, sentence case, no exclamation marks. Nexios palette.

## Review Focus

1. **The yearly review is pending.** The bell and the wave button must not start the next sprint until a choice is made, and the choice can only be made once. The test goes in Task 2.
2. **Restart after buying upgrades.** A new game starts with floors 1, heatResistance 0, raise 1 and coins 0. The test goes in Task 2.
3. **Floors beyond what the canvas can show.** The building must still fit above y ≥ 6 (render-only, checked in the browser).
4. **Buying with too few coins, at max level, or outside the review.** Expect it to be refused with coins unchanged. The test goes in Task 2.
5. **Sprint 100+ (generated).** Bug counts and intervals stay finite and positive, and the spawn interval has a floor of ≥ 0.12 s. The test goes in Task 1.

---

### Task 1: Sprint calendar and endless sprints

**Files:** Modify `src/engine/game.js`, `tests/game.test.js`

**Interfaces — Produces:**
- `sprintInfo(n) -> { year, quarter, sprint, quarterIndex, label }`. `n` is 0-based and global. `sprint` is 1–7, `quarter` is 1–4, `year` starts at 1. `label` is `'Year 1 · Q1 · Sprint 1 / 7'`.
- `getSprintDef(n) -> { hp, groups }`. For `n < waves.length` it returns `waves[n]`. Beyond that it generates from the last hand-made wave with `k = n - (len-1)`: count `× (1 + 0.12k)` rounded, interval `× 0.97^k` with a floor of 0.12, hp `× 1.15^k`.
- `game.sprint` (0-based). `game.wave` is a getter/setter alias for it. `game.coins = 0`.
- `checkEnd` no longer goes to `won`. On a clear: Warrants `+ (20 + 5 × (n+1))`, `coins += 1`. If `sprint === 7`: `coins += 3`, `phase = 'review'`, emit `quarter:review`, and if `quarter === 4` set `game.pendingYearReview = true`. Otherwise `phase = 'bell'`. Emit `sprint:cleared` and `wave:cleared` with `{ game, sprint: n+1, wave: n+1, bonus }`, then `sprint++`.

- [ ] **Step 1: Write the failing tests:**
  - `sprintInfo(0).label === 'Year 1 · Q1 · Sprint 1 / 7'`
  - `sprintInfo(6).sprint === 7`
  - `sprintInfo(7).quarter === 2`
  - `sprintInfo(28)` gives year 2, quarter 1
  - `after last hand-made wave, sprints continue (generated) and never reach won`
  - `clearing a sprint gives 1 coin, sprint 7 gives 4 and enters review`
  - `clearing sprint 28 sets pendingYearReview`
  - `Review Focus 5: getSprintDef(150) has finite positive counts and interval ≥ 0.12`
  - Update the old "last wave → won" test to the endless behaviour.
- [ ] **Step 2:** `node --test`. Expect the new tests to FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `node --test`. Expect all PASS.
- [ ] **Step 5:** Commit: `feat: sprints, quarters and endless sprint generation`

### Task 2: Upgrades shop and yearly review

**Files:** Create `src/engine/upgrades.js`, `src/content/upgrades/floor.js`, `src/content/upgrades/aircon.js`. Modify `src/engine/registry.js` (add `registerUpgrade`, `getUpgrades`, `getUpgrade`, and include them in reset), `src/engine/game.js`, `src/content/manifest.js` and the CORE list in `src/main.js`. Test: `tests/upgrades.test.js`.

**Interfaces — Produces:**
- Upgrade def: `{ id, name, description, maxLevel /*Infinity ok*/, getCost(game, level), apply(game, level) }`.
- `upgradeLevel(game, id)` (stored in `game.upgrades[id]`), `upgradeCost(game, id)`, `canBuy(game, id)` (phase `review`, level < max, coins ≥ cost), and `buyUpgrade(game, id) -> boolean` (deducts coins, increments the level, calls `apply(game, newLevel)`, emits `upgrade:bought`).
- `game.floors = 1`, `game.heatResistance = 0`, `game.raise = 1` (total yearly multiplier).
- `chooseYearReview(game, 'accept'|'raise') -> 'accepted'|'approved'|'denied'|null`. Returns null unless `pendingYearReview`. Applies the multiplier, multiplies `game.raise`, clears the pending flag, adds a banner effect and emits `year:review`.
- `ringBell` works from `bell` or `review`, but returns false while `pendingYearReview` is set.

- [ ] **Step 1: Write the failing tests:**
  - `floor costs 3,4,5; adds 5 max lives and heals 5; floors++`
  - `aircon costs 3,5,7, max 3, sets heatResistance level/3`
  - `Review Focus 4: buy refused outside review / too few coins / at max — coins unchanged`
  - `accept → warrantMultiplier 1.1; raise with random 0.2 → 1.2; raise with random 0.8 → unchanged and 'denied'`
  - `Review Focus 1: ringBell refused while year review pending; second chooseYearReview returns null`
- [ ] **Step 2:** Run. Expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expect all PASS.
- [ ] **Step 5:** Commit: `feat: building upgrades shop and yearly review`

### Task 3: Browser layer — building, HUD, review overlays, best run

**Files:** Modify `src/engine/render.js`, `src/engine/ui.js`, `style.css`, `scripts/sim.mjs`, `README.md`, `CONTRIBUTING.md`.

- **Building:** replace the PROD box drawing. The base is at y 174. The building's height is `22 + floors × 12`, capped so the top stays ≥ 6 (compress the floor height when there are many floors). Draw a window row per floor, a "NEXIOS" sign on the ground floor, a door facing the path, an air-conditioning unit on the roof sized by level (none at 0), and a production bar under the building at y ≈ 182 (green, orange at ≤ 40%).
- **HUD:**
  - `Sprint` stat showing `Y1 · Q1 · 3/7`
  - a `Coins` stat
  - a `+N%` raise note under Warrants when `game.raise > 1`
  - the wave button reads `Start sprint n →`, `Ring the bell →`, or `Start Q2 →` in review (disabled while the year review is pending)
- **Review overlay** (phase `review`):
  - eyebrow `Quarter review · Year Y · QN`, title `QN closed`
  - quarter stats (bugs squashed, lives lost this quarter; track a `game.quarterStats` snapshot)
  - a coins counter
  - one shop row per upgrade (name, level, description, `Buy · cost` button, disabled per `canBuy`); rebuild the overlay after each purchase
  - the bell (rings to start the next quarter)
  - if `pendingYearReview`: a yearly-review block above the shop with two cards, `Accept the review · +10% Warrants` and `Ask for a raise · 50% chance of +20%`; the bell is disabled until one is chosen
- **Lost screen:** `Fell in Year Y · QN · Sprint S`, plus best run from `localStorage['dtc-best']` (store the global sprint index, with try/catch). Show "New best" when beaten.
- **Sim:** run until lost and report the sprint label reached.
- **Docs:** README, plus CONTRIBUTING (`registerUpgrade` and the new events).

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `node --test`. Expect all PASS. `node scripts/sim.mjs` should show the bots reaching different depths, with a mixed build getting furthest.
- [ ] **Step 3:** Browser checks with the CDP driver: a mid-sprint screenshot with the building; force `phase=review` with coins and buy a floor (the building gets taller); force the year review and choose; lose (shows the best run). No console errors.
- [ ] **Step 4:** Commit: `feat: Nexios building, sprint HUD and review screens`. Merge, push, verify live.
