# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The static marketing site for **maratus** — a small counter screen that shows a QR code for a link your business software sends through the API. The product itself lives in `erenmeren/maratus-admin`; it is not modified from this project.

The repo root *is* the site (single page, no build step):

- `index.html` — the whole page (`body.hybrid`): dark hero with the device concept and a live screen preview → ticker → intro → `#how` three-step handoff tabs → `#uses` use-case picker → brand section → ownership grid → FAQ → closing CTA → footer.
- `style.css` — base styles; `hybrid.css` — the `.hybrid` theme layered on top.
- `app.js` — the `#uses` picker (`cases` data → `[data-use]` buttons).
- `hybrid.js` — the `#how` handoff tabs (`flowData`, keyboard-navigable tablist).
- `screen.js` — projects the 640px screen UI onto the four inner-glass corners of `assets/maratus-device-concept.png` (homography, recomputed on resize) and cycles the scenes (receipt / surprise / loyalty / menu) with pause + dot controls.
- `assets/` — `maratus-device-concept.png` (1254×1254 render; the corner coords in `screen.js` depend on it), `demo-qr.svg`.
- `CNAME` — `maratus.co`. **Load-bearing**: GitHub Pages drops the custom domain if it is missing from the deployed branch.

Preview: `python3 -m http.server` in the repo root.

## Deploy

Live at https://maratus.co, served by GitHub Pages from the `gh-pages` branch of `erenmeren/maratus-site` (renamed from `ditto-site`). To redeploy, copy the site files (`index.html`, `*.css`, `*.js`, `assets/`, `CNAME`) plus an empty `.nojekyll` into a clone of `gh-pages`, commit, push. `docs.html` lives only on `gh-pages`: it is now a redirect to the real API docs at https://docs.maratus.co (served by maratus-admin) — keep it when redeploying so old links keep working. The legacy `assets/style.css`, `assets/site.js`, `assets/favicon.svg`, `assets/og.png` there are leftovers of the old reference; keep them too. Don't publish `CLAUDE.md`, `.gitignore` or anything under `docs/` / `device-photos/`.

## Rules

- Everything tracked is English-only (code, comments, commits). Internal notes may be Turkish but stay untracked under `docs/reviews/` (gitignored).
- Contact address is `hi@maratus.co`.
- Keep copy consistent with the real product: the caller sends a device ID + a URL, maratus shows it as a QR code, the customer's browser opens the caller's URL — maratus never hosts or fetches the content. The trigger API rejects requests when the device is offline or paused. Pinned content can be set per device, store or organisation from the management panel.
