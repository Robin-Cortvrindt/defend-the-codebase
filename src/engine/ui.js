// DOM interface: HUD, hire bar, power-up bar, selected-developer panel and overlay screens.
import { getDevelopers, getDeveloper, getPowerups, getFeatures, getBugs } from './registry.js';
import { totalWaves, startWave, startGame, ringBell } from './game.js';
import { LEVELS, sellDev } from './devs.js';
import { canUse, usePowerup, powerupState, powerupCost } from './powerups.js';
import { drawDevTile } from './render.js';
import { playSound, unlockAudio, isMuted, setMuted } from './sound.js';

const $ = sel => document.querySelector(sel);

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null) el.append(c);
  return el;
}

// Only touch the DOM when a value actually changes.
function set(el, prop, value) { if (el[prop] !== value) el[prop] = value; }
function toggle(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }

let app;
const refs = { hire: [], powerups: [] };
let lastPhase = null;

export function initUI(appRef) {
  app = appRef;
  buildHud();
  buildHire();
  buildPowerups();
}

function buildHud() {
  const hud = $('#hud');
  hud.append(
    h('img', { src: 'assets/nexios-wordmark-white.webp', alt: 'Nexios', class: 'wordmark' }),
    stat('Warrants', refs.warrants = h('b', {}, '0')),
    stat('Production', refs.prod = h('div', { class: 'prod' })),
    stat('Wave', refs.wave = h('b', {}, '0 / 10')),
    h('div', { class: 'hud-spacer' }),
    refs.speed = h('button', { class: 'btn ghost', title: 'Game speed (F)', onclick: toggleSpeed }, '1×'),
    refs.pause = h('button', { class: 'btn ghost', title: 'Pause (P)', onclick: togglePause }, 'Pause'),
    refs.mute = h('button', { class: 'btn ghost', title: 'Sound (M)', onclick: toggleMute }, 'Sound on'),
    refs.waveBtn = h('button', { class: 'btn primary', onclick: onWaveButton }, 'Start wave 1'),
  );
  for (let i = 0; i < 10; i++) refs.prod.append(h('i'));
}

function stat(label, valueEl) {
  return h('div', { class: 'stat' }, h('small', {}, label), valueEl);
}

function buildHire() {
  const bar = $('#hire');
  bar.innerHTML = '';
  refs.hire = getDevelopers().map((def, i) => {
    const cv = h('canvas', { width: 64, height: 64, class: 'hire-icon' });
    const c = cv.getContext('2d');
    c.scale(2, 2);
    drawDevTile(c, def, 16, 16, 28);
    const cost = h('span', { class: 'cost' }, String(def.cost));
    const btn = h('button', { class: 'hire-btn', style: `--accent:${def.accent}`, title: `Hotkey ${i + 1}`, onclick: () => selectHire(def.id) },
      cv, h('span', { class: 'hire-text' }, h('b', {}, def.name), h('small', {}, def.blurb || '')), cost);
    bar.append(btn);
    return { def, btn };
  });
  refs.selPanel = h('div', { class: 'sel-panel hidden' });
  bar.append(refs.selPanel);
}

function buildPowerups() {
  const bar = $('#powerups');
  bar.innerHTML = '';
  refs.powerups = getPowerups().map(def => {
    const status = h('small', {});
    const cd = h('i', { class: 'cd' });
    const card = h('button', { class: 'pu', onclick: () => activatePowerup(def.id) }, h('b', {}, def.name), status, cd);
    bar.append(card);
    return { def, card, status, cd };
  });
  for (const f of getFeatures()) {
    for (const b of f.hudButtons || []) {
      bar.append(h('button', { class: 'pu feature', onclick: () => { try { b.onClick(app.game); } catch (e) { console.error(e); } } }, h('b', {}, b.label), h('small', {}, b.hint || '')));
    }
  }
}

export function selectHire(id) {
  app.view.hire = app.view.hire === id ? null : id;
  app.view.selected = null;
}

function activatePowerup(id) {
  if (usePowerup(app.game, id)) playSound(id === 'claude' ? 'claude' : 'powerup');
}

function onWaveButton() {
  const g = app.game;
  if (g.phase === 'building') { unlockAudio(); startWave(g); }
  else if (g.phase === 'bell') swingBell();
}

function toggleSpeed() { app.view.speed = app.view.speed === 1 ? 2 : 1; }
export function togglePause() { if (['wave', 'building', 'bell'].includes(app.game.phase)) app.view.paused = !app.view.paused; }
function toggleMute() { setMuted(!isMuted()); }
export const uiActions = { toggleSpeed, togglePause, toggleMute, onWaveButton };

let bellSwinging = false;
function swingBell() {
  if (bellSwinging || app.game.phase !== 'bell') return;
  bellSwinging = true;
  unlockAudio();
  playSound('bell');
  const bell = document.querySelector('.bell-svg');
  bell?.classList.add('swing');
  setTimeout(() => { bellSwinging = false; ringBell(app.game); }, 700);
}

export function updateUI() {
  const g = app.game, v = app.view;
  set(refs.warrants, 'textContent', String(Math.floor(g.warrants)));
  const shownWave = Math.min(g.wave + 1, totalWaves());
  set(refs.wave, 'textContent', `${shownWave} / ${totalWaves()}`);
  const lit = Math.ceil((g.lives / g.maxLives) * 10);
  [...refs.prod.children].forEach((el, i) => { toggle(el, 'off', i >= lit); toggle(el, 'low', g.lives / g.maxLives <= 0.4); });

  const wb = refs.waveBtn;
  if (g.phase === 'building') { set(wb, 'textContent', `Start wave ${g.wave + 1} →`); set(wb, 'disabled', false); }
  else if (g.phase === 'bell') { set(wb, 'textContent', 'Ring the bell →'); set(wb, 'disabled', false); }
  else { set(wb, 'textContent', g.phase === 'wave' ? 'Wave running' : '—'); set(wb, 'disabled', true); }
  set(refs.speed, 'textContent', `${v.speed}×`);
  set(refs.pause, 'textContent', v.paused ? 'Resume' : 'Pause');
  set(refs.mute, 'textContent', isMuted() ? 'Sound off' : 'Sound on');

  for (const { def, btn } of refs.hire) {
    toggle(btn, 'active', v.hire === def.id);
    toggle(btn, 'poor', g.warrants < def.cost);
  }

  for (const { def, card, status, cd } of refs.powerups) {
    const st = powerupState(g, def.id);
    const cost = powerupCost(g, def.id);
    const usable = canUse(g, def.id);
    toggle(card, 'active', st.active);
    toggle(card, 'ready', usable && !st.active);
    toggle(card, 'disabled', !usable && !st.active);
    let text, pct = 0;
    if (st.active) { text = `${def.description} · ${Math.ceil(st.remaining)} s left`; pct = st.remaining / def.duration; }
    else if (st.cooldownLeft > 0) { text = `${def.description} · ${Math.ceil(st.cooldownLeft)} s`; pct = 1 - st.cooldownLeft / def.cooldown; }
    else text = cost ? `${def.description} · ${cost}` : `${def.description} · ${g.phase === 'wave' ? 'ready' : 'during waves'}`;
    set(status, 'textContent', text);
    cd.style.width = `${Math.round(pct * 100)}%`;
  }

  updateSelPanel();
  if (g.phase !== lastPhase) { lastPhase = g.phase; showOverlay(g.phase); }
  toggle($('#stage'), 'paused', v.paused);
}

function updateSelPanel() {
  const dev = app.view.selected;
  const p = refs.selPanel;
  if (!dev || !app.game.devs.includes(dev)) { toggle(p, 'hidden', true); p.dataset.key = ''; return; }
  const def = getDeveloper(dev.type);
  const lvl = LEVELS[dev.level], next = LEVELS[dev.level + 1];
  const key = `${dev.id}:${dev.level}:${Math.floor(dev.xp)}:${dev.kills}`;
  toggle(p, 'hidden', false);
  if (p.dataset.key === key) return;
  p.dataset.key = key;
  p.style.setProperty('--accent', def.accent);
  p.innerHTML = '';
  p.append(
    h('div', {}, h('b', {}, `${def.name} · ${lvl.name}`),
      h('small', {}, next ? `XP ${Math.floor(dev.xp)} / ${next.xp} · ${dev.kills} squashed` : `Max level · ${dev.kills} squashed`)),
    h('button', { class: 'btn ghost', onclick: () => { sellDev(app.game, dev); app.view.selected = null; } }, `Sell +${Math.floor(dev.spent * 0.5)}`),
  );
}

// ---------- overlays ----------

const BELL_SVG = `
<svg class="bell-svg" viewBox="-100 -100 200 200" width="220" height="220" aria-label="Nexios victory bell">
  <circle r="74" fill="none" stroke="#123650"/><circle r="92" fill="none" stroke="#0A2A40"/>
  <g class="bell-body">
    <rect x="-5" y="-54" width="10" height="12" rx="3" fill="#E2E8F0"/>
    <path d="M-36 28 Q-38 -36 0 -42 Q38 -36 36 28 L46 38 H-46 Z" fill="#fff"/>
    <path d="M-46 38 H46" stroke="#16A34A" stroke-width="3"/>
    <circle class="clapper" cy="47" r="7" fill="#E2E8F0"/>
    <text y="6" text-anchor="middle" font-size="11" font-weight="900" letter-spacing="1.5" fill="#001E32" font-family="Lato, sans-serif">NEXIOS</text>
  </g>
  <path class="waves" d="M-60 -20 q-8 10 0 20 M-70 -26 q-12 16 0 32 M60 -20 q8 10 0 20 M70 -26 q12 16 0 32" stroke="#94A3B8" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>`;

function showOverlay(phase) {
  const ov = $('#overlay');
  ov.className = '';
  ov.innerHTML = '';
  const g = app.game;
  if (phase === 'menu') {
    ov.className = 'screen';
    const legend = h('div', { class: 'legend' }, getDevelopers().map(d => {
      const bug = getBugs().find(b => b.id === d.counters);
      return h('span', {}, h('i', { style: `background:${d.accent}` }), h('b', {}, d.name), ` counters ${bug ? bug.name.toLowerCase() + 's' : d.counters}`);
    }));
    ov.append(h('div', { class: 'screen-card' },
      h('img', { src: 'assets/nexios-wordmark-white.webp', alt: 'Nexios', class: 'wordmark' }),
      h('i', { class: 'dash', style: 'background:#2563EB' }),
      h('div', { class: 'eyebrow' }, 'Intent Engineering Bootcamp · Day 5'),
      h('h1', {}, 'Defend the Codebase'),
      h('p', { class: 'lede' }, 'Bugs are crawling toward production. Hire developers next to the path, earn Warrants for every bug they squash, and ring the Nexios bell after each wave.'),
      legend,
      h('button', { class: 'btn primary big', onclick: () => { unlockAudio(); startGame(g); } }, 'Start →'),
    ));
  } else if (phase === 'bell') {
    ov.className = 'bell-overlay';
    const bellWrap = h('div', { class: 'bell-wrap', html: BELL_SVG, onclick: swingBell, title: 'Ring the bell' });
    ov.append(h('div', { class: 'bell-card' },
      bellWrap,
      h('div', { class: 'eyebrow' }, `Wave ${g.wave} squashed · +${20 + 5 * g.wave} bonus`),
      h('h2', {}, `Ring the bell to start wave ${g.wave + 1}`),
      h('small', {}, 'You can still hire and sell developers'),
    ));
  } else if (phase === 'won') {
    ov.className = 'screen won';
    ov.append(endCard('#16A34A', `${totalWaves()} of ${totalWaves()} waves`, 'Codebase defended', [
      [g.stats.squashed, 'Bugs squashed'], [g.stats.seniors, 'Seniors'], [Math.floor(g.stats.warrantsEarned), 'Warrants earned'],
    ], h('button', { class: 'btn primary big', onclick: () => app.restart() }, 'Play again →')));
  } else if (phase === 'lost') {
    ov.className = 'screen lost';
    ov.append(endCard('#EA580C', `Fell on wave ${g.wave + 1}`, 'Production is down', [
      [g.stats.squashed, 'Bugs squashed'], [g.stats.backfires, 'Claude backfires'],
    ], h('pre', { class: 'trace' }, '500 · NullPointerException\n  at prod.main(Legacy.java:1)\non-call: you'),
    h('button', { class: 'btn light big', onclick: () => app.restart() }, 'Hotfix and retry →')));
  }
}

function endCard(accent, eyebrow, title, stats, ...extra) {
  return h('div', { class: 'screen-card' },
    h('img', { src: 'assets/nexios-wordmark-white.webp', alt: 'Nexios', class: 'wordmark' }),
    h('i', { class: 'dash', style: `background:${accent}` }),
    h('div', { class: 'eyebrow' }, eyebrow),
    h('h1', {}, title),
    h('div', { class: 'stats' }, stats.map(([n, l]) => h('div', {}, h('b', {}, String(n)), h('small', {}, l)))),
    ...extra,
  );
}

export function resetUI() { lastPhase = null; buildPowerups(); }
