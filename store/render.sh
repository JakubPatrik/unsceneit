#!/usr/bin/env bash
# Renders the Chrome Web Store promo images from promo.html with headless
# Chrome, and the padded 128px icon from assets/icon.png. Needs Google Chrome
# and ImageMagick (`magick`).
set -euo pipefail
cd "$(dirname "$0")" # store/

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT

shot() { # size width height out
  # Headless windows can't be narrower than ~500px, so render wider and crop.
  local w=$(( $2 < 600 ? 600 : $2 ))
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --user-data-dir="$PROFILE" --window-size="$w,$3" --virtual-time-budget=1500 \
    --screenshot="$4.tmp.png" "file://$PWD/promo.html?size=$1" 2>/dev/null
  magick "$4.tmp.png" -crop "$2x$3+0+0" +repage -alpha off -strip "$4"
  rm "$4.tmp.png"
  echo "✓ $4 ($(magick identify -format '%wx%h' "$4"))"
}

shot small 440 280 promo-small-440x280.png
shot marquee 1400 560 promo-marquee-1400x560.png
shot og 1200 630 og-1200x630.png
cp og-1200x630.png ../website/public/og.png
echo "  (also website/public/og.png)"
shot banner 2560 1440 youtube-banner-2560x1440.png
shot thumb 1280 720 youtube-thumbnail-1280x720.png

# Icon: 96×96 artwork centred in 128×128 with 16px transparent padding.
magick ../assets/icon.png -background none -gravity center -extent 363x363 \
  -resize 96x96 -extent 128x128 -strip icon-128.png
cp icon-128.png ../extension/icons/icon-128.png
echo "✓ icon-128.png (also extension/icons/icon-128.png)"

# YouTube video watermark: the icon on a transparent 300×300 square.
magick ../assets/icon.png -background none -gravity center -extent 363x363 \
  -resize 300x300 -strip youtube-watermark-300x300.png
echo "✓ youtube-watermark-300x300.png"
