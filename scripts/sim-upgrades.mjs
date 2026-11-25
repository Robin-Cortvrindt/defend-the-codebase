// Developer-upgrade balance check: seeded runs per strategy and level-3 branch, with no investments.
// A bot hires, buys upgrades and plays up to MAX_SPRINTS sprints per seed.
// Run: node scripts/sim-upgrades.mjs [seed-count] [max-sprints]   (scripts/sim.mjs covers investments)
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave, ringBell, step, sprintInfo, chooseYearReview } from '../src/engine/game.js';
import { buyUpgrade as buyBuilding } from '../src/engine/upgrades.js';
import { canAfford, drinkFor } from '../src/engine/drinks.js';
import { trackPickups, tickPickups } from './pickup.mjs';
import { placeDev, hireCost, nextUpgrades, upgradeStatus, buyUpgrade } from '../src/engine/devs.js';
import { usePowerup } from '../src/engine/powerups.js';
import { isBuildable, cellCenter, pointAt, PATH_LENGTH, CELL, COLS, ROWS } from '../src/engine/map.js';
import { getDeveloper } from '../src/engine/registry.js';
import { setStorage } from '../src/engine/investments.js';
setStorage(null);   // no saved investments: every run starts from the same base game

await loadModules(CONTENT_URLS);

// --pickup <p> is read by pickup.mjs; strip it so it can't shift the positional arguments.
const argv = process.argv.slice(2);
const pk = argv.indexOf('--pickup');
if (pk >= 0) argv.splice(pk, 2);
const SEEDS = Math.max(1, parseInt(argv[0] ?? '10', 10) || 10);
// The game is endless (sprints and quarters), so each run stops after MAX_SPRINTS sprints.
const MAX_SPRINTS = Math.max(1, parseInt(argv[1] ?? '28', 10) || 28);

// Small seeded PRNG so every run of a strategy is reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rank buildable cells by how much path is in range.
function coverage(col, row, range) {
  const c = cellCenter(col, row); let n = 0;
  for (let d = 0; d < PATH_LENGTH; d += 4) { const p = pointAt(d); if (Math.hypot(p.x - c.x, p.y - c.y) <= range) n++; }
  return n;
}
const cells = [];
for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (isBuildable(c, r)) cells.push({ c, r, cov: coverage(c, r, 2.2 * 40) });
cells.sort((a, b) => b.cov - a.cov);

// Which upgrades this dev may take: at level 1 the bot sticks to one branch.
// `branch` is 'A', 'B' or 'alt' (every other developer of the same type),
// or per type, like { dotnet: 'A' } (other types 'alt').
// An aura upgrade is only taken when it would reach a developer that no copy of it reaches yet.
function auraHelps(g, dev, up) {
  const reach = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) <= up.aura.radius * CELL;
  const owners = g.devs.filter(o => o.upgrade?.id === up.id);
  return g.devs.some(o => o !== dev && reach(o, dev) && !owners.some(w => w !== o && reach(w, o)));
}

function choices(g, dev, branch) {
  const ups = nextUpgrades(dev);
  if (dev.level !== 1) return ups;
  const b = typeof branch === 'object' ? branch[dev.type] ?? 'alt' : branch;
  const pick = b === 'A' ? 0 : b === 'B' ? 1 : g.devs.filter(d => d.type === dev.type).indexOf(dev) % 2;
  const up = ups[pick];
  if (!up) return [];
  if (up.aura && !auraHelps(g, dev, up)) return [];
  return [up];
}

// bell: 'up' buys upgrades before hiring, 'hire' hires before upgrading.
function play({ order, powers, branch, bell }, seed) {
  const g = createGame(); g.random = mulberry32(seed); startGame(g); trackPickups(g, seed);
  const bought = {};
  let i = 0;
  const upgrade = () => {
    while (true) {
      let best = null;
      for (const dev of g.devs) for (const up of choices(g, dev, branch)) {
        if (upgradeStatus(g, dev, up).ok && (!best || up.cost < best.up.cost)) best = { dev, up };
      }
      if (!best || !buyUpgrade(g, best.dev, best.up.id)) return;
      if (best.dev.level === 2) bought[best.up.id] = (bought[best.up.id] ?? 0) + 1;
    }
  };
  const hire = () => {
    while (true) {
      const type = order[i % order.length];
      if (!canAfford(g, drinkFor(type), hireCost(g, type))) return;
      // Seeded jitter: one of the three best free cells.
      const free = cells.filter(x => !g.devs.some(d => d.col === x.c && d.row === x.r)).slice(0, 3);
      if (!free.length) return;
      const cell = free[Math.floor(g.random() * free.length)];
      placeDev(g, type, cell.c, cell.r); i++;
    }
  };
  hire(); startWave(g);
  let t = 0;
  while (g.phase !== 'lost' && g.sprint < MAX_SPRINTS && t < 20000) {
    step(g, 0.05); t += 0.05; tickPickups(g, 0.05);
    if (powers && g.phase === 'wave') { for (const p of ['ceo', 'business', 'training']) usePowerup(g, p); if (g.bugs.length > 40) usePowerup(g, 'claude'); }
    if (g.phase === 'review') { if (g.pendingYearReview) chooseYearReview(g, 'accept'); while (buyBuilding(g, 'aircon') || buyBuilding(g, 'floor')); }
    // Nothing can change while the bell waits: ring it, then spend at the start of the sprint.
    const spend = () => { if (bell === 'up') { upgrade(); hire(); } else { hire(); upgrade(); } };
    if (g.phase === 'bell') { ringBell(g); spend(); }
    else if (g.phase === 'review') { spend(); ringBell(g); }
  }
  return { survived: g.phase !== 'lost', sprints: g.sprint, lives: g.lives, bought };
}

// Level-3 upgrade ids for the types in an order, in content order.
const level3Ids = order => [...new Set(order)].flatMap(type => (getDeveloper(type).upgrades?.level3 ?? []).map(u => u.id));

function run(name, strategy) {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) runs.push(play(strategy, seed));
  const avg = f => (runs.reduce((n, r) => n + f(r), 0) / runs.length).toFixed(1);
  const alive = runs.filter(r => r.survived).length;
  const ups = level3Ids(strategy.order).map(id => `${id} ${runs.reduce((n, r) => n + (r.bought[id] ?? 0), 0)}`).join(' ');
  const label = `${name} ${strategy.powers ? 'powers' : 'no powers'} ${strategy.bell === 'up' ? 'up-first' : 'hire-first'}`;
  console.log(`${label.padEnd(36)} survived ${`${alive}/${SEEDS}`.padEnd(5)} sprints ${avg(r => r.sprints).padStart(4)}  lives ${avg(r => r.lives).padStart(4)}  ${ups}`);
}

// Each strategy runs with and without powers, and with both bell orders.
function runAll(name, order, branch) {
  for (const powers of [false, true]) for (const bell of ['up', 'hire']) run(name, { order, powers, branch, bell });
}

const ORDERS = [['react only', ['react']], ['java only', ['java']], ['mixed', ['react', 'java', 'react', 'dotnet']], ['dotnet only', ['dotnet']]];
for (const [name, order] of ORDERS) runAll(name, order, 'alt');
for (const type of ['java', 'react', 'dotnet']) {
  runAll(`${type} A`, [type], 'A');
  runAll(`${type} B`, [type], 'B');
}
// .NET only can't hire before wave 1, so its branches also run behind a React opener.
runAll('react+dotnet A', ['react', 'dotnet'], { dotnet: 'A' });
runAll('react+dotnet B', ['react', 'dotnet'], { dotnet: 'B' });
