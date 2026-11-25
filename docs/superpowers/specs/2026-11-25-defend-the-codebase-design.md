# Defend the Codebase — design

Date: 2026-11-25 · Status: draft, awaiting approval
Context: Intent Engineering Bootcamp, Day 5 hackathon. Demo at 16:00, live link posted before 15:45.

## 1. Intent

A browser tower defense game on the brief's "Defend the Codebase" theme. Bugs crawl along a path toward **production**, developers squash them, and you lose when too much gets through.

The goal for this first build is a **solid, playable base that teammates can extend individually**. Each teammate should be able to add a power-up, developer, bug or Nexios reference in **their own file**, without editing shared engine code and without merge conflicts. Features, polish and extra Nexios references come afterwards, built in parallel.

The judging prizes are: most features (counted live), most fun (audience vote), most polished, and best Nexios references (references that are part of the gameplay score higher). The base should make all four easy to chase later.

## 2. Goals, non-goals, anti-goals

**Goals**
- A complete core game: 10 waves, a win condition and a lose condition.
- Three developer types, three bug types, developer levelling, four power-ups, and the victory bell.
- Each piece lives in its own file and registers itself with the engine (see §6).
- Opens from a GitHub Pages link with no build step.
- Nexios visual style (see §5).

**Non-goals for the base**
- Multiple maps, extra developer or bug types, a settings menu, save games, leaderboards.
- Final art and final sound. Placeholders are fine.
- Final game balance. The numbers in §4 are starting values to tune.

**Anti-goals** (failure even if it technically works)
- A single big file that every teammate has to edit. That leads to merge conflicts.
- Engine changes needed just to add a new tower, bug or power-up.
- Things that are unreadable on a projector: tiny icons, low contrast.
- Breaking during the live demo. Stability beats features.

## 3. Constraints

- Must run in a browser from a link. Hosted on GitHub Pages (public repo `Robin-Cortvrindt/defend-the-codebase`, deployed from the `main` branch root).
- No build step, no npm. Plain HTML, CSS and JavaScript ES modules.
- ES modules don't load from `file://`, so local testing needs a static server, e.g. `python -m http.server`.
- `REGRET.md` at the repo root, kept up to date: each time something that worked breaks, log what broke and why.
- Nothing secret in the repo, since the page is public.
- Power-ups are named after roles (Training manager, Business manager, CEO), not real colleagues, so no consent is needed.

## 4. The game

### Core loop
1. Before each wave, hire developers with **Warrants** and place them on grid cells next to the path.
2. Start the wave. Bugs enter on the left and follow the path toward the **PROD** box.
3. Developers automatically attack bugs in range. Each squashed bug pays Warrants and gives the developer that landed the killing hit some experience.
4. Each bug that reaches PROD costs production lives. At 0 lives, production is down and the game is lost.
5. When the wave is cleared, the **Nexios victory bell** appears. Clicking it rings the bell and starts the next wave. Hiring and selling still work while the bell is waiting.
6. Clearing wave 10 wins the game.

### Map
- A single fixed map on a 16 × 8 grid of 40 px cells (640 × 320 logical pixels), scaled to fit the window.
- A winding path from the left edge to the PROD box on the right, as shown in the mockups. Path waypoints in logical pixels: `(0,60) → (180,60) → (180,260) → (420,260) → (420,140) → (576,140)`. The path is 36 px wide.
- The PROD box sits **inside** the grid, in the rightmost column (x 576–632, y 106–174). Its cells can't be built on.
- Developers can only be placed on free cells that aren't part of the path.

### Developers
Each developer type owns one Nexios accent colour. It's drawn as a 36 px rounded tile with a white technology icon.

| Type | Accent | Fire rate | Damage | Range | Cost | Counters |
|---|---|---|---|---|---|---|
| React | blue `#2563EB` | fast (~4/s) | low (~6) | medium (~2.2 cells) | 50 | Typo bug |
| Java | orange `#EA580C` | medium (~1.5/s) | medium (~18) | medium (~2.2 cells) | 75 | Null pointer |
| .NET | fuchsia `#C026D3` | slow (~0.6/s) | high (~55) | longer (~2.6 cells) | 110 | Legacy bug |

- **Counter bonus:** a developer does **×2 damage** to the bug type it counters, with a visible "×2" damage pop.
- **Targeting:** attack the bug furthest along the path within range.
- **Levelling:** Junior Consultant → Consultant → Senior Consultant. Experience comes from kills: a developer earns XP when its hit kills a bug. Suggested thresholds: 10 XP for Consultant, 30 XP for Senior. Each level gives roughly +25% damage and +15% fire rate. The level badge (J / C / S) is drawn at the tile's corner, and an XP bar shows when the developer is selected.
- **Selling:** returns 50% of the hire price.
- Clicking a placed developer selects it and shows its range, level, XP and a sell button.

### Bugs
Bugs are simple shapes: a light body with a ring in the **accent colour of the developer that counters them**, so counters can be read at a glance. There are lots of them.

| Bug | Size | Health | Speed | Lives lost at PROD | Warrants | Ring |
|---|---|---|---|---|---|---|
| Typo bug | tiny | ~10 | fast | 1 | 1 | blue |
| Null pointer | medium | ~45 | medium | 1 | 3 | orange |
| Legacy bug | large | ~200 | slow | 3 | 8 | fuchsia |

### Waves
- 10 waves, defined as data: a list of spawn groups (bug type, count, interval, delay).
- Wave 1 is typo bugs only. Null pointers come in around wave 2–3 and legacy bugs around wave 4. Later waves mix all three in larger numbers. Wave 10 is a big mixed swarm.
- Each cleared wave pays a bonus (~20 + 5 × wave number).
- Starting state: **100 Warrants** (two Juniors) and **20 production lives**.

### Power-ups
Power-ups are buttons in a bar below the map. Each shows ready, active (with time left) or cooling down (with a progress bar).

| Power-up | Effect | Duration | Cooldown |
|---|---|---|---|
| **Training manager** | Developers gain ×2 XP | 15 s | 45 s |
| **Business manager** | Warrants from kills ×2 | 15 s | 45 s |
| **CEO** | All developers attack 50% faster | 10 s | 40 s |
| **Claude** | Squash every bug on the map right away, for Warrants | instant | none, but the price rises |

**Claude details:** it starts at 150 Warrants and the price is ×1.5 after each use, rounded. There's a fixed **25% chance to backfire**. On a backfire, every bug currently on the map is copied, so the bug count doubles, and the player still pays. On success, every bug on the map dies and pays out normally. The button is disabled when you can't afford it. A banner says what happened ("Claude · backfire — Hallucinated a fix — bug count doubled").

Power-ups only work during a wave. Cooldowns keep running while the bell is waiting.

### Screens
1. **Start screen:** the Nexios wordmark, the game title and a "Start" button. *(Added during the design; not in the mockups.)*
2. **Playing:** a HUD at the top (wordmark, Warrants, production bar, wave X / 10, wave button), the map, the power-up bar and the hire bar.
3. **Bell:** the map is dimmed, and the bell sits in the centre with the wave bonus and the "Ring the bell to start wave N" call to action.
4. **Won:** "Codebase defended", with stats (bugs squashed, Seniors promoted, Warrants earned) and a "Play again" button.
5. **Lost:** "Production is down", with the wave it fell on, a fake stack trace and a "Hotfix and retry" button.

The mockups are kept for reference in `docs/mockups/game-states.html`.

## 5. Visual style (Nexios)

- Navy `#001E32` background, slate neutrals (`#475569` `#64748B` `#94A3B8` `#E2E8F0` `#EEF1F5`), and the **Lato** font from Google Fonts.
- Four positional accents: blue (React), orange (Java), fuchsia (.NET), and green `#16A34A` for ready, healthy, Senior and win. Orange also marks the loss screen.
- The white Nexios wordmark is a static image (`assets/nexios-wordmark-white.webp`). Never re-typeset it or stretch it.
- 8 px button radius, 10–14 px card radius, 1 px hairlines. No gradients, glow or glass.
- No emoji anywhere in the interface. Headlines use sentence case and no exclamation marks.
- Everything is drawn with canvas shapes, so art can be swapped later without touching game logic.

## 6. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Plain canvas, vanilla JS ES modules, data-driven registry** | Small enough for anyone to read the whole engine in ten minutes, and no library to learn. Animations, particles and sprites have to be hand-rolled. | **Chosen** by the user |
| B. Same structure on Phaser 3 from a CDN | Animations, particles, sprites and sound included, but every teammate has to learn the Phaser way and the code is harder for newcomers. | Rejected: slows parallel work |
| C. A single HTML file | Fastest to start, but every change touches the same file, so merge conflicts happen all the time. | Dropped: works against the main goal |

### Structure (the extension contract)

```
index.html            page shell, loads src/main.js as a module
style.css             HUD, bars and screens in Nexios style
REGRET.md
assets/               wordmark, sounds
src/
  main.js             boots the game; imports every content file (one line per file)
  engine/             loop, state, map/path, spawner, combat, rendering, input, UI
  engine/registry.js  registerDeveloper / registerBug / registerPowerup / registerWaves
  engine/events.js    tiny event bus: on(name, fn), emit(name, data)
  content/developers/ react.js, java.js, dotnet.js
  content/bugs/       typo.js, nullpointer.js, legacy.js
  content/powerups/   training-manager.js, business-manager.js, ceo.js, claude.js
  content/waves.js
  content/features/   empty at first; teammates' add-ons (e.g. Nexios references) go here
```

- **Content files are data plus small hooks.** For example, a developer file registers `{ id, name, accent, cost, damage, fireRate, range, counters, drawIcon(ctx) }`. A power-up file registers `{ id, name, duration, cooldown, cost?, activate(game), deactivate(game) }`.
- **Adding something new** means creating one file and adding one `import` line in `main.js`. That one line is the only shared edit.
- **The event bus** lets features react without touching the engine. Events include `game:start`, `wave:start`, `wave:cleared`, `bell:rung`, `bug:spawned`, `bug:killed`, `bug:leaked`, `dev:placed`, `dev:levelup`, `dev:sold`, `powerup:activated`, `claude:backfire`, `game:won` and `game:lost`. A feature might ring a sound on `bell:rung`, or show a Pizza Hut bonus on `wave:cleared`.
- **Modifiers:** power-ups and features change the game through a shared modifier object (`game.mods.xpMultiplier`, `warrantMultiplier`, `fireRateMultiplier`, `damageMultiplier`, `bugSpeedMultiplier`, `rangeMultiplier`), never by patching engine functions. *(Builder call: `bugSpeedMultiplier` and `rangeMultiplier` were added so slow, freeze and buff power-ups work without engine edits.)*
- **Features:** `registerFeature({ id, init(game), update(game, dt), draw(ctx, game), hudButtons })` covers per-frame logic, map overlays (e.g. a Pizza Hut bonus popup) and extra HUD buttons. Every hook is optional. *(Builder call.)*
- **Bug hooks:** bug definitions may add optional `onHit(bug, game)`, `onDeath(bug, game)` and `update(bug, game, dt)` for special behaviour such as splitting or shields. *(Builder call.)*
- **Fault isolation:** `main.js` loads each content file through its own guarded dynamic `import()`. A broken teammate file is logged to the console and skipped, and the game keeps running. This protects the live link on `main`. *(Builder call.)*
- **Sound:** a tiny `playSound(name)` helper built on `Audio`. It fails silently if a file is missing. Placeholder sounds for the bell, hits, a level-up, Claude and game over.

## 7. Deployment

- Public repo `Robin-Cortvrindt/defend-the-codebase`. GitHub Pages deploys from the `main` branch at `/` (root). No build step and no Actions.
- Live URL: `https://robin-cortvrindt.github.io/defend-the-codebase/`
- All asset paths are relative, so the `/defend-the-codebase/` sub-path works.
- The link goes in the bootcamp channel before 15:45. Fallback: run locally over HDMI.
- **Workflow (builder call):** teammates push straight to `main` and keep commits small. Before every push, load the page locally with `python -m http.server` and play one wave. Freeze `main` at 15:30 and only push fixes after that.

### Build order (builder call)
1. **Contract first:** the registry, event bus, modifiers, guarded loader and one stub file of each kind. Push it, so teammates can start right away.
2. Core loop: map, path, spawner, the three bugs, the three developers, placing developers, combat, Warrants, lives.
3. The bell, the 10 waves, and the win and lose screens.
4. Levelling, selling, and the power-ups (Training manager, Business manager, CEO, then Claude).
5. Start screen, placeholder sounds, polish.

If time runs short, cut from the bottom of this list. Steps 1–3 alone are a playable demo.

## 8. Left to the builder

- Exact balance numbers (everything marked ~ above).
- Spawn timing and composition per wave.
- Projectile versus instant-hit visuals (a short beam line, as in the mockups, is fine).
- How the canvas scales to the window and handles high-DPI screens.
- Placeholder sound sources (generated or free, e.g. kenney.nl).
- Internal engine module boundaries, as long as the registry, events and modifiers contract in §6 holds.

---

## 9. Update (approved 2026-11-25): sprints, quarters, the Nexios building, reviews

This section replaces the parts of §4 it contradicts. Waves become **sprints**, the game becomes **endless**, and the PROD box becomes the **Nexios building**.

### Sprints and quarters
- A wave is now called a **sprint**. Every **quarter** has **7 sprints** and every **year** has **4 quarters**. There's no last sprint: you play until production goes down.
- The HUD shows `Year Y · QN · Sprint S / 7`. Sprints are numbered globally inside the engine (`game.sprint`, starting at 0) and turned into year, quarter and sprint for display.
- Difficulty never caps. The first 10 hand-made sprints come from `waves.js`. After that, sprints are generated from the last hand-made one, with more bugs and more health each sprint.
- **The run ends** on the lost screen, which shows how far you got ("Fell in Year 1 · Q3 · Sprint 5") and your best run, saved in `localStorage` with a try/catch around it.
- The old win screen is no longer reachable. The `game:won` event stays in the event list for compatibility but is never emitted.

### Nexios Coins
- This is a second currency, `game.coins`, which starts at 0.
- Finishing a sprint pays **1 coin**. Finishing a quarter pays **3 more**.

### Quarter review (after sprint 7 of every quarter)
- It replaces the plain bell screen for that sprint. It shows the quarter's stats (bugs squashed and lives lost this quarter) and the **building shop**, then the bell to start the next quarter.
- **Building upgrades** are registered content, using the same pattern as power-ups:
  - **Add a floor:** +5 maximum production and heals 5. Costs `3 + floors bought` coins (3, 4, 5…). The building is drawn one storey taller for each floor.
  - **Air conditioning:** levels 1 to 3, costing 3, 5 and 7 coins. Each level takes away a third of the heat-wave slowdown. A roof unit is drawn, getting bigger with the level.

### Heat waves (designed by the random-events work, not here)
- The heat wave is one of the random events, designed and built in a separate piece of work (`docs/superpowers/specs/2026-11-25-random-events-design.md`).
- **The only interface:** air conditioning sets `game.heatResistance` (0, 1/3, 2/3, 1 for levels 0–3), and the heat wave scales its effect by `1 - heatResistance`.

### Yearly review (after every Q4)
- It comes straight after that year's quarter review, as a choice between two cards:
  - **Accept the review:** a permanent +10% on Warrant income (`warrantMultiplier ×1.1`).
  - **Ask for a raise:** a 50% chance of +20% (`×1.2`). If it fails, nothing changes.
- The result appears as a banner ("Raise approved" or "Raise denied — maybe next year"). The total bonus is shown in the HUD.

### The Nexios building
- It replaces the PROD box at the end of the path, in the same place. It's drawn as a small office with a "NEXIOS" sign, its floors stack upward, and the air-conditioning unit sits on the roof. Its health bar shows production (`game.lives / game.maxLives`).

### Extension points (added)
- `registerUpgrade({ id, name, description, maxLevel?, getCost(game), apply(game), draw? })`. Upgrades appear in the quarter-review shop.
- New events: `sprint:start`, `sprint:cleared`, `quarter:review`, `year:review`, `upgrade:bought`.
- `wave:start` and `wave:cleared` are still emitted as aliases, so existing features keep working.

## 10. Update (approved 2026-11-25): one counter-upgrade per random event

| Event | Counter-upgrade (id) | Effect | On the building |
|---|---|---|---|
| Heat wave | Air conditioning (`aircon`) | speed-up −⅓ per level | white roof unit, one fan per level, cool-air wisps |
| The heating is out | Server heat recovery (`heating`) | slowdown 50% → 33% → 17% → 0% | orange radiator strips under the windows (more floors per level), blinking server-room lights |
| Out of coffee | Coffee bar (`coffee`) | Java slowdown shrinks the same way | round café sign with a steaming cup on the left wall, bigger per level, glow at level 3 |
| Out of Red Bull | Energy drink fridge (`fridge`) | .NET slowdown shrinks the same way | glowing fuchsia fridge window, one per level |
| PROD is down | Backup generator (`generator`) | flashlight radius +40% per level; level 3 keeps the lights on | generator box at the foot (bigger per level) and one roof light per level |

- Each counter-upgrade has 3 levels for 3, 5 and 7 coins. It sets `game.resistance['<event id>'] = level / 3`. Events read it with `resistanceTo(game, id)` from `src/engine/upgrades.js` and scale their effect by it. Air conditioning also keeps `game.heatResistance`.
- New counter-upgrades: `counterUpgrade({ id, name, description, counters })` from `src/engine/upgrades.js`.
- The building drawing lives in `src/engine/building.js` (`drawBuilding(ctx, { floors, lives, maxLives, time, levels })`).
- There's no chimney, because Nexios is an IT company.
