#!/usr/bin/env bash
# Builds the client and server and assembles staging/, the Docker build context:
#
#   staging/
#     package.json, package-lock.json   server manifest; the image installs production deps from it
#     dist/                             compiled server (server/dist)
#     public/                           built client (client/dist), served at / via CLIENT_DIST_DIR
#
# Usage: ./build.sh [--skip-tests]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGING="$ROOT/staging"

run_tests=true
for arg in "$@"; do
  case "$arg" in
    --skip-tests) run_tests=false ;;
    -h | --help)
      sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (try --help)" >&2
      exit 2
      ;;
  esac
done

step() { printf '\n==> %s\n' "$*"; }

# Installs dependencies from the lockfile when a package has none yet.
ensure_deps() {
  if [ ! -d "$1/node_modules" ]; then
    step "Installing $(basename "$1") dependencies"
    (cd "$1" && npm ci)
  fi
}

ensure_deps "$ROOT/client"
ensure_deps "$ROOT/server"

if [ "$run_tests" = true ]; then
  step "Testing client"
  (cd "$ROOT/client" && npm run lint && npm test)
  step "Testing server"
  (cd "$ROOT/server" && npm run typecheck && npm test)
fi

step "Building client -> client/dist"
(cd "$ROOT/client" && npm run build)

step "Building server -> server/dist"
(cd "$ROOT/server" && npm run build)

step "Assembling staging/"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp "$ROOT/server/package.json" "$ROOT/server/package-lock.json" "$STAGING/"
cp -R "$ROOT/server/dist" "$STAGING/dist"
cp -R "$ROOT/client/dist" "$STAGING/public"

step "Done"
echo "Staging directory: $STAGING"
echo "Building the image..."
docker build -f Dockerfile -t git-history-page staging
