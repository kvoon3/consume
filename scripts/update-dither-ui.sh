#!/usr/bin/env bash
# Refresh vendor/dither-ui from upstream and re-apply local patches.
# Usage: pnpm up:dither [ref]   (ref defaults to master)
set -euo pipefail

ref="${1:-master}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -sL "https://codeload.github.com/drvova/dither-ui/tar.gz/refs/heads/$ref" | tar xz -C "$tmp"
src="$tmp/dither-ui-$ref/dither-kit"
[ -d "$src" ] || { echo "dither-kit not found at ref $ref" >&2; exit 1; }

rsync -a --delete --exclude package.json "$src/" vendor/dither-ui/
# package.json is upstream's with our "private" tweak; keep ours, but take upstream version bumps
cp "$src/package.json" vendor/dither-ui/package.json

for patch in patches/dither-ui/*.patch; do
  git apply --directory=vendor/dither-ui "$patch"
done

node scripts/prune-dither-ui.mjs

pnpm install
echo "dither-ui updated to $ref with $(ls patches/dither-ui/*.patch | wc -l | tr -d ' ') local patch(es) applied"
