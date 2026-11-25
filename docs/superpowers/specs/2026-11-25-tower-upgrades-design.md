# Tower upgrades — design

Date: 2026-11-25 · Status: draft, awaiting approval
Builds on: `docs/superpowers/specs/2026-11-25-defend-the-codebase-design.md`

## 1. Intent

Today the only thing to spend Warrants on is another developer. This change gives Warrants a second, more interesting use: **upgrading the developers you already have**. Every bell becomes a choice between hiring wider and upgrading deeper.

Each developer type gets its own upgrade path: one shared level-2 upgrade, then a choice between two level-3 branches. The branches must be **real tactical choices** (one steady, one a gamble), and each path carries a running joke that fits the technology.

Upgrades are gated by XP: squashing bugs earns XP as it does today, and reaching a threshold **unlocks** the next upgrade. You still have to pay Warrants to buy it.

## 2. Goals, non-goals, anti-goals

**Goals**
- Upgrades cost Warrants and need XP: 10 XP unlocks level 2, 30 XP unlocks the level-3 choice (today's thresholds).
- Nine upgrades as in §4, each with its own behaviour, not just a stat bump.
- Each developer file declares its whole upgrade path (approach A, §5).
- The jokes from §4 ship as written.

**Non-goals**
- Invisible or stealth bugs. Visual Studio Enterprise is simply the big-hit branch.
- New bug types, new developer types, level 4, respec or downgrading.
- Final balance. The numbers in §4 are starting values to tune with the sim.

**Anti-goals** (failure even if it works)
- One level-3 branch that is always the right pick. Then it is not a choice.
- Upgrading becomes strictly better or strictly worse than hiring, so Warrants still have one obvious use.
- A broken upgrade hook takes the game down. Hooks are guarded like all other content hooks (try/catch, logged, skipped).
- Text a projector audience can't read, or emoji in game text (house style).

## 3. Constraints

- Same as the base game: plain ES modules, no build step, GitHub Pages, Nexios palette, Lato, sentence case, no exclamation marks, no emoji.
- This change **edits the engine** (`devs.js`, `ui.js`, `render.js`, `main.js`, tests, `scripts/sim.mjs`). That's accepted. After it, adding or tweaking an upgrade must only need the developer's own content file.
- `node --test` and `node scripts/sim.mjs` must pass/run. Update `CONTRIBUTING.md` and `README.md` to describe upgrades.
- Log anything that breaks in `REGRET.md`.

## 4. The upgrades

Base stats today: React 50 W, 6 dmg, 4 /s, range 2.2 · Java 75 W, 18 dmg, 1.5 /s, 2.2 · .NET 110 W, 55 dmg, 0.6 /s, 2.6. Range is in cells (1 cell = 40 px).

Costs and numbers below are **my starting values** (not the user's), to be tuned with the sim. "Steady" and "Gamble" replace the user's green/yellow markers and appear as a small label on the branch button.

### Java — balanced all-rounder

| Level | Name | Cost | Effect |
|---|---|---|---|
| 1 | Junior Java Dev | (hire 75) | base |
| 2 | Spring Boot Dev | 60 | damage 18 → 26, range 2.2 → 2.6 |
| 3A Steady | Enterprise Architect | 120 | own damage ×0.6. Aura: other developers within 2 cells deal +15% damage. Auras from several architects don't stack. Line: "I don't code anymore, I enable." |
| 3B Gamble | Garbage Collector | 120 | every 8 s it stops firing for 1 s ("Stop-the-World"), then deals a pulse of 3× its shot damage to every bug in range |

Flavour: after placement, "Initializing 847 beans…" shows above the tower for 1 s. Cosmetic only; the tower fires normally.

### .NET — slow, heavy hits

| Level | Name | Cost | Effect |
|---|---|---|---|
| 1 | .NET Framework 4.8 | (hire 110) | base |
| 2 | .NET Core | 90 | fire rate 0.6 → 0.9. The tower's displayed name changes. |
| 3A Steady | Visual Studio Enterprise | 160 | damage 55 → 160, fire rate back to 0.6. No invisibility. |
| 3B Gamble | Azure Function | 140 | each shot also hits every bug within 1 cell of the target for full damage. Costs 2 Warrants per second while it is firing ("pay-as-you-go"). A toggle in the selection panel switches it on and off; when off, or when Warrants hit 0, it doesn't fire at all. |

Azure details *(design calls)*: it starts **on** after purchase. It charges only while it's on **and** has a bug in range, at 1 Warrant every 0.5 s, so Warrants stay whole numbers and never go below 0. At 0 Warrants it stops firing until you have Warrants again.

Running gag: every .NET upgrade first opens a prompt "Is it Core? Standard? Just .NET?" with a single "Yes" button. Esc or clicking outside cancels; "Yes" buys. The game pauses while the prompt is open, the same as `P` *(design call: the joke shouldn't cost the player lives, and a free pause gives nothing that `P` doesn't already)*. The sim and tests call the buy function directly and skip the prompt.

### React — fast, light hits

| Level | Name | Cost | Effect |
|---|---|---|---|
| 1 | Create React App | (hire 50) | base |
| 2 | Vite | 40 | fire rate 4 → 6. Upgrade tooltip: "CRA is deprecated, sorry." |
| 3A Steady | Next.js | 90 | each shot also hits the next 2 bugs behind the target that are in range ("renders before they arrive") |
| 3B Gamble | useEffect Hell | 80 | every hit has a 20% chance to trigger another hit (a re-render), which can chain. Chains capped at 10 per shot. If the target dies mid-chain, the next hit goes to the next target in range. |

Ecosystem bonus (all React levels): +10% fire rate for each other React developer on the map, capped at +50%. The cap is my call so React-only doesn't run away with the game; the sim decides if it stays.

Counter damage (×2) applies to every hit above: pierce, chain, splash and pulse.

## 5. Approaches considered

- **A. Each developer file declares its own upgrade path** — *picked by the user.* Keeps a type's whole path in one file, which is what you need when balancing it. Needs a small hook surface in the engine.
- **B. One file per upgrade, registered separately.** Closest to "one file plus one line", but spreads one path across many files and makes balancing harder.
- **C. Hardcode in `engine/devs.js`.** Fastest, but every tweak means touching the engine, which goes against the contributor guide.

## 6. How it works

### XP and buying

- Kills still grant XP (Thomas still doubles it). Crossing 10 or 30 XP no longer levels the developer up. It makes the next upgrade **available**.
- XP keeps accumulating, so a developer at 35 XP that is still level 1 can buy level 2 and then level 3 straight away.
- Buying needs XP ≥ threshold and Warrants ≥ cost. Buying is allowed in any phase where hiring is allowed (building, wave, bell).
- The cost is added to `dev.spent`, so selling refunds 50% of hire plus upgrades (the current sell rule).
- Level 3 is a one-time choice between A and B.
- **The automatic per-level bonuses go away** (`LEVEL_DAMAGE`, `LEVEL_FIRE_RATE` in `devs.js`). The numbers in §4 are absolute stats. Level 3 keeps level 2's stats unless it overrides them. *(Design call.)*

### Content shape (in each developer file)

The developer definition gains a `levelName` for level 1 and an `upgrades` field: one level-2 upgrade and a pair of level-3 branches. Each upgrade has `id`, `name`, `cost`, `kind` (`steady` / `gamble`, level 3 only), `description`, optional `tooltip`, stat overrides, and optional hooks.

The engine must offer hooks for at least what §4 needs:
- **stat changes on the developer itself** (Spring Boot, .NET Core, Vite, VS Enterprise, the React ecosystem bonus),
- **stat changes on other developers** (Enterprise Architect's aura),
- **replacing what a shot does** (pierce, splash, pulse, chained re-hits), using an engine helper that applies one hit with counter damage, `onHit`, kill, reward and XP, so content doesn't duplicate that logic,
- **a per-tick update that can stop the tower firing** (Garbage Collector's pause, Azure's toggle and Warrants drain),
- **extra panel buttons for the selected developer** (Azure's on/off toggle),
- **an optional confirm prompt before buying** (.NET's "Is it Core?").

The exact signatures are the builder's call. A developer-level hook (e.g. React's ecosystem bonus) applies at every level. Every hook call is wrapped in try/catch like existing content hooks.

### Events

- `dev:levelup` now fires when an upgrade is **bought**, with `{ game, dev, level, upgrade }`.
- New `dev:upgradeready` fires when XP crosses a threshold whose upgrade isn't bought yet.
- `game.stats.seniors` now counts level-3 purchases.

### UI

Selection panel, when a developer is selected:

```
 Java · Spring Boot Dev                XP 34 / 30
 ┌──────────────────────────┐ ┌──────────────────────────┐
 │ Enterprise Architect 120 │ │ Garbage Collector    120 │
 │ Steady · +15% aura       │ │ Gamble · Stop-the-World  │
 └──────────────────────────┘ └──────────────────────────┘
                                             [ Sell +68 ]
```

- Level 1 shows one upgrade button. Level 2 shows the two branches. Level 3 shows "Max level".
- A locked button shows why: "Needs 10 XP" or "Needs 60 Warrants".
- The panel title uses the current upgrade's name, not "Junior / Consultant / Senior".
- On the map, a developer whose next upgrade is unlocked shows a small green "ready" marker, so the player knows to come back. The level badge shows 1, 2 or 3. The XP bar under the selected tower stays.
- The level-up pop and sound play on purchase, with the upgrade's name as text.

### Sim and tests

- `scripts/sim.mjs` (balance bar chosen by the user: "exercise both branches, plus a light by-eye comparison"):
  - The bot buys upgrades when available and affordable.
  - Seeded runs: make `[seed-count]` work by seeding `game.random` (and any other randomness the content uses) so runs are reproducible. Default about 10 seeds.
  - Strategies: the existing ones with upgrades on, plus "branch A only" and "branch B only" for each developer type.
  - Report per strategy: wins out of seeds, average wave reached, average lives left, level-3 purchases per branch.
  - Done when every existing strategy that wins today still wins, and no branch looks clearly dominant when its numbers are compared by eye with its sibling's. No hard threshold.
- Tests: XP gating, cost check, `spent` and refund, branch exclusivity, each §4 behaviour at least once, and a throwing hook not crashing `step`.

## 7. Left to the builder

- Exact hook names and signatures, and where the upgrade data sits in the definition.
- Visuals for pulse, splash, pierce, chains and the aura (reuse `ring`, `beam`, `pop` effects).
- How the "ready" marker and the .NET prompt look, within the Nexios style.
- Tuning costs and numbers in §4 against the sim.
