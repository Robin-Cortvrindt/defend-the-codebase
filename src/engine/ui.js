// DOM interface: HUD, hire bar, power-up bar, selected-developer panel and overlay screens.
import { getDevelopers, getDeveloper, getDrinks, getDrink, getPowerups, getFeatures, getEvent, getUpgrades } from './registry.js';
import { loadProgress, capitalFor } from './investments.js';
import { startWave, startGame, ringBell, sprintInfo, chooseYearReview, quitRun, CAO_WARRANTS, SPRINTS_PER_QUARTER, deathAnimDone, sprintBonusEach, isLocked, lockedView } from './game.js';
import { upgradeLevel, upgradeCost, canBuy, buyUpgrade } from './upgrades.js';
import { sellDev, hireCost, nextUpgrades, upgradeStatus, buyUpgrade as buyDevUpgrade, levelName, XP_GATES } from './devs.js';
import { canUse, usePowerup, powerupState, effectiveCooldown } from './powerups.js';
import { drinkFor, drinkName, canAfford } from './drinks.js';
import { quarterHoldLeft } from './drops.js';
import { WIDTH } from './map.js';
import { popoverPosition } from './popover.js';
import { roadmapModel } from './roadmap.js';
import { hireCardInfo } from './hire-card.js';
import { drawDevTile } from './render.js';
import { playSound, unlockAudio, isMuted, setMuted } from './sound.js';
import { $, h, set, toggle, setScreen, recordBest } from './dom.js';
import { drawDrinkIcon } from './drink-icons.js';
import { updateEffectsCard } from './effects-card.js';
import { initMenu, showMenu, showShop, updateMenu } from './menu.js';
import { getBellActions, bellActionView } from './bell.js';

let app;
const refs = { hire: [], powerups: [], bellActions: [] };
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
    stat('Drinks', refs.drinks = h('span', { class: 'drinks' }), refs.raise = h('em', { class: 'raise' }, '')),
    stat('Production', refs.prod = h('div', { class: 'prod' })),
    stat('Warrants', refs.warrants = h('b', {}, '0')),
    h('div', { class: 'hud-divider run-only' }),
    buildRoadmap(),
    refs.incident = h('span', { class: 'incident-chip run-only hidden', html: ICONS.incident }, refs.incidentName = h('span', {})),
    h('div', { class: 'hud-spacer' }),
    refs.speed = h('button', { class: 'btn ghost run-only', title: 'Game speed: click or F to speed up, right-click or Shift+F to slow down', onclick: () => toggleSpeed(), oncontextmenu: e => { e.preventDefault(); toggleSpeed(true); } }, '1×'),
    refs.pause = h('button', { class: 'btn ghost icon run-only', title: 'Pause (P)', 'aria-label': 'Pause', onclick: togglePause }),
    refs.mute = h('button', { class: 'btn ghost icon', title: 'Sound (M)', 'aria-label': 'Sound', onclick: toggleMute }),
    h('button', { class: 'btn ghost icon run-only', title: 'Quit this run', 'aria-label': 'Quit', onclick: openQuit, html: ICONS.quit }),
    refs.waveBtn = h('button', { class: 'btn primary run-only', onclick: onWaveButton }, 'Start wave 1'),
  );
  for (let i = 0; i < 10; i++) refs.prod.append(h('i'));
}

// Inline icons for the compact HUD buttons and the incident chip (no emoji in the shipped UI).
const svg = body => `<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">${body}</svg>`;
const ICONS = {
  pause: svg('<rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/>'),
  resume: svg('<path d="M4.5 2.5v11l9-5.5z" fill="currentColor"/>'),
  soundOn: svg('<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.5a6 6 0 0 1 0 9" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
  soundOff: svg('<path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor"/><path d="M11 6l4 4M15 6l-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'),
  quit: svg('<path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'),
  incident: svg('<path d="M8 1.8l6.5 12H1.5z" fill="currentColor"/><path d="M8 6v4" stroke="#001E32" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="12" r=".9" fill="#001E32"/>'),
  trophy: svg('<path d="M4.5 2h7v3.5a3.5 3.5 0 0 1-7 0z" fill="currentColor"/><path d="M4.5 3H2.5v1.2A2.3 2.3 0 0 0 4.8 6.5M11.5 3h2v1.2a2.3 2.3 0 0 1-2.3 2.3" fill="none" stroke="currentColor" stroke-width="1.1"/><rect x="7.2" y="8.5" width="1.6" height="3" fill="currentColor"/><rect x="5" y="11.5" width="6" height="2" rx=".6" fill="currentColor"/>'),
  star: svg('<path d="M8 1.5l1.9 4.1 4.5.5-3.4 3 1 4.4L8 11.2 4 13.5l1-4.4-3.4-3 4.5-.5z" fill="currentColor"/>'),
};
// Swap an element's icon only when it changes (innerHTML never reads back exactly as written).
function setIcon(el, key) { if (el.dataset.icon !== key) { el.dataset.icon = key; el.innerHTML = ICONS[key]; } }

// The year roadmap: 4 quarters x 7 sprints, built once and updated with classes.
function buildRoadmap() {
  refs.road = { quarters: [] };
  const grid = h('div', { class: 'rm-quarters' });
  for (let q = 0; q < 4; q++) {
    const cells = Array.from({ length: SPRINTS_PER_QUARTER }, () => h('span', { class: 'rm-sprint' }));
    const mark = h('i', { class: 'rm-mark', html: q === 3 ? ICONS.trophy : ICONS.star });
    const el = h('div', { class: 'rm-q' }, ...cells, h('label', {}, `Q${q + 1}`), mark);
    refs.road.quarters.push({ el, cells });
    grid.append(el);
  }
  return h('div', { class: 'roadmap run-only' },
    h('div', { class: 'rm-top' }, refs.road.left = h('span', {}), refs.road.right = h('span', {})),
    grid);
}

function updateRoadmap(g) {
  const m = roadmapModel(g);
  set(refs.road.left, 'innerHTML', `<b>Year ${m.year}</b> · Q${m.quarter} · Sprint ${m.sprint}`);
  set(refs.road.right, 'textContent', m.right);
  m.quarters.forEach((q, i) => {
    const r = refs.road.quarters[i];
    toggle(r.el, 'past', q.state === 'past');
    toggle(r.el, 'current', q.state === 'current');
    q.sprints.forEach((s, k) => {
      const cell = r.cells[k];
      toggle(cell, 'done', s === 'done');
      toggle(cell, 'now', s === 'now');
      const fill = s === 'now' ? `${Math.round(m.nowFill * 100)}%` : '';
      if (cell.style.getPropertyValue('--fill') !== fill) cell.style.setProperty('--fill', fill);
    });
  });
}

function stat(label, valueEl, extra) {
  return h('div', { class: 'stat' }, h('small', {}, label, extra), valueEl);
}

// A drink's icon as a small crisp canvas (or its text icon for a drink that doesn't draw one).
function drinkIconEl(id, px) {
  const def = getDrink(id);
  if (!def?.drawIcon) return h('span', { class: 'drink-ico' }, def?.icon ?? '');
  const cv = h('canvas', { width: px * 2, height: px * 2, class: 'drink-ico', style: `width:${px}px;height:${px}px` });
  const c = cv.getContext('2d');
  c.scale(2, 2);
  c.translate(px / 2, px / 2);
  drawDrinkIcon(c, def, px - 1);
  return cv;
}

// Hover card: which bug this developer counters, plus its hotkey.
function hireCard(def, i) {
  const { strong, hotkey } = hireCardInfo(def, i);
  return h('span', { class: 'hire-card' },
    strong ? h('span', { class: 'hc-strong' }, 'Strong vs ', h('i', { class: 'hc-dot', style: `background:${strong.ring}` }), h('b', {}, strong.name), ' · 2× damage') : null,
    h('small', {}, hotkey));
}

function buildHire() {
  const bar = $('#hire');
  bar.innerHTML = '';
  refs.hire = getDevelopers().map((def, i) => {
    const cv = h('canvas', { width: 64, height: 64, class: 'hire-icon' });
    const c = cv.getContext('2d');
    c.scale(2, 2);
    drawDevTile(c, def, 16, 16, 28);
    const price = h('span', {}, String(def.cost));
    const cost = h('span', { class: 'cost' }, drinkIconEl(drinkFor(def.id), 16), price);
    const btn = h('button', { class: 'hire-btn', style: `--accent:${def.accent}`, onclick: () => selectHire(def.id) },
      cv, h('span', { class: 'hire-text' }, h('b', {}, def.name), h('small', {}, def.blurb || '')), cost, hireCard(def, i));
    bar.append(btn);
    return { def, btn, price };
  });
  // The selected-developer panel lives on the map, before #overlay so overlay screens stay on top.
  if (!refs.selPanel) {
    refs.selPanel = h('div', { class: 'sel-panel popover hidden' });
    refs.selArrow = h('i', { class: 'popover-arrow' });
    refs.selPanel.dataset.key = '';
  }
  const stage = $('#stage');
  if (refs.selPanel.parentNode !== stage) stage.insertBefore(refs.selPanel, $('#overlay'));
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
  if (isLocked(app.game)) return;   // nothing changes while the bell waits
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
  // The bell locks the game: drop any selection or hire in progress (the view object is shared, so mutate it).
  if (isLocked(g) && (v.selected || v.hire)) Object.assign(v, lockedView(v));
  toggle($('#app'), 'bell-locked', isLocked(g));
  updateDrinks(g);
  refreshBellActions();
  const si = sprintInfo(g.sprint);
  updateRoadmap(g);
  set(refs.warrants, 'textContent', String(g.warrants));
  set(refs.raise, 'textContent', g.raise > 1.0001 ? ` +${Math.round((g.raise - 1) * 100)}%` : '');
  const ev = g.activeEvent && getEvent(g.activeEvent);
  set(refs.incidentName, 'textContent', ev ? ev.name : '');
  toggle(refs.incident, 'hidden', !ev);
  const lit = Math.ceil((g.lives / g.maxLives) * 10);
  [...refs.prod.children].forEach((el, i) => { toggle(el, 'off', i >= lit); toggle(el, 'low', g.lives / g.maxLives <= 0.4); });

  const wb = refs.waveBtn;
  if (g.phase === 'building') { set(wb, 'textContent', `Start sprint ${si.sprint} →`); set(wb, 'disabled', false); }
  else if (g.phase === 'bell') { set(wb, 'textContent', 'Ring the bell →'); set(wb, 'disabled', false); }
  else if (g.phase === 'review') { set(wb, 'textContent', g.pendingYearReview ? 'Yearly review first' : `Start Q${si.quarter} →`); set(wb, 'disabled', g.pendingYearReview); }
  else {
    const hold = quarterHoldLeft(g);
    set(wb, 'textContent', hold ? `Grab the drops · review in ${Math.ceil(hold)} s` : g.phase === 'wave' ? 'Sprint running' : '—');
    set(wb, 'disabled', true);
  }
  set(refs.speed, 'textContent', `${v.speed}×`);
  setIcon(refs.pause, v.paused ? 'resume' : 'pause');
  set(refs.pause, 'title', v.paused ? 'Resume (P)' : 'Pause (P)');
  setIcon(refs.mute, isMuted() ? 'soundOff' : 'soundOn');
  set(refs.mute, 'title', isMuted() ? 'Sound off (M)' : 'Sound on (M)');

  for (const { def, btn, price: priceEl } of refs.hire) {
    const price = hireCost(g, def.id);
    toggle(btn, 'active', v.hire === def.id);
    toggle(btn, 'poor', !canAfford(g, drinkFor(def.id), price));
    set(priceEl, 'textContent', String(price));
  }

  for (const { def, card, status, cd } of refs.powerups) {
    const st = powerupState(g, def.id);
    const usable = canUse(g, def.id);
    toggle(card, 'active', st.active);
    toggle(card, 'ready', usable && !st.active);
    toggle(card, 'disabled', !usable && !st.active);
    let text, pct = 0;
    let desc = def.description;
    try { if (def.describe) desc = def.describe(g); } catch (e) { console.error(`[powerup ${def.id}]`, e); }
    if (st.active) { text = `${desc} · ${Math.ceil(st.remaining)} s left`; pct = st.remaining / def.duration; }
    else if (st.cooldownLeft > 0 && usable && def.id === 'claude') text = `${desc} · free Claude ready`;
    else if (st.cooldownLeft > 0) { text = `${desc} · ${Math.ceil(st.cooldownLeft)} s`; pct = 1 - st.cooldownLeft / (effectiveCooldown(g, def.id) || 1); }
    else text = `${desc} · ${g.phase === 'wave' ? 'ready' : 'during waves'}`;
    set(status, 'textContent', text);
    cd.style.width = `${Math.round(pct * 100)}%`;
  }

  updateSelPanel();
  updateEffectsCard(app, reviewMinimized, isQuitOpen());
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

function updateDrinks(g) {
  const list = getDrinks();
  if (refs.drinks.children.length !== list.length) {
    refs.drinks.replaceChildren(...list.map(d => h('span', { class: 'drink', title: d.name, style: `color:${d.color}` }, h('i', {}, drinkIconEl(d.id, 16)), h('b', { 'data-drink': d.id }, '0'))));
  }
  for (const b of refs.drinks.querySelectorAll('b[data-drink]')) set(b, 'textContent', String(Math.floor(g.drinks[b.dataset.drink] ?? 0)));
}

function upgradeBtn({ up, status }, dev, gate) {
  const kind = up.kind === 'steady' ? 'Steady · ' : up.kind === 'gamble' ? 'Gamble · ' : '';
  const line = status.ok ? up.description : status.reason === 'xp' ? `Needs ${gate} XP` : `Needs ${up.cost} ${drinkName(drinkFor(dev.type))}`;
  const btn = h('button', { class: 'upgrade-btn', onclick: () => buyDevUpgrade(app.game, dev, up.id) },
    h('span', { class: 'upgrade-top' }, h('b', {}, up.name), h('span', { class: 'cost' }, drinkIconEl(drinkFor(dev.type), 14), String(up.cost))),
    h('small', {}, kind + line));
  btn.disabled = !status.ok;
  if (up.tooltip) btn.title = up.tooltip;
  return btn;
}

function updateSelPanel() {
  const dev = app.view.selected;
  const p = refs.selPanel;
  if (!dev || !app.game.devs.includes(dev)) { toggle(p, 'hidden', true); p.dataset.key = ''; return; }
  const def = getDeveloper(dev.type);
  const gate = XP_GATES[dev.level + 1];
  const ups = nextUpgrades(dev).map(up => ({ up, status: upgradeStatus(app.game, dev, up) }));
  let extra = [];
  try { extra = dev.upgrade?.panelButtons?.(app.game, dev) ?? []; } catch (e) { console.error(`panelButtons failed for ${dev.type}`, e); }
  const key = [dev.id, dev.level,
    ups.map(u => `${u.up.id}=${u.status.reason}`).join(','), extra.map(b => b.label).join('|')].join(':');
  toggle(p, 'hidden', false);
  const xpLine = gate != null ? `XP ${Math.floor(dev.xp)} / ${gate} · ${dev.kills} squashed` : `Max level · ${dev.kills} squashed`;
  if (p.dataset.key === key && refs.selXp) { set(refs.selXp, 'textContent', xpLine); positionPopover(dev); return; }
  p.dataset.key = key;
  refs.popSize = null;
  p.style.setProperty('--accent', def.accent);
  p.innerHTML = '';
  refs.selXp = h('small', {}, xpLine);
  // The arrow sits outside the box, so scrolling happens in an inner body, not on the popover.
  p.append(
    h('div', { class: 'popover-body' },
      h('div', {}, h('b', {}, `${def.name} · ${levelName(dev)}`), refs.selXp),
      // Element.append does not flatten arrays (h() does), so spread them.
      ...(ups.length === 2 ? [
        h('div', { class: 'choice-head' }, h('b', {}, 'Choose one'), h('small', {}, "You can't change this later.")),
        h('div', { class: 'choice' }, upgradeBtn(ups[0], dev, gate), h('span', { class: 'choice-or' }, 'or'), upgradeBtn(ups[1], dev, gate)),
      ] : ups.map(u => upgradeBtn(u, dev, gate))),
      ...extra.map(b => h('button', { class: 'btn ghost', onclick: () => {
        try { b.onClick(app.game, dev); } catch (e) { console.error(`panel button failed for ${dev.type}`, e); }
      } }, b.label)),
      h('button', { class: 'btn ghost', onclick: () => { sellDev(app.game, dev); app.view.selected = null; } }, `Sell +${Math.floor(dev.spent * 0.5)} ${drinkName(drinkFor(dev.type))}`),
    ),
    refs.selArrow,
  );
  positionPopover(dev);
}

// Place the popover next to its tower. The natural size is measured without touching the caps
// (clearing them would un-overflow .popover-body and reset its scroll), cached, and re-measured
// only after a rebuild or a stage resize; styles are rewritten only when an input changes.
function positionPopover(dev) {
  const p = refs.selPanel;
  const stage = $('#stage');
  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  const sizeKey = `${stageW}x${stageH}`;
  if (!refs.popSize || refs.popSizeKey !== sizeKey) {
    const body = p.querySelector('.popover-body');
    const extra = body ? body.scrollHeight - body.clientHeight : 0;
    refs.popSize = { w: p.offsetWidth, h: p.offsetHeight + extra };
    refs.popSizeKey = sizeKey;
    refs.popPosKey = '';
  }
  const posKey = `${dev.x},${dev.y},${sizeKey}`;
  if (refs.popPosKey === posKey) return;
  refs.popPosKey = posKey;
  const { left, top, side, arrowY, maxW, maxH } = popoverPosition({
    x: dev.x, y: dev.y, scale: stageW / WIDTH, stageW, stageH,
    popW: refs.popSize.w, popH: refs.popSize.h,
  });
  set(p.style, 'maxWidth', `${maxW}px`);
  set(p.style, 'maxHeight', `${maxH}px`);
  set(p.style, 'left', `${left}px`);
  set(p.style, 'top', `${top}px`);
  toggle(p, 'left', side === 'left');
  set(refs.selArrow.style, 'top', `${arrowY}px`);
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

// Choices that features offer at the bell (see bell.js), e.g. summoning a Trojan horse. null when there are none.
// The buttons are refreshed every frame by refreshBellActions(), so they follow drinks picked up or spent at the bell.
function bellActionsEl(g, rerender) {
  refs.bellActions = [];
  const list = getBellActions(g);
  if (!list.length) return null;
  return h('div', { class: 'bell-actions' }, list.map(({ action }) => {
    const ref = { g, action, label: h('b'), cost: h('span', { class: 'bell-cost' }), hint: h('small'), costKey: null };
    ref.btn = h('button', {
      class: 'btn bell-action',
      onclick: () => {
        let ok = false;
        try { ok = !!action.onClick(g); } catch (e) { console.error(e); }
        if (ok) playSound('powerup');
        rerender();
      },
    }, ref.label, ref.cost, ref.hint);
    refs.bellActions.push(ref);
    refreshBellAction(ref);
    return ref.btn;
  }));
}

function refreshBellAction(ref) {
  const view = bellActionView(ref.g, ref.action);
  set(ref.label, 'textContent', String(view.label));
  set(ref.hint, 'textContent', String(view.hint));
  set(ref.btn, 'disabled', !view.enabled);
  const key = JSON.stringify(view.cost);
  if (key !== ref.costKey) {
    ref.costKey = key;
    ref.cost.replaceChildren(...Object.entries(view.cost ?? {}).map(([id, n]) => h('span', { class: 'cost' }, drinkIconEl(id, 14), String(n))));
  }
}

function refreshBellActions() {
  for (const ref of refs.bellActions ?? []) if (ref.btn.isConnected) refreshBellAction(ref);
}

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
        h('div', { class: 'eyebrow' }, `Sprint ${sprintInfo(g.sprint - 1).sprint} done · +${sprintBonusEach(g.sprint - 1)} of each drink · +1 Warrant`),
        h('h2', {}, `Ring the bell to start sprint ${sprintInfo(g.sprint).sprint}`),
        h('small', {}, 'Click the bell or press Space'),
        bellActionsEl(g, () => showOverlay('bell')),
      ),
    ));
  } else if (phase === 'review') {
    reviewMinimized = false;
    renderReview(ov, g);
  } else if (phase === 'won') {
    ov.className = 'screen won';
    ov.append(endCard('#16A34A', 'All sprints done', 'Codebase defended', [
      [g.stats.squashed, 'Bugs squashed'], [g.stats.seniors, 'Level 3 upgrades'], [g.stats.drinksCollected, 'Drinks collected'],
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
        h('div', { class: 'eyebrow' }, `Quarter review · Q${done.quarter} · ${g.warrants} Warrants`),
        h('h2', {}, g.pendingYearReview ? 'Yearly review still open' : ringLabel),
        h('small', {}, 'Hire, place and sell developers on the map'),
        bellActionsEl(g, rerender),
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
        h('div', {}, h('b', { class: 'warrants' }, String(g.warrants)), h('small', {}, 'Warrants')),
      ),
    ),
  );

  if (!g.pendingYearReview && g.lastYearReview && done.quarter === 4) {
    const msg = {
      accepted: ['Review accepted', 'Drinks +10% from now on', 'accepted'],
      approved: ['Raise approved', 'Drinks +20% from now on', 'approved'],
      denied: ['Raise denied', 'Maybe next year', 'denied'],
    }[g.lastYearReview];
    card.append(h('div', { class: `year-review result ${msg[2]}` },
      h('div', { class: 'eyebrow' }, `Yearly review · Year ${done.year}`),
      h('b', { class: 'result-title' }, msg[0]), h('small', {}, ` — ${msg[1]}`),
      h('div', { class: 'cao' }, h('b', { class: 'warrants' }, `+${CAO_WARRANTS} Warrants`), h('small', {}, ' — CAO paid out, spend it on the building below')),
    ));
  }

  if (g.pendingYearReview) {
    const choose = choice => { chooseYearReview(g, choice); playSound(choice === 'raise' ? 'claude' : 'powerup'); rerender(); };
    card.append(h('div', { class: 'year-review' },
      h('div', { class: 'eyebrow' }, `Yearly review · Year ${done.year} · CAO +${CAO_WARRANTS} Warrants either way`),
      h('div', { class: 'choices' },
        h('button', { class: 'choice', onclick: () => choose('accept') }, h('b', {}, 'Accept the review'), h('small', {}, '+10% Drinks, guaranteed')),
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
      bellActionsEl(g, rerender),
    ),
    h('button', { class: 'btn ghost hire-from-review', onclick: () => setMin(true) }, 'Hire developers →'),
  ));
  ov.append(card);
}
