# Wine tasting event + Water cooler upgrade (short design)

Mockup: `docs/mockups/wine-tasting.html`

## Intent
A new random event, "Thomas organized a wine tasting": tipsy developers shoot a random bug in range instead
of the one furthest along, and those tipsy shots zigzag to their target. A new counter-upgrade sobers the team up.

## Behaviour
- **Event** `wine-tasting` (`src/content/events/wine-tasting.js`): name "Thomas organized a wine tasting",
  description "Developers shoot at random bugs", accent `#9F1239`. No stat changes.
- **Targeting:** while the event is active, each shot is *tipsy* with chance `1 - resistanceTo(game, 'wine-tasting')`.
  A tipsy shot picks a uniformly random bug from `bugsInRange`; a sober shot keeps today's target (furthest along).
- **Zigzag:** only tipsy shots zigzag. The attack effect carries a `tipsy` flag; `drawAttack` receives it plus a shared
  `zigzagPoint(from, to, s, seed, amp)` helper (triangle-wave sideways offset, pinned at both ends).
  - React: the hook flies along the zigzag instead of its bow (still spins).
  - Java: both steam wisps use the zigzag as their centre line (braid kept).
  - .NET: the bolt follows wide regular zags, with its usual small jitter on top.
- **Upgrade "Water cooler"** (`src/content/upgrades/water.js`, id `water`): `counterUpgrade` with counters
  `wine-tasting`, description "Counters: wine tasting", 3/5/7 Warrants. Each level makes a third of shots sober;
  level 3 cancels the event.
- **Building:** a water cooler against the wall below the door; the jug fills a third per level, bubbles at level 3.
  Side panel tile label "Water".
- Randomness for targeting uses `game.random()` (gameplay); the zigzag shape uses the shot's visual seed.

## Approaches
- **A (picked): each developer keeps its own look along a zigzag path.** Touches the three developer files plus one helper.
- B: replace every tipsy shot with one generic zigzag line. Less work, but loses each developer's identity.
- Zigzag on all shots during the event vs only tipsy ones: **only tipsy ones** (picked), so the upgrade level is visible.

## Name
"Espresso bar" was dropped because a Coffee bar upgrade already exists; "Water cooler" it is.

## Tests
- Manifest/content test lists the new event; counter-upgrade test includes `water` ↔ `wine-tasting`.
- Targeting: with the event and resistance 0, shots spread over bugs in range; with resistance 1, always the furthest.
- Wire into `src/content/manifest.js`, `src/main.js`, `building.js`/`render.js` levels, side panel `SHORT`, README.
