# Trojan horse: a boss you summon yourself (design)

## Intent

A high-risk, high-reward gamble. At the victory bell the player can pay a large drink price to let a
**Trojan horse** into the next sprint. It is a special boss, tougher than that sprint's security risk.
Squash it and it bursts open, scattering a jackpot of drinks across the map. Let it reach the Nexios
building and production goes down at once: the run is lost.

The theme: you pay to let a "gift" in; when it breaks open, what it was hiding spills out.

## Goals

- A deliberate choice between sprints: save drinks for a gamble, or spend them on hires and upgrades.
- Stays meaningful the whole run: price and strength scale with the sprint.
- A memorable payoff moment: an explosion, then a scramble to click up loot spread over the map.

## Non-goals

- No random or forced horses: it only ever comes because the player paid for it.
- No new currency, no investment or building upgrade tied to it (can come later).
- No change to the regular security risk.

## Anti-goals

- A guaranteed money machine. If a strong team can farm it every sprint with no real risk, it has failed.
  The price, the instant-death leak and the expiring loot are what keep it a gamble.
- Breaking the "one file plus one manifest line" rule beyond the single engine hook described below.

## Behaviour

### Summoning (victory bell)

- The offer appears on the **victory bell card** (phase `bell`) and on the **quarter-review bell**
  (phase `review`, both the full review card and the minimised corner card), because both lead into a sprint.
  It is not offered while the yearly review is still open (`pendingYearReview`), because the bell can't be rung then.
- The action reads "Let the Trojan horse in" with the price shown per drink (drink icons, as on other cost labels).
- It is disabled when the player can't pay the price in **all three** drinks; the label still shows the price.
- Clicking it pays immediately and cannot be undone. The action then shows "Trojan horse incoming" (disabled).
- At most **one horse per sprint**. The summon is stored on the game state (e.g. `game.trojan = { sprint, paid }`)
  and is consumed by the next sprint start.
- If the run is lost or quit before the bell is rung, the payment is simply gone.

### Price

- Per drink: `round(100 × (1 + 0.1 × s))`, where `s` is the 0-based global index of the sprint the horse will
  appear in (`game.sprint` while at the bell). Sprint 1 → 100, sprint 7 → 160, sprint 28 → 370.
  There is no bell before sprint 1 (the run starts in `building`), so in play the cheapest horse is sprint 2 at 110.
  The formula and its tests keep `s = 0` anyway.
- The same amount is paid in each of the three drinks. Investments, raise and business manager do not change the price.

### The horse in the sprint

- Bug id `trojan-horse`, `boss: true`, no counter (grey/neutral ring rule: no developer gets double damage).
- Health: base `hp: 900` (3× the security risk's 300); the engine's per-sprint `hp` multiplier applies as for every bug,
  so it is always 3× that sprint's security risk.
- Speed: 22, same as the security risk. Radius ~20 (a bit bigger than the security risk's 18).
- Spawn: added to the sprint's spawn queue **3 s after the security risk** (`BOSS_DELAY` after the boss's entry).
- On spawn, a pop text "TROJAN HORSE!" like the security risk's "SECURITY RISK!".
- `livesLost: Infinity`. When it leaks, `moveBugs` caps the loss at the current lives, so lives hit 0 and the run is
  lost through the normal path (investors pay out, retrospective shows, best run saved). The retrospective counts it as a
  leaked bug like any other.
- Look: a wooden horse on wheels, seen from above, walking (rolling) along the path, in the boss style (pulsing alarm ring).
  Exact drawing is the builder's; it must read as a boss at a glance and look different from the security risk.
  It needs `draw` and `drawIcon`.

### Explosion and loot

- On death (`onDeath`): an explosion effect at the horse (burst ring and debris/planks flying out, ~0.6–1 s),
  plus a pop text such as "JACKPOT!".
- Total loot (before multipliers) = **2 × the total price paid** (so 600 at sprint 1), multiplied by
  `game.mods.drinkMultiplier` like every drop (business manager and yearly raise apply).
- The loot is split evenly over the three drinks and into **many small drops** (on the order of 8–12 per drink),
  thrown out from the horse to random points across a large part of the map (well beyond `SWEEP_RADIUS`, so one click
  does not grab it all). Drops must land inside the map.
- Drops thrown further get a longer lifetime: base `DROP_TTL` (10 s) plus up to ~5 s extra, scaling with the distance
  from the horse. Drops are collected with the existing click/sweep logic; nothing new for pickup.
- The existing end-of-quarter hold already waits for every drop to be collected or gone; that covers horse loot too.
- Rounding: the sum of the drop amounts should equal the computed loot (no loss from rounding many small drops).
- `killBug` always calls `dropDrinks`, which gives a boss at least 1 of each drink even with `reward: 0`. *Designer's
  call:* no engine change for this. The horse keeps `reward: 0`, and the jackpot subtracts what `dropDrinks` already
  dropped, so the **total** of all drops from the horse equals the computed loot. The test counts every drop the
  horse leaves.

### Claude and other effects

- **Claude can't touch the horse** (decided by the owner). On a success Claude squashes every other bug, and the horse
  keeps walking at full health. On a backfire every other bug is copied, but the horse is not. Implemented as a bug flag
  (e.g. `claudeImmune: true` on the bug definition) that `src/content/powerups/claude.js` checks, so it stays a content
  change. Claude's `canActivate` still needs at least one bug; if the horse is the only bug left, Claude may fire and
  do nothing (builder's call whether to disable it then).
- The horse is a normal bug for everything else: CEO/training/business manager, firewall, garbage collection slow
  (boss rate), random events.

## Engine change (the one hook)

The bell card and the quarter-review bell (full and minimised) in `src/engine/ui.js` get an extension point so
content can add actions there. Proposed shape, an extra optional field on `registerFeature`:

```js
bellActions: [{ id, label(game), hint?(game), enabled(game), onClick(game) }]
```

`label` may return a string or a DOM node (needed for drink icons in the price). The UI re-renders the card after
`onClick`. Documented in `CONTRIBUTING.md` next to `hudButtons`.

Everything else lives in content:

- `src/content/bugs/trojan-horse.js`: the bug (stats, `update` pop text, `onDeath` explosion and loot, `draw`, `drawIcon`).
- `src/content/features/trojan-horse.js`: price, summon state, the bell action, and adding the horse to the spawn
  queue on `sprint:start` (keeping the queue sorted by `t`).
- One line each in `src/content/manifest.js`.

Loot drops are pushed in the same shape `dropDrinks` uses (`{ id, x, y, drink, amount, ttl }`) and emit
`drop:spawned`. If that proves awkward, a small exported helper in `drops.js` for placing a drop at a given point with a
given ttl is acceptable.

## Approaches

- **A (picked): small engine hook for bell-card actions plus content files.** Clean fit with the project's rule,
  and the hook is reusable for later bell-time choices.
- B: pure content, the summon as a HUD button that only works between sprints. No engine change, but not on the
  bell card where it was wanted.
- C: pure content, the feature injects itself into the bell card's DOM. Looks right but breaks silently whenever `ui.js`
  changes how it builds the card.

## Decided in the conversation

- Summoned at the victory bell; spawns in the next sprint; stronger than that sprint's boss; explodes and scatters loot.
- Trojan horse as the boss.
- Leak = instant loss of the run.
- Price 100 per drink, +10% per sprint; health 3× the security risk; loot 2× the price paid.
- Claude neither kills nor copies the horse.

## Calls made by the designer (correct if wrong)

- Also offered at the quarter-review bell.
- One horse per sprint; no refund.
- Horse arrives 3 s after the security risk.
- Far-thrown loot lives up to ~5 s longer.
- Price is not reduced by any investment or multiplier.

- Balance check: `scripts/sim.mjs` gets an option for the bot to summon the horse whenever it can afford it, and reports
  win/leak rate and net drinks per horse. It only reports. If the numbers look farmable, the builder flags it and the
  agreed numbers are not retuned without the owner.

## Left to the builder

- Exact horse drawing and explosion visuals, sound (reuse an existing sound if there is no fitting one).
- Exact drop count and spread pattern within the limits above.
- Exact markup/CSS for the bell action, matching the existing bell card.

## Tests

- Price formula at sprints 0, 6, 27.
- Summon: pays all three drinks, refuses when any drink is short, refuses a second summon in the same sprint,
  is consumed by the next sprint, horse ends up in the spawn queue after the boss.
- Horse health = 3× the security risk in the same sprint.
- Leak sets lives to 0 and the run is lost.
- Claude success leaves the horse alive at full health; Claude backfire does not copy it.
- Death: total dropped amount = 2 × price × drinkMultiplier, split over three drinks, all drops inside the map,
  ttl between 10 and ~15 s.
- `bellActions` render on the bell card and the quarter review, not during the yearly review.
- Manifest/content test lists the new bug and feature. README gets a bullet under "How it plays".
