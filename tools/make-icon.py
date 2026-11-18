"""Build the macOS app icon from build/source-icon.png.

Puts the artwork on a white rounded square with Apple's icon-grid padding and a soft
shadow, then writes build/icon.png (1024 px) and build/icon.icns (via iconutil).
Usage: python3 tools/make-icon.py
"""
import os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..', 'build')
SIZE, BOX, RADIUS, ART = 1024, 824, 185, 720       # canvas, rounded square, corner, artwork

src = Image.open(os.path.join(ROOT, 'source-icon.png')).convert('RGBA')
canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
off = (SIZE - BOX) // 2

shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((off, off + 12, off + BOX, off + BOX + 12), RADIUS, fill=(0, 0, 0, 90))
canvas.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(14)))

mask = Image.new('L', (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle((off, off, off + BOX, off + BOX), RADIUS, fill=255)
tile = Image.new('RGBA', (SIZE, SIZE), (255, 255, 255, 255))
art = src.resize((ART, ART), Image.LANCZOS)
tile.alpha_composite(art, ((SIZE - ART) // 2, (SIZE - ART) // 2))
tile.putalpha(mask)
canvas.alpha_composite(tile)
canvas.save(os.path.join(ROOT, 'icon.png'))

with tempfile.TemporaryDirectory() as tmp:
    iconset = os.path.join(tmp, 'icon.iconset')
    os.mkdir(iconset)
    for s in (16, 32, 128, 256, 512):
        for scale in (1, 2):
            px = s * scale
            name = f'icon_{s}x{s}{"@2x" if scale == 2 else ""}.png'
            canvas.resize((px, px), Image.LANCZOS).save(os.path.join(iconset, name))
    subprocess.run(['iconutil', '-c', 'icns', iconset, '-o', os.path.join(ROOT, 'icon.icns')], check=True)
print('wrote build/icon.png and build/icon.icns')
