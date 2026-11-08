#!/usr/bin/env bash
# Install the tarball into a scratch project and import it
# (release workflow's verify-artifacts job).
set -euo pipefail

TARBALL="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
scratch=""
cleanup() {
  if [[ -n "$scratch" ]]; then
    cd /
    rm -rf "$scratch"
  fi
}
trap cleanup EXIT

scratch="$(mktemp -d)"
cd "$scratch"
npm init -y >/dev/null
npm install --no-audit --no-fund "$TARBALL" >/dev/null
node --input-type=module -e "
const core = await import('@verifiably/nodes');
const keys = Object.keys(core);
if (keys.length === 0) throw new Error('no exports');
console.log('npm import smoke ok (' + keys.length + ' exports)');
"
cd / && rm -rf "$scratch"
scratch=""
