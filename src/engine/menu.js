// Title screens shown before a run: main menu, how to play and the investments shop.
// They are drawn in #overlay like every other screen; setScreen() hides the board, HUD and bars behind them.
import { $, h, setScreen, loadBest } from './dom.js';
import { getDevelopers, getBugs, getInvestments } from './registry.js';
import { loadProgress, investmentLevel, investmentCost, canInvest, invest, resetProgress } from './investments.js';
import { startGame, sprintInfo } from './game.js';
import { playSound, unlockAudio, isMuted, setMuted } from './sound.js';

let app;
let muteBtn = null;

export function initMenu(appRef) { app = appRef; }

const sprintLabel = sprint => { const s = sprintInfo(sprint); return `Y${s.year} · Q${s.quarter} · S${s.sprint}`; };

function startRun() {
  unlockAudio();
  app.lastRun = null;
  startGame(app.game);
}

function screen(cls, ...children) {
  const ov = $('#overlay');
  ov.className = `screen title-screen ${cls}`;
  ov.innerHTML = '';
  ov.append(...children);
  return ov;
}

export function showMenu() {
  setScreen('menu');
  const { capital } = loadProgress();
  const invs = getInvestments();
  const owned = invs.filter(d => investmentLevel(d.id) > 0).length;
  const affordable = invs.filter(d => investmentLevel(d.id) < (d.maxLevel ?? Infinity) && canInvest(d.id)).length;
  const best = loadBest();
  const last = app.lastRun;

  const tiles = [];
  if (last) {
    tiles.push(h('div', { class: 'tile last' },
      h('div', { class: 'eyebrow' }, last.quit ? 'Last run · quit' : 'Last run'),
      h('b', {}, sprintLabel(last.sprint)),
      h('small', {}, 'New investors put in ', h('strong', {}, `+${last.capital ?? 0} 💼`))));
  }
  tiles.push(
    h('div', { class: 'tile' }, h('div', { class: 'eyebrow' }, 'Best run'),
      h('b', {}, best >= 0 ? sprintLabel(best) : '—'),
      h('small', {}, best >= 0 ? 'Furthest sprint in this browser' : 'No runs yet')),
    h('div', { class: 'tile' }, h('div', { class: 'eyebrow' }, 'Investor capital'),
      h('b', {}, `💼 ${capital}`),
      h('small', {}, `${owned} investment${owned === 1 ? '' : 's'} owned · ${affordable} affordable now`)),
    h('div', { class: 'tile' }, h('div', { class: 'eyebrow' }, 'Who counters what'),
      h('div', { class: 'legend' }, getDevelopers().map(d => {
        const bug = getBugs().find(b => b.id === d.counters);
        return h('span', {}, h('i', { style: `background:${d.accent}` }), h('b', {}, d.name), ` counters ${bug ? bug.name.toLowerCase() + 's' : d.counters}`);
      }))),
  );

  muteBtn = h('button', { class: 'link', onclick: () => { setMuted(!isMuted()); updateMenu(); } });
  const ov = screen('menu-screen',
    h('div', { class: 'menu-main' },
      h('img', { src: 'assets/nexios-wordmark-white.webp', alt: 'Nexios', class: 'wordmark' }),
      h('i', { class: 'dash', style: 'background:#2563EB' }),
      h('h1', {}, 'Defend the Codebase'),
      h('p', { class: 'lede' }, 'Hire developers, squash bugs, keep production up. How many years can you last?'),
      h('div', { class: 'menu-list' },
        h('button', { class: 'mi primary', onclick: startRun }, 'Start run', h('small', {}, 'Space')),
        h('button', { class: 'mi', onclick: showHowTo }, 'How to play', h('small', {}, 'Rules & keys')),
        h('button', { class: 'mi', onclick: () => showShop(showMenu) }, 'Investments', h('small', {}, `💼 ${capital} to spend`)),
      ),
    ),
    h('div', { class: 'menu-side' }, tiles),
    h('div', { class: 'menu-foot' }, muteBtn, h('span', {}, 'Nexios')),
  );
  updateMenu();
  return ov;
}

// Called every frame: keeps the sound label right when M is pressed on the menu.
export function updateMenu() {
  if (muteBtn) { const t = isMuted() ? 'Sound off · M' : 'Sound on · M'; if (muteBtn.textContent !== t) muteBtn.textContent = t; }
}

const STEPS = [
  ['Hire next to the path', 'Developers squash bugs in range. Each type counters one kind of bug.'],
  ['Grab drinks', 'Squashed bugs drop Coffee, White Monster or Red Bull. Click them within 10 s. Each developer is paid in its own drink.'],
  ['Ring the bell', 'After each sprint, ring the Nexios bell to start the next one.'],
  ['Quarterly review', 'Every 7 sprints, spend Warrants on the building.'],
];
const KEYS = [['1 2 3', 'hire'], ['Shift-click', 'keep hiring'], ['Right-click / Esc', 'cancel'], ['Space', 'start the sprint or ring the bell'], ['P', 'pause'], ['F / Shift+F', 'speed'], ['M', 'sound']];

export function showHowTo() {
  setScreen('howto');
  muteBtn = null;
  screen('howto-screen',
    h('div', { class: 'howto' },
      h('div', { class: 'eyebrow' }, 'How to play'),
      h('h1', {}, 'Keep production up'),
      h('div', { class: 'steps' }, STEPS.map(([title, text], i) =>
        h('div', { class: 'step' }, h('em', {}, String(i + 1).padStart(2, '0')), h('b', {}, title), text))),
      h('div', { class: 'keys' }, KEYS.map(([k, what]) => h('span', {}, h('kbd', {}, k), ` ${what}`))),
      h('div', { class: 'screen-actions' },
        h('button', { class: 'btn ghost big', onclick: showMenu }, '← Back'),
        h('button', { class: 'btn primary big', onclick: startRun }, 'Start run →'),
      ),
    ),
  );
}

// ---------- investments shop (between runs) ----------

const INVEST_GROUPS = [['developers', 'Developers'], ['powerups', 'Power-ups'], ['unlocks', 'Unlocks']];

function investmentText(def, level) {
  try { if (level > 0 && def.effectText) return def.effectText(level); } catch (e) { console.error(`[investment ${def.id}]`, e); }
  return def.description || '';
}

// `back` returns to whichever screen opened the shop (the menu or the game-over card).
export function showShop(back) {
  setScreen('invest');
  muteBtn = null;
  const rerender = () => showShop(back);
  const { capital } = loadProgress();
  const cols = INVEST_GROUPS.map(([group, title]) => {
    const defs = getInvestments().filter(d => (d.group || 'developers') === group);
    if (!defs.length) return null;
    return h('div', { class: 'inv-col' }, h('div', { class: 'eyebrow' }, title), defs.map(def => {
      const level = investmentLevel(def.id);
      const max = def.maxLevel ?? Infinity;
      const maxed = level >= max;
      const unlock = group === 'unlocks' && max === 1;   // one-off unlocks say "Owned"; multi-level ones show pips
      const btnProps = { class: `buy${maxed ? ' own' : ''}`, onclick: () => { if (invest(def.id)) { playSound('powerup'); rerender(); } } };
      if (maxed || !canInvest(def.id)) btnProps.disabled = '';
      const pips = unlock || !Number.isFinite(max) ? null
        : h('span', { class: 'pips', 'aria-label': `Level ${level} of ${max}` }, Array.from({ length: max }, (_, i) => h('i', { class: i < level ? 'on' : '' })));
      return h('div', { class: 'inv', title: def.description || '' },
        h('b', {}, h('span', {}, def.name), pips),
        h('small', {}, investmentText(def, level)),
        h('button', btnProps, maxed ? (unlock ? 'Owned' : 'Max') : `💼 ${investmentCost(def.id)}`),
      );
    }));
  });
  const reset = () => {
    if (!window.confirm('Reset all investments and Investor Capital?')) return;
    resetProgress(); rerender();
  };
  const fromMenu = app.game.phase === 'menu';
  screen('invest-screen',
    h('div', { class: 'invest' },
      h('div', { class: 'inv-head' },
        h('h1', {}, 'Investments'),
        h('span', { class: 'inv-capital' }, `💼 ${capital} Investor Capital`),
        h('span', { class: 'spacer' }),
        h('button', { class: 'btn ghost', onclick: back }, fromMenu ? '← Main menu' : '← Back'),
        fromMenu ? h('button', { class: 'btn primary', onclick: startRun }, 'Start run →') : null,
      ),
      h('div', { class: 'inv-cols' }, cols),
      h('div', { class: 'inv-foot' }, 'Investments stay for all future runs. Hover one for the full description. ',
        h('button', { class: 'link', onclick: reset }, 'Reset progress')),
    ),
  );
}
