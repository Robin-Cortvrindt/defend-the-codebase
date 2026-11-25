// Trojan horse: a boss the player pays to let in at the victory bell (see features/trojan-horse.js).
// 3× the security risk, no counter, Claude can't touch it, and if it reaches the building production is down at once.
// Squash it and it bursts open: 2× the price paid, scattered over the map in many small drops.
// Spec: docs/superpowers/specs/2026-11-25-trojan-horse-design.md
import { registerBug, getDrinks } from '../../engine/registry.js';
import { addEffect } from '../../engine/game.js';
import { placeDrop, DROP_TTL } from '../../engine/drops.js';
import { WIDTH, HEIGHT } from '../../engine/map.js';

export const TROJAN_ID = 'trojan-horse';
export const BASE_PRICE = 100;      // per drink, for the very first sprint
export const PRICE_GROWTH = 0.1;    // +10% of the base per sprint
export const LOOT_FACTOR = 2;       // the jackpot pays back 2× the price
export const PIECES = 10;           // jackpot drops per drink
export const MIN_THROW = 40;        // px
export const MAX_THROW = 260;       // px
export const EXTRA_TTL = 5;         // s: the farthest-thrown loot lives this much longer
const EDGE = 16;                    // keep loot this far inside the map
const BOSS_DROP = 1;                // dropDrinks already leaves 1 of each drink for a boss with reward 0

const WOOD = '#A16207', WOOD_DARK = '#713F12', WOOD_LIGHT = '#CA8A04', GOLD = '#FACC15';

// Price per drink for a horse that appears in the 0-based global sprint `sprint`.
export const trojanPrice = sprint => Math.round(BASE_PRICE * (1 + PRICE_GROWTH * sprint));

// Jackpot per drink (everything the horse leaves of that drink) for a horse in `sprint`.
export const trojanLoot = (sprint, drinkMultiplier = 1) => Math.round(LOOT_FACTOR * trojanPrice(sprint) * drinkMultiplier);

// Splits `total` into `n` whole parts that differ by at most 1.
const split = (total, n) => Array.from({ length: n }, (_, i) => Math.floor(total / n) + (i < total % n ? 1 : 0));

// Throws the jackpot out of the horse to random spots on the map; farther drops live longer.
export function scatterLoot(game, bug) {
  const drops = [];
  const loot = trojanLoot(game.sprint, game.mods.drinkMultiplier);
  for (const d of getDrinks()) {
    const jackpot = loot - BOSS_DROP;
    if (jackpot <= 0) continue;
    for (const amount of split(jackpot, Math.min(PIECES, jackpot))) {
      const angle = game.random() * Math.PI * 2;
      const dist = MIN_THROW + game.random() * (MAX_THROW - MIN_THROW);
      const x = Math.min(WIDTH - EDGE, Math.max(EDGE, bug.x + Math.cos(angle) * dist));
      const y = Math.min(HEIGHT - EDGE, Math.max(EDGE, bug.y + Math.sin(angle) * dist));
      drops.push(placeDrop(game, { x, y, drink: d.id, amount, ttl: DROP_TTL + EXTRA_TTL * dist / MAX_THROW }));
    }
  }
  return drops;
}

const horse = {
  id: TROJAN_ID,
  name: 'Trojan horse',
  boss: true,
  claudeImmune: true,
  ring: WOOD,
  radius: 20,
  hp: 900,
  speed: 22,
  livesLost: Infinity,
  reward: 0,
  update(bug, game) {
    if (bug.announced) return;
    bug.announced = true;
    addEffect(game, { kind: 'pop', x: bug.x, y: bug.y - 30, text: 'TROJAN HORSE!', color: WOOD_LIGHT, size: 15, ttl: 1.5 });
  },
  onDeath(bug, game) {
    scatterLoot(game, bug);
    addEffect(game, { kind: 'flash', ttl: 0.35 });
    addEffect(game, { kind: 'ring', x: bug.x, y: bug.y, radius: 60, color: GOLD, ttl: 0.6 });
    addEffect(game, { kind: 'ring', x: bug.x, y: bug.y, radius: 110, color: WOOD_LIGHT, ttl: 0.9 });
    addEffect(game, { kind: 'pop', x: bug.x, y: bug.y - 30, text: 'JACKPOT!', color: GOLD, size: 18, ttl: 1.5 });
  },
  // A wooden horse on wheels seen from above, facing +x, with a pulsing golden alarm ring.
  draw(ctx, r, bug, time) {
    const s = r / 20;
    ctx.save(); ctx.scale(s, s);
    const p = (time * 1.1) % 1;
    ctx.globalAlpha = 0.5 * (1 - p); ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 24 + p * 14, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // wheels, rolling
    const spin = (bug?.distance ?? time * 22) * 0.3;
    ctx.fillStyle = '#292524';
    for (const [wx, wy] of [[-13, -13], [11, -13], [-13, 13], [11, 13]]) {
      ctx.fillRect(wx - 5, wy - 2.5, 10, 5);
      ctx.strokeStyle = '#78716C'; ctx.lineWidth = 1;
      const o = (spin % 1) * 10 - 5;
      ctx.beginPath(); ctx.moveTo(wx + o, wy - 2.5); ctx.lineTo(wx + o, wy + 2.5); ctx.stroke();
    }
    // platform
    ctx.fillStyle = WOOD_DARK; ctx.fillRect(-18, -11, 34, 22);
    // body with planks
    ctx.fillStyle = WOOD; ctx.beginPath(); ctx.ellipse(-2, 0, 15, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = WOOD_DARK; ctx.lineWidth = 1;
    for (const px of [-10, -4, 2, 8]) { ctx.beginPath(); ctx.moveTo(px, -7); ctx.lineTo(px, 7); ctx.stroke(); }
    // tail
    ctx.strokeStyle = WOOD_LIGHT; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.quadraticCurveTo(-22, 4, -24, 0); ctx.stroke();
    // neck and head
    ctx.fillStyle = WOOD_LIGHT;
    ctx.beginPath(); ctx.moveTo(8, -4); ctx.lineTo(18, -3); ctx.lineTo(18, 3); ctx.lineTo(8, 4); ctx.fill();
    ctx.beginPath(); ctx.ellipse(21, 0, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = WOOD_DARK; // ears and mane
    ctx.beginPath(); ctx.moveTo(18, -4); ctx.lineTo(16, -8); ctx.lineTo(20, -5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18, 4); ctx.lineTo(16, 8); ctx.lineTo(20, 5); ctx.fill();
    ctx.fillRect(8, -1, 10, 2);
    // hatch on its back, hiding the loot
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5; ctx.strokeRect(-7, -4, 8, 8);
    ctx.restore();
  },
  drawIcon(ctx, r) {
    const s = r / 20;
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = WOOD; ctx.beginPath(); ctx.ellipse(-3, 2, 12, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = WOOD_LIGHT; ctx.beginPath(); ctx.ellipse(11, -7, 6, 5, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(4, -6, 6, 6);
    ctx.fillStyle = '#292524';
    for (const wx of [-10, 4]) { ctx.beginPath(); ctx.arc(wx, 11, 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  },
};

registerBug(horse);
export default horse;
