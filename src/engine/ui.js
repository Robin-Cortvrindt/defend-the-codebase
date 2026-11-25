// DOM interface: HUD, hire bar, power-up bar, selected-developer panel and overlay screens.
import { getDevelopers, getDeveloper, getPowerups, getFeatures, getEvent, getUpgrades } from './registry.js';
import { loadProgress, capitalFor } from './investments.js';
import { startWave, startGame, ringBell, sprintInfo, chooseYearReview, quitRun, CAO_COINS, SPRINTS_PER_QUARTER, deathAnimDone } from './game.js';
import { upgradeLevel, upgradeCost, canBuy, buyUpgrade } from './upgrades.js';
import { LEVELS, sellDev, hireCost } from './devs.js';
import { canUse, usePowerup, powerupState, powerupCost, effectiveCooldown } from './powerups.js';
import { drawDevTile } from './render.js';
import { playSound, unlockAudio, isMuted, setMuted } from './sound.js';
import { $, h, set, toggle, setScreen, recordBest } from './dom.js';
import { initMenu, showMenu, showShop, updateMenu } from './menu.js';

let app;
const refs = { hire: [], powerups: [] };
let lastPhase = null;

export function initUI(appRef) {
  app = appRef;
  initMenu(app);
  buildHud();
  buildHire();
  buildPowerups();
}

function buildHud() {
  const hud = $('#hud');
  hud.append(
    h('img', { src: 'assets/nexios-wordmark-white.webp', alt: 'Nexios', class: 'wordmark' }),
    stat('Warrants', refs.warrants = h('b', {}, '0'), refs.raise = h('em', { class: 'raise' }, '')),
    stat('Production', refs.prod = h('div', { class: 'prod' })),
    stat('Coins', refs.coins = h('b', {}, '0')),
    stat('Sprint', refs.wave = h('b', {}, 'Q1 · 1 / 7')),
    stat('Incident', refs.incident = h('b', { class: 'incident' }, 'None')),
    h('div', { class: 'hud-spacer' }),
    refs.speed = h('button', { class: 'btn ghost run-only', title: 'Game speed: click or F to speed up, right-click or Shift+F to slow down', onclick: () => toggleSpeed(), oncontextmenu: e => { e.preventDefault(); toggleSpeed(true); } }, '1×'),
    refs.pause = h('button', { class: 'btn ghost run-only', title: 'Pause (P)', onclick: togglePause }, 'Pause'),
    h('button', { class: 'btn ghost run-only', title: 'Quit this run', onclick: openQuit }, 'Quit'),
    refs.mute = h('button', { class: 'btn ghost', title: 'Sound (M)', onclick: toggleMute }, 'Sound on'),
    refs.waveBtn = h('button', { class: 'btn primary run-only', onclick: onWaveButton }, 'Start wave 1'),
  );
  for (let i = 0; i < 10; i++) refs.prod.append(h('i'));
}

function stat(label, valueEl, extra) {
  return h('div', { class: 'stat' }, h('small', {}, label, extra), valueEl);
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
    return { def, btn, cost };
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
    for (const b of Array.isArray(f.hudButtons) ? f.hudButtons : []) {
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
  if (g.phase === 'menu') { unlockAudio(); app.lastRun = null; startGame(g); }
  else if (g.phase === 'building') { unlockAudio(); startWave(g); }
  else if (g.phase === 'bell' || (g.phase === 'review' && !g.pendingYearReview)) swingBell();
}

// Game speeds, cycled with the speed button or F (Shift+F or right-click goes back down).
export const SPEEDS = [1, 2, 3, 5, 10];
function toggleSpeed(back = false) {
  const i = SPEEDS.indexOf(app.view.speed);
  const n = SPEEDS.length;
  app.view.speed = SPEEDS[((i < 0 ? 0 : i) + (back ? n - 1 : 1)) % n];
}
export function togglePause() { if (quitBox) return; if (['wave', 'building', 'bell', 'review'].includes(app.game.phase)) app.view.paused = !app.view.paused; }
function toggleMute() { setMuted(!isMuted()); }
export const uiActions = { toggleSpeed, togglePause, toggleMute, onWaveButton };

// ---------- quit confirmation ----------

const QUIT_PHASES = ['building', 'wave', 'bell', 'review'];
let quitBox = null;
let pausedBeforeQuit = false;
export const isQuitOpen = () => !!quitBox;

function openQuit() {
  const g = app.game;
  if (quitBox || !QUIT_PHASES.includes(g.phase)) return;
  pausedBeforeQuit = app.view.paused;
  app.view.paused = true;
  const si = sprintInfo(g.sprint);
  quitBox = h('div', { class: 'quit-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Quit this run?' },
    h('div', { class: 'quit-box' },
      h('div', { class: 'eyebrow' }, `Year ${si.year} · Q${si.quarter} · Sprint ${si.sprint}`),
      h('h2', {}, 'Quit this run?'),
      h('p', { class: 'lede' }, 'Production goes down and you return to the main menu. Investors still pay for how far you got: ',
        h('b', {}, `+${capitalFor(g.sprint)} 💼`), '.'),
      h('div', { class: 'screen-actions' },
        h('button', { class: 'btn ghost big', onclick: closeQuit }, 'Keep playing'),
        h('button', { class: 'btn danger big', onclick: confirmQuit }, 'Quit run'),
      ),
    ));
  $('#stage').append(quitBox);
  quitBox.querySelector('.btn.ghost').focus();
}

export function closeQuit() {
  if (!quitBox) return;
  quitBox.remove();
  quitBox = null;
  app.view.paused = pausedBeforeQuit;
}

function confirmQuit() {
  closeQuit();
  app.view.paused = false;
  quitRun(app.game);
}

let bellSwinging = false;
function swingBell() {
  if (bellSwinging || !['bell', 'review'].includes(app.game.phase) || app.game.pendingYearReview) return;
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
  const si = sprintInfo(g.sprint);
  set(refs.wave, 'textContent', `Y${si.year} · Q${si.quarter} · ${si.sprint} / ${SPRINTS_PER_QUARTER}`);
  set(refs.coins, 'textContent', String(g.coins));
  set(refs.raise, 'textContent', g.raise > 1.0001 ? ` +${Math.round((g.raise - 1) * 100)}%` : '');
  const ev = g.activeEvent && getEvent(g.activeEvent);
  set(refs.incident, 'textContent', ev ? ev.name : 'None');
  toggle(refs.incident, 'on', !!ev);
  const lit = Math.ceil((g.lives / g.maxLives) * 10);
  [...refs.prod.children].forEach((el, i) => { toggle(el, 'off', i >= lit); toggle(el, 'low', g.lives / g.maxLives <= 0.4); });

  const wb = refs.waveBtn;
  if (g.phase === 'building') { set(wb, 'textContent', `Start sprint ${si.sprint} →`); set(wb, 'disabled', false); }
  else if (g.phase === 'bell') { set(wb, 'textContent', 'Ring the bell →'); set(wb, 'disabled', false); }
  else if (g.phase === 'review') { set(wb, 'textContent', g.pendingYearReview ? 'Yearly review first' : `Start Q${si.quarter} →`); set(wb, 'disabled', g.pendingYearReview); }
  else { set(wb, 'textContent', g.phase === 'wave' ? 'Sprint running' : '—'); set(wb, 'disabled', true); }
  set(refs.speed, 'textContent', `${v.speed}×`);
  set(refs.pause, 'textContent', v.paused ? 'Resume' : 'Pause');
  set(refs.mute, 'textContent', isMuted() ? 'Sound off' : 'Sound on');

  for (const { def, btn, cost } of refs.hire) {
    const price = hireCost(g, def.id);
    toggle(btn, 'active', v.hire === def.id);
    toggle(btn, 'poor', g.warrants < price);
    set(cost, 'textContent', String(price));
  }

  for (const { def, card, status, cd } of refs.powerups) {
    const st = powerupState(g, def.id);
    const cost = powerupCost(g, def.id);
    const usable = canUse(g, def.id);
    toggle(card, 'active', st.active);
    toggle(card, 'ready', usable && !st.active);
    toggle(card, 'disabled', !usable && !st.active);
    let text, pct = 0;
    let desc = def.description;
    try { if (def.describe) desc = def.describe(g); } catch (e) { console.error(`[powerup ${def.id}]`, e); }
    if (st.active) { text = `${desc} · ${Math.ceil(st.remaining)} s left`; pct = st.remaining / def.duration; }
    else if (st.cooldownLeft > 0) { text = `${desc} · ${Math.ceil(st.cooldownLeft)} s`; pct = 1 - st.cooldownLeft / (effectiveCooldown(g, def.id) || 1); }
    else text = cost ? `${desc} · ${cost}` : `${desc} · ${g.phase === 'wave' ? 'ready' : 'during waves'}`;
    set(status, 'textContent', text);
    cd.style.width = `${Math.round(pct * 100)}%`;
  }

  updateSelPanel();
  // On game over, let the building burn down first; the end screen follows once the collapse is done.
  // A quit run burns down like a real loss, then goes straight back to the main menu.
  if (g.phase === 'lost' && g.quit && deathAnimDone(g)) {
    recordBest(g.sprint);
    app.toMenu({ sprint: g.sprint, capital: g.capitalEarned ?? 0, quit: true });
    return;
  }
  const waitForCollapse = g.phase === 'lost' && !deathAnimDone(g);
  if (waitForCollapse) setScreen('collapse');
  if (g.phase !== lastPhase && !waitForCollapse) { lastPhase = g.phase; showOverlay(g.phase); }
  toggle($('#stage'), 'paused', v.paused);
  updateMenu();
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
  setScreen(['lost', 'won'].includes(phase) ? phase : 'run');
  ov.className = '';
  ov.innerHTML = '';
  const g = app.game;
  if (phase === 'menu') {
    showMenu();
    return;
  } else if (phase === 'bell') {
    ov.className = 'bell-overlay';
    const bellWrap = h('div', { class: 'bell-wrap', html: BELL_SVG, onclick: swingBell, title: 'Ring the bell' });
    ov.append(h('div', { class: 'bell-card' },
      bellWrap,
      h('div', {},
        h('div', { class: 'eyebrow' }, `Sprint ${sprintInfo(g.sprint - 1).sprint} done · +${20 + 5 * g.sprint} Warrants · +1 coin`),
        h('h2', {}, `Ring the bell to start sprint ${sprintInfo(g.sprint).sprint}`),
        h('small', {}, 'Hiring and selling still work'),
      ),
    ));
  } else if (phase === 'review') {
    reviewMinimized = false;
    renderReview(ov, g);
  } else if (phase === 'won') {
    ov.className = 'screen won';
    ov.append(endCard('#16A34A', 'All sprints done', 'Codebase defended', [
      [g.stats.squashed, 'Bugs squashed'], [g.stats.seniors, 'Seniors'], [Math.floor(g.stats.warrantsEarned), 'Warrants earned'],
    ], h('button', { class: 'btn primary big', onclick: () => app.restart() }, 'Play again →')));
  } else if (phase === 'lost') {
    ov.className = 'screen lost';
    // Kept on the game, so coming back from the shop still shows "New" for a new record.
    g.bestResult ??= recordBest(g.sprint);
    const best = g.bestResult;
    const si = sprintInfo(g.sprint);
    const bi = sprintInfo(best.sprint);
    ov.append(endCard('#EA580C', `Fell in Year ${si.year} · Q${si.quarter} · Sprint ${si.sprint}`, 'Production is down', [
      [g.stats.squashed, 'Bugs squashed'], [g.floors, 'Floors'],
      [best.isNew ? 'New' : `Y${bi.year} Q${bi.quarter} S${bi.sprint}`, 'Best run'],
    ], h('pre', { class: 'trace' }, '500 · NullPointerException\n  at prod.main(Legacy.java:1)\non-call: you'),
    h('p', { class: 'lede investors' }, `New investors put in +${g.capitalEarned ?? 0} 💼 · you now have ${loadProgress().capital} 💼`),
    h('div', { class: 'screen-actions' },
      h('button', { class: 'btn light big', onclick: () => app.restart() }, 'Hotfix and retry →'),
      h('button', { class: 'btn ghost big', onclick: () => showShop(() => showOverlay('lost')) }, 'Investments'),
      h('button', { class: 'btn ghost big', onclick: () => app.toMenu() }, 'Main menu'),
    )));
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

// ---------- quarter review ----------

// The review can shrink to a corner card so the map is free for hiring, placing and selling developers.
let reviewMinimized = false;

function renderReview(ov, g) {
  ov.innerHTML = '';
  const done = sprintInfo(g.sprint - 1);
  const next = sprintInfo(g.sprint);
  const rerender = () => renderReview(ov, g);
  const setMin = m => { reviewMinimized = m; app.view.selected = null; if (!m) app.view.hire = null; rerender(); };
  const ringLabel = `Ring the bell to start Q${next.quarter}${next.quarter === 1 ? ` of year ${next.year}` : ''}`;

  if (reviewMinimized) {
    ov.className = 'review-min-overlay';
    const bell = h('div', { class: 'bell-wrap', html: BELL_SVG, onclick: swingBell, title: 'Ring the bell' });
    ov.append(h('div', { class: `review-min${g.pendingYearReview ? ' locked' : ''}` },
      bell,
      h('div', {},
        h('div', { class: 'eyebrow' }, `Quarter review · Q${done.quarter} · ${g.coins} coins`),
        h('h2', {}, g.pendingYearReview ? 'Yearly review still open' : ringLabel),
        h('small', {}, 'Hire, place and sell developers on the map'),
      ),
      h('button', { class: 'btn ghost', onclick: () => setMin(false) }, 'Back to review'),
    ));
    return;
  }
  ov.className = 'screen review';
  const card = h('div', { class: 'review-card' },
    h('div', {},
      h('div', { class: 'eyebrow' }, `Quarter review · Year ${done.year} · Q${done.quarter}`),
      h('h1', {}, `Q${done.quarter} closed`),
      h('div', { class: 'stats' },
        h('div', {}, h('b', {}, String(g.quarterStats.squashed)), h('small', {}, 'Bugs squashed')),
        h('div', {}, h('b', {}, String(g.quarterStats.leaked)), h('small', {}, 'Production lost')),
        h('div', {}, h('b', { class: 'coins' }, String(g.coins)), h('small', {}, 'Nexios Coins')),
      ),
    ),
  );

  if (!g.pendingYearReview && g.lastYearReview && done.quarter === 4) {
    const msg = {
      accepted: ['Review accepted', 'Warrants +10% from now on', 'accepted'],
      approved: ['Raise approved', 'Warrants +20% from now on', 'approved'],
      denied: ['Raise denied', 'Maybe next year', 'denied'],
    }[g.lastYearReview];
    card.append(h('div', { class: `year-review result ${msg[2]}` },
      h('div', { class: 'eyebrow' }, `Yearly review · Year ${done.year}`),
      h('b', { class: 'result-title' }, msg[0]), h('small', {}, ` — ${msg[1]}`),
      h('div', { class: 'cao' }, h('b', { class: 'coins' }, `+${CAO_COINS} Nexios Coins`), h('small', {}, ' — CAO paid out, spend it on the building below')),
    ));
  }

  if (g.pendingYearReview) {
    const choose = choice => { chooseYearReview(g, choice); playSound(choice === 'raise' ? 'claude' : 'powerup'); rerender(); };
    card.append(h('div', { class: 'year-review' },
      h('div', { class: 'eyebrow' }, `Yearly review · Year ${done.year} · CAO +${CAO_COINS} Nexios Coins either way`),
      h('div', { class: 'choices' },
        h('button', { class: 'choice', onclick: () => choose('accept') }, h('b', {}, 'Accept the review'), h('small', {}, '+10% Warrants, guaranteed')),
        h('button', { class: 'choice gamble', onclick: () => choose('raise') }, h('b', {}, 'Ask for a raise'), h('small', {}, '50% chance of +20%, otherwise nothing')),
      ),
    ));
  }

  const shop = h('div', { class: 'shop' }, h('div', { class: 'eyebrow' }, 'Upgrade the Nexios building'));
  for (const def of getUpgrades()) {
    const level = upgradeLevel(g, def.id);
    const max = def.maxLevel ?? Infinity;
    const maxed = level >= max;
    const cost = upgradeCost(g, def.id);
    const btnProps = { class: 'btn primary', onclick: () => { if (buyUpgrade(g, def.id)) { playSound('levelup'); rerender(); } } };
    if (!canBuy(g, def.id)) btnProps.disabled = '';
    shop.append(h('div', { class: 'shop-row' },
      h('div', {}, h('b', {}, def.name), h('small', {}, `${def.description} · ${Number.isFinite(max) ? `level ${level} / ${max}` : `level ${level}`}`)),
      h('button', btnProps, maxed ? 'Max' : `Buy · ${cost}`),
    ));
  }
  card.append(shop);

  const bellWrap = h('div', { class: 'bell-wrap', html: BELL_SVG, onclick: swingBell, title: 'Ring the bell' });
  card.append(h('div', { class: `review-foot${g.pendingYearReview ? ' locked' : ''}` },
    bellWrap,
    h('div', {},
      h('h2', {}, g.pendingYearReview ? 'Finish the yearly review first' : ringLabel),
      h('small', {}, 'Sprints get harder every quarter'),
    ),
    h('button', { class: 'btn ghost hire-from-review', onclick: () => setMin(true) }, 'Hire developers →'),
  ));
  ov.append(card);
}
