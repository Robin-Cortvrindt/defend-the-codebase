// Game state and the simulation step. No DOM in here, so it can be tested in Node.
import { getBug, getWaves, getFeatures } from './registry.js';
import { emit } from './events.js';
import { pointAt, PATH_LENGTH } from './map.js';
import { tickDevs } from './devs.js';
import { tickPowerups } from './powerups.js';

export const START_WARRANTS = 100;
export const START_LIVES = 20;

export function createGame() {
  return {
    phase: 'menu',            // menu | building | wave | bell | won | lost
    wave: 0,                  // index of the current (or next) wave
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
    },
    powerups: {},
    stats: { squashed: 0, warrantsEarned: 0, seniors: 0, backfires: 0 },
    time: 0,
    nextId: 1,
    random: Math.random,
  };
}

export const totalWaves = () => getWaves().length;

export function startGame(game) {
  game.phase = 'building';
  emit('game:start', { game });
}

export function startWave(game) {
  if (game.phase !== 'building' && game.phase !== 'bell') return false;
  const wave = getWaves()[game.wave];
  if (!wave) return false;
  const queue = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) queue.push({ t: (g.delay || 0) + i * (g.interval || 1), bug: g.bug });
  }
  queue.sort((a, b) => a.t - b.t);
  game.spawnQueue = queue;
  game.waveTime = 0;
  game.phase = 'wave';
  emit('wave:start', { game, wave: game.wave + 1 });
  return true;
}

export function ringBell(game) {
  if (game.phase !== 'bell') return false;
  emit('bell:rung', { game, wave: game.wave + 1 });
  return startWave(game);
}

export function spawnBug(game, bugId, distance = 0, hp) {
  const def = getBug(bugId);
  if (!def) { console.warn(`[game] unknown bug "${bugId}"`); return null; }
  const p = pointAt(distance);
  const bug = { id: game.nextId++, type: bugId, hp: hp ?? def.hp, maxHp: def.hp, distance, x: p.x, y: p.y, slow: 1 };
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
      game.lives = Math.max(0, game.lives - (def?.livesLost ?? 1));
      emit('bug:leaked', { game, bug });
    }
  }
}

function checkEnd(game) {
  if (game.lives <= 0) {
    game.phase = 'lost';
    emit('game:lost', { game, wave: game.wave + 1 });
    return;
  }
  if (game.spawnQueue.length || game.bugs.length) return;
  if (game.wave >= totalWaves() - 1) {
    game.phase = 'won';
    emit('game:won', { game });
    return;
  }
  const bonus = 20 + 5 * (game.wave + 1);
  addWarrants(game, bonus);
  emit('wave:cleared', { game, wave: game.wave + 1, bonus });
  game.wave++;
  game.phase = 'bell';
}

export function step(game, dt) {
  if (game.phase === 'menu' || game.phase === 'won' || game.phase === 'lost') {
    tickEffects(game, dt);
    return;
  }
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

export function addEffect(game, effect) {
  game.effects.push({ age: 0, ...effect, maxTtl: effect.ttl });
}
