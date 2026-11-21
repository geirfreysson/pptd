#!/bin/sh
# The bundled skill (agent/plugin/skills/pptd-slides) is maintained in this repo.
# The spec, the checker and the deck tool have their canonical copies in docs/ and tools/;
# this copies them into the skill, then builds each style's template.html from
# tools/style-deck.html and the style's style.css. Runs before every build.
set -e
cd "$(dirname "$0")/.."
DST=agent/plugin/skills/pptd-slides
cp docs/pptd-spec.md "$DST"/pptd-spec.md
cp tools/pptd-check.mjs "$DST"/pptd-check.mjs
cp tools/pptd-deck.mjs "$DST"/pptd-deck.mjs
echo "synced spec, checker and deck tool -> $DST"
node tools/build-styles.mjs
