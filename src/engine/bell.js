// Actions that features add to the victory bell (and the quarter-review bell): choices made between sprints.
// A feature declares them as `bellActions: [{ id, label(game), hint?(game), cost?(game), enabled(game), onClick(game) }]`.
import { getFeatures } from './registry.js';

const BELL_PHASES = ['bell', 'review'];

// What a bell action's button shows right now. The UI reads this every frame, so the button follows the drinks
// (e.g. boss drops picked up at the bell). A callback that throws falls back to a safe value: a broken action is disabled.
export function bellActionView(game, action) {
  const call = (fn, fallback, missing = fallback) => {
    if (typeof fn !== 'function') return missing;
    try { return fn(game); } catch (e) { console.error(`[bell action ${action.id}]`, e); return fallback; }
  };
  return {
    label: call(action.label, action.id),
    hint: call(action.hint, ''),
    cost: call(action.cost, null),
    enabled: !!call(action.enabled, false, true),
  };
}

// Every feature's bell actions, in registry order. Empty outside the bell and while the yearly review is open.
export function getBellActions(game) {
  if (!BELL_PHASES.includes(game.phase) || game.pendingYearReview) return [];
  const out = [];
  for (const f of getFeatures()) {
    if (!Array.isArray(f.bellActions)) continue;
    for (const action of f.bellActions) out.push({ feature: f.id, action });
  }
  return out;
}
