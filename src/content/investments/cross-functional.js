// Unlock: Cross-functional team.
// While the map has as many React as Java as .NET developers (at least one of each: 1-1-1, 2-2-2, ...),
// the whole team is more productive: every developer attacks 25% faster. Checked every frame, so hiring
// or selling switches it on or off right away. Built like security-training.js: one investment + one feature.
import { registerInvestment, registerFeature } from '../../engine/registry.js';
import { addEffect } from '../../engine/game.js';
import { pctText } from '../../engine/effects.js';

export const BALANCED_BONUS = 1.25;
const TYPES = ['react', 'java', 'dotnet'];
const GREEN = '#16A34A';

const investment = {
  id: 'cross-functional',
  name: 'Cross-functional team',
  description: 'Equal React, Java and .NET developers: +25% attack speed for everyone',
  group: 'unlocks',
  maxLevel: 1,
  getCost() { return 40; },
  apply(game) { game.unlocks.crossFunctional = true; },
  describeEffect(game) { return isBalanced(game) ? { group: 'team', text: `attack speed ${pctText(BALANCED_BONUS)}` } : null; },
  effectText() { return 'Balanced team: +25% productivity'; },
};

export function teamCounts(game) {
  const counts = Object.fromEntries(TYPES.map(t => [t, 0]));
  for (const d of game.devs) if (d.type in counts) counts[d.type]++;
  return counts;
}

export function isBalanced(game) {
  const { react, java, dotnet } = teamCounts(game);
  return react > 0 && react === java && java === dotnet;
}

export const crossFunctionalFeature = {
  id: 'cross-functional',
  update(game) {
    if (!game.unlocks?.crossFunctional) return;
    const on = isBalanced(game);
    if (on && !game.crossFunctionalFactor) {
      // Remember the factor so switching off removes exactly what was added (stacks with CEO, heating out).
      game.crossFunctionalFactor = BALANCED_BONUS;
      game.mods.fireRateMultiplier *= BALANCED_BONUS;
      addEffect(game, { kind: 'banner', title: 'Balanced team', text: '+25% productivity for every developer', accent: GREEN, ttl: 2 });
    } else if (!on && game.crossFunctionalFactor) {
      game.mods.fireRateMultiplier /= game.crossFunctionalFactor;
      game.crossFunctionalFactor = 0;
    }
  },
  // A badge in the top-left corner of the map, and a green outline on every developer while balanced.
  draw(ctx, game) {
    if (!game.unlocks?.crossFunctional || game.phase === 'menu') return;
    const on = !!game.crossFunctionalFactor;
    const { react, java, dotnet } = teamCounts(game);
    const text = on ? 'Balanced team · +25% productivity' : `Team ${react} / ${java} / ${dotnet}`;
    ctx.font = '700 10px Lato, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 14;
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = on ? GREEN : '#475569';
    ctx.fillRect(6, 6, w, 18);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 13, 15.5);
    if (!on) return;
    ctx.strokeStyle = GREEN;
    ctx.lineWidth = 1.5;
    for (const d of game.devs) ctx.strokeRect(d.x - 18, d.y - 18, 36, 36);
  },
};

registerInvestment(investment);
registerFeature(crossFunctionalFeature);
export default investment;
