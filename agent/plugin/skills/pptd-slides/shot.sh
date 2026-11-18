#!/usr/bin/env bash
# Screenshot one slide of a radio-navigated deck.
# Usage: shot.sh deck.html SLIDE_NUMBER out.png [WIDTHxHEIGHT]
# Example: shot.sh docs/deck.html 4 /tmp/s4.png 1280x720
set -euo pipefail
deck="$1"; n="$2"; out="$3"; size="${4:-1280x720}"
tmp="$(dirname "$out")/.shot-$n.html"
# Move "checked" from r1 to rN in a temporary copy.
sed -E 's/(id="r1" class="slide-radio") checked/\1/; s/(id="r'"$n"'" class="slide-radio")/\1 checked/' "$deck" > "$tmp"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --virtual-time-budget=1500 --window-size="${size/x/,}" --screenshot="$out" "file://$(cd "$(dirname "$tmp")" && pwd)/$(basename "$tmp")" 2>/dev/null
rm -f "$tmp"
echo "$out"
