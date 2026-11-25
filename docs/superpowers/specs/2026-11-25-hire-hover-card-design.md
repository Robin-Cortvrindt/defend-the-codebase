# Hire button hover card: design (small change)

## Intent

When a player hovers a hire button, show which bug that developer is strong against, so they can pick the right developer for the bugs coming at them. Only that: no stats, no upgrades (user's decision).

## Goals

- Hovering (or keyboard-focusing) a hire button shows a small card above it: `Strong vs ● <bug name> · 2× damage`, with the dot in the bug's ring colour.
- The card's second line keeps the hotkey hint that the button's tooltip shows today: `Hotkey <n>`.

## Non-goals / anti-goals

- No stats, upgrade paths or prices on the card.
- The button itself doesn't change size or layout, and the card never blocks clicking the button.
- No new game data. It comes from the developer's `counters` bug id and that bug's `name` and `ring`.

## Approaches

- **A. A styled card above the button (chosen).** It appears instantly, can show the ring colour, and looks like the game.
- B. The browser's `title` tooltip. One line of code, but it's delayed, looks like the operating system and can't show colour.

## Design

- `src/engine/ui.js`, hire bar: each hire button gets a child `<span class="hire-card">` with two lines. The first is `Strong vs`, a coloured dot (`getBug(def.counters).ring`), the bug's `name` and `· 2× damage`. The second is `Hotkey <n>`. The `title` attribute is removed, since the card replaces it. If the developer has no `counters` or the bug isn't registered, the first line is left out and only the hotkey shows.
- `style.css`: `.hire-btn` becomes `position: relative`. `.hire-card` is absolutely positioned above the button (bottom: 100% + gap), hidden by default, and shown on `.hire-btn:hover` and `:focus-visible`. It has `pointer-events: none`, uses the existing navy/white palette, and has a small arrow pointing at the button.
- The text builder `hireCardText(def)` sits in a small pure helper so a Node test can check the text: React → Typo bug, Java → Null pointer, .NET → Legacy bug, plus the fallback when `counters` is missing.

## Left to the builder

The exact spacing, font size and arrow styling, matching the existing upgrade popover's look.
