// Game state and the simulation step. No DOM in here, so it can be tested in Node.
import { getBug, getWaves, getFeatures } from './registry.js';
import { emit } from './events.js';
import { pointAt, PATH_LENGTH } from './map.js';
import { tickDevs } from './devs.js';
import { tickPowerups } from './powerups.js';
import { rollEvent, endEvent } from './random-events.js';
import { applyInvestments } from './investments.js';
import { startingDrinks, addEachDrink, eachShare } from './drinks.js';
import { payKill } from './drops.js';

export const START_LIVES = 20;
export const BOSS_DELAY = 3;    // seconds between the last regular bug and the boss
export const DEATH_ANIM = 3.6;  // seconds the building burns and collapses before the game-over screen

// True once the collapse animation has finished playing (the game-over screen waits for it).
export const deathAnimDone = game => game.phase === 'lost' && game.deathTime >= DEATH_ANIM;

export function createGame() {
  return {
    phase: 'menu',            // menu | building | wave | bell | review | lost  (won is no longer reached)
    sprint: 0,                // global index of the current (or next) sprint, 0-based
    get wave() { return this.sprint; },      // old name, kept so existing code and features keep working
    set wave(v) { this.sprint = v; },
    coins: 0,                 // Nexios Coins, earned per sprint, spent in the quarter review
    pendingYearReview: false,
    lastYearReview: null,     // 'accepted' | 'approved' | 'denied' after the latest yearly review
    floors: 1,                // Nexios building floors (upgrade)
    heatResistance: 0,        // 0..1, set by the air-conditioning upgrade (old name, same as resistance['heat-wave'])
    resistance: {},           // event id -> 0..1, set by counter-upgrades; each event scales its effect by (1 - resistance)
    raise: 1,                 // total yearly-review Warrant multiplier
    upgrades: {},
    unlocks: {},              // mechanics unlocked by investments, e.g. unlocks.firewall
    powerupMods: {},          // per power-up investment bonuses, see powerupMod() in powerups.js
    investmentsApplied: false,
    capitalEarned: null,      // Investor Capital paid out when this run was lost
    quarterStats: { squashed: 0, leaked: 0 },
    drinks: startingDrinks(),
    lives: START_LIVES,
    maxLives: START_LIVES,
    bugs: [],
    devs: [],
    effects: [],
    spawnQueue: [],
    waveTime: 0,
    deathTime: 0,             // seconds since production went down (drives the collapse animation)
    mods: {
      xpMultiplier: 1, drinkMultiplier: 1, fireRateMultiplier: 1,
      damageMultiplier: 1, bugSpeedMultiplier: 1, rangeMultiplier: 1,
      timeScale: 1, devFireRate: {}, devCostMultiplier: 1,
    },
    powerups: {},
    activeEvent: null,        // id of the random event running this wave
    stats: { squashed: 0, drinksCollected: 0, seniors: 0, backfires: 0 },
    time: 0,
    nextId: 1,
    random: Math.random,
  };
}

export const totalWaves = () => getWaves().length;
export const SPRINTS_PER_QUARTER = 7;
export const QUARTERS_PER_YEAR = 4;

// Global sprint index (0-based) -> calendar position.
export function sprintInfo(n) {
  const quarterIndex = Math.floor(n / SPRINTS_PER_QUARTER);
  const sprint = (n % SPRINTS_PER_QUARTER) + 1;
  const quarter = (quarterIndex % QUARTERS_PER_YEAR) + 1;
  const year = Math.floor(quarterIndex / QUARTERS_PER_YEAR) + 1;
  return { year, quarter, sprint, quarterIndex, label: `Year ${year} · Q${quarter} · Sprint ${sprint} / ${SPRINTS_PER_QUARTER}` };
}

// Hand-made sprints come from waves.js; after those the game keeps generating harder ones.
export function getSprintDef(n) {
  const waves = getWaves();
  if (!waves.length) return null;
  if (n < waves.length) return waves[n];
  const last = waves[waves.length - 1];
  const k = n - (waves.length - 1);
  return {
    hp: (last.hp ?? 1) * 1.05 ** k,
    boss: last.boss,
    groups: last.groups.map(g => ({
      ...g,
      count: Math.max(1, Math.round(g.count * (1 + 0.05 * k))),
      interval: Math.max(0.12, (g.interval || 1) * 0.97 ** k),
    })),
  };
}

export function startGame(game) {
  game.phase = 'building';
  applyInvestments(game);
  emit('game:start', { game });
}

export function startWave(game) {
  if (game.phase !== 'building' && game.phase !== 'bell' && game.phase !== 'review') return false;
  if (game.pendingYearReview) return false;
  const wave = getSprintDef(game.sprint);
  if (!wave) return false;
  const queue = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) queue.push({ t: (g.delay || 0) + i * (g.interval || 1), bug: g.bug });
  }
  queue.sort((a, b) => a.t - b.t);
  // The boss (if the sprint has one) walks in a few seconds after the last regular bug.
  if (wave.boss) queue.push({ t: (queue.at(-1)?.t ?? 0) + BOSS_DELAY, bug: wave.boss });
  game.spawnQueue = queue;
  game.waveTime = 0;
  game.phase = 'wave';
  if (game.sprint % SPRINTS_PER_QUARTER === 0) game.quarterStats = { squashed: 0, leaked: 0 };
  rollEvent(game);
  emit('sprint:start', { game, sprint: game.sprint + 1, info: sprintInfo(game.sprint) });
  emit('wave:start', { game, wave: game.wave + 1 });
  return true;
}

export function ringBell(game) {
  if ((game.phase !== 'bell' && game.phase !== 'review') || game.pendingYearReview) return false;
  emit('bell:rung', { game, wave: game.wave + 1 });
  return startWave(game);
}

export function spawnBug(game, bugId, distance = 0, hp) {
  const def = getBug(bugId);
  if (!def) { console.warn(`[game] unknown bug "${bugId}"`); return null; }
  const p = pointAt(distance);
  const maxHp = Math.round(def.hp * (getSprintDef(game.sprint)?.hp ?? 1));
  const bug = { id: game.nextId++, type: bugId, hp: hp ?? maxHp, maxHp, distance, x: p.x, y: p.y, slow: 1 };
  game.bugs.push(bug);
  emit('bug:spawned', { game, bug });
  return bug;
}

// Sprint bonus for the sprint with this 0-based index, and the share each drink gets.
export const sprintBonus = sprint => 20 + 5 * (sprint + 1);
export const sprintBonusEach = sprint => eachShare(sprintBonus(sprint));

export function killBug(game, bug, dev = null) {
  if (bug.dead) return;
  bug.dead = true;
  const i = game.bugs.indexOf(bug);
  if (i >= 0) game.bugs.splice(i, 1);
  const def = getBug(bug.type);
  payKill(game, def);
  game.stats.squashed++;
  game.quarterStats.squashed++;
  try { def?.onDeath?.(bug, game); } catch (e) { console.error(e); }
  emit('bug:killed', { game, bug, dev });
}

function moveBugs(game, dt) {
  for (const bug of [...game.bugs]) {
    const def = getBug(bug.type);
    try { def?.update?.(bug, game, dt); } catch (e) { console.error(e); }
    bug.distance += (def?.speed ?? 0) * game.mods.bugSpeedMultiplier * bug.slow * dt;
    const p = pointAt(bug.distance);
    bug.x = p.x; bug.y = p.y;
    if (bug.distance >= PATH_LENGTH) {
      bug.dead = true;
      game.bugs.splice(game.bugs.indexOf(bug), 1);
      const lost = Math.min(game.lives, def?.livesLost ?? 1);
      game.lives -= lost;
      game.quarterStats.leaked += lost;
      emit('bug:leaked', { game, bug });
    }
  }
}

function loseRun(game) {
  endEvent(game);
  game.phase = 'lost';
  emit('game:lost', { game, wave: game.wave + 1, sprint: game.sprint + 1, info: sprintInfo(game.sprint) });
}

// The player gives up: production goes down exactly as if the bugs had won, so investors still pay out.
export function quitRun(game) {
  if (!['building', 'wave', 'bell', 'review'].includes(game.phase)) return false;
  game.quit = true;
  game.lives = 0;
  loseRun(game);
  return true;
}

function checkEnd(game) {
  if (game.lives <= 0) { loseRun(game); return; }
  if (game.spawnQueue.length || game.bugs.length) return;
  endEvent(game);
  const info = sprintInfo(game.sprint);
  const bonus = sprintBonus(game.sprint);
  addEachDrink(game, bonus);
  game.coins += 1;
  const cleared = { game, sprint: game.sprint + 1, wave: game.sprint + 1, bonus, info };
  emit('sprint:cleared', cleared);
  emit('wave:cleared', cleared);
  game.sprint++;
  if (info.sprint === SPRINTS_PER_QUARTER) {
    game.coins += 3;
    game.pendingYearReview = info.quarter === QUARTERS_PER_YEAR;
    if (game.pendingYearReview) game.lastYearReview = null;
    game.phase = 'review';
    emit('quarter:review', { game, info, yearReview: game.pendingYearReview });
  } else {
    game.phase = 'bell';
  }
}

export function step(game, dt) {
  if (game.phase === 'menu' || game.phase === 'won' || game.phase === 'lost') {
    if (game.phase === 'lost') game.deathTime += dt;
    tickEffects(game, dt);
    return;
  }
  dt *= game.mods.timeScale ?? 1;
  game.time += dt;
  if (game.phase === 'wave') {
    game.waveTime += dt;
    while (game.spawnQueue.length && game.spawnQueue[0].t <= game.waveTime) {
      spawnBug(game, game.spawnQueue.shift().bug);
    }
    moveBugs(game, dt);
    tickDevs(game, dt);
  }
  tickPowerups(game, dt);
  tickEffects(game, dt);
  for (const f of getFeatures()) {
    try { f.update?.(game, dt); } catch (e) { console.error(`[feature ${f.id}]`, e); }
  }
  if (game.phase === 'wave') checkEnd(game);
}

function tickEffects(game, dt) {
  for (const e of game.effects) e.ttl -= dt;
  game.effects = game.effects.filter(e => e.ttl > 0);
}

// Yearly review (after every Q4): accept a safe +10%, or gamble on a raise (50% chance of +20%).
export const REVIEW_ACCEPT = 1.1;
export const REVIEW_RAISE = 1.2;
export const RAISE_CHANCE = 0.5;
export const CAO_COINS = 10;   // CAO: collective labour agreement bonus, paid in Nexios Coins with every yearly review

export function chooseYearReview(game, choice) {
  if (!game.pendingYearReview || (choice !== 'accept' && choice !== 'raise')) return null;
  game.pendingYearReview = false;
  let result, factor = 1;
  if (choice === 'accept') { result = 'accepted'; factor = REVIEW_ACCEPT; }
  else if (game.random() < RAISE_CHANCE) { result = 'approved'; factor = REVIEW_RAISE; }
  else result = 'denied';
  game.mods.drinkMultiplier *= factor;
  game.raise *= factor;
  game.lastYearReview = result;
  game.coins += CAO_COINS;
  const banners = {
    accepted: ['Yearly review', `Review accepted — Drinks +10% · CAO +${CAO_COINS} coins`, '#2563EB'],
    approved: ['Yearly review', `Raise approved — Drinks +20% · CAO +${CAO_COINS} coins`, '#16A34A'],
    denied: ['Yearly review', `Raise denied — but CAO +${CAO_COINS} coins`, '#EA580C'],
  };
  const [title, text, accent] = banners[result];
  addEffect(game, { kind: 'banner', title, text, accent, ttl: 3 });
  emit('year:review', { game, choice, result, factor });
  return result;
}

export function addEffect(game, effect) {
  game.effects.push({ age: 0, ...effect, maxTtl: effect.ttl });
}
