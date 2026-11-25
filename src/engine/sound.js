// Tiny synthesised sound effects (WebAudio, no files). Silent if audio is unavailable.
let ctx = null;
let muted = false;
const lastPlayed = {};

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { ctx = null; }
}

export const isMuted = () => muted;
export function setMuted(m) { muted = m; }

function tone({ freq, type = 'sine', start = 0, dur = 0.2, vol = 0.2, to }) {
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

const SOUNDS = {
  bell: () => {
    for (const [f, v, d] of [[523, 0.25, 2.2], [1046, 0.12, 1.6], [1318, 0.08, 1.2], [2093, 0.04, 0.8]]) tone({ freq: f, vol: v, dur: d });
  },
  squash: () => tone({ freq: 320, type: 'triangle', dur: 0.06, vol: 0.05, to: 120 }),
  levelup: () => [523, 659, 784].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.07, dur: 0.18, vol: 0.12 })),
  powerup: () => tone({ freq: 440, type: 'square', dur: 0.25, vol: 0.06, to: 880 }),
  claude: () => { tone({ freq: 300, type: 'sawtooth', dur: 0.4, vol: 0.06, to: 1200 }); tone({ freq: 1600, start: 0.35, dur: 0.5, vol: 0.08 }); },
  backfire: () => tone({ freq: 600, type: 'sawtooth', dur: 0.7, vol: 0.08, to: 70 }),
  leak: () => tone({ freq: 140, type: 'square', dur: 0.15, vol: 0.06, to: 90 }),
  place: () => tone({ freq: 660, type: 'triangle', dur: 0.08, vol: 0.08 }),
  won: () => [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', start: i * 0.12, dur: 0.4, vol: 0.12 })),
  lost: () => [392, 311, 233, 175].forEach((f, i) => tone({ freq: f, type: 'sawtooth', start: i * 0.18, dur: 0.35, vol: 0.07 })),
};

// minGap throttles very frequent sounds (e.g. squash) so they don't pile up.
export function playSound(name, minGap = 0) {
  if (muted || !ctx || !SOUNDS[name]) return;
  const now = performance.now();
  if (minGap && now - (lastPlayed[name] || 0) < minGap) return;
  lastPlayed[name] = now;
  try { SOUNDS[name](); } catch { /* audio is optional */ }
}

export function registerSound(name, fn) { SOUNDS[name] = () => fn(ctx, tone); }
