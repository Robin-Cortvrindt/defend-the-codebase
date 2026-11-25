import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/engine/game.js';
import { getEvent } from '../src/engine/registry.js';
import '../src/content/events/heat-wave.js';
import '../src/content/events/heating-out.js';
import { BASE_BPM, LEAD, CHORDS, ROOTS, noteHz, musicTempo } from '../src/engine/music.js';

test('music plays at 116 BPM normally', () => {
  assert.equal(BASE_BPM, 116);
  assert.equal(musicTempo(createGame()), 116);
});

test('a heat wave speeds the music up until the event ends', () => {
  const g = createGame();
  const ev = getEvent('heat-wave');
  ev.start(g);
  assert.equal(musicTempo(g), 174);
  ev.end(g);
  assert.equal(musicTempo(g), 116);
});

test('heating out halves the tempo until the event ends', () => {
  const g = createGame();
  const ev = getEvent('heating-out');
  ev.start(g);
  assert.equal(musicTempo(g), 58);
  ev.end(g);
  assert.equal(musicTempo(g), 116);
});

test('a counter-upgrade that weakens the event also softens the tempo change', () => {
  assert.equal(musicTempo({ heatWaveFactor: 1.25 }), 145);
  assert.equal(musicTempo({ heatingOutFactor: 0.75 }), 87);
});

test('no game or no event state falls back to the base tempo', () => {
  assert.equal(musicTempo(null), 116);
  assert.equal(musicTempo({}), 116);
});

test('every lead bar has 8 steps and starts with a note or a rest', () => {
  assert.equal(LEAD.length, 8);
  for (const bar of LEAD) {
    assert.equal(bar.length, 8);
    assert.notEqual(bar[0], '_');
  }
});

test('all notes are playable pitches', () => {
  assert.equal(noteHz('A4'), 440);
  const notes = [...LEAD.flat().filter(n => n && n !== '_'), ...CHORDS.flat(), ...ROOTS];
  for (const n of notes) {
    const f = noteHz(n);
    assert.ok(Number.isFinite(f) && f > 50 && f < 2000, `${n} → ${f}`);
  }
});
