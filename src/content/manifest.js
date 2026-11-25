// Every content file the game loads. To add something: create one file, add one line here.
// A file that fails to load is skipped (see the browser console), so it can't break the game.
export const CONTENT = [
  // Drinks (currencies, one per developer)
  './drinks/coffee.js',
  './drinks/monster.js',
  './drinks/redbull.js',
  // Developers (towers)
  './developers/react.js',
  './developers/java.js',
  './developers/dotnet.js',
  // Bugs (enemies)
  './bugs/typo.js',
  './bugs/nullpointer.js',
  './bugs/legacy.js',
  './bugs/merge-conflict.js', // splits in two when squashed
  './bugs/memory-leak.js',    // grows the longer it lives
  './bugs/security-risk.js', // boss at the end of every sprint
  // Waves
  './waves.js',
  // Power-ups
  './powerups/training-manager.js',
  './powerups/business-manager.js',
  './powerups/ceo.js',
  './powerups/claude.js',
  // Random events (one may hit at the start of a wave)
  './events/prod-down.js',
  './events/heating-out.js',
  './events/no-coffee.js',
  './events/no-redbull.js',
  './events/heat-wave.js',
  './events/wine-tasting.js',  // developers shoot random bugs; zigzag shots
  // Building upgrades (quarter review shop)
  './upgrades/floor.js',
  './upgrades/aircon.js',
  './upgrades/heating.js',
  './upgrades/coffee.js',
  './upgrades/fridge.js',
  './upgrades/generator.js',
  './upgrades/water.js',
  // Investments (permanent, bought between runs with Investor Capital)
  './investments/better-laptops.js',
  './investments/agile-coaching.js',
  './investments/bigger-monitors.js',
  './investments/recruitment-network.js',
  './investments/training-budget.js',
  './investments/training-planning.js',
  './investments/sales-targets.js',
  './investments/sales-pipeline.js',
  './investments/leadership-coaching.js',
  './investments/ceo-calendar.js',
  './investments/prompt-engineering.js',
  './investments/enterprise-plan.js',
  './investments/security-training.js',   // unlock: .NET firewall
  './investments/cross-functional.js',    // unlock: balanced team bonus
  './investments/full-stack-squad.js',    // unlock: React hits bounce
  './investments/garbage-collection.js',  // unlock: Java 2x2 squares slow bugs
  // Features (teammates' add-ons, Nexios references, ...)
  './features/side-panel.js',
  './features/mailbox.js',
  './features/retrospective.js',
];

export const CONTENT_URLS = CONTENT.map(p => new URL(p, import.meta.url).href);
