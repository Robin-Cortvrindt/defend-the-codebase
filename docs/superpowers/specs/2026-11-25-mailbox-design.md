# Mailbox: design

## Intent

Give the player small side goals during a run. Tasks arrive as mail in an inbox. Finishing one and pressing Claim pays out Warrants, or rarely a free Claude. Some mails are phishing: they look exactly like real ones, and the trap only springs when the player claims. The phishing is a surprise gag for the demo audience, not a lesson in spotting phishing.

Mockups: `docs/mockups/mailbox.html` (states 1 to 6).

## Goals

- An inbox holding at most 4 mails. Mail trickles in during play.
- Each mail is a task with a progress bar and a reward. A finished task shows a Claim button.
- About 1 in 6 mails is phishing. On Claim, one of three penalties is picked at random: stolen, malware or compromised.
- A popup with the sender, subject and reward appears when a new mail arrives.
- Teammates can add a task with one line in the task list.

## Non-goals

- Tells that let a careful player spot phishing. A fake mail looks identical to a real one in the inbox, in the popup and in the progress bar.
- Keeping mail or progress across games.
- Changes to the engine.

## Anti-goals

- A phishing penalty that can end a run on its own.
- The panel or popup getting in the way of placing developers or ringing the bell.
- A broken mailbox taking the game down. The loader already isolates a failing file.

## Approaches

1. **One feature file, no engine changes (chosen).** `src/content/features/mailbox.js` plus one manifest line. The file builds its own small panel and popup, tracks progress through bus events, and applies penalties with existing APIs. Risk stays in one file, and it follows the house rule.
2. **Feature file plus engine helpers** (`grantPowerup`, a panel slot in `ui.js`). Cleaner, but it touches shared engine code before the 15:30 freeze.
3. **A new content type, `registerMail`.** The most extensible option, but too big a change for one afternoon.

Option 1 won because it keeps all the risk inside one file.

## Design

### Decided with the team

- The inbox is a basic panel over the board, opened from a dashed "Inbox" card in the power-up bar.
- Mail trickles in slowly, with at most 4 in the inbox.
- Real and phishing mails look identical.
- Rewards and penalties fire on **Claim**, not automatically.
- Phishing penalties, picked at random:
  - **Stolen:** the player loses Warrants equal to the promised reward.
  - **Malware:** a burst of bugs spawns at the start of the path.
  - **Compromised:** one random developer is locked for 10 seconds.
- A new-mail popup shows the sender and subject.
- The game keeps running while the inbox is open.

### Mail flow

- **Arrival:** the first mail arrives 5 s after `game:start`. After that, one arrives every 30 s of game time, in the `building`, `wave` and `bell` phases. It pauses on the quarter `review` screen, where the panel and popup are hidden.
  - The timer counts the scaled `dt` that `update` receives, so the heating-out event and 2× speed affect it naturally.
  - It pauses while the inbox holds 4 mails.
- **Phishing roll:** each mail is rolled as phishing at arrival, with `PHISH_CHANCE = 1/6` using `game.random`. A phishing mail uses a normal task template, so its task and progress are real.
- **Repeats:** a template already open in the inbox isn't picked again.
- **Progress:** action tasks count from the moment the mail arrives. State tasks check the game state.
- **Claim:** works in any active phase. After a claim, the mail leaves the inbox.
  - A real reward shows a green "Reward claimed" banner and plays a chime.
  - Phishing shows a red flash and a "Phished" banner whose text depends on the penalty.

### Tasks (starting list, one line each)

| Sender | Task | Tracks | Reward |
|---|---|---|---|
| HR | Hire 3 .NET developers | `dev:placed`, type `dotnet` | 60 W |
| HR | Hire 2 React developers | `dev:placed`, type `react` | 40 W |
| HR | Hire 2 Java developers | `dev:placed`, type `java` | 40 W |
| Training manager | Promote a developer to Consultant | `dev:levelup`, level ≥ 1 | 40 W |
| Training manager | Promote a developer to Senior Consultant | `dev:levelup`, level 2 | 80 W |
| IT service desk | Squash 25 typo bugs | `bug:killed`, type `typo` | 50 W |
| IT service desk | Squash 15 null pointers | `bug:killed`, type `nullpointer` | 50 W |
| IT service desk | Squash 8 legacy bugs | `bug:killed`, type `legacy` | 60 W |
| CEO | Survive 2 more sprints | `sprint:cleared` after arrival | 50 W |
| Business manager | Clear a sprint without a single leak | a sprint that starts after arrival with no `bug:leaked` | 70 W |

The senders are roles, not people's names, matching the recent rename of the power-ups.

### Power-up reward

Only Claude costs Warrants. The other power-ups are free and limited only by cooldowns, so a "free use" of them would mean nothing.

- **The reward:** roughly 1 in 8 real mails rewards **one free Claude** instead of Warrants.
- **How:** the file wraps `claude.getCost` so it returns 0 while the player holds a voucher. On `powerup:activated` with id `claude`, it spends one voucher. The Claude power-up card then shows a price of 0.
- **Phishing version:** a phishing mail can also show "Free Claude". If it's Stolen, the player loses 100 W.

### Penalties

- **Stolen:** `warrants = max(0, warrants - reward)`.
- **Malware:** spawns `min(8, 3 + floor(sprint / 3))` bugs of random non-boss types at distance 0, slightly spread out. The game is endless now, so the count is capped.
  - If the player claims outside a sprint, the bugs are queued and spawn on the next `wave:start`.
- **Compromised:** picks a random developer and sets `dev.cooldown = 10` (`tickDevs` already skips a developer on cooldown). The file tracks the locked developer until `game.time` passes the 10 seconds, and its `draw` greys the developer out and draws a padlock with canvas shapes (no emoji).
  - With no developers on the board, it falls back to Stolen.

### UI

- **Inbox card:** a `hudButtons` entry labelled "Inbox". On each `update`, the file finds its own card in the power-up bar and keeps two things current:
  - a badge with the unread count
  - the hint text "N new · x/4"
- **Panel:** a DOM element the file creates inside `#stage`, matching the mockup.
  - It opens at the **bottom right**, right above the Inbox card, with its right edge in line with the card (team request after playtesting). It closes by itself when a sprint is cleared, so it never covers the bell card; the player can open it again during the bell.
  - Mails show unread dots until the panel is opened.
- **Popup:** a toast right above the Inbox card (bottom of the board, right edge in line with the card, arrow pointing at it) that disappears after 4 s. Clicking it opens the inbox. No popup appears while the inbox is open.
  - It plays a short chime, registered with `registerSound('mail', ...)`.
- **Styles:** the CSS is injected from the file as one `<style>` tag, using the Nexios palette and Lato. That keeps the change to one file plus the manifest line.
- **Restart:** `init(game)` resets the mailbox state and empties the panel. Bus listeners are added at the top level of the file, as CONTRIBUTING requires.

### Testing

- The logic (arrival timer, cap, progress, claim, phishing roll, penalties, voucher) lives in plain exported functions that work on a `game` object, with no DOM involved.
- `tests/mailbox.test.js` covers that logic in Node.
- DOM code is guarded with `typeof document !== 'undefined'`.
- `scripts/sim.mjs` doesn't claim mail, so the balance check is unchanged.
- **Before pushing:** run `node --test` and play at least one sprint in the browser.

## Changes after the sprints update (my calls)

After this design was approved, the game became endless sprints with quarter reviews and a boss. That led to these changes:

- **Survive task:** "Survive wave N" became "Survive 2 more sprints". There's no last wave any more, and a goal relative to now avoids confusing global sprint numbers.
- **Malware:** it never spawns the boss, and its count is capped at 8.
- **Quarter review:** the mail timer pauses on the review screen, and the panel and popup are hidden there.
- **Wording:** player-facing text says "sprint" instead of "wave".

## Left to the builder (my calls)

- The exact banner and phishing wording, the reward amounts, and the 1 in 8 Claude odds.
- The chime sound.
- The pixel layout of the panel and popup within the mockup's look.
- What a malware bug's spread looks like.
