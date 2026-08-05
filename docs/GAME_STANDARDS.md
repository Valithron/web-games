# Escapee Games Standards

These standards apply to every published game and to every new game created for the portal.

## Required player experience

- Fill the usable browser viewport without a permanent site navigation bar.
- Support desktop keyboard controls and mobile touch controls.
- Remain playable in both portrait and landscape orientation.
- Show one small floating pause button during play.
- The pause menu must include Resume, Restart, Sound, High Scores, Full screen, and Home.
- Home must ask for confirmation while a run is active.
- Returning from another tab or app must leave the game paused.

## Signed high scores

Every game with a numeric score must use the shared signed-score system.

- Submit the final score exactly once after the game enters its game-over or results state.
- Prompt for exactly three uppercase alphanumeric characters: A-Z and 0-9.
- Remember the last valid signature across the arcade, but keep it editable.
- Maintain a local top-10 leaderboard per game.
- Rank higher numeric values first.
- Allow a separate numeric `sortValue` when the displayed result is based on waves, time, kills, or another compound result.
- The prompt must be keyboard accessible and work with mobile software keyboards.
- The player may skip signing.
- A storage error may prevent persistence but must never block results, replay, navigation, or the next run.
- Guard against duplicate score submission from repeated end-state calls.

Submit a standard score with:

```js
window.EscapeeScores?.submit(finalScore, {
  label: 'Final score',
  display: `${finalScore.toLocaleString()} points`
});
```

Submit a compound result with a numeric ranking value:

```js
window.EscapeeScores?.submit(displayedValue, {
  sortValue: numericRankingValue,
  label: 'Defense score',
  display: `Wave ${wave} · ${kills} kills`
});
```

The runtime exposes:

```js
window.EscapeeScores.submit(score, options);
window.EscapeeScores.getLeaderboard();
window.EscapeeScores.show();
```

Leaderboards are local to the current browser and device. A global leaderboard requires a separate server-backed design.

## Mobile layout

- Use `viewport-fit=cover`.
- Use `100dvh` or the shared `--escapee-vh` visual-viewport value rather than raw `100vh`.
- Keep HUD and controls inside safe areas.
- Do not shrink a desktop layout until it becomes unreadable. Reflow HUD and controls for portrait and short landscape screens.
- Minimum touch target is 48 by 48 pixels. Primary action controls should normally be 56 pixels or larger.
- Prevent scrolling, overscroll, text selection, and browser gestures inside the game surface.

## Canvas and rendering

- Resize canvas backing dimensions when its CSS size changes.
- Cap device pixel ratio at 2 unless the game has a measured reason not to.
- Recalculate layout after resize, rotation, fullscreen changes, and `visualViewport` changes.
- Cap frame delta after interruptions.
- Use one authoritative animation loop. Restart must not create a second loop.

## Input reliability

Handle `pointerup`, `pointercancel`, `lostpointercapture`, blur, page hiding, and orientation changes. Clear all keyboard, joystick, and action-button state whenever focus is lost so controls cannot remain stuck.

## Audio and storage

- Audio is optional. Missing, blocked, suspended, or rejected Web Audio must never prevent gameplay from starting.
- Catch audio promise rejections.
- Guard all local-storage access with `try/catch`.
- Invalid saved data falls back to defaults.
- Storage failure may disable scores or preferences, but never gameplay.

## Lifecycle and pause behavior

- Pause simulation when the pause menu opens.
- Pause on `visibilitychange`, `pagehide`, and interruption.
- Do not automatically resume when the player returns.
- Reset timing when resuming so physics does not jump forward.
- Restart and Home require confirmation during an active run.

## Accessibility

- Icon-only controls require accessible labels.
- Pause and score-entry menus must be keyboard usable.
- The signature field requires an explicit label and instructions.
- Maintain readable contrast.
- Respect reduced-motion preferences for nonessential effects.

## Required package files

Each game folder must contain:

- `index.html`
- `game.json`
- A 4:3 thumbnail

The manifest must accurately describe desktop controls, mobile controls, orientation support, category, play length, and publication status.

## Shared runtime

Published games receive `/shared/universal-game.js` and `/shared/universal-game.css` during the production build. New games should still expose this adapter when practical:

```js
window.EscapeeGame = {
  pause(),
  resume(),
  restart(),
  setMuted(muted),
  getStatus()
};
```

Recommended status values are `menu`, `playing`, `paused`, `between-rounds`, and `game-over`.

## Pre-publish checklist

- Start works when Web Audio is unavailable.
- Start works when storage is unavailable.
- Pause and Resume work.
- High Scores opens from the pause menu.
- Home confirmation can be cancelled and accepted.
- Restart does not duplicate the animation loop.
- Touch controls release after interruption.
- The HUD and controls fit a 320 by 568 viewport.
- Portrait and landscape are both playable.
- Short landscape menus do not overflow.
- Backgrounding pauses the run.
- Fullscreen denial does not break the menu.
- No uncaught error blocks the main game loop.
- A completed run opens score entry exactly once.
- The signature accepts exactly three letters or numbers and normalizes to uppercase.
- The Save button remains disabled until the signature is valid.
- Scores are ordered correctly and limited to ten entries.
- The previous signature is remembered but editable.
- Skip works.
- Storage failure does not trap the player or hide the original results screen.
