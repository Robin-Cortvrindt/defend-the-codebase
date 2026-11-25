// Actions that features add to the victory bell (and the quarter-review bell): choices made between sprints.
// A feature declares them as `bellActions: [{ id, label(game), hint?(game), cost?(game), enabled(game), onClick(game) }]`.
import { getFeatures } from './registry.js';

const BELL_PHASES = ['bell', 'review'];

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
