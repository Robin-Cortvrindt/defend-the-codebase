// Mouse and keyboard input on the canvas.
import { getDevelopers } from './registry.js';
import { WIDTH, HEIGHT, cellAt } from './map.js';
import { placeDev, devAt } from './devs.js';
import { playSound } from './sound.js';
import { selectHire, uiActions } from './ui.js';

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
    if (!['building', 'wave', 'bell'].includes(g.phase)) return;
    const { x, y } = toLogical(ev);
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
    const devs = getDevelopers();
    const n = Number(ev.key);
    if (n >= 1 && n <= devs.length) selectHire(devs[n - 1].id);
    else if (ev.key === 'Escape') { app.view.hire = null; app.view.selected = null; }
    else if (ev.key === 'p' || ev.key === 'P') uiActions.togglePause();
    else if (ev.key === 'f' || ev.key === 'F') uiActions.toggleSpeed();
    else if (ev.key === 'm' || ev.key === 'M') uiActions.toggleMute();
    else if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); uiActions.onWaveButton(); }
  });
}
