// Game state and the simulation step. No DOM in here, so it can be tested in Node.
import { getBug, getWaves, getFeatures } from './registry.js';
import { emit } from './events.js';
import { pointAt, PATH_LENGTH } from './map.js';
import { tickDevs } from './devs.js';
import { tickPowerups } from './powerups.js';
import { rollEvent, endEvent } from './random-events.js';

export const START_WARRANTS = 100;
export const START_LIVES = 20;

export function createGame() {
  return {
    phase: 'menu',            // menu | building | wave | bell | review | lost  (won is no longer reached)
    sprint: 0,                // global index of the current (or next) sprint, 0-based
    get wave() { return this.sprint; },      // old name, kept so existing code and features keep working
    set wave(v) { this.sprint = v; },
    coins: 0,                 // Nexios Coins, earned per sprint, spent in the quarter review
    pendingYearReview: false,
    floors: 1,                // Nexios building floors (upgrade)
    heatResistance: 0,        // 0..1, set by the air-conditioning upgrade; read by the heat wave event
    raise: 1,                 // total yearly-review Warrant multiplier
    upgrades: {},
    quarterStats: { squashed: 0, leaked: 0 },
    warrants: START_WARRANTS,
    lives: START_LIVES,
    maxLives: START_LIVES,
    bugs: [],
    devs: [],
    effects: [],
    spawnQueue: [],
    waveTime: 0,
    mods: {
      xpMultiplier: 1, warrantMultiplier: 1, fireRateMultiplier: 1,
      damageMultiplier: 1, bugSpeedMultiplier: 1, rangeMultiplier: 1,
      timeScale: 1, devFireRate: {},
    },
    powerups: {},
    activeEvent: null,        // id of the random event running this wave
    stats: { squashed: 0, warrantsEarned: 0, seniors: 0, backfires: 0 },
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
    hp: (last.hp ?? 1) * 1.15 ** k,
    groups: last.groups.map(g => ({
      ...g,
      count: Math.max(1, Math.round(g.count * (1 + 0.12 * k))),
      interval: Math.max(0.12, (g.interval || 1) * 0.97 ** k),
    })),
  };
}

export function startGame(game) {
  game.phase = 'building';
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

export function addWarrants(game, amount) {
  game.warrants += amount;
  game.stats.warrantsEarned += amount;
}

export function killBug(game, bug, dev = null) {
  if (bug.dead) return;
  bug.dead = true;
  const i = game.bugs.indexOf(bug);
  if (i >= 0) game.bugs.splice(i, 1);
  const def = getBug(bug.type);
  addWarrants(game, Math.round((def?.reward ?? 0) * game.mods.warrantMultiplier));
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

function checkEnd(game) {
  if (game.lives <= 0) {
    endEvent(game);
    game.phase = 'lost';
    emit('game:lost', { game, wave: game.wave + 1, sprint: game.sprint + 1, info: sprintInfo(game.sprint) });
    return;
  }
  if (game.spawnQueue.length || game.bugs.length) return;
  endEvent(game);
  const info = sprintInfo(game.sprint);
  const bonus = 20 + 5 * (game.sprint + 1);
  addWarrants(game, bonus);
  game.coins += 1;
  const cleared = { game, sprint: game.sprint + 1, wave: game.sprint + 1, bonus, info };
  emit('sprint:cleared', cleared);
  emit('wave:cleared', cleared);
  game.sprint++;
  if (info.sprint === SPRINTS_PER_QUARTER) {
    game.coins += 3;
    game.pendingYearReview = info.quarter === QUARTERS_PER_YEAR;
    game.phase = 'review';
    emit('quarter:review', { game, info, yearReview: game.pendingYearReview });
  } else {
    game.phase = 'bell';
  }
}

export function step(game, dt) {
  if (game.phase === 'menu' || game.phase === 'won' || game.phase === 'lost') {
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

export function chooseYearReview(game, choice) {
  if (!game.pendingYearReview || (choice !== 'accept' && choice !== 'raise')) return null;
  game.pendingYearReview = false;
  let result, factor = 1;
  if (choice === 'accept') { result = 'accepted'; factor = REVIEW_ACCEPT; }
  else if (game.random() < RAISE_CHANCE) { result = 'approved'; factor = REVIEW_RAISE; }
  else result = 'denied';
  game.mods.warrantMultiplier *= factor;
  game.raise *= factor;
  const banners = {
    accepted: ['Yearly review', 'Review accepted — Warrants +10%', '#2563EB'],
    approved: ['Yearly review', 'Raise approved — Warrants +20%', '#16A34A'],
    denied: ['Yearly review', 'Raise denied — maybe next year', '#EA580C'],
  };
  const [title, text, accent] = banners[result];
  addEffect(game, { kind: 'banner', title, text, accent, ttl: 3 });
  emit('year:review', { game, choice, result, factor });
  return result;
}

export function addEffect(game, effect) {
  game.effects.push({ age: 0, ...effect, maxTtl: effect.ttl });
}
