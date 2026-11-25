# Visual overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each developer its own attack animation, each enemy its own look, the firewall real fuchsia fire, and the lane a code-on-a-circuit-board style, without touching gameplay.

**Architecture:** The engine gets generic hooks (a developer's `drawAttack`, a bug's `draw`, an extra `dev`/`time` argument to developer `drawIcon`) plus engine-owned lane drawing. Every look lives in its own content file. Rendering stays read-only: animation state comes from effects (which the game loop already ages) and `game.time`.

**Tech Stack:** Vanilla JS ES modules, canvas 2D, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-visual-overhaul-design.md` (looks: `docs/mockups/attack-animations.html`, `path-styles.html`, `bug-designs.html`).

## Global Constraints

- No gameplay or balance changes: damage, fire rates, ranges, speeds, HP, rewards, damage timing (instant on fire) unchanged.
- Each enemy keeps its ring colour dominant (merge conflict's pale diff tints with a thick grey outline are the accepted exception; memory leak module is slate grey).
- Content without the new hooks keeps today's look (straight beam; oval with legs + `drawIcon`).
- Every content hook call is wrapped in try/catch + `console.error`, like `drawIcon` today.
- `render.js` and draw hooks never change game state.
- No new dependencies. 60 fps on a busy late wave on a normal laptop.

## Review Focus

1. Target dies or leaks before the attack arrives → the attack finishes at the bug's last position (test in Task 1).
2. A content draw hook throws → logged, the rest of the frame still draws (tests in Tasks 1 and 2).
3. Content without hooks (the example "Py" developer, "flaky" bug) → today's look (tests in Tasks 1 and 2).
4. Developer icons drawn without a placed developer (shop, hover preview) → `drawIcon(ctx, size)` with no `dev` still works (test in Task 3).
5. Paused or sped-up game → animations follow game time (effects age with `dt`; time-based looks use `game.time`), so they freeze when paused and speed up at 2×/3×. Checked by hand in Task 7.

---

### Task 1: Attack effects and the `drawAttack` hook

**Files:**
- Modify: `src/engine/devs.js` (`tickDevs`), `src/engine/game.js` (`tickEffects`), `src/engine/render.js` (`drawEffects`, `drawBug` hit flash), `src/content/investments/full-stack-squad.js` (bounce)
- Create: `tests/stub-ctx.js` (not a test file: a canvas context stub)
- Test: `tests/visuals.test.js`

**Interfaces:**
- Produces: `addAttack(game, dev, from, target)` exported from `src/engine/devs.js`. Pushes `{ kind: 'attack', dev: dev.type, from: {x,y}, to: {x,y}, target, seed: game.random(), shot: dev.shots, ttl: def.attackDuration ?? 0.12, hitAt: def.attackHitAt ?? 0 }` via `addEffect`, then `dev.shots = (dev.shots ?? 0) + 1`.
- Produces: `tickDevs` sets `dev.lastShotAt = game.time` on each shot and calls `addAttack(game, dev, {x: dev.x, y: dev.y}, target)` instead of the beam. Counter `×2` pop unchanged.
- Produces: in `tickEffects`, an attack effect whose `target` is not `dead` copies the target's `x, y` into `to`; once dead it keeps the last `to`.
- Produces: developer hook `drawAttack(ctx, a)` where `a = { from, to, progress /*0→1*/, time /*game.time*/, seed /*0..1*/, shot /*int*/, accent }`; optional `attackDuration` (s) and `attackHitAt` (0..1, when it lands).
- Produces: `render.js` `drawEffects`: for `kind: 'attack'`, call the developer's `drawAttack` (try/catch); without one, draw today's beam (accent colour, width `Math.min(5, 1.5 + damage / 15)`, fading).
- Produces: `render.js` exports `hitFlash(game, bug) -> number` (0..1): strongest over the attack effects targeting `bug` of `1 - (progress - hitAt) / 0.3` when `progress >= hitAt`, else 0. `drawBug` draws a white ellipse (`r*1.1 × r*0.85`) at `alpha 0.7 * flash` over the body.
- Produces: `tests/stub-ctx.js` exports `stubCtx()`: a Proxy where any property read is a no-op function, except `measureText` → `{ width: 5 }`, `createRadialGradient`/`createLinearGradient` → `{ addColorStop() {} }`, and assignments are stored.

- [ ] **Step 1: Write failing tests** in `tests/visuals.test.js` (same `beforeEach` pattern as `tests/firewall.test.js`: `resetRegistry`, `clearAll`, register a dev `java` `{ damage: 18, fireRate: 1.5, range: 2.2, attackDuration: 0.4, attackHitAt: 0.66 }` and a bug):
  - `attack effect: firing pushes kind 'attack' with dev type, target and ttl 0.4` — place a dev, put a bug in range, `tickDevs(g, 0.01)`; assert one effect `kind === 'attack'`, `dev === 'java'`, `target === bug`, `maxTtl === 0.4`, `dev.lastShotAt === g.time`.
  - `attack effect: developer without attackDuration uses 0.12`.
  - `attack effect: follows the target, then freezes where it died` — move the bug, `tickEffects` via `tick(g, 0.01)`, assert `to` equals new position; set `bug.dead = true`, move it again, tick, assert `to` unchanged.
  - `render: drawAttack gets progress in 0..1; a throwing hook is logged and the frame finishes` — `render(stubCtx(), g, { })` with a dev whose `drawAttack` records `a.progress`, then one that throws; assert recorded progress within [0, 1] and render did not throw.
  - `render: developer without drawAttack still draws (beam)` — no throw.
  - `hitFlash: 0 before hitAt, 1 at hitAt, 0 after hitAt + 0.3`.
- [ ] **Step 2:** `npm test` → the new tests fail (`addAttack`/`hitFlash` missing, kind is `beam`).
- [ ] **Step 3:** Implement the interfaces above. `full-stack-squad.js`: replace its beam with `addAttack(game, dev, { x: bug.x, y: bug.y }, next)`.
- [ ] **Step 4:** `npm test` → all pass (existing full-stack-squad tests included).
- [ ] **Step 5:** Commit `feat: attack effects follow their target and developers can draw their own attack`.

### Task 2: Bug `draw` hook and heading

**Files:**
- Modify: `src/engine/map.js`, `src/engine/render.js` (`drawBug`)
- Test: `tests/visuals.test.js`, `tests/map.test.js`

**Interfaces:**
- Produces: `headingAt(distance) -> radians` in `map.js`: direction of travel of the segment containing `distance` (0 = +x, π/2 = +y). At `distance >= PATH_LENGTH` the last segment's heading.
- Produces: bug hook `draw(ctx, r, bug, time)`, drawn at the origin facing +x. `drawBug`: if the def has `draw`, translate, rotate by `headingAt(bug.distance)`, call it (try/catch); else today's legs + oval + `drawIcon` (unrotated, as today). Then hit flash (Task 1), then health bar (unrotated) as today.

- [ ] **Step 1: Failing tests:** `headingAt: 0 on the first segment, π/2 going down, -π/2 going up` (distances 10, 200, and on the segment from (420,260) to (420,140)); `render: bug draw hook is called with r and time; throwing hook is logged; bug without hook draws`.
- [ ] **Step 2:** `npm test` → fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: bugs can draw their own body, turned towards where they walk`.

### Task 3: Java steam, .NET lightning, React hooks

**Files:**
- Modify: `src/content/developers/java.js`, `dotnet.js`, `react.js`, `src/engine/render.js` (pass `dev`, `game.time` to `drawIcon`)
- Test: `tests/visuals.test.js`

**Interfaces:**
- Consumes: `drawAttack(ctx, a)`, `attackDuration`, `attackHitAt` (Task 1); `dev.lastShotAt` (Task 1).
- Produces: developer `drawIcon(ctx, size, dev, time)`; `dev`/`time` are undefined outside the board. `drawDevTile(ctx, def, x, y, size, dev, time)` passes them on.
- Values (from the mockups, adapt to the accent tile):
  - Java: `attackDuration: 0.42`, `attackHitAt: 0.66`. Two wisps from the icon's steam positions (icon units x −4 and 2, y −10 scaled by `size/36`), braided half a wave apart, head travelling 0→1 with a body 0.5 long (`travel = progress * 1.5`), orange core (`#EA580C`, width 3) over a white haze (width 7, alpha 0.12), tails thinner/fainter; 3 small orange puffs at the bug while the tail sinks in. Icon steam hidden at the shot and rising back over 0.35 s (`(time - dev.lastShotAt) / 0.35`), always full without `dev`.
  - .NET: `attackDuration: 0.28`, `attackHitAt: 0`. Jagged bolt of 9 segments, amplitude 22 px tapered by `sin(π f)`, re-jittered every 0.045 s (seeded by `seed` and `Math.floor(time / 0.045)` so it is deterministic), passes fuchsia w9 α.22 / fuchsia w4 α.9 / white w1.6; full until progress 0.15 then fading; white flash disc (16 px) and a fuchsia shockwave ring growing 10→32 px at the bug.
  - React: `attackDuration: 0.22`, `attackHitAt: 0.6`. A fishing hook (shaft + curved barb, blue stroke 4.2 under white 1.8, scale 0.75) flying 0→0.6 on a curve bowed 30 px sideways (side alternates by `shot % 2`), spinning 2 turns; from 0.6 stuck at the bug's near edge, fading out.

- [ ] **Step 1: Failing test** `every shipped developer look draws without throwing` — import the three developer files, for each: `drawIcon(stubCtx(), 36)`, `drawIcon(stubCtx(), 36, { lastShotAt: 1 }, 1.1)`, and `drawAttack(stubCtx(), a)` for progress 0, 0.5, 1; assert each def has `drawAttack`.
- [ ] **Step 2:** `npm test` → fail.
- [ ] **Step 3:** Implement the three looks and the `drawIcon` arguments.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: Java steam, .NET lightning and React hooks attacks`.

### Task 4: Enemy looks

**Files:**
- Modify: `src/content/bugs/typo.js`, `nullpointer.js`, `legacy.js`, `merge-conflict.js`, `memory-leak.js`, `security-risk.js`
- Test: `tests/visuals.test.js`

**Interfaces:**
- Consumes: bug `draw(ctx, r, bug, time)` (Task 2).
- Looks (mockup `bug-designs.html`, option A except memory leak B), all scaled by `r / mockupRadius`:
  - typo: squiggle worm (blue, no legs, white head with blue rim).
  - nullpointer: orange-shell beetle with dark seam, white ∅, dark head with orange rim, antennae, grey legs.
  - legacy: floppy disk shell (`#4A044E` body, fuchsia outline, `#CBD5E1` shutter, white label), dark head, slow legs, dust puffs behind from `time`.
  - merge-conflict: diff bug (`#BBF7D0` / `#FECACA` halves, zigzag seam, thick grey outline, green +, red −); merge-conflict-half: small pale-green + bug for `bug.side === 'ours'`, pale-red − bug otherwise, grey outline.
  - memory-leak: slate-grey module (`#334155`), grey outline, gold contacts as legs, 4 chips lit `Math.round(fill * 4)` where `fill = (bug.radius - BASE_RADIUS) / (MAX_RADIUS - BASE_RADIUS)` (0 without a bug).
  - security-risk: dark-red armoured beetle, plate lines, mandibles, open padlock in `#FECACA`, red alarm ring pulsing with `time` (period ~0.77 s). Keep its existing `update`.
  - Keep existing `drawIcon` functions (harmless fallback; other code may use them).

- [ ] **Step 1: Failing test** `every shipped bug look draws without throwing` — import the six bug files; for each registered bug assert `draw` exists and call it with `(stubCtx(), def.radius, { radius: def.radius, side: 'theirs' }, 1.3)` and with `bug` undefined.
- [ ] **Step 2:** `npm test` → fail.
- [ ] **Step 3:** Implement the six looks.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: every enemy gets its own look`.

### Task 5: Firewall burning ground

**Files:**
- Modify: `src/content/investments/security-training.js` (`firewallFeature.draw`)
- Test: `tests/firewall.test.js`

**Interfaces:**
- Produces: `fireParticles(time, x, y, size, count) -> [{ x, y, r, age /*0..1*/, ember }]`, exported, pure: particle `i` has a fixed life (0.27–0.54 s, from a hash of `i`), its cycle `Math.floor((time + phase_i) / life_i)` picks a start point inside the square (hash of `i` and cycle), it rises up to ~32 px·life and sways; ~1 in 25 is an ember (tiny, longer life, rises further).
- Draw: soft fuchsia radial glow under the cell, then particles with `globalCompositeOperation = 'lighter'`, colour by age `#FCE7F3` (<0.18) → `#F0ABFC` (<0.4) → `#C026D3` (<0.7) → `#701A75`, alpha `(1 - age) * 0.55`, radius shrinking to 35%; for each bug inside a firewall cell, a small extra `fireParticles` burst at the bug. ~110 particles per cell.

- [ ] **Step 1: Failing tests:** `fireParticles is deterministic for the same time`; `fireParticles start inside the cell` (every non-ember particle's x within the square ± sway 6 px); `firewall draw does not throw` (`firewallFeature.draw(stubCtx(), g)` with a pair).
- [ ] **Step 2:** `npm test` → fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: firewall burns as fuchsia fire across its lane cell`.

### Task 6: Code-on-a-circuit lane

**Files:**
- Create: `src/engine/lane.js`
- Modify: `src/engine/render.js` (`drawMap` calls `drawLane(ctx, game.time)` instead of the band + dashes)
- Test: `tests/visuals.test.js`

**Interfaces:**
- Produces: `drawLane(ctx, time)` and `sideTraces() -> [[x, y], ...][]` from `lane.js`.
- Look (`path-styles.html`, "A + B version 1"): teal edge (`rgba(45,212,191,.45)`, `PATH_WIDTH`), body `#0B3448` (`PATH_WIDTH - 4`), clipped rows of `500 7.5px "JetBrains Mono", monospace` code (5 rows, 7 px apart, scrolling 18 px/s towards production, plain text `#94A3B8` α .28, keywords in React/Java/.NET colours α .55), hollow teal rings (r 13) at the inner waypoints, side traces (teal α .22, width 2) ending in pads, with a small signal dot running along each trace into the lane. Add the JetBrains Mono font link to `index.html` with the existing Lato one; fall back to `monospace`.
- `sideTraces()`: about one every 110 px along the path, alternating sides; each leaves the lane edge, goes 12 px diagonally and ~30 px straight; drop any whose end is on a path cell or off the board.

- [ ] **Step 1: Failing tests:** `sideTraces end off the lane and on the board`; `drawLane does not throw`.
- [ ] **Step 2:** `npm test` → fail.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → pass.
- [ ] **Step 5:** Commit `feat: the lane is a circuit trace carrying a stream of code`.

### Task 7: Docs and check in the browser

**Files:**
- Modify: `CONTRIBUTING.md` (registry table: `drawAttack`, `attackDuration`, `attackHitAt`, `drawIcon(ctx, size, dev?, time?)`, bug `draw?(ctx, radius, bug, time)`), `README.md` only if it describes looks.

- [ ] **Step 1:** Update the docs.
- [ ] **Step 2:** Run the game in a browser (static server on the repo root), play into a late sprint at 3× with many developers and a firewall: every look as in the mockups, counter colours readable, pause freezes animations, no console errors, smooth frame rate. Fix what's off.
- [ ] **Step 3:** `npm test` → pass. Commit `docs: drawing hooks for attacks and bugs`.
