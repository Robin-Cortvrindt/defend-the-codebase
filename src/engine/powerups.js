// Power-up timers, cooldowns and activation. Each power-up is its own content file.
import { getPowerup, getPowerups } from './registry.js';
import { emit } from './events.js';

export function powerupState(game, id) {
  if (!game.powerups[id]) game.powerups[id] = { active: false, remaining: 0, cooldownLeft: 0, uses: 0 };
  return game.powerups[id];
}

// Permanent bonuses from investments: cooldown multiplier and effect level.
export function powerupMod(game, id) {
  if (!game.powerupMods) game.powerupMods = {};
  if (!game.powerupMods[id]) game.powerupMods[id] = { cooldown: 1, effect: 0 };
  return game.powerupMods[id];
}

export function effectiveCooldown(game, id) {
  return (getPowerup(id)?.cooldown || 0) * powerupMod(game, id).cooldown;
}

// Content hooks are guarded: a broken power-up becomes unusable instead of crashing the game.
function safe(id, fn, fallback) {
  try { return fn(); } catch (e) { console.error(`[powerup ${id}]`, e); return fallback; }
}

export function canUse(game, id) {
  const def = getPowerup(id);
  if (!def || game.phase !== 'wave') return false;
  const st = powerupState(game, id);
  if (st.active) return false;
  if (st.cooldownLeft > 0 && !safe(id, () => def.skipCooldown?.(game), false)) return false;
  if (def.canActivate && !safe(id, () => def.canActivate(game), false)) return false;
  return true;
}

export function usePowerup(game, id) {
  if (!canUse(game, id)) return false;
  const def = getPowerup(id);
  const st = powerupState(game, id);
  const skippedCooldown = st.cooldownLeft > 0;
  st.uses++;
  const duration = def.duration || 0;
  if (duration > 0) { st.active = true; st.remaining = duration; }
  else st.cooldownLeft = effectiveCooldown(game, id);
  try { def.activate(game, st); } catch (e) { console.error(`[powerup ${id}]`, e); }
  emit('powerup:activated', { game, id, skippedCooldown });
  return true;
}

export function tickPowerups(game, dt) {
  for (const def of getPowerups()) {
    const st = powerupState(game, def.id);
    if (st.active) {
      st.remaining -= dt;
      if (st.remaining <= 0) {
        const overflow = -st.remaining;
        st.active = false; st.remaining = 0;
        st.cooldownLeft = Math.max(0, effectiveCooldown(game, def.id) - overflow);
        try { def.deactivate?.(game, st); } catch (e) { console.error(`[powerup ${def.id}]`, e); }
      }
    } else if (st.cooldownLeft > 0) {
      st.cooldownLeft = Math.max(0, st.cooldownLeft - dt);
    }
  }
}
