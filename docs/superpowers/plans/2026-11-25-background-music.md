# Background Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An original, always-on 8-bit loop whose tempo follows heat wave / heating-out events.

**Architecture:** `src/engine/music.js` holds the pattern data, a pure `musicTempo(game)` and a WebAudio
look-ahead scheduler that borrows the AudioContext from `sound.js`. `main.js` starts it at boot; it stays
silent until audio is unlocked and while muted.

**Tech Stack:** Vanilla ES modules, WebAudio, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-background-music-design.md`

## Global Constraints
- No audio files, no dependencies. Base tempo 116 BPM. Pattern exactly as prototyped (8 bars × 8 eighths, A minor).
- Tempo = 116 × `game.heatWaveFactor` × `game.heatingOutFactor`; game speed (F) does not affect it.
- Mute (`isMuted()` from `sound.js`) silences music too. No WebAudio → silent, no errors.

## Review Focus
- Game restart (`app.restart()` creates a new game): music must follow the new game, not the old one → scheduler reads the game through a getter.
- Tab hidden then shown: the scheduler must not burst hundreds of queued notes → if `nextTime` is behind `currentTime`, jump it forward.
- Mute toggled while playing: silence within a tick (master gain → 0), and resumes in place when unmuted.
- Node tests import `music.js`: it must not touch `window` at import time.
- Tempo glide: never zero/NaN if factors are missing → `musicTempo` defaults them to 1.

---

### Task 1: Music module with tested tempo and pattern

**Files:**
- Create: `src/engine/music.js`
- Modify: `src/engine/sound.js` (add `export const getAudioContext = () => ctx;`)
- Test: `tests/music.test.js`

**Interfaces:**
- Produces: `BASE_BPM = 116`, `LEAD`, `CHORDS`, `ROOTS`, `noteHz(name: string): number`,
  `musicTempo(game): number`, `startMusic(getGame: () => game): void`.

- [ ] **Step 1: Write failing tests** — `musicTempo` returns 116 for a fresh `createGame()`; 174 after `heat-wave` start and 58 after `heating-out` start (real event content via `getEvent`), 116 again after `end`, 145/87 for weakened factors 1.25/0.75, 116 for `{}` and `null`; every `LEAD` bar has length 8 and never starts with `'_'`; every note in LEAD/CHORDS/ROOTS gives a finite `noteHz` between 50 and 2000; `noteHz('A4') === 440`.
- [ ] **Step 2: Run** `npm test` — expect failures (module missing).
- [ ] **Step 3: Implement `music.js`** — pattern and voices copied from the prototype; scheduler via `setInterval(tick, 25)` scheduling 0.12 s ahead; current BPM eases toward `musicTempo(getGame())` (≈ 1 s glide); master gain at 0 when muted; skip-ahead when behind.
- [ ] **Step 4: Run** `npm test` — all pass.

### Task 2: Wire into the game

**Files:** Modify `src/main.js` (import `startMusic`, call `startMusic(() => app.game)` once at boot).

- [ ] **Step 1:** Add the call.
- [ ] **Step 2:** Run the game in the browser: music after Start, faster on heat wave, slower with heating out, back to normal after the wave, `M` mutes.
- [ ] **Step 3: Commit** spec, plan, music.js, sound.js, main.js, tests.
