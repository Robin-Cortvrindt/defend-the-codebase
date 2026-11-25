// Content registry. Every developer, bug, power-up, wave list and feature registers itself here.
const developers = new Map();
const bugs = new Map();
const powerups = new Map();
const features = new Map();
const events = new Map();
const upgrades = new Map();
let waves = [];

function put(map, kind, def) {
  if (!def || !def.id) throw new Error(`[registry] ${kind} needs an id`);
  if (map.has(def.id)) {
    console.warn(`[registry] ${kind} "${def.id}" registered twice, replacing`);
    map.delete(def.id);
  }
  map.set(def.id, def);
  return def;
}

export const registerDeveloper = def => put(developers, 'developer', def);
export const registerBug = def => put(bugs, 'bug', def);
export const registerPowerup = def => put(powerups, 'powerup', def);
export const registerFeature = def => put(features, 'feature', def);
export const registerEvent = def => put(events, 'event', def);
export const registerUpgrade = def => put(upgrades, 'upgrade', def);
export function registerWaves(list) { waves = list; }

export const getDevelopers = () => [...developers.values()];
export const getDeveloper = id => developers.get(id);
export const getBugs = () => [...bugs.values()];
export const getBug = id => bugs.get(id);
export const getPowerups = () => [...powerups.values()];
export const getPowerup = id => powerups.get(id);
export const getFeatures = () => [...features.values()];
export const getWaves = () => waves;
export const getEvents = () => [...events.values()];
export const getEvent = id => events.get(id);
export const getUpgrades = () => [...upgrades.values()];
export const getUpgrade = id => upgrades.get(id);

export function resetRegistry() {
  developers.clear(); bugs.clear(); powerups.clear(); features.clear(); events.clear(); upgrades.clear(); waves = [];
}
