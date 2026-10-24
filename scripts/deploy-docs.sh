#!/bin/sh
# Publish apps/docs to GitHub Pages from a local build: the built site goes to the gh-pages branch (only that branch is force-pushed).
set -e
cd "$(dirname "$0")/.."
npx turbo run build --filter=docs
dir=$(mktemp -d)
cp -R apps/docs/dist/. "$dir"/
touch "$dir/.nojekyll"
cd "$dir"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" commit -q -m "Deploy docs $(git -C "$OLDPWD" rev-parse --short HEAD)"
git remote add origin "$(git -C "$OLDPWD" remote get-url origin)"
git push -q -f origin gh-pages
echo "Published: https://gabrielgomesbarbosa.github.io/data-grid-kit/"
