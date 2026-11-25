// Hover card listing every effect acting on a developer. The helpers are DOM-free (Node tests import
// them); updateEffectsCard is the only part that touches `document`, and only when called.
import { devEffects, GROUPS } from './effects.js';
import { devAt, devStats, levelName } from './devs.js';
import { getDeveloper } from './registry.js';
import { CELL, WIDTH } from './map.js';
import { popoverPosition } from './popover.js';
import { h, set, toggle } from './dom.js';

const SHOWN_PHASES = ['building', 'wave', 'bell'];

// The developer under the cursor, unless the selected-developer panel already shows it.
export function hoveredDev(game, view, reviewMinimized, quitOpen = false) {
  if (!view.hover || quitOpen) return null;
  const phase = game.phase;
  if (!(SHOWN_PHASES.includes(phase) || (phase === 'review' && reviewMinimized))) return null;
  const dev = devAt(game, view.hover.col, view.hover.row);
  if (!dev || dev === view.selected) return null;
  return dev;
}

export function totalsText(game, dev) {
  const s = devStats(game, dev);
  return `Damage ${Math.round(s.damage)} · ${s.fireRate.toFixed(1)}/s · range ${(s.range / CELL).toFixed(1)}`;
}

// Changes when the line list changes; countdown numbers ("8 s left") are ignored so the DOM is not rebuilt every second.
export function effectsCardKey(dev, effects) {
  const lines = effects.map(l => `${l.group}|${l.name}|${l.text.replace(/\d+(?:\.\d+)? s left/g, '# s left')}`);
  return `${dev.type}@${dev.col},${dev.row}#${levelName(dev)}\n${lines.join('\n')}`;
}

let card = null;
let cardKey = '';
let cardSize = null;
let posKey = '';

export function updateEffectsCard(app, reviewMinimized, quitOpen = false) {
  const game = app.game;
  const dev = hoveredDev(game, app.view, reviewMinimized, quitOpen);
  if (!card) {
    card = h('div', { class: 'effects-card sel-panel popover hidden' });
    card.dataset.key = '';
  }
  const stage = document.querySelector('#stage');
  if (card.parentNode !== stage) stage.insertBefore(card, document.querySelector('#overlay'));
  toggle(card, 'hidden', !dev);
  if (!dev) { cardKey = ''; return; }

  const effects = devEffects(game, dev);
  const key = effectsCardKey(dev, effects);
  if (key !== cardKey) {
    cardKey = key; cardSize = null; posKey = '';
    card.innerHTML = '';
    card.append(h('div', { class: 'popover-body' },
      h('b', {}, `${getDeveloper(dev.type).name} · ${levelName(dev)}`),
      h('small', { class: 'effects-totals' }, totalsText(game, dev)),
      ...(effects.length ? GROUPS.flatMap(g => effects.filter(l => l.group === g)).map(l =>
        h('div', { class: 'effect-line' }, h('b', {}, l.name), h('span', {}, l.text)))
        : [h('small', {}, 'No active effects')]),
    ));
  } else {
    // Same lines: refresh only the text that moves (totals and countdowns).
    const body = card.firstChild;
    set(body.querySelector('.effects-totals'), 'textContent', totalsText(game, dev));
    const els = body.querySelectorAll('.effect-line span');
    GROUPS.flatMap(g => effects.filter(l => l.group === g)).forEach((l, i) => { if (els[i]) set(els[i], 'textContent', l.text); });
  }

  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  if (!cardSize) {
    set(card.style, 'maxWidth', '');
    set(card.style, 'maxHeight', '');
    cardSize = { w: card.offsetWidth, h: card.offsetHeight };
    posKey = '';
  }
  const pk = `${dev.x},${dev.y},${stageW}x${stageH}`;
  if (pk === posKey) return;
  posKey = pk;
  const { left, top, side, maxW, maxH } = popoverPosition({
    x: dev.x, y: dev.y, scale: stageW / WIDTH, stageW, stageH, popW: cardSize.w, popH: cardSize.h,
  });
  set(card.style, 'maxWidth', `${maxW}px`);
  set(card.style, 'maxHeight', `${maxH}px`);
  set(card.style, 'left', `${left}px`);
  set(card.style, 'top', `${top}px`);
  toggle(card, 'left', side === 'left');
}
