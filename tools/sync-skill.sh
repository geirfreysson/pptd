#!/bin/sh
# The bundled skill (agent/plugin/skills/pptd-slides) is maintained in this repo.
# The spec and the checker have their canonical copies in docs/ and tools/;
# this copies them into the skill. Runs before every build.
set -e
cd "$(dirname "$0")/.."
DST=agent/plugin/skills/pptd-slides
cp docs/pptd-spec.md "$DST"/pptd-spec.md
cp tools/pptd-check.mjs "$DST"/pptd-check.mjs
echo "synced spec and checker -> $DST"
