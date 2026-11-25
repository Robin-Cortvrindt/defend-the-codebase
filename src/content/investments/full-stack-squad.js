// Unlock: Full-stack squad.
// A React developer with a Java developer AND a .NET developer directly next to it (above, below,
// left or right; diagonals don't count) reuses its components: every hit also bounces to the
// nearest other bug close by, for half damage. Checked on every hit, so hiring or selling a
// neighbour switches it on or off right away. Built like security-training.js: one investment + one feature.
import { registerInvestment, registerFeature, getDeveloper } from '../../engine/registry.js';
import { on } from '../../engine/events.js';
import { killBug } from '../../engine/game.js';
import { devStats, grantXp, addAttack } from '../../engine/devs.js';
import { CELL } from '../../engine/map.js';

export const BOUNCE_RANGE = 1.5 * CELL;   // px, measured from the bug that was hit
export const BOUNCE_FACTOR = 0.5;
const OUTLINE = '#60A5FA';

const investment = {
  id: 'full-stack-squad',
  name: 'Full-stack squad',
  description: 'A React developer with a Java and a .NET developer directly above, below, left or right: its hits bounce to a second bug',
  group: 'unlocks',
  maxLevel: 1,
  getCost() { return 40; },
  apply(game) { game.unlocks.fullStackSquad = true; },
  describeEffect(game, dev) { return isSquadReact(game, dev) ? { group: 'team', text: `hits bounce to a second bug for ${Math.round(BOUNCE_FACTOR * 100)}%` } : null; },
  effectText() { return 'React next to Java + .NET: hits bounce for 50%'; },
};

export function isSquadReact(game, dev) {
  if (dev.type !== 'react') return false;
  const neighbours = game.devs.filter(d => Math.abs(d.col - dev.col) + Math.abs(d.row - dev.row) === 1);
  return neighbours.some(d => d.type === 'java') && neighbours.some(d => d.type === 'dotnet');
}

// Subscribed at the top level (CONTRIBUTING rule). The bounce deals damage directly, so it never emits dev:hit again.
on('dev:hit', ({ game, dev, bug }) => {
  if (!game.unlocks?.fullStackSquad || !isSquadReact(game, dev)) return;
  let next = null, best = BOUNCE_RANGE;
  for (const b of game.bugs) {
    if (b === bug || b.dead) continue;
    const d = Math.hypot(b.x - bug.x, b.y - bug.y);
    if (d <= best) { best = d; next = b; }
  }
  if (!next) return;
  const def = getDeveloper(dev.type);
  const counter = next.type === def?.counters;
  next.hp -= devStats(game, dev).damage * BOUNCE_FACTOR * (counter ? 2 : 1);
  addAttack(game, dev, { x: bug.x, y: bug.y }, next);   // the developer's own attack look, bug to bug
  if (next.hp <= 0) {
    killBug(game, next, dev);
    dev.kills++;
    grantXp(game, dev, 1);
  }
});

export const fullStackSquadFeature = {
  id: 'full-stack-squad',
  // A thin outline marks every React developer whose hits bounce.
  draw(ctx, game) {
    if (!game.unlocks?.fullStackSquad) return;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 1.5;
    for (const d of game.devs) if (isSquadReact(game, d)) ctx.strokeRect(d.x - 18, d.y - 18, 36, 36);
  },
};

registerInvestment(investment);
registerFeature(fullStackSquadFeature);
export default investment;
