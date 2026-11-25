// Headless balance check: a simple bot plays until production goes down.
//   node scripts/sim.mjs                  every strategy, with and without power-ups, no investments
//   node scripts/sim.mjs --profile max    the same, with every investment at max level
//   node scripts/sim.mjs --pickup 0.7     collect only 70% of the drops (default 1), each 1 s after it appears
//   node scripts/sim.mjs --meta [runs]    run after run from zero: earn Investor Capital, buy the cheapest investment, repeat
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave, ringBell, step, sprintInfo, chooseYearReview } from '../src/engine/game.js';
import { buyUpgrade } from '../src/engine/upgrades.js';
import { placeDev, hireCost } from '../src/engine/devs.js';
import { canAfford, drinkFor } from '../src/engine/drinks.js';
import { PICKUP, trackPickups, tickPickups } from './pickup.mjs';
import { usePowerup } from '../src/engine/powerups.js';
import { isBuildable, isPathCell, cellCenter, pointAt, PATH_LENGTH } from '../src/engine/map.js';
import { getInvestments } from '../src/engine/registry.js';
import { setStorage, saveProgress, loadProgress, awardCapital, investmentCost, invest } from '../src/engine/investments.js';

await loadModules(CONTENT_URLS);
setStorage(null);

// Rank buildable cells by how much path is in range.
function coverage(col, row, range) {
  const c = cellCenter(col, row); let n = 0;
  for (let d = 0; d < PATH_LENGTH; d += 4) { const p = pointAt(d); if (Math.hypot(p.x - c.x, p.y - c.y) <= range) n++; }
  return n;
}
const cells = [];
for (let c = 0; c < 16; c++) for (let r = 0; r < 8; r++) if (isBuildable(c, r)) cells.push({ c, r, cov: coverage(c, r, 2.2 * 40) });
cells.sort((a, b) => b.cov - a.cov);

// Firewall slots: pairs of buildable cells facing each other across one lane cell, best coverage first.
const pairCells = [];
for (const a of cells) {
  for (const [dc, dr] of [[0, 2], [2, 0]]) {
    const b = cells.find(x => x.c === a.c + dc && x.r === a.r + dr);
    if (b && isPathCell(a.c + dc / 2, a.r + dr / 2)) pairCells.push(a, b);
  }
}

function play(strategy, usePowers) {
  const g = createGame(); startGame(g); trackPickups(g);
  const free = x => !g.devs.some(d => d.col === x.c && d.row === x.r);
  let i = 0;
  const buy = () => {
    while (true) {
      const type = strategy[i % strategy.length];
      if (!canAfford(g, drinkFor(type), hireCost(g, type))) return;
      // With the firewall unlocked, .NET developers go into facing pairs first.
      const cell = (type === 'dotnet' && g.unlocks.firewall && pairCells.find(free)) || cells.find(free);
      if (!cell) return;
      placeDev(g, type, cell.c, cell.r); i++;
    }
  };
  buy(); startWave(g);
  let t = 0;
  while (!['won', 'lost'].includes(g.phase) && t < 40000) {
    step(g, 0.05); t += 0.05; tickPickups(g, 0.05);
    if (usePowers && g.phase === 'wave') { for (const p of ['ceo', 'business', 'training']) usePowerup(g, p); if (g.bugs.length > 40) usePowerup(g, 'claude'); }
    if (g.phase === 'review') { if (g.pendingYearReview) chooseYearReview(g, 'accept'); while (buyUpgrade(g, 'aircon') || buyUpgrade(g, 'floor')); }
    if (g.phase === 'bell' || g.phase === 'review') { buy(); ringBell(g); }
  }
  return g;
}
const describe = g => `${g.phase.padEnd(4)} ${sprintInfo(g.sprint).label.padEnd(26)} floors ${g.floors} devs ${g.devs.length} seniors ${g.stats.seniors}`;

const args = process.argv.slice(2);
const STRATEGIES = [['react only', ['react']], ['java only', ['java']], ['mixed', ['react', 'java', 'react', 'dotnet']], ['dotnet only', ['dotnet']]];

if (args.includes('--meta')) {
  const runs = Number(args[args.indexOf('--meta') + 1]) || 30;
  const total = getInvestments().length;
  let firewallRun = null, completeRun = null;
  for (let run = 1; run <= runs; run++) {
    const g = play(STRATEGIES[2][1], true);
    const earned = awardCapital(g);
    for (;;) {   // buy unlocks first (a player wants new mechanics), then the cheapest affordable investment
      const { capital } = loadProgress();
      const rank = d => (d.group === 'unlocks' ? 0 : 1);
      const next = getInvestments().map(d => ({ id: d.id, rank: rank(d), cost: investmentCost(d.id) })).filter(x => x.cost <= capital).sort((a, b) => a.rank - b.rank || a.cost - b.cost)[0];
      if (!next || !invest(next.id)) break;
    }
    const { levels, capital } = loadProgress();
    const owned = getInvestments().filter(d => (levels[d.id] || 0) >= (d.maxLevel ?? Infinity)).length;
    if (!firewallRun && levels['security-training']) firewallRun = run;
    if (!completeRun && owned === total) completeRun = run;
    console.log(`run ${String(run).padStart(2)} · died ${sprintInfo(g.sprint).label.padEnd(26)} · +${String(earned).padStart(3)} · left ${String(capital).padStart(3)} · maxed ${owned}/${total}`);
  }
  console.log(`firewall bought on run ${firewallRun ?? `— (not within ${runs})`}; catalog complete on run ${completeRun ?? `— (not within ${runs})`}`);
} else {
  console.log(`pickup ${PICKUP}`);
  const max = args.includes('--profile') && args[args.indexOf('--profile') + 1] === 'max';
  if (max) saveProgress({ capital: 0, levels: Object.fromEntries(getInvestments().map(d => [d.id, d.maxLevel ?? 1])) });
  for (const [name, s] of STRATEGIES) {
    console.log(name.padEnd(12), 'no powers :', describe(play(s, false)));
    console.log(name.padEnd(12), 'powers    :', describe(play(s, true)));
  }
}
