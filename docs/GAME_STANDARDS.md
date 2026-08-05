# Escapee Games Standards

These standards apply to every published game and every new game created for the portal.

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
- Identify the game by its lowercase URL slug. Every stored score row must include that game slug.
- Prompt for exactly three uppercase alphanumeric characters: A-Z and 0-9.
- The player may edit the signature only before pressing Save Score.
- After a successful submission, the signature, numeric score, display text, game slug, and timestamp are permanent.
- Do not provide edit, correction, overwrite, or delete controls. Mistaken submissions remain as entered.
- Store leaderboards in the Cloudflare D1 database `web-games-scores`, not in browser local storage.
- Use the recommended Pages binding name `WEB_GAMES_SCORES`. The API also recognizes `web_games_scores`, `SCORES`, `DB`, and `web-games-scores` for compatibility.
- Maintain a global top-10 leaderboard separately for each game.
- Rank higher numeric values first. Ties are ordered by the earlier server timestamp.
- Allow a separate numeric `sortValue` when the displayed result is based on waves, time, kills, or another compound result.
- The prompt must be keyboard accessible and work with mobile software keyboards.
- The player may skip signing.
- A network or database error must never block results, replay, navigation, or the next run.
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
await window.EscapeeScores.getLeaderboard();
window.EscapeeScores.show();
```

### Score service contract

- `GET /api/scores?game=<slug>` returns the top ten immutable records for one game.
- `POST /api/scores` inserts one new immutable record.
- The API accepts no `PUT`, `PATCH`, or `DELETE` operation.
- The server generates the record ID and timestamp.
- The server validates the game slug, three-character signature, and non-negative integer score.
- The API creates its D1 table and ranking index automatically if they do not yet exist.
- Score display uses text rendering only. Never inject submitted values as HTML.

Browser storage may remember the last three-character signature as a convenience, but it must never contain the authoritative leaderboard or score records.

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

## Audio, storage, and network reliability

- Audio is optional. Missing, blocked, suspended, or rejected Web Audio must never prevent gameplay from starting.
- Catch audio promise rejections.
- Guard local-storage access with `try/catch`.
- Invalid saved preferences fall back to defaults.
- Do not use local storage as the authoritative leaderboard.
- D1 or network failure may prevent a score submission, but never gameplay.
- A failed submission must clearly say that nothing was recorded and may offer Retry.
- Never silently queue a failed score for later submission because the player must know whether the permanent record exists.

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
- Loading, save failure, and successful leaderboard states must be understandable without color alone.
- Maintain readable contrast.
- Respect reduced-motion preferences for nonessential effects.

## Required package files

Each game folder must contain:

- `index.html`
- `game.json`
- A 4:3 thumbnail

The manifest must accurately describe desktop controls, mobile controls, orientation support, category, play length, and publication status.

## Shared runtime

Published games receive `/shared/universal-game.js`, `/shared/d1-scores.js`, and `/shared/universal-game.css` during the production build. New games should still expose this adapter when practical:

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
- Start works when local storage is unavailable.
- Pause and Resume work.
- High Scores opens from the pause menu and shows only the current game.
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
- A successful submission appears on the correct game leaderboard.
- Scores are ordered correctly and limited to ten entries.
- After submission, no UI or API can edit or delete the row.
- Skip works.
- D1 failure reports that nothing was recorded and leaves the game usable.
- A request for one game can never return another game's scores.
