# maratus.co

The marketing site for maratus. Static HTML, CSS and JS, no build step.

- `site/` – the website (home, technical, docks, developers, pricing). `site/DESIGN.md` has the design rules.
- `site/tools/` – scripts that make the 3D models, stills and data in `site/` (not published).
- `kit/` – page checks (screenshots, slop check).
- `docs/palettes-tried/` – colour palettes that were tried.

Preview: `python3 -m http.server 8080 --bind 127.0.0.1 -d site`

Deploy: `./deploy.sh` (shows the diff), then `./deploy.sh --push`. GitHub Pages serves https://maratus.co from the `gh-pages` branch.
