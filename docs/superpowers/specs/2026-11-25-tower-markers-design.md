# Tower markers inside the cell — design

Date: 2026-11-25 · Status: approved

## Intent

A tower's level badge and its "upgrade ready" marker are drawn centred on the tile's corners, so they stick about 7 px into the neighbouring cells and overlap the neighbours' markers. The user wants no overlap, while both the level and the "ready" state stay clear.

## Goals, non-goals, anti-goals

- **Goal:** everything drawn for a tower (tile, level badge, ready marker, the XP bar when selected) stays inside its own 40×40 cell.
- **Goal:** the level reads as a number, and "an upgrade is ready" is easy to spot on a projector.
- **Non-goals:** new icons, changing the hire-bar tiles, range circles and effects (beams, rings, pops), which may cross cells on purpose.
- **Anti-goal:** a marker that clashes with or hides a neighbour's marker.

## Approaches

- **A. Smaller tile, markers tucked into the corners** *(picked by the user)*. The tile shrinks from 36 to 32 px; the level number sits in a 14 px badge in the cell's top-right corner; "ready" is a pulsing green outline around the tile.
- **B. Same tile, level as dots along the bottom edge.** Rejected: three small dots are harder to read from a distance than a number.

## Design

- **Tile on the map:** 32 px (was 36). The hire bar's own tiles keep their size.
- **Level badge:** a 14×14 rounded box whose top-right corner is the cell's top-right corner, inset 1 px (so it spans cell x ∈ [+5, +19], y ∈ [−19, −5] relative to the centre). Number in 900-weight 10 px Lato; white box with navy text, green box with white text at max level (as today).
- **Ready marker:** a green (`#16A34A`) outline drawn around the tile, 2 px, at most 19 px from the centre, with a gentle pulse (opacity between about 0.45 and 1, about once a second, from `game.time`). It replaces the corner triangle.
- **XP bar (selected tower only):** moves inside the cell, along the bottom edge (y ∈ [+16, +19]), 32 px wide.
- **Check:** a pure layout function returns these rectangles for a tower; a test asserts every one stays within the cell (±20 px) and that the badge doesn't cover the tile's centre.
