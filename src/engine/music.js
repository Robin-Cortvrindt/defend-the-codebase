// Background music: an original 8-bit loop ("Sprint Anthem"), synthesised with WebAudio, no files.
// Its tempo follows the random events: a heat wave speeds it up as much as the bugs, the heating
// being out slows it down as much as the developers, until the event ends with the wave. Counter-upgrades
// that weaken an event soften the change too. Game speed (F) does not change it.
import { getAudioContext, isMuted } from './sound.js';

export const BASE_BPM = 116;
const VOLUME = 0.35;          // master level, under the sound effects
const LOOKAHEAD = 0.12;       // seconds of notes scheduled ahead
const GLIDE = 1;              // seconds to ease into a new tempo

// 8 bars of 8 eighth-notes, A minor. '_' holds the previous note, null is a rest.
export const LEAD = [
  ['E5', '_', 'A5', '_', 'G5', 'E5', 'D5', 'E5'],
  ['C5', '_', '_', 'D5', 'E5', '_', 'C5', '_'],
  ['D5', '_', 'G5', '_', 'F5', 'D5', 'B4', 'D5'],
  ['E5', '_', '_', '_', 'G#4', '_', 'B4', '_'],
  ['A5', '_', 'G5', 'A5', 'C6', '_', 'B5', 'A5'],
  ['A5', '_', 'F5', '_', 'C5', '_', 'F5', '_'],
  ['G5', '_', 'B5', '_', 'D6', '_', 'B5', 'G5'],
  ['E5', '_', 'D5', '_', 'B4', '_', 'G#4', 'B4'],
];
export const CHORDS = [['A3', 'C4', 'E4'], ['F3', 'A3', 'C4'], ['G3', 'B3', 'D4'], ['E3', 'G#3', 'B3']]; // Am F G E
export const ROOTS = ['A2', 'F2', 'G2', 'E2'];
const STAB_STEPS = [0, 3, 6];
const KICK_STEPS = [0, 4];
const SNARE_STEPS = [2, 6];

const SEMITONES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
export function noteHz(name) {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return NaN;
  return 440 * 2 ** ((SEMITONES[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
}

// The events remember the factor they applied (heatWaveFactor, heatingOutFactor) and reset it to 1 when they end.
export function musicTempo(game) {
  return BASE_BPM * (game?.heatWaveFactor ?? 1) * (game?.heatingOutFactor ?? 1);
}

// ----- playback -----
let ctx = null, master = null, noise = null;
let step = 0, nextTime = 0, bpm = BASE_BPM, lastTick = 0, timer = null;

function setup(audio) {
  ctx = audio;
  master = ctx.createGain();
  master.gain.value = isMuted() ? 0 : VOLUME;
  master.connect(ctx.destination);
  noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  nextTime = ctx.currentTime + 0.05;
  step = 0;
}

function voice(type, freq, t, dur, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.setValueAtTime(vol, t + dur * 0.8);
  gain.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function kick(t) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  gain.gain.setValueAtTime(0.6, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + 0.16);
}

function snare(t) {
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = noise;
  filter.type = 'highpass';
  filter.frequency.value = 1200;
  gain.gain.setValueAtTime(0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
  src.stop(t + 0.16);
}

function holdSteps(bar, i) {
  let n = 1;
  while (i + n < 8 && LEAD[bar][i + n] === '_') n++;
  return n;
}

function playStep(t, eighth) {
  const bar = Math.floor(step / 8) % LEAD.length;
  const i = step % 8;
  const chord = bar % CHORDS.length;
  const note = LEAD[bar][i];
  if (note && note !== '_') voice('square', noteHz(note), t, eighth * holdSteps(bar, i) * 0.95, 0.09);
  voice('triangle', noteHz(ROOTS[chord]) * (i % 4 === 2 ? 2 : 1), t, eighth * 0.85, 0.35);
  if (STAB_STEPS.includes(i)) for (const c of CHORDS[chord]) voice('square', noteHz(c), t, eighth * 0.4, 0.035);
  if (KICK_STEPS.includes(i)) kick(t);
  if (SNARE_STEPS.includes(i)) snare(t);
}

function tick(getGame) {
  const audio = getAudioContext();
  if (!audio || audio.state !== 'running') return;   // not unlocked yet
  if (audio !== ctx) setup(audio);

  const now = performance.now() / 1000;
  const dt = lastTick ? Math.min(now - lastTick, 0.25) : 0;
  lastTick = now;
  const target = musicTempo(getGame());
  bpm += (target - bpm) * Math.min(1, dt / GLIDE * 3);   // ease toward the target over ~GLIDE seconds

  master.gain.setTargetAtTime(isMuted() ? 0 : VOLUME, ctx.currentTime, 0.02);
  // After the tab was hidden, timers stall: skip ahead instead of firing a burst of old notes.
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.02;
  while (nextTime < ctx.currentTime + LOOKAHEAD) {
    const eighth = 60 / bpm / 2;
    playStep(nextTime, eighth);
    nextTime += eighth;
    step++;
  }
}

// Starts the loop once; it stays silent until audio is unlocked by the first click.
export function startMusic(getGame) {
  if (timer) return;
  timer = setInterval(() => {
    try { tick(getGame); } catch { /* music is optional */ }
  }, 25);
}
