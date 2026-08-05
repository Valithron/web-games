# Escapee Games

A lightweight browser-game portal for small games that work on desktop and mobile.

Production: `https://fun.skpfam.com`

## Cloudflare Pages

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `22`

No database, Pages Functions, or Worker is required.

## Local development

```bash
npm run validate
npm run build
npm run dev
```

The development server runs at `http://localhost:4173` and listens on the local network so games can be tested on a phone.

## Add a game

1. Copy `games/_template`.
2. Rename the copy using a lowercase kebab-case slug, such as `last-lantern`.
3. Update every field in `game.json`.
4. Change the page title and shell title in the game files.
5. Replace `thumbnail.svg` with a 4:3 thumbnail. SVG, PNG, and WebP are supported.
6. Build the game using relative asset paths or root paths that remain valid under `/<slug>/`.
7. Confirm keyboard and touch controls both work.
8. Change `status` from `draft` to `published`.
9. Run `npm run validate` and `npm run build`.
10. Push to `main`.

The build automatically creates the homepage card, `games.json`, sitemap entry, and route at:

```text
https://fun.skpfam.com/<slug>/
```

No router or homepage edit is needed.

## Game manifest

```json
{
  "slug": "last-lantern",
  "title": "Last Lantern",
  "description": "Keep the lantern burning while creatures close in.",
  "category": "Survival",
  "tags": ["arcade", "waves", "upgrades"],
  "thumbnail": "thumbnail.webp",
  "desktopControls": ["WASD", "Arrow keys"],
  "mobileControls": ["Virtual joystick", "Touch buttons"],
  "orientation": "any",
  "sessionMinutes": "5–10 min",
  "published": "2026-08-05",
  "featured": true,
  "status": "published"
}
```

Folders beginning with `_` and manifests marked `draft` are excluded from the deployed catalog.

## Shared utilities

- `/shared/input.js` normalizes keyboard, pointer, joystick, and touch-button input.
- `/shared/storage.js` namespaces local storage by game slug.
- `/shared/game-shell.js` provides Back, Restart, Sound, Full screen, pause, and resume behavior.
- `/shared/game-shell.css` provides the standard portal control bar.

Games may use their own visual style and architecture as long as they remain responsive and support desktop and mobile input.
