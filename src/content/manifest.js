// Every content file the game loads. To add something: create one file, add one line here.
// A file that fails to load is skipped (see the browser console), so it can't break the game.
export const CONTENT = [
  // Developers (towers)
  './developers/react.js',
  './developers/java.js',
  './developers/dotnet.js',
  // Bugs (enemies)
  './bugs/typo.js',
  './bugs/nullpointer.js',
  './bugs/legacy.js',
  // Waves
  './waves.js',
  // Power-ups
  // Features (teammates' add-ons, Nexios references, ...)
];

export const CONTENT_URLS = CONTENT.map(p => new URL(p, import.meta.url).href);
