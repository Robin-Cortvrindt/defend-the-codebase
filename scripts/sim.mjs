// Headless balance check: a simple bot plays all 10 waves. Run: node scripts/sim.mjs [seed-count]
import { CONTENT_URLS } from '../src/content/manifest.js';
import { loadModules } from '../src/engine/loader.js';
import { createGame, startGame, startWave, ringBell, step } from '../src/engine/game.js';
import { placeDev, grantXp } from '../src/engine/devs.js';
import { usePowerup } from '../src/engine/powerups.js';
import { isBuildable, cellCenter, pointAt, PATH_LENGTH } from '../src/engine/map.js';
import { getDeveloper } from '../src/engine/registry.js';

await loadModules(CONTENT_URLS);

// Rank buildable cells by how much path is in range.
function coverage(col, row, range) {
  const c = cellCenter(col, row); let n = 0;
  for (let d = 0; d < PATH_LENGTH; d += 4) { const p = pointAt(d); if (Math.hypot(p.x - c.x, p.y - c.y) <= range) n++; }
  return n;
}
const cells = [];
for (let c = 0; c < 16; c++) for (let r = 0; r < 8; r++) if (isBuildable(c, r)) cells.push({ c, r, cov: coverage(c, r, 2.2 * 40) });
cells.sort((a, b) => b.cov - a.cov);

function play(strategy, usePowers) {
  const g = createGame(); startGame(g);
  const order = strategy;
  let i = 0;
  const buy = () => {
    while (true) {
      const type = order[i % order.length];
      if (g.warrants < getDeveloper(type).cost) return;
      const cell = cells.find(x => !g.devs.some(d => d.col === x.c && d.row === x.r));
      if (!cell) return;
      placeDev(g, type, cell.c, cell.r); i++;
    }
  };
  buy(); startWave(g);
  let t = 0;
  while (!['won', 'lost'].includes(g.phase) && t < 3600) {
    step(g, 0.05); t += 0.05;
    if (usePowers && g.phase === 'wave') { for (const p of ['ceo', 'business', 'training']) usePowerup(g, p); if (g.bugs.length > 40) usePowerup(g, 'claude'); }
    if (g.phase === 'bell') { buy(); ringBell(g); }
  }
  return `${g.phase.padEnd(4)} wave ${g.wave + 1} lives ${g.lives} devs ${g.devs.length} warrants ${g.warrants} seniors ${g.stats.seniors}`;
}

for (const [name, s] of [['react only', ['react']], ['java only', ['java']], ['mixed', ['react', 'java', 'react', 'dotnet']], ['dotnet only', ['dotnet']]]) {
  console.log(name.padEnd(12), 'no powers :', play(s, false));
  console.log(name.padEnd(12), 'powers    :', play(s, true));
}
