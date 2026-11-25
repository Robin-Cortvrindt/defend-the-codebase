import { registerDeveloper } from '../../engine/registry.js';
import { addEffect, isLocked } from '../../engine/game.js';
import { bugsInRange, hitBug, shotBeam } from '../../engine/devs.js';
import { CELL } from '../../engine/map.js';
import { zigzagPoint } from '../../engine/zigzag.js';
import { spendDrink } from '../../engine/drinks.js';

// Azure Function hits every bug around its target for 3× the developer's damage (it costs White Monster).
export const AZURE_DAMAGE_MULT = 3;
export const AZURE_BILL_EVERY = 0.5;   // seconds of shooting per White Monster
const MULT_WORD = { 2: 'double', 3: 'triple' };

// .NET: slow, heavy hits and a longer range. Counters legacy bugs.
// Its attack is a lightning strike: a jagged bolt cracks into the bug with a flash and a shockwave.
const FUCHSIA = '#C026D3';
const FLICKER = 0.045;   // seconds between re-jitters of the bolt

// Small deterministic random numbers, so a frame redraws the same bolt.
function rng(seed) {
  let s = Math.floor(seed * 233280) % 233280;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280) - 0.5;
}

// A tipsy bolt (wine tasting, `zig` = the shot's seed) swerves in wide regular zags with a little jitter on top.
function bolt(ctx, from, to, rnd, alpha, zig = null) {
  const tipsy = zig != null, N = tipsy ? 18 : 9, jitter = tipsy ? 12 : 44;
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const pts = [from];
  for (let i = 1; i < N; i++) {
    const f = i / N, j = rnd() * jitter * Math.sin(Math.PI * f);
    const c = tipsy ? zigzagPoint(from, to, f, zig, 26) : { x: from.x + dx * f, y: from.y + dy * f };
    pts.push({ x: c.x + nx * j, y: c.y + ny * j });
  }
  pts.push(to);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const pass of [{ c: FUCHSIA, w: 9, a: 0.22 }, { c: FUCHSIA, w: 4, a: 0.9 }, { c: '#fff', w: 1.6, a: 1 }]) {
    ctx.globalAlpha = pass.a * alpha; ctx.strokeStyle = pass.c; ctx.lineWidth = pass.w;
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

registerDeveloper({
  id: 'dotnet',
  drink: 'monster',
  name: '.NET',
  accent: '#C026D3',
  cost: 110,
  damage: 55,
  fireRate: 0.6,
  range: 2.6,
  counters: 'legacy',
  blurb: 'Slow, heavy hits',
  levelName: '.NET Framework 4.8',
  upgrades: {
    level2: { id: 'core', name: '.NET Core', cost: 50, description: 'Faster attacks', stats: { fireRate: 0.9 } },
    level3: [
      {
        id: 'vs', name: 'Visual Studio Enterprise', kind: 'steady', cost: 70,
        description: 'Huge single hit',
        stats: { damage: 160, fireRate: 0.6 },
      },
      {
        id: 'azure', name: 'Azure Function', kind: 'gamble', cost: 100,
        description: 'Triple area damage, pay-as-you-go',
        describeEffect: (game, dev) => dev.state.azureOff ? 'off: not shooting'
          : game.drinks.monster <= 0 ? 'out of White Monster: not shooting'
          : `${MULT_WORD[AZURE_DAMAGE_MULT] ?? `${AZURE_DAMAGE_MULT}×`} area damage, 1 White Monster / ${AZURE_BILL_EVERY} s`,
        update(game, dev, dt, stats) {
          if (dev.state.azureOff) return false;
          if (bugsInRange(game, dev, stats.range).length === 0) return true;
          dev.state.bill = (dev.state.bill ?? 0) + dt;
          while (dev.state.bill >= AZURE_BILL_EVERY && spendDrink(game, 'monster', 1)) dev.state.bill -= AZURE_BILL_EVERY;
          if (game.drinks.monster <= 0) dev.state.bill = 0; // no debt while broke
          return game.drinks.monster > 0;
        },
        fire(game, dev, target, stats) {
          const { x, y } = target;
          shotBeam(game, dev, target);
          addEffect(game, { kind: 'ring', x, y, color: '#C026D3', ttl: 0.4 });
          for (const bug of bugsInRange(game, dev, stats.range + CELL)) {
            if (Math.hypot(bug.x - x, bug.y - y) <= CELL) hitBug(game, dev, bug, stats.damage * AZURE_DAMAGE_MULT);
          }
        },
        panelButtons(game, dev) {
          return [{
            label: dev.state.azureOff ? 'Azure off' : 'Azure on',
            onClick: (g, d) => { if (!isLocked(g)) d.state.azureOff = !d.state.azureOff; },
          }];
        },
      },
    ],
  },
  attackDuration: 0.28,
  attackHitAt: 0,
  attackJolt: 3,   // px the bug is knocked back, visually, when the bolt hits
  drawAttack(ctx, { from, to, progress, time, seed, tipsy }) {
    const alpha = progress < 0.15 ? 1 : 1 - (progress - 0.15) / 0.85;
    bolt(ctx, { x: from.x, y: from.y - 6 }, to, rng(seed + Math.floor(time / FLICKER) * 0.137), alpha, tipsy ? seed : null);
    // white flash and an expanding shockwave ring at the bug
    ctx.globalAlpha = alpha * 0.6; ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(to.x, to.y, 16 * alpha, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1 - progress; ctx.strokeStyle = FUCHSIA; ctx.lineWidth = 3 * (1 - progress) + 1;
    ctx.beginPath(); ctx.arc(to.x, to.y, 10 + progress * 22, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  },
  drawIcon(ctx, size) {
    const s = size / 36;
    ctx.save();
    ctx.scale(s, s);
    ctx.fillStyle = '#fff';
    ctx.font = '900 13px Lato, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('.NET', 0, 1);
    ctx.restore();
  },
});
