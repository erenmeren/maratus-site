# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The static marketing site for **maratus**, a retail customer-engagement device (Dock + device, lent free and included in the subscription). The product itself lives in `erenmeren/maratus-admin`; it is not modified from this project.

- `site/` – the website, no build step: `index.html` (home), `technical/`, `docks/`, `developers/`, `pricing/`, shared `css/`, `js/`, `assets/` (3D models, stills, data), `vendor/` (three.js). Design rules: `site/DESIGN.md`.
- `site/CNAME` – `maratus.co`. **Load-bearing**: GitHub Pages drops the custom domain if it is missing from the deployed branch.
- `site/tools/` – scripts that generate the models, stills and data in `site/assets/`. Not published.
- `kit/` – `scripts/shot.mjs` (screenshots), `scripts/slopcheck.mjs` (design-tell check), `ban-list.md`.
- `docs/` – `palettes-tried/` is tracked. The internal notes in `docs/*.md` (brief, content deck, directions, owner answers, project facts) are local only: gitignored, never committed.
- Untracked local material (gitignored): `.work/`, `ai/`, `cad-src/`, `site/shots/`, `docs/*.md`.

Preview: `python3 -m http.server 8080 --bind 127.0.0.1 -d site`

## Deploy

Live at https://maratus.co, served by GitHub Pages from the `gh-pages` branch of `erenmeren/maratus-site`. `./deploy.sh` copies `site/` into a `gh-pages` worktree under `.work/` and shows the diff; `./deploy.sh --push` commits and pushes. `docs.html` lives only on `gh-pages` (a redirect to https://docs.maratus.co); the script keeps it.

## Rules

- Everything tracked is English-only (code, comments, commits).
- This repo is public on GitHub. Internal notes, prices, customer or partner names and the owner's messages never go into tracked files or commit messages. Git hooks in this clone block committing or pushing `docs/*.md` and block pushing the history from before 2026-11-26 (kept locally in `local/*` branches). Never use `--no-verify`.
- Contact address is `hi@maratus.co`.
- No brand names or logos of retailers on the site. No monthly price on the site.
- Keep copy consistent with the real product: the caller sends a device ID + a URL, maratus shows it as a QR code, the customer's browser opens the caller's URL. maratus never hosts or fetches the content.
