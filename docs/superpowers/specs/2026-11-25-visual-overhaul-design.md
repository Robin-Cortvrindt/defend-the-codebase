# Visual overhaul: attacks, firewall, lane and enemies

## Why

The board looks generic: every attack is a straight line, every enemy is the same pale oval with a coloured ring, and the lane is a dark band. The game is about IT consultants squashing bugs before they reach production, and the visuals should say that. Each developer's attack should grow out of their own icon or tech, each enemy should look like the problem it is, and the lane should look like code on a circuit board.

## Goals

- A distinct attack animation per developer type (Java, .NET, React).
- The .NET firewall looks like real fuchsia fire.
- The bug lane looks like a circuit-board trace carrying a stream of code.
- Each enemy type has its own look.

## Non-goals

- No gameplay or balance changes: damage, fire rates, ranges, speeds, HP and rewards stay exactly as they are.
- No new enemies, developers or mechanics.
- No changes to menus, HUD, shop or other DOM UI.

## Anti-goals (failure even if it works)

- **Losing the counter colours.** The ring colour (blue = React, orange = Java, fuchsia = .NET, grey = nobody, red = boss) is how players know who counters what. Every new enemy look keeps that colour as its dominant colour.
- **Visual noise that hides the game.** Many React developers fire 4 times a second. The board must stay readable with a full late-game map: lane decoration stays dim, attack effects stay small and short.
- **Breaking the content rule.** CONTRIBUTING.md: new content is one file plus one manifest line, and content never needs engine edits. The engine only gets generic hooks; each look lives in its own content file.
- **Frame drops.** It must stay smooth (60 fps) on a normal laptop on a busy late wave.

## Constraints

- Plain canvas 2D, no new dependencies. The board is 640×320 (16×8 cells of 40 px), `src/engine/map.js`.
- `src/engine/render.js` reads game state and never changes it. Purely visual state (particles, flashes) must not change gameplay state; it can be derived from `game.time` or kept on effects / visual-only fields.
- Content hooks that throw are caught and logged, like `drawIcon` is today, so a broken look can't take the game down.
- Content that doesn't define the new hooks (e.g. `example-feature.js`'s "Py" developer and "flaky" bug, or anything contributors add later) keeps today's look: the straight beam and the oval with legs.

## Approaches considered

1. **Each look lives with its own developer or enemy (picked).** The engine gets three small generic hooks; the steam lives in `java.js`, the floppy disk in `legacy.js`, the fire in `security-training.js`, and so on. A few more files touched, but it keeps the one-file-per-thing rule and the next contributor draws their bug in their own file.
2. **All new visuals in one new engine file.** Quicker and easy to compare side by side, but separates each thing's look from its definition, breaks the content rule, and content added later gets no look of its own.

Robin picked approach 1.

## Decisions (as decided with Robin)

The mockups are the reference for every look. They are in `docs/mockups/`:
`attack-animations.html` (attacks and firewall), `path-styles.html` (lane), `bug-designs.html` (enemies). Open them in a browser; slow motion helps. Note the mockups draw developers as navy circles with an accent ring; in the game they are accent-coloured rounded tiles with a white icon (`drawDevTile`). Adapt the look to the real tile, keep the idea.

### Engine hooks (generic)

- **Developer attack hook:** a developer definition may provide its own attack drawing. When a developer fires, the engine records an attack effect carrying the developer type, the developer's position, the **target bug** (so the drawing can follow it), the attack's duration, and whether it was a counter hit. The developer's hook draws it each frame given its progress (0 → 1). Without a hook, today's straight beam is used.
- **Enemy body hook:** a bug definition may provide its own body drawing, replacing the default legs + oval + `drawIcon`. The engine still draws position, jitter, the health bar, and any hit flash. Without a hook, today's look is used.
- **Lane:** drawn by the engine in `drawMap` (it isn't content).
- Register the new hook names in CONTRIBUTING.md's "What you can register" table, and update `example-feature.js` only if it helps as an example (optional).

### Timing

- **Damage stays instant**, at the moment of firing, as today. Flying attacks are cosmetic.
- **Flying attacks follow the bug** while in the air. If the bug dies or disappears before arrival, the attack finishes at its last known position.
- **Hit flash:** the bug flashes briefly (whitens) when the attack arrives, so the hit still looks connected.

### Attacks

- **Java, "scalding steam":** the two steam lines on the coffee icon lift off the cup, travel as two braided, wavy wisps to the bug and sink into it with a few small orange puffs. Orange core with a faint white haze; tails thin and fade as if evaporating. The icon's steam is gone right after the shot and rises back within ~0.35 s. Duration ~0.4 s (Java fires 1.5/s).
- **.NET, "lightning strike":** a jagged fuchsia bolt (white core, fuchsia glow) cracks from the developer to the bug, re-jitters a few times while it lasts (~0.28 s), with a white flash and an expanding fuchsia shockwave ring at the bug, and the bug jolts slightly.
- **React, "thrown hooks":** a small fishing hook is thrown spinning along a curved path, alternating left and right per shot, and sticks in the bug briefly before fading. Duration ~0.22 s (React fires 4/s). Blue with white.
- **Full-stack squad bounce** (`full-stack-squad.js`, currently a beam from bug to bug): use the attacking developer's attack look from the first bug to the next. *(Claude's call.)*

### Firewall (`src/content/investments/security-training.js`)

- **"Burning ground":** the whole firewall lane cell is on fire, with low flames spread over the full square. Pale pink-white when young, fuchsia, then dark purple tips as they rise and fade, a few drifting embers, and a soft fuchsia glow on the ground. Bugs inside the cell catch small flames while they're in it. Replaces today's pulsing bar. Gameplay (where firewalls form, damage) unchanged.

### Lane (`src/engine/render.js` `drawMap`)

- **"Code on a circuit board" (A+B version 1 in `path-styles.html`):** the lane is a circuit trace: a teal-glowing edge, dark solder-mask body, hollow solder rings at the corners. Inside it, rows of dim monospace source code scroll slowly towards production, with keywords picked out faintly in the developer colours. Thin side traces branch off the lane into the board, ending in small pads, with small signals running along them into the lane. Replaces today's band and dashed line.
- The decoration must stay dim enough that devs, bugs and attacks clearly sit on top, and side traces must not read as places you can or can't build.

### Enemies (each in its own `src/content/bugs/*.js`)

All six are on `main` (merge conflict and memory leak arrived with `c2b14b0`).

All keep their ring colour as the dominant colour, and roughly today's size (`radius`).

- **Typo (blue): "squiggle worm".** The wavy spelling-mistake underline, crawling like a worm, with a small white head with a blue rim. No legs.
- **Null pointer (orange): "null beetle".** Orange shell split down the middle, a ∅ sign on its back, a dark head with an orange rim and two antennae, grey legs.
- **Legacy (fuchsia): "floppy disk beetle".** Its shell is a floppy disk seen from above (dark fuchsia body, fuchsia outline, metal shutter, white label), a dark head, slow stubby legs, and small dust puffs kicked up behind it.
- **Merge conflict (grey): "diff bug".** One bug split along a zigzag seam: pale green half with a +, pale red half with a −, thick grey outline. Its halves (`merge-conflict-half`) are a small pale-green + bug ("ours") and a small pale-red − bug ("theirs"), also with grey outlines. The pale diff tints are an accepted exception to "ring colour dominant": the thick grey outline carries the "nobody counters it", and the pale red must stay clearly unlike the boss's dark red. *(Claude's call, confirmed by Robin.)*
- **Memory leak (grey): "RAM stick".** A **slate-grey** memory module (not green, so grey stays dominant; Claude's call, confirmed by Robin) on legs (gold contacts as feet) with a grey outline. Its four chips light up one by one as it grows (dark when it spawns, all lit at full growth), and it gets bigger as it already does today (`bug.radius`).
- **Security risk (red boss): "armoured beetle, open lock".** A big dark-red armoured beetle with plate lines, mandibles, an unlocked (open) padlock on its back, and a pulsing red alarm ring around it.

## Left to the builder

- Exact hook names and signatures, effect shape, and how the hit flash is stored (visual-only).
- How to keep particle fire and the scrolling code fast (e.g. time-derived particles, caching the static parts of the lane to an offscreen canvas).
- Exact placement of the side traces on the current map.
- Fine-tuning sizes, colours and timings to look right in the real game, staying true to the mockups.
- Tests: at minimum, that a developer or bug without the new hooks falls back to today's drawing, that a hook that throws is caught, and that every shipped developer/bug look draws without throwing (a stub canvas context is fine). Visual quality is checked by running the game.
