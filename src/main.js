// Boots the game: loads content, wires events to sound and effects, runs the loop.
import { loadModules, loadManifest } from './engine/loader.js';
import { getFeatures } from './engine/registry.js';
import { on } from './engine/events.js';
import { createGame, startGame, startWave, step, addEffect } from './engine/game.js';
import { placeDev } from './engine/devs.js';
import { WIDTH, HEIGHT } from './engine/map.js';
import { render } from './engine/render.js';
import { initUI, updateUI, resetUI } from './engine/ui.js';
import { initInput } from './engine/input.js';
import { awardCapital } from './engine/investments.js';
import { playSound } from './engine/sound.js';
import { startMusic } from './engine/music.js';

// If the manifest itself is broken (a typo in the one shared file), still load the core game.
const CORE = [
  'drinks/coffee.js', 'drinks/monster.js', 'drinks/redbull.js',
  'developers/react.js', 'developers/java.js', 'developers/dotnet.js',
  'bugs/typo.js', 'bugs/nullpointer.js', 'bugs/legacy.js', 'waves.js',
  'powerups/training-manager.js', 'powerups/business-manager.js', 'powerups/ceo.js', 'powerups/claude.js',
  'events/prod-down.js', 'events/heating-out.js', 'events/no-coffee.js', 'events/no-redbull.js', 'events/heat-wave.js',
  'upgrades/floor.js', 'upgrades/aircon.js', 'upgrades/heating.js', 'upgrades/coffee.js', 'upgrades/fridge.js', 'upgrades/generator.js',
].map(p => new URL(`./content/${p}`, import.meta.url).href);
const contentUrls = await loadManifest(new URL('./content/manifest.js', import.meta.url).href, CORE);
const { failed } = await loadModules(contentUrls);
if (failed.length) console.warn(`[main] ${failed.length} content file(s) failed to load and were skipped`, failed);

const DEMO = new URLSearchParams(location.search).has('demo');

const app = {
  game: createGame(),
  view: { hire: null, selected: null, hover: null, cursor: null, paused: false, speed: 1 },
  lastRun: null, // { sprint, capital, quit } for the main menu's "Last run" tile
  restart() {
    this.toMenu();
    startGame(this.game);
  },
  // A fresh game waiting on the main menu.
  toMenu(lastRun = null) {
    this.game = createGame();
    this.lastRun = lastRun;
    Object.assign(this.view, { hire: null, selected: null, paused: false });
    initFeatures();
    resetUI();
  },
};
window.game = app; // handy in the browser console while developing

function initFeatures() {
  for (const f of getFeatures()) {
    try { f.init?.(app.game); } catch (e) { console.error(`[feature ${f.id}] init failed`, e); }
  }
}

// ----- events → feedback -----
on('bug:killed', ({ game, bug }) => {
  if (game !== app.game) return;
  playSound('squash', 40);
});
on('drop:collected', ({ game }) => { if (game === app.game) playSound('place', 30); });
on('bug:leaked', () => playSound('leak', 80));
on('dev:levelup', ({ game, dev, upgrade }) => {
  addEffect(game, { kind: 'ring', x: dev.x, y: dev.y, color: '#16A34A', ttl: 0.6 });
  addEffect(game, { kind: 'pop', x: dev.x, y: dev.y - 26, text: upgrade.name, color: '#4ADE80', size: 12, ttl: 1 });
  playSound('levelup');
});
on('claude:backfire', () => playSound('backfire'));
on('game:won', () => playSound('won'));
on('game:lost', () => playSound('lost'));
// New investors pay out Investor Capital for how far the run got (not in the ?demo=1 shortcut).
on('game:lost', ({ game }) => { if (!DEMO && game === app.game) awardCapital(game); });
startMusic(() => app.game); // background loop; silent until the first click unlocks audio

// ----- canvas -----
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
// The board fits the window: as wide as its column allows, but never so tall that the HUD, power-ups
// and hire row stop fitting on screen. Below MIN_BOARD_H the page may scroll instead.
const MIN_BOARD_H = 240;
function resize() {
  const stage = document.getElementById('stage');
  const play = document.getElementById('play');
  const side = document.getElementById('side-panel');
  const stacked = side.offsetTop > play.offsetTop + 1;          // narrow screens put the panel below the board
  const availW = play.clientWidth - (stacked ? 0 : side.offsetWidth);
  const body = getComputedStyle(document.body);
  const bodyPad = parseFloat(body.paddingTop) + parseFloat(body.paddingBottom);
  const chrome = ['hud', 'powerups', 'hire'].reduce((h, id) => h + document.getElementById(id).offsetHeight, 2); // + #app border
  const availH = Math.max(MIN_BOARD_H, window.innerHeight - bodyPad - chrome);
  const cssW = Math.floor(Math.min(availW, availH * (WIDTH / HEIGHT)));
  const cssH = Math.round(cssW * (HEIGHT / WIDTH));
  const dpr = window.devicePixelRatio || 1;
  stage.style.width = `${cssW}px`;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
}
window.addEventListener('resize', resize);
// The HUD can wrap and the bars appear or disappear per screen: re-fit when their height changes.
if (typeof ResizeObserver !== 'undefined') {
  const ro = new ResizeObserver(() => resize());
  for (const id of ['hud', 'powerups', 'hire']) ro.observe(document.getElementById(id));
}

initUI(app);
initInput(canvas, app);
initFeatures();
resize();

// ?demo=1 jumps straight into wave 1 with one of each developer (handy for testing)
if (DEMO) {
  startGame(app.game);
  for (const id of Object.keys(app.game.drinks)) app.game.drinks[id] = 1000;
  placeDev(app.game, 'react', 3, 3);
  placeDev(app.game, 'java', 6, 3);
  placeDev(app.game, 'dotnet', 9, 5);
  startWave(app.game);
}

// Each part of the frame is guarded, so one broken content file can never freeze the game.
const lastError = {};
function guarded(name, fn) {
  try { fn(); } catch (e) {
    const now = performance.now();
    if (now - (lastError[name] || 0) > 2000) { lastError[name] = now; console.error(`[main] ${name} failed`, e); }
  }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!app.view.paused) {
    // the game-over collapse always plays at normal speed
    const steps = app.game.phase === 'lost' ? 1 : app.view.speed;
    guarded('step', () => { for (let i = 0; i < steps; i++) step(app.game, dt); });
  }
  guarded('render', () => {
    ctx.save();
    try { render(ctx, app.game, app.view); } finally { ctx.restore(); ctx.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0); }
  });
  guarded('ui', updateUI);
}
requestAnimationFrame(frame);
