# Hire Hover Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hovering or focusing a hire button shows a small card: `Strong vs ● <bug name> · 2× damage` plus `Hotkey <n>`.

**Architecture:** A pure helper `hireCardInfo(def, index)` in a new DOM-free module builds the card's data from the developer's `counters` bug. `ui.js` renders it as a hidden child of each hire button, and CSS shows it on hover/focus.

**Tech Stack:** Plain ES modules, CSS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-25-hire-hover-card-design.md`

## Global Constraints

- Copy: line 1 is `Strong vs`, a dot in `bug.ring`, the bug's `name`, then `· 2× damage`. Line 2 is `Hotkey <n>` (1-based).
- No stats, upgrades or prices on the card. The button's size and layout don't change. The card has `pointer-events: none`.
- The button's `title="Hotkey n"` is removed (the card replaces it).
- No counter, or an unregistered bug: line 1 is omitted and only the hotkey shows.

## Review Focus

1. A developer whose `counters` bug isn't registered (a teammate's content file failed to load): the card must still render with just the hotkey, not throw. Tested in Task 1.
2. The bottom hire bar near the screen edge: the card must stay on-screen above the button, not clipped. Manual check in Task 1 Step 5.
3. Keyboard users: the card shows on `:focus-visible`. Manual check.
4. Clicking still hires through the card area (`pointer-events: none`). Manual check.
5. An active (selected) hire button keeps showing the card correctly on its white background. Manual check.

---

### Task 1: Hover card on hire buttons

**Files:**
- Create: `src/engine/hire-card.js`
- Modify: `src/engine/ui.js` (hire bar, around lines 53-62)
- Modify: `style.css` (after `.hire-btn` rules, around line 72)
- Test: `tests/hire-card.test.js`

**Interfaces:**
- Produces: `hireCardInfo(def, index: number) -> { strong: { name: string, ring: string } | null, hotkey: string }` in `src/engine/hire-card.js`, using `getBug(def.counters)` from `./registry.js`.

- [ ] **Step 1: Write the failing test** `tests/hire-card.test.js`. Use `resetRegistry()` and register bugs `{ id: 'typo', name: 'Typo bug', ring: '#2563EB' }` and `{ id: 'nullpointer', name: 'Null pointer', ring: '#EA580C' }`.
  - `hireCardInfo({ counters: 'nullpointer' }, 1)` deep-equals `{ strong: { name: 'Null pointer', ring: '#EA580C' }, hotkey: 'Hotkey 2' }`
  - `hireCardInfo({ counters: 'typo' }, 0).strong.name === 'Typo bug'`
  - `hireCardInfo({}, 2)` deep-equals `{ strong: null, hotkey: 'Hotkey 3' }`
  - `hireCardInfo({ counters: 'ghost' }, 0).strong === null` (Review Focus 1)
  - Also: with the real content loaded (`import '../src/content/developers/java.js'` etc. is fine if the bugs are imported too), React → `Typo bug`, Java → `Null pointer`, .NET → `Legacy bug`.
- [ ] **Step 2: Run** `node --test tests/hire-card.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `hireCardInfo` in `src/engine/hire-card.js`. In `ui.js`, append to each hire button `h('span', { class: 'hire-card' }, ...)` with an optional first line `h('span', { class: 'hc-strong' }, 'Strong vs ', h('i', { class: 'hc-dot', style: `background:${ring}` }), h('b', {}, name), ' · 2× damage')` and a second line `h('small', {}, hotkey)`. Remove the `title`. In CSS, `.hire-btn` gets `position: relative`. `.hire-card` is `position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%)`, `white-space: nowrap`, navy background, white text, small radius, an arrow underneath, `pointer-events: none`, `opacity: 0` → `1` on `.hire-btn:hover .hire-card, .hire-btn:focus-visible .hire-card`, and `z-index` above the board. `.hc-dot` is an 8 px circle.
- [ ] **Step 4: Run** `npm test` and `node --check src/engine/ui.js src/engine/hire-card.js`. Expected: all pass.
- [ ] **Step 5: Manual check** in a browser (`python3 -m http.server 8000`, then `/?demo=1`): Review Focus 2-5. If no browser is available, list these as not run.
- [ ] **Step 6: Commit** `feat: hire buttons show which bug each developer is strong against`
