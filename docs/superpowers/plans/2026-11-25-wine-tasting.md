# Wine Tasting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the "Thomas organized a wine tasting" event (random targeting, zigzag shots) and its Water cooler counter-upgrade.

**Architecture:** The event is a content file with no stat changes; `tickDevs` asks `pickTarget` which bug to shoot, which rolls "tipsy" while the event is active. A tipsy shot marks its attack effect `tipsy: true`; render passes `tipsy` and a shared `zigzagPoint` helper to each developer's `drawAttack`. The upgrade is a standard `counterUpgrade` and is drawn on the building.

**Tech Stack:** Vanilla ES modules, canvas, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-wine-tasting-design.md` (mockup `docs/mockups/wine-tasting.html`)

## Global Constraints
- Event id `wine-tasting`, name "Thomas organized a wine tasting", description "Developers shoot at random bugs", accent `#9F1239`.
- Upgrade id `water`, name "Water cooler", description "Counters: wine tasting", costs 3/5/7, side panel label "Water".
- Tipsy chance per shot = `1 - resistanceTo(game, 'wine-tasting')`; only tipsy shots zigzag.
- Gameplay randomness via `game.random()`, consumed only while the event is active; visuals use the shot seed.

## Review Focus
- One bug in range: a tipsy shot still hits it (random pick from a list of one).
- Event inactive: no `game.random()` calls from targeting (other seeded tests stay deterministic).
- Follow-up hits (React bounce via `dev:hit`) are not tipsy: `dev.tipsy` is cleared before `emit('dev:hit')`.
- `zigzagPoint` returns exactly `from` at s=0 and `to` at s=1.
- Building with 1 floor and every upgrade at level 3: the cooler doesn't overlap the door or generator.

---

### Task 1: Event, upgrade and random targeting

**Files:**
- Create: `src/content/events/wine-tasting.js`, `src/content/upgrades/water.js`, `tests/wine-tasting.test.js`
- Modify: `src/engine/devs.js` (`tickDevs`, new `pickTarget`, `addAttack` sets `tipsy`), `src/content/manifest.js`, `src/main.js` CORE, `tests/content.test.js`, `tests/counter-upgrades.test.js`, `README.md`

**Interfaces:**
- Produces: `pickTarget(game, dev, range) -> { target: bug|null, tipsy: boolean }` in devs.js; attack effects carry `tipsy: boolean`.

- [ ] Tests: event registered (content test list ends `'wine-tasting'`); `water` counters `wine-tasting` (added to COUNTERS map); `pickTarget` with no event → furthest bug, `tipsy` false; with event + resistance 0 over 200 picks → every in-range bug chosen at least once, all `tipsy`; resistance 1 → always furthest, never tipsy; one bug in range → that bug; addAttack during a tipsy shot → effect `tipsy === true`.
- [ ] Run `node --test tests/wine-tasting.test.js` → FAIL.
- [ ] Implement; event `start`/`end` are no-ops (targeting reads `game.activeEvent`).
- [ ] `npm test` → all pass. Commit.

### Task 2: Zigzag shots

**Files:**
- Create: `src/engine/zigzag.js` (`zigzagPoint(from, to, s, seed, amp = 16) -> {x, y}`, triangle wave, `zigs = max(2, round(len/45))`, envelope `min(1, 6s, 6(1-s))`)
- Modify: `src/engine/render.js` (`drawAttack` args gain `tipsy`), `src/content/developers/react.js`, `java.js`, `dotnet.js`
- Test: `tests/wine-tasting.test.js`

- [ ] Tests: `zigzagPoint` endpoints equal `from`/`to`; midpoints deviate from the straight line by ≤ amp and some by > amp/2; each developer's `drawAttack` runs with `tipsy: true` on the stub ctx without throwing.
- [ ] Implement per mockup: React hook follows zigzag (amp 18) instead of bow; Java wisps use zigzag centre (amp 16) with their braid offset; .NET bolt 18 segments on zigzag (amp 26) with jitter amp 6.
- [ ] `npm test` → pass. Commit.

### Task 3: Water cooler on the building

**Files:**
- Modify: `src/engine/building.js` (`drawWaterCooler(ctx, leftX, floorY, level, t)`, called with `x + 1, ground - 6` when `L.water`), `src/engine/render.js` levels (`water`), `src/content/features/side-panel.js` SHORT `water: 'Water'`
- Test: `tests/wine-tasting.test.js`

- [ ] Tests: `drawBuilding` with `levels.water` 1..3 runs on the stub ctx; side panel label check if `side-panel.test.js` covers SHORT.
- [ ] Implement per mockup. `npm test` → pass. Commit.
