# Simple Web Games Standards

Use this checklist when designing or reviewing every game in this project.

## Universal behavior

- Full usable browser viewport, with no permanent navigation bar.
- One small floating pause button.
- Pause menu: Resume, Restart, Sound, High Scores, Full screen, Home.
- Home asks for confirmation during an active run.
- Both portrait and landscape must remain playable.
- Desktop keyboard and mobile touch controls are both required.

## Signed high scores

- Every scored run must submit its final score once after entering the game-over or results state.
- The game is identified by its lowercase URL slug, and every score row must store that slug.
- Show an arcade-style prompt asking the player to sign the score with exactly 3 characters.
- Signatures may contain uppercase letters A-Z and numbers 0-9.
- The player may edit the signature only before pressing Save Score.
- Once saved, the game, signature, score, display text, record ID, and server timestamp are permanent.
- Never provide edit, correction, overwrite, or delete controls. Mistaken submissions must remain as entered.
- Store scores in the Cloudflare D1 database `web-games-scores`, not in browser local storage.
- Use `WEB_GAMES_SCORES` as the recommended Pages binding name.
- Keep a global top-10 leaderboard separately for each game and make it available from the pause menu.
- Sort numeric scores from highest to lowest. Earlier server timestamps win ties.
- Games with unusual scoring may provide a separate numeric sort value and human-readable display value.
- The prompt must work with a physical keyboard and a mobile software keyboard.
- The player may skip signing. Score entry must never trap the player or prevent replaying.
- Network or D1 failure may prevent persistence, but it must not block the results screen or next run.
- A failed save must say that nothing was recorded. Do not silently queue it for later.
- Prevent duplicate submissions when an end function fires more than once.

Games submit scores through the shared runtime:

```js
window.EscapeeScores?.submit(finalScore, {
  label: 'Final score',
  display: `${finalScore.toLocaleString()} points`
});
```

For a nonstandard score, use `sortValue` for ranking:

```js
window.EscapeeScores?.submit(displayedValue, {
  sortValue: numericRankingValue,
  label: 'Defense score',
  display: `Wave ${wave} · ${kills} kills`
});
```

The shared API is insert-only:

- `GET /api/scores?game=<slug>` reads one game's top ten.
- `POST /api/scores` inserts one permanent record.
- No `PUT`, `PATCH`, or `DELETE` endpoint is permitted.
- The server creates the D1 table and index automatically.

Browser storage may remember the last signature as a typing convenience, but it must not store authoritative scores or leaderboards.

## Responsive mobile rules

- Include `viewport-fit=cover`.
- Use `100dvh` or the shared visual-viewport value, not raw `100vh` alone.
- Keep HUD and controls inside safe areas.
- Reflow portrait and landscape layouts instead of shrinking the desktop layout.
- Use touch targets of at least 48 by 48 pixels.
- Prevent page scrolling and overscroll during play.
- Test small portrait and short landscape screens.

## Reliability rules

- Audio failure must never block gameplay.
- Storage failure must never block gameplay.
- Network or D1 failure must never block gameplay.
- Pause when hidden, backgrounded, or interrupted.
- Do not resume automatically when the player returns.
- Clear keyboard, joystick, and action-button state after interruption.
- Use one animation loop. Restart must not create another loop.
- Cap frame delta after interruptions.
- Catch rejected fullscreen and audio promises.

## Canvas rules

- Match backing resolution to displayed size.
- Cap device pixel ratio at 2 unless testing proves otherwise.
- Resize after browser-bar changes, rotation, fullscreen changes, and viewport changes.
- Keep important game objects and controls visible in both orientations.

## Accessibility

- Label icon-only buttons.
- Keep pause and score-entry menus keyboard usable.
- Give the three-character signature field an explicit accessible label and instructions.
- Communicate loading, save failure, and success without relying only on color.
- Maintain readable contrast.
- Respect reduced-motion settings for nonessential animation.

## Pre-publish test

- Start with Web Audio unavailable.
- Start with local storage unavailable.
- Pause and resume.
- Open High Scores and verify it shows only the current game.
- Cancel and accept Home confirmation.
- Restart repeatedly and verify only one loop runs.
- Interrupt a held touch control and verify it releases.
- Rotate during play.
- Test at 320 by 568, modern phone portrait, phone landscape, tablet, and desktop.
- Verify no menu or HUD overflows.
- Verify backgrounding pauses the game.
- Finish a run and verify the signature prompt appears once.
- Verify lowercase and symbols are normalized or rejected correctly.
- Verify Save remains disabled until exactly 3 valid characters are present.
- Verify the submitted score appears in the correct game's leaderboard order.
- Verify no UI or API can edit or delete a submitted row.
- Verify Skip works.
- Disconnect the score service and verify the player is told nothing was recorded while the game remains usable.
