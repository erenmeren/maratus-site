#!/bin/sh
# Publishes site/ to the gh-pages branch (GitHub Pages serves https://maratus.co from it).
# Usage: ./deploy.sh            -> shows what would change
#        ./deploy.sh --push     -> commits and pushes
set -e
cd "$(dirname "$0")"
W=.work/gh-pages
git fetch -q origin gh-pages
[ -d "$W" ] || git worktree add -q "$W" gh-pages
git -C "$W" checkout -q gh-pages && git -C "$W" reset -q --hard origin/gh-pages
# docs.html only lives on gh-pages: it redirects old links to https://docs.maratus.co
rsync -a --delete --exclude .git --exclude .nojekyll --exclude docs.html --exclude README.md \
  --exclude shots --exclude tools --exclude DESIGN.md --exclude .DS_Store site/ "$W/"
touch "$W/.nojekyll"
git -C "$W" add -A
git -C "$W" status --short
if [ "$1" = "--push" ] && ! git -C "$W" diff --cached --quiet; then
  git -C "$W" commit -qm "deploy: main $(git rev-parse --short HEAD)"
  git -C "$W" push -q origin gh-pages
  echo "pushed"
fi
