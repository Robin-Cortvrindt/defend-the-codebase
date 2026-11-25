# Background music — design (small change)

## Intent
Add old-school 8-bit background music to the game: one original looping track ("Sprint Anthem")
that is always on. The user asked for Eye of the Tiger; that is copyrighted, so the track is an
original with a similar rock-anthem / training-montage feel. The user heard and approved the
prototype (A minor, 116 BPM, square lead, triangle bass, square chord stabs on 0/3/6, noise snare,
triangle kick, 8 bars of 8 eighth-notes).

## Goals
- Background loop, always on, quieter than the sound effects.
- Tempo reacts to random events, lasting until the wave ends (which is when events already end):
  - Heat wave → faster, by the same factor the bugs speed up (116 → ~174 BPM; less with the counter-upgrade).
  - Heating is out → half tempo (~58 BPM).
  - Event ends → glides back to 116 BPM over about a second.
- `M` / the Sound button mutes music together with sound effects.

## Non-goals
- No music changes for game speed (F, 1×–10×): music tempo stays steady.
- No separate tracks per phase, no game-over jingle beyond the existing sound, no music volume setting.
- Music keeps playing while paused.

## Approaches
1. **Tempo from the factor each event applied (chosen).** tempo = 116 × `game.heatWaveFactor` × `game.heatingOutFactor`
   (both events store the factor they applied, counter-upgrades included, and reset it to 1 when they end).
   Originally planned as `mods.bugSpeedMultiplier × mods.timeScale`, but heating out now halves the developers'
   fire rate instead of `timeScale`, and reading `fireRateMultiplier` would also react to power-ups.
2. Per-event `musicTempo` field: explicit, but ignores air conditioning and needs every event to opt in.
3. Audio file (MP3/OGG): needs sourcing and licensing; the project has no assets of that kind and no build step.

## Design
- New `src/engine/music.js`, WebAudio, no files or dependencies, same style as `sound.js`.
  Look-ahead scheduler (setInterval ~25 ms, schedules ~0.12 s ahead) so it doesn't stutter.
- Pure helpers exported for tests: `musicTempo(game)` and the pattern data (`LEAD`, `CHORDS`, `ROOTS`).
- Started from `main.js` once audio is unlocked; tempo target refreshed from the current game each tick
  and eased toward it. Mute reuses `isMuted()` from `sound.js` (silences via a master gain).
- If WebAudio is unavailable the game stays silent, as today.

## Tests
- `musicTempo`: 116 normally, ×1.5 on a heat wave, ×0.5 with the heating out, back to 116 after the event ends,
  softened when a counter-upgrade weakens the event.
- Pattern data: every bar has 8 steps, notes parse to valid pitches, `_` never starts a bar.
- Sound checked by ear in the browser.
