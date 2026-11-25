// Trojan horse summon: at the victory bell (or the quarter-review bell) the player can pay a big price in every
// drink to let a Trojan horse into the next sprint. The horse itself lives in bugs/trojan-horse.js.
// Spec: docs/superpowers/specs/2026-11-25-trojan-horse-design.md
import { registerFeature, getDrinks } from '../../engine/registry.js';
import { on, emit } from '../../engine/events.js';
import { BOSS_DELAY, getSprintDef } from '../../engine/game.js';
import { canAfford, spendDrink } from '../../engine/drinks.js';
import { TROJAN_ID, trojanPrice } from '../bugs/trojan-horse.js';

const BELL_PHASES = ['bell', 'review'];

// The sprint the horse would appear in is the next one, which `game.sprint` already points at while at the bell.
const priceNow = game => trojanPrice(game.sprint);

export function canSummon(game) {
  if (!BELL_PHASES.includes(game.phase) || game.pendingYearReview || game.trojan) return false;
  const price = priceNow(game);
  return getDrinks().every(d => canAfford(game, d.id, price));
}

// Pays the price in every drink and books the horse for the next sprint. No refund.
export function summonTrojan(game) {
  if (!canSummon(game)) return false;
  const price = priceNow(game);
  for (const d of getDrinks()) spendDrink(game, d.id, price);
  game.trojan = { sprint: game.sprint, price };
  emit('trojan:summoned', { game, sprint: game.sprint, price });
  return true;
}

// When the booked sprint starts, the horse walks in BOSS_DELAY seconds after the sprint's boss.
export function attachListeners() {
  on('sprint:start', ({ game }) => {
    if (!game?.trojan || game.trojan.sprint !== game.sprint) return;
    const q = game.spawnQueue;
    const boss = getSprintDef(game.sprint)?.boss;
    const anchor = q.filter(s => s.bug === boss).at(-1) ?? q.at(-1);
    q.push({ t: (anchor?.t ?? 0) + BOSS_DELAY, bug: TROJAN_ID });
    q.sort((a, b) => a.t - b.t);
    delete game.trojan;
  });
}
attachListeners();

const feature = {
  id: 'trojan-horse',
  bellActions: [{
    id: 'summon',
    label: game => (game.trojan ? 'Trojan horse incoming' : 'Let the Trojan horse in'),
    hint: () => '3× the security risk · squash it for 2× back · if it gets in, production is down',
    cost: game => (game.trojan ? null : Object.fromEntries(getDrinks().map(d => [d.id, priceNow(game)]))),
    enabled: canSummon,
    onClick: summonTrojan,
  }],
};

registerFeature(feature);
export default feature;
