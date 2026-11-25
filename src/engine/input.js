// Mouse and keyboard input on the canvas.
import { getDevelopers } from './registry.js';
import { WIDTH, HEIGHT, cellAt } from './map.js';
import { placeDev, devAt } from './devs.js';
import { isLocked } from './game.js';
import { clickDrop } from './drops.js';
import { playSound } from './sound.js';
import { selectHire, uiActions, isQuitOpen, closeQuit } from './ui.js';

export function initInput(canvas, app) {
  const toLogical = ev => {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * WIDTH, y: ((ev.clientY - r.top) / r.height) * HEIGHT };
  };

  canvas.addEventListener('mousemove', ev => {
    const { x, y } = toLogical(ev);
    app.view.hover = cellAt(x, y);
    app.view.cursor = { x, y };
  });
  canvas.addEventListener('mouseleave', () => { app.view.hover = null; app.view.cursor = null; });

  canvas.addEventListener('click', ev => {
    const g = app.game;
    if (!['building', 'wave', 'bell', 'review'].includes(g.phase)) return;
    const { x, y } = toLogical(ev);
    if (clickDrop(g, app.view, x, y)) return;
    if (isLocked(g)) return;                  // the bell is waiting: only drops can be picked up
    const { col, row } = cellAt(x, y);
    const existing = devAt(g, col, row);
    if (existing) { app.view.selected = existing; app.view.hire = null; return; }
    if (app.view.hire) {
      const dev = placeDev(g, app.view.hire, col, row);
      if (dev) {
        playSound('place');
        if (!ev.shiftKey) app.view.hire = null; // shift-click keeps hiring
      }
      return;
    }
    app.view.selected = null;
  });

  canvas.addEventListener('contextmenu', ev => {
    ev.preventDefault();
    app.view.hire = null;
    app.view.selected = null;
  });

  window.addEventListener('keydown', ev => {
    if (ev.target instanceof HTMLInputElement) return;
    // While the quit box is open only Esc counts (it closes the box); buttons inside it still get Space/Enter.
    if (isQuitOpen()) { if (ev.key === 'Escape') closeQuit(); return; }
    const devs = getDevelopers();
    const n = Number(ev.key);
    const ae = document.activeElement;
    const hotkey = (n >= 1 && n <= devs.length) || ev.key === 'Escape';
    if (hotkey && ae && ae.classList && ae.classList.contains('hire-btn')) ae.blur(); // drop stale focus so its hover card hides
    if (n >= 1 && n <= devs.length) { if (!isLocked(app.game)) selectHire(devs[n - 1].id); }
    else if (ev.key === 'Escape') { app.view.hire = null; app.view.selected = null; }
    else if (ev.key === 'p' || ev.key === 'P') uiActions.togglePause();
    else if (ev.key === 'f' || ev.key === 'F') uiActions.toggleSpeed(ev.shiftKey);
    else if (ev.key === 'm' || ev.key === 'M') uiActions.toggleMute();
    else if (ev.key === ' ' || ev.key === 'Enter') {
      if (ev.repeat || ev.target instanceof HTMLButtonElement) return; // let focused buttons activate normally
      if (app.game.phase === 'review') return;                        // the quarter shop is only left by ringing the bell
      ev.preventDefault();
      uiActions.onWaveButton();
    }
  });
}
