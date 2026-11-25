# Random events: design

## Intent

Make waves less predictable. Sometimes a wave starts with an office mishap that handicaps the player for that wave. The events are Nexios in-jokes that fit the game's tone, and teammates should be able to add more during the hackathon the same way they add power-ups.

## Goals

- Five events: PROD is down, heating is out, out of coffee, out of Red Bull, heat wave.
- Teammates add a new event with one file plus one manifest line.
- An event always ends cleanly, whether the wave is cleared, the game is lost, or the game is restarted. No effect leaks into the next wave.

## Non-goals

- Mid-wave events.
- More than one event at a time.
- Events that help the player.

## Approaches

1. **One feature file with all five events.** This is the least code, but every new event means editing the same shared file.
2. **A new content type, `registerEvent`, one file per event (chosen).** It mirrors power-ups. The engine handles rolling, the banner and cleanup in one place that Node can test.

Option 2 won because it keeps the "one new file plus one manifest line" rule for teammates.

## Design

**Trigger (decided):** the event is rolled on wave start and lasts the whole wave.

**Registry:** `registerEvent({ id, name, description, accent?, weight?, minWave?, start(game), end(game), draw?(ctx, game, view) })` in `registry.js`, plus `getEvents()`.

**Engine module:** `src/engine/random-events.js`. It is named this way so it doesn't clash with the event bus in `events.js`.

- On `wave:start`, starting from wave 2, there is a 25% chance (`EVENT_CHANCE`, using `game.random`) to pick one event, weighted by `weight` (default 1).
- It stores the event as `game.activeEvent`, calls `start(game)`, shows a banner with the name and description, and emits `event:start`.
- On `wave:cleared` and `game:lost` it calls `end(game)`, clears `game.activeEvent` and emits `event:end`. A restart builds a fresh game state, so nothing lingers.
- All calls are wrapped in try/catch, so a broken event can't break the game.
- The HUD shows the active event's name while it runs.

**Engine hooks:**

- `game.mods.timeScale` (default 1). `step()` multiplies `dt` by it, so the whole simulation slows down: spawns, bugs, developers and power-up timers.
- `game.mods.devFireRate`, an object keyed by developer type id. Missing keys count as 1. `devStats` multiplies the fire rate by it.
- `input.js` stores the cursor position in pixels as `view.cursor` (`null` when the cursor is off the canvas). `render()` passes `view` to the active event's `draw`, which runs after bugs and before effects, so banners stay visible.

**Events (`src/content/events/*.js`):**

| Event | Effect |
|---|---|
| PROD is down | Dark overlay with a flashlight radius of about 2.5 cells around `view.cursor`. Fully dark when the cursor is off the canvas. |
| Heating is out | `timeScale *= 0.5` |
| Out of coffee | Java fire rate ×0.5 |
| Out of Red Bull | .NET fire rate ×0.5 |
| Heat wave | `bugSpeedMultiplier *= 1.5` |

Every `start` multiplies and every `end` divides, following the existing mods convention.

**Docs and tests:**

- Update CONTRIBUTING with the `registerEvent` row, the two new mods, and the `event:start` and `event:end` bus events.
- Add a Node test for rolling, cleanup on clear, loss and restart, and the two new mods.

## Left to the builder (my calls)

- The exact darkness opacity and how soft the flashlight edge is.
- The banner colours, using the Nexios palette.
- `scripts/sim.mjs` keeps events on, so the balance check includes them.
