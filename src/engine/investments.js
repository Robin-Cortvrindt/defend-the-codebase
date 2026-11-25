// Investments: permanent upgrades bought between runs with Investor Capital.
// After a loss, new investors pay out based on how far the run got. Progress lives in
// localStorage in the browser and in memory in Node, so this module stays testable.
import { getInvestments, getInvestment } from './registry.js';
import { emit } from './events.js';

export const CAPITAL_KEY = 'dtc-investments';
const SPRINTS_PER_QUARTER = 7;
const SPRINTS_PER_YEAR = 28;

function memoryStore() {
  const data = new Map();
  return {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: k => { data.delete(k); },
  };
}

function defaultStore() {
  try {
    const ls = globalThis.localStorage;
    if (ls) { ls.getItem(CAPITAL_KEY); return ls; }
  } catch { /* storage blocked */ }
  return memoryStore();
}

let store = defaultStore();

// null = a fresh in-memory store (tests, or storage unavailable).
export function setStorage(storage) { store = storage ?? memoryStore(); }

export function loadProgress() {
  let raw = null;
  try { raw = JSON.parse(store.getItem(CAPITAL_KEY)); } catch { raw = null; }
  const capital = Number(raw?.capital);
  const levels = {};
  const src = raw?.levels && typeof raw.levels === 'object' ? raw.levels : {};
  for (const [id, v] of Object.entries(src)) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n <= 0) continue;
    const max = getInvestment(id)?.maxLevel ?? Infinity;
    levels[id] = Math.min(n, max);
  }
  return { capital: Number.isFinite(capital) && capital > 0 ? capital : 0, levels };
}

export function saveProgress(progress) {
  try { store.setItem(CAPITAL_KEY, JSON.stringify(progress)); } catch { /* storage full or blocked */ }
}

export const investmentLevel = id => loadProgress().levels[id] || 0;

export function investmentCost(id) {
  const def = getInvestment(id);
  if (!def) return Infinity;
  const level = investmentLevel(id);
  if (level >= (def.maxLevel ?? Infinity)) return Infinity;
  try {
    const cost = Number(def.getCost(level));
    return Number.isFinite(cost) ? cost : Infinity;
  } catch (e) { console.error(`[investment ${id}]`, e); return Infinity; }
}

export const canInvest = id => loadProgress().capital >= investmentCost(id);

export function invest(id) {
  if (!canInvest(id)) return false;
  const p = loadProgress();
  p.capital -= investmentCost(id);
  p.levels[id] = (p.levels[id] || 0) + 1;
  saveProgress(p);
  emit('investment:bought', { id, level: p.levels[id] });
  return true;
}

// Investors pay 1 per sprint survived, 5 more per quarter and 15 more per year.
export function capitalFor(sprint) {
  const s = Math.max(0, Math.floor(sprint || 0));
  return s + 5 * Math.floor(s / SPRINTS_PER_QUARTER) + 15 * Math.floor(s / SPRINTS_PER_YEAR);
}

// Paid once per game; later calls return the same amount without paying again.
export function awardCapital(game) {
  if (game.capitalEarned != null) return game.capitalEarned;
  const amount = capitalFor(game.sprint);
  const p = loadProgress();
  p.capital += amount;
  saveProgress(p);
  game.capitalEarned = amount;
  return amount;
}

// Called from startGame: every owned investment applies its bonus once per run.
export function applyInvestments(game) {
  if (game.investmentsApplied) return;
  game.investmentsApplied = true;
  const { levels } = loadProgress();
  for (const def of getInvestments()) {
    const level = levels[def.id] || 0;
    if (level <= 0) continue;
    try { def.apply(game, level); } catch (e) { console.error(`[investment ${def.id}]`, e); }
  }
}

export function resetProgress() { saveProgress({ capital: 0, levels: {} }); }
