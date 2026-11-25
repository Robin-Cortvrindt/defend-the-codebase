// Headless balance check: a simple bot plays until production goes down.
//   node scripts/sim.mjs                  every strategy, with and without power-ups, no investments
//   node scripts/sim.mjs --profile max    the same, with every investment at max level
//   node scripts/sim.mjs --pickup 0.7     collect only 70% of the drops (default 1), each 1 s after it appears
//   node scripts/sim.mjs --trials N      seeded trials per row (default 30): prints mean / median / p10 of sprints cleared
//   node scripts/sim.mjs --meta [runs]    run after run from zero: earn Investor Capital, buy the cheapest investment, repeat
//   node scripts/sim.mjs --trojan         the bot summons a Trojan horse at every bell it can afford; reports how the horses went
import { CONTENT_URLS } from '../src/content/manifest.js';
import { on } from '../src/engine/events.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave, ringBell, step, sprintInfo, chooseYearReview } from '../src/engine/game.js';
import { buyUpgrade } from '../src/engine/upgrades.js';
import { placeDev, hireCost } from '../src/engine/devs.js';
import { canAfford, drinkFor } from '../src/engine/drinks.js';
import { PICKUP, mulberry32, trackPickups, tickPickups } from './pickup.mjs';
import { usePowerup } from '../src/engine/powerups.js';
import { isBuildable, isPathCell, cellCenter, pointAt, PATH_LENGTH, COLS, ROWS } from '../src/engine/map.js';
import { getInvestments } from '../src/engine/registry.js';
import { setStorage, saveProgress, loadProgress, awardCapital, investmentCost, invest, investmentLevel } from '../src/engine/investments.js';

await loadModules(CONTENT_URLS);
setStorage(null);
const { summonTrojan } = await import('../src/content/features/trojan-horse.js');
const TROJAN = process.argv.includes('--trojan');

// Trojan horse bookkeeping per game. killBug spawns a bug's drops before it emits bug:killed,
// so the drops seen since the previous kill belong to the bug that just died.
const horseStats = new WeakMap();
let sinceKill = [];
on('drop:spawned', ({ drop }) => sinceKill.push(drop.id));
on('bug:killed', ({ game, bug }) => {
  const h = horseStats.get(game);
  if (h && bug.type === 'trojan-horse') { h.squashed++; for (const id of sinceKill) h.drops.add(id); }
  sinceKill = [];
});
on('bug:leaked', ({ game, bug }) => { const h = horseStats.get(game); if (h && bug.type === 'trojan-horse') h.leaked++; });
on('drop:collected', ({ game, drop }) => { const h = horseStats.get(game); if (h?.drops.has(drop.id)) h.collected += drop.amount; });
on('trojan:summoned', ({ game, price }) => { const h = horseStats.get(game); if (h) { h.summoned++; h.paid += price * 3; } });

// Rank buildable cells by how much path is in range.
function coverage(col, row, range) {
  const c = cellCenter(col, row); let n = 0;
  for (let d = 0; d < PATH_LENGTH; d += 4) { const p = pointAt(d); if (Math.hypot(p.x - c.x, p.y - c.y) <= range) n++; }
  return n;
}
const cells = [];
for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (isBuildable(c, r)) cells.push({ c, r, cov: coverage(c, r, 2.2 * 40) });
cells.sort((a, b) => b.cov - a.cov);

// Firewall slots: pairs of buildable cells facing each other across one lane cell, best coverage first.
const pairCells = [];
for (const a of cells) {
  for (const [dc, dr] of [[0, 2], [2, 0]]) {
    const b = cells.find(x => x.c === a.c + dc && x.r === a.r + dr);
    if (b && isPathCell(a.c + dc / 2, a.r + dr / 2)) pairCells.push(a, b);
  }
}

function play(strategy, usePowers, seed = 1) {
  const g = createGame(); g.random = mulberry32(seed); startGame(g); trackPickups(g, seed);
  if (TROJAN) horseStats.set(g, { summoned: 0, squashed: 0, leaked: 0, paid: 0, collected: 0, drops: new Set() });
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
    // Nothing can change while the bell waits (except a Trojan horse, which is summoned on the bell card):
    // ring it, then hire at the start of the sprint.
    if (g.phase === 'bell') { if (TROJAN) summonTrojan(g); ringBell(g); buy(); }
    else if (g.phase === 'review') { if (TROJAN) summonTrojan(g); buy(); ringBell(g); }
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
    for (;;) {   // buy new unlocks first (a player wants new mechanics), then the cheapest affordable investment; a multi-level unlock's later levels count as ordinary upgrades
      const { capital } = loadProgress();
      const rank = d => (d.group === 'unlocks' && !investmentLevel(d.id) ? 0 : 1);
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
  const trialsAt = args.indexOf('--trials');
  const trials = Math.max(1, Number(trialsAt >= 0 ? args[trialsAt + 1] : NaN) || 30);
  const stats = xs => {
    const v = [...xs].sort((a, b) => a - b), at = q => v[Math.min(v.length - 1, Math.floor(q * v.length))];
    return { mean: v.reduce((a, b) => a + b, 0) / v.length, median: at(0.5), p10: at(0.1) };
  };
  console.log(`${trials} seeded trials per row (seeds 1..${trials}); sprints cleared = global sprint count at the end; sample = trial 1`);
  for (const [name, s] of STRATEGIES) {
    for (const [label, powers] of [['no powers ', false], ['powers    ', true]]) {
      const games = Array.from({ length: trials }, (_, k) => play(s, powers, k + 1));
      const { mean, median, p10 } = stats(games.map(g => g.sprint));
      console.log(name.padEnd(12), label + ':', `mean ${mean.toFixed(1).padStart(5)} median ${String(median).padStart(3)} p10 ${String(p10).padStart(3)} | sample ${describe(games[0])}`);
      if (TROJAN) {
        const t = games.map(x => horseStats.get(x)).reduce((a, h) => ({ n: a.n + h.summoned, won: a.won + h.squashed, lost: a.lost + h.leaked, net: a.net + h.collected - h.paid }), { n: 0, won: 0, lost: 0, net: 0 });
        const pct = k => (t.n ? `${Math.round(100 * k / t.n)}%` : '—').padStart(4);
        console.log(''.padEnd(12), '  trojan   :', `horses ${String(t.n).padStart(4)} squashed ${pct(t.won)} leaked ${pct(t.lost)} | mean net drinks per horse ${t.n ? Math.round(t.net / t.n) : '—'}`);
      }
    }
  }
}
