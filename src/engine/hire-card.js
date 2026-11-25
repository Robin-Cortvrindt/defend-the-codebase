// Content of the hover card on a hire button: which bug the developer is strong against, plus the hotkey.
import { getBug } from './registry.js';

export function hireCardInfo(def, index) {
  const bug = def.counters ? getBug(def.counters) : null;
  return {
    strong: bug ? { name: bug.name, ring: bug.ring } : null,
    hotkey: `Hotkey ${index + 1}`,
  };
}
