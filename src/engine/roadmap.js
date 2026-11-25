// The year roadmap in the top bar: 4 quarters of 7 sprints, what's done, what's now and what's next.
// Pure: reads the game, returns what to draw.
import { sprintInfo, waveProgress, SPRINTS_PER_QUARTER, QUARTERS_PER_YEAR } from './game.js';

export function roadmapModel(game) {
  const { year, quarter, sprint } = sprintInfo(game.sprint);
  const inSprint = game.phase === 'wave';
  const quarters = [];
  for (let q = 1; q <= QUARTERS_PER_YEAR; q++) {
    const state = q < quarter ? 'past' : q === quarter ? 'current' : 'future';
    const sprints = [];
    for (let s = 1; s <= SPRINTS_PER_QUARTER; s++) {
      if (state === 'past' || (state === 'current' && s < sprint)) sprints.push('done');
      else if (state === 'current' && s === sprint) sprints.push('now');
      else sprints.push('todo');
    }
    quarters.push({ label: `Q${q}`, state, sprints });
  }
  let right, nowFill = 0;
  if (inSprint) {
    const { done, total } = waveProgress(game);
    right = `${done} / ${total} bugs`;
    nowFill = total ? done / total : 0;
  } else {
    const left = SPRINTS_PER_QUARTER - sprint + 1;
    right = `${left} sprint${left === 1 ? '' : 's'} to quarter review`;
  }
  return { year, quarter, sprint, quarters, nowFill, right };
}
