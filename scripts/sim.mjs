// Headless balance check: a bot hires, buys upgrades and plays all 10 waves per seed. Run: node scripts/sim.mjs [seed-count]
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave, ringBell, step } from '../src/engine/game.js';
import { placeDev, nextUpgrades, upgradeStatus, buyUpgrade } from '../src/engine/devs.js';
import { usePowerup } from '../src/engine/powerups.js';
import { isBuildable, cellCenter, pointAt, PATH_LENGTH } from '../src/engine/map.js';
import { getDeveloper } from '../src/engine/registry.js';

await loadModules(CONTENT_URLS);

const SEEDS = Math.max(1, parseInt(process.argv[2] ?? '10', 10) || 10);

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
for (let c = 0; c < 16; c++) for (let r = 0; r < 8; r++) if (isBuildable(c, r)) cells.push({ c, r, cov: coverage(c, r, 2.2 * 40) });
cells.sort((a, b) => b.cov - a.cov);

// Which upgrades this dev may take: at level 1 the bot sticks to one branch.
// `branch` is 'A', 'B' or 'alt' (by dev.id % 2), or per type, like { dotnet: 'A' } (others 'alt').
function choices(dev, branch) {
  const ups = nextUpgrades(dev);
  if (dev.level !== 1) return ups;
  const b = typeof branch === 'object' ? branch[dev.type] ?? 'alt' : branch;
  const pick = b === 'A' ? 0 : b === 'B' ? 1 : dev.id % 2;
  return ups[pick] ? [ups[pick]] : [];
}

function play(order, usePowers, branch, seed) {
  const g = createGame(); g.random = mulberry32(seed); startGame(g);
  const bought = {};
  let i = 0;
  const upgrade = () => {
    while (true) {
      let best = null;
      for (const dev of g.devs) for (const up of choices(dev, branch)) {
        if (upgradeStatus(g, dev, up).ok && (!best || up.cost < best.up.cost)) best = { dev, up };
      }
      if (!best || !buyUpgrade(g, best.dev, best.up.id)) return;
      if (best.dev.level === 2) bought[best.up.id] = (bought[best.up.id] ?? 0) + 1;
    }
  };
  const hire = () => {
    while (true) {
      const type = order[i % order.length];
      if (g.warrants < getDeveloper(type).cost) return;
      const cell = cells.find(x => !g.devs.some(d => d.col === x.c && d.row === x.r));
      if (!cell) return;
      placeDev(g, type, cell.c, cell.r); i++;
    }
  };
  hire(); startWave(g);
  let t = 0;
  while (!['won', 'lost'].includes(g.phase) && t < 3600) {
    step(g, 0.05); t += 0.05;
    if (usePowers && g.phase === 'wave') { for (const p of ['bart', 'jeroen', 'thomas']) usePowerup(g, p); if (g.bugs.length > 40) usePowerup(g, 'claude'); }
    if (g.phase === 'bell') { upgrade(); hire(); ringBell(g); }
  }
  return { won: g.phase === 'won', wave: g.wave + 1, lives: g.lives, bought };
}

// Level-3 upgrade ids for the types in an order, in content order.
const level3Ids = order => [...new Set(order)].flatMap(type => (getDeveloper(type).upgrades?.level3 ?? []).map(u => u.id));

function run(name, order, usePowers, branch) {
  const runs = [];
  for (let seed = 1; seed <= SEEDS; seed++) runs.push(play(order, usePowers, branch, seed));
  const avg = f => (runs.reduce((n, r) => n + f(r), 0) / runs.length).toFixed(1);
  const wins = runs.filter(r => r.won).length;
  const ups = level3Ids(order).map(id => `${id} ${runs.reduce((n, r) => n + (r.bought[id] ?? 0), 0)}`).join(' ');
  console.log(`${name.padEnd(24)} wins ${`${wins}/${SEEDS}`.padEnd(5)} wave ${avg(r => r.wave).padStart(4)}  lives ${avg(r => r.lives).padStart(4)}  ${ups}`);
}

const ORDERS = [['react only', ['react']], ['java only', ['java']], ['mixed', ['react', 'java', 'react', 'dotnet']], ['dotnet only', ['dotnet']]];
for (const [name, order] of ORDERS) {
  run(`${name} no powers`, order, false, 'alt');
  run(`${name} powers`, order, true, 'alt');
}
for (const type of ['java', 'react', 'dotnet']) {
  run(`${type} A`, [type], true, 'A');
  run(`${type} B`, [type], true, 'B');
}
// .NET only can't hire before wave 1, so its branches also run behind a React opener.
run('react+dotnet A', ['react', 'dotnet'], true, { dotnet: 'A' });
run('react+dotnet B', ['react', 'dotnet'], true, { dotnet: 'B' });
