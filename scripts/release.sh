#!/usr/bin/env bash
set -euo pipefail

bump="${1:-patch}"
case "$bump" in
  patch | minor | major) ;;
  *)
    echo "Usage: npm run release, npm run release:minor or npm run release:major" >&2
    exit 1
    ;;
esac

branch="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$branch" == "HEAD" ]]; then
  echo "Check out a branch before releasing." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Commit or stash your changes before releasing." >&2
  exit 1
fi

git fetch --quiet origin "$branch"
if [[ "$(git rev-list --count "HEAD..origin/$branch")" != "0" ]]; then
  echo "origin/$branch has commits you don't have. Pull them first." >&2
  exit 1
fi

if [[ "${SKIP_CHECKS:-}" != "1" ]]; then
  npm run lint
  npm run lint:rust
  npm run build
fi

tag="$(npm version "$bump" -m "Release v%s")"
git push --follow-tags origin "$branch"
echo "Pushed $tag. GitHub Actions is building the release:"
echo "https://github.com/sagarsen2023/aurolis-api-client/actions/workflows/release.yml"
