// Power-up timers, cooldowns and activation. Each power-up is its own content file.
import { getPowerup, getPowerups } from './registry.js';
import { emit } from './events.js';

export function powerupState(game, id) {
  if (!game.powerups[id]) game.powerups[id] = { active: false, remaining: 0, cooldownLeft: 0, uses: 0 };
  return game.powerups[id];
}

export function powerupCost(game, id) {
  return getPowerup(id)?.getCost?.(game) ?? 0;
}

export function canUse(game, id) {
  const def = getPowerup(id);
  if (!def || game.phase !== 'wave') return false;
  const st = powerupState(game, id);
  if (st.active || st.cooldownLeft > 0) return false;
  if (def.canActivate && !def.canActivate(game)) return false;
  return game.warrants >= powerupCost(game, id);
}

export function usePowerup(game, id) {
  if (!canUse(game, id)) return false;
  const def = getPowerup(id);
  const st = powerupState(game, id);
  game.warrants -= powerupCost(game, id);
  st.uses++;
  const duration = def.duration || 0;
  if (duration > 0) { st.active = true; st.remaining = duration; }
  else st.cooldownLeft = def.cooldown || 0;
  try { def.activate(game, st); } catch (e) { console.error(`[powerup ${id}]`, e); }
  emit('powerup:activated', { game, id });
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
        st.cooldownLeft = Math.max(0, (def.cooldown || 0) - overflow);
        try { def.deactivate?.(game, st); } catch (e) { console.error(`[powerup ${def.id}]`, e); }
      }
    } else if (st.cooldownLeft > 0) {
      st.cooldownLeft = Math.max(0, st.cooldownLeft - dt);
    }
  }
}
