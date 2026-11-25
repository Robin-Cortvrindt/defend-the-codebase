# Upgrade popover — design

Date: 2026-11-25 · Status: approved
Builds on: `docs/superpowers/specs/2026-11-25-tower-upgrades-design.md`

## Intent

Today the selected developer's panel is the 4th column of the hire bar. When it grows to hold upgrade buttons, the whole row grows and the React, Java and .NET hire buttons stretch. The user wants:

1. The hire buttons to keep one fixed size.
2. A developer's options to open **next to that developer on the map**.
3. The level-3 step to read clearly as a **choice** between two branches.

## Goals, non-goals, anti-goals

- **Goals:** fixed-size hire bar; a popover anchored to the selected tower; an unmistakable "pick one" for level 3.
- **Non-goals:** changing what the panel offers (name, level, XP, upgrades, Azure toggle, Sell), upgrade balance, keyboard shortcuts for upgrades.
- **Anti-goals:** the popover hiding the tower it belongs to; the popover running off the map; anything in the bottom bar changing size when you select or deselect a developer.

## Approaches

- **Popover inside `#stage`, positioned from the tower's map coordinates** *(picked)*. Same pattern `main`'s inbox uses (`mailbox.js` places absolutely positioned panels in `#stage`). It scales with the canvas and stays inside the map.
- **Draw the panel on the canvas.** Rejected: rebuilds buttons, hover and tooltips by hand, and it's harder to click.
- **Keep it in the bottom bar but give it its own row.** Rejected: the user asked for it next to the tower.

## Design

**Bottom bar:** `#hire` becomes three equal columns of hire buttons. The panel no longer lives there, so nothing in the bar changes size. *Controller call:* the three buttons get a bit wider than today; an empty 4th slot would look odd.

**Popover:** a panel inside `#stage`, shown while a developer is selected.
- **Position:** the tower's centre is mapped from canvas coordinates to `#stage` pixels (stage width / `WIDTH`). The popover opens to the right of the tower with a small arrow pointing at it; if it wouldn't fit, it opens to the left. Vertically it is centred on the tower and clamped inside the stage. It is repositioned every frame, so window resizes and the stage scale are handled.
- **Content (unchanged):** title `{type} · {level name}`, the XP / squashed line, the upgrade buttons, any extra content buttons (Azure toggle), Sell.
- **Level 3 as a choice:** when the developer is at level 2 and has two branches, the popover shows a "Choose one" heading and the two branch buttons side by side with an "or" between them, plus a small line "You can't change this later." Each branch keeps its Steady / Gamble label and cost.
- **Closing:** as today — clicking empty map, Esc, right-click, selling, or selecting another developer.
- **Style:** Nexios palette and Lato, same look as the inbox panels (navy background, accent border in the developer's colour). Readable on a projector: 13–14px names, 12px sublines. Sits above the canvas and below the overlay screens (bell, review, game over).

## Left to the builder

- Exact sizes, spacing and arrow shape within the style above.
- How narrow screens (the existing `max-width` media query) are handled, as long as the popover stays on the map.
