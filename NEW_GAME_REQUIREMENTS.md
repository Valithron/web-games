# Escapee Games: New Game Requirements

This is the required integration standard for every new game added to Escapee Games.

The goal is simple: a new game should begin with the site-wide systems already accounted for instead of rediscovering pause behavior, mobile controls, score entry, viewport handling, or leaderboard wiring after the game is otherwise finished.

Start from `games/_template` unless there is a strong reason not to.

## 1. Core design rule: keep controls simple

Escapee Games are small browser games. The control scheme should remain understandable within seconds.

### Desktop

- Prefer **WASD and Arrow Keys** for movement.
- If an action button is needed, prefer **Space** or **Enter**.
- Avoid multi-key combos, complex hotkey sets, or controls that require explanation before play.
- The pause menu is handled by the universal runtime. Do not build a competing pause system unless the shared runtime cannot support the game.

### Mobile

- Every published game must be fully playable by touch.
- Touch controls must provide the same essential capabilities as desktop controls.
- Prefer one virtual joystick, directional touch region, direct dragging/tapping, and at most one or two obvious action buttons.
- Do not require hover, right-click, keyboard-only input, or pixel-precise mouse behavior.
- Interactive touch targets should be at least **48 by 48 CSS pixels**.
- Prevent page scrolling, pull-to-refresh style overscroll, and browser-page gestures from interfering with active play.

Use `/shared/input.js` when its normalized movement/action model fits the game. It already handles WASD, Arrow Keys, Space, pointer state, joystick input, touch buttons, blur cleanup, page-hide cleanup, and pause cleanup.

## 2. Required universal game runtime

Published games use the shared universal runtime:

- `/shared/universal-game.js`
- `/shared/universal-game.css`
- `/shared/d1-scores.js`
- `/shared/score-input-lock.js`

`scripts/postbuild-universal.mjs` injects these into published games during the build and verifies that scored games have a score submission hook.

New games should still be written as if these systems are first-class dependencies. Do not depend on a fragile post-build string patch for a new game's core behavior.

## 3. `window.EscapeeGame` contract

Each game should expose a small integration object on `window.EscapeeGame`:

```js
window.EscapeeGame = {
  restart,
  pause,
  resume,
  setMuted,
  getStatus
};
```

Expected behavior:

- `restart()` fully resets the run without creating a second animation loop.
- `pause()` freezes gameplay and game timers.
- `resume()` resumes from a paused state and resets timing references so there is no giant frame delta.
- `setMuted(muted)` changes game audio state without affecting gameplay.
- `getStatus()` returns a meaningful state such as `playing`, `paused`, `between-rounds`, or `game-over`.

The universal pause and score systems use this contract when available.

## 4. Universal pause behavior

Every game should have **one small floating pause button** supplied by the universal runtime.

The pause menu contains:

- Resume
- Restart
- Sound
- High Scores
- Full screen
- Home

Required behavior:

- Home asks for confirmation during an active run.
- Restart must not accidentally start another animation loop.
- Escape or `P` may open/close pause through the shared runtime.
- When the browser tab becomes hidden, the page loses focus, or the page is interrupted, the game pauses.
- **Do not automatically resume when the player returns.** The player must explicitly resume.
- Keyboard, joystick, pointer, and held action state must be cleared when pausing or when the page is interrupted.
- Fullscreen rejection must never break the game.

Do not add a permanent site navigation bar inside the play viewport. The game should use the full usable browser viewport with the small pause control as the universal escape hatch.

## 5. High-score system wiring

High scores are site-wide infrastructure, not per-game local storage.

### Default rule

A published game is considered scored unless it explicitly opts out with:

```json
"scoreMode": "none"
```

A scored game must call `window.EscapeeScores.submit(...)` exactly once when a completed run reaches its final results/game-over state.

Example:

```js
window.EscapeeScores?.submit(finalScore, {
  label: 'Final score',
  display: `${finalScore.toLocaleString()} points`
});
```

### Score value rules

- The ranking value must be a **non-negative safe integer**.
- The backend ranks larger values higher.
- If the visible result uses decimals, elapsed time, distance formatting, or another special display, use an integer ranking value and pass a human-readable `display` string.
- `sortValue` may be supplied when the ranking integer should differ from the visible raw value.
- For a lower-is-better game, convert the result into a higher-is-better integer ranking value rather than expecting the leaderboard to sort ascending.

### Qualification and initials

The score service:

- Keeps the **top 10** scores per game.
- Prompts for initials/signature only when the score qualifies.
- Accepts exactly **3 letters or numbers**.
- Uses the database leaderboard cutoff, not a local cached high score.
- Does not allow editing or deleting submitted scores through the public score API.
- Uses earlier submission time as the tie-order after score sorting, while a new score tied with an existing full-board cutoff does not displace the cutoff.

### Input lock during initials entry

`/shared/score-input-lock.js` must remain active whenever the score overlay is open.

This prevents `W`, `A`, `S`, `D`, Arrow Keys, and Space from continuing to control the game while the player types initials. New games must not bypass this behavior with document-level keyboard handlers that run ahead of the universal score overlay.

### D1 backend

The backend lives at:

- `functions/api/scores.js`

The preferred Cloudflare D1 binding is:

- `WEB_GAMES_SCORES`

The API automatically ensures the `arcade_scores` schema exists. Score persistence therefore depends on the production Pages deployment having the D1 database bound to the project.

Useful endpoints:

- `GET /api/scores?game=<slug>` - top 10 for one game
- `GET /api/scores?game=<slug>&action=qualify&score=<integer>` - qualification check
- `GET /api/scores?action=all` - all leaderboards for the site page
- `GET /api/scores?action=health` - D1 binding/schema health check
- `POST /api/scores` - insert a qualifying score

Do **not** create a second local leaderboard in `localStorage`. Local storage may be used for preferences, unlocks, or non-authoritative game state through `/shared/storage.js`, but the authoritative high-score list is D1.

## 6. Responsive viewport requirements

Every game must remain playable in both portrait and landscape unless a very specific game design justifies otherwise.

Required baseline:

- Include `viewport-fit=cover`.
- Use `100dvh` or the shared `--escapee-vh` visual-viewport value instead of raw `100vh` alone.
- Keep HUD and controls inside safe areas using `env(safe-area-inset-*)` where needed.
- Reflow portrait and landscape layouts. Do not simply shrink a desktop layout until it technically fits.
- Prevent HUD, overlays, menus, and touch controls from overflowing on short landscape screens.
- Listen for resize/orientation/visual viewport changes when game geometry depends on rendered dimensions.

The template already demonstrates the intended full-viewport and safe-area structure.

## 7. Canvas requirements

For canvas games:

- Match the canvas backing resolution to its displayed CSS size.
- Cap device pixel ratio at **2** unless testing proves a higher value is worth the cost.
- Recalculate after resize, rotation, fullscreen changes, and mobile browser-bar changes.
- Keep important objects and controls visible in both portrait and landscape.
- Use one animation loop.
- Cap frame delta after interruptions so returning to the game does not simulate a huge time jump.

## 8. Reliability requirements

A game must continue functioning when optional browser features fail.

- Audio/Web Audio failure must never block gameplay.
- Rejected audio promises must be caught.
- Local-storage failure must never block gameplay.
- Rejected fullscreen promises must be caught.
- Backgrounding or interruption pauses the run.
- Returning from interruption does not resume automatically.
- Held keyboard/touch/joystick controls are cleared after interruption.
- Repeated restart must not multiply timers, event handlers, or animation loops.

## 9. Accessibility baseline

- Give icon-only buttons an accessible label.
- Keep pause and score menus keyboard usable.
- Maintain readable contrast for HUD and menus.
- Do not communicate essential game state only by subtle color changes.
- Respect reduced-motion preferences for nonessential animation when practical.

## 10. Game manifest requirements

Every game folder needs a valid `game.json`.

Required fields currently validated by `scripts/validate-games.mjs`:

```json
{
  "slug": "new-game",
  "title": "New Game",
  "description": "One-sentence description.",
  "category": "Arcade",
  "thumbnail": "thumbnail.svg",
  "desktopControls": ["WASD", "Arrow keys"],
  "mobileControls": ["Virtual joystick", "Touch button"],
  "orientation": "any",
  "status": "draft"
}
```

Rules:

- Folder name must match the lowercase kebab-case `slug`.
- `desktopControls` and `mobileControls` must both be non-empty.
- `orientation` is `portrait`, `landscape`, or `any`.
- Keep the game `draft` until it passes the pre-publish test.
- A published scored game must contain a valid `EscapeeScores.submit(...)` hook or the universal post-build validation should fail.

Optional catalog metadata such as tags, session length, publish date, and featured status should be filled in when useful.

## 11. Build and deployment dependencies

Local validation:

```bash
npm run validate
npm run build
```

The build pipeline currently:

1. Validates manifests and required files.
2. Builds the game catalog and routes.
3. Applies compatibility patches where needed for older games.
4. Injects the universal pause/runtime assets.
5. Injects the D1 score runtime and score-input lock.
6. Verifies published scored games contain a score submission hook.
7. Publishes the site-wide high-score page into `dist/high-scores`.

Production is built from `main` and served from `dist`.

For high scores to work in production, the Cloudflare Pages project must include the Pages Function and a working D1 binding, preferably named `WEB_GAMES_SCORES`.

## 12. New-game implementation order

Use this order so universal requirements are not bolted on at the end:

1. Copy `games/_template` and create the manifest.
2. Decide the entire control scheme before building the core loop.
3. Implement desktop and touch controls together.
4. Implement `window.EscapeeGame` pause/restart/resume/status hooks.
5. Make the playfield responsive in portrait and landscape.
6. Implement sound as optional, failure-safe behavior.
7. Define the final score and wire one `EscapeeScores.submit(...)` call into game over/results.
8. Verify the score overlay completely captures keyboard input.
9. Test pause, backgrounding, restart, rotation, and fullscreen.
10. Run validation/build, then publish.

## 13. Pre-publish test

Before changing a game to `published`, test all of the following:

- Start with Web Audio unavailable.
- Start with local storage unavailable.
- Start, pause, and resume normally.
- Cancel and accept Home confirmation.
- Restart repeatedly and verify only one loop runs.
- Hold a keyboard direction, pause, and verify movement does not remain stuck.
- Hold a touch control, interrupt the page, and verify it releases.
- Background the page and verify the game pauses.
- Return to the page and verify it remains paused until Resume is chosen.
- Rotate during play.
- Test at **320x568**, a modern phone portrait size, phone landscape, tablet, and desktop.
- Verify no HUD, menu, or controls overflow.
- Verify the game remains usable with touch only.
- Verify the game remains usable with keyboard only where applicable.
- Finish a run with a non-qualifying score and verify there is no initials prompt.
- Finish a run with a qualifying score and verify the 3-character prompt appears.
- Type `WASD` during score entry and verify those characters go only into the initials field and do not control the game.
- Save a score and verify it appears in the top-10 leaderboard.
- Open High Scores from the pause menu.
- Verify `/api/scores?action=health` reports a working D1 binding in the deployed environment.
- Run `npm run validate`.
- Run `npm run build`.

## 14. Things a new game should not reinvent

Do not create a separate implementation for any of these unless the shared system is being deliberately replaced site-wide:

- Pause button/menu
- Home confirmation
- Fullscreen handling
- Site-wide high-score storage
- Three-character score-entry UI
- Score-entry keyboard lock
- Basic keyboard/touch normalization when `/shared/input.js` fits the game
- Namespaced local-storage safety wrapper
- Mobile visual-viewport CSS variables

The game itself should spend its complexity budget on the mechanic, feedback, progression, and replayability. The portal-level plumbing should stay universal.