// Tiny DOM helpers shared by the HUD (ui.js) and the menu screens (menu.js).

export const $ = sel => document.querySelector(sel);

export function h(tag, props = {}, ...children) {
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
export function set(el, prop, value) { if (el[prop] !== value) el[prop] = value; }
export function toggle(el, cls, on) { if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on); }

// Which screen is up: menu | howto | invest | run | collapse | lost | won. style.css hides the board, bars and HUD items from it.
export function setScreen(name) {
  const app = $('#app');
  if (app && app.dataset.screen !== name) app.dataset.screen = name;
}

// Best run (furthest sprint index) is kept in this browser only.
export function loadBest() {
  try { const n = Number(localStorage.getItem('dtc-best') ?? -1); return Number.isFinite(n) ? n : -1; } catch { return -1; }
}
export function recordBest(sprint) {
  const best = loadBest();
  const isNew = sprint > best;
  if (isNew) { try { localStorage.setItem('dtc-best', String(sprint)); } catch { /* ignore */ } }
  return { sprint: Math.max(sprint, best), isNew };
}
