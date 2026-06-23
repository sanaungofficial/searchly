#!/usr/bin/env python3
"""Generate simple Kimchi-green PNG icons for the extension."""

from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    raise SystemExit("Install Pillow: pip install pillow")

COLOR = (28, 58, 47, 255)
OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)

for size in (16, 48, 128):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    margin = max(1, size // 8)
    draw.rounded_rectangle(
        (margin, margin, size - margin, size - margin),
        radius=max(2, size // 5),
        fill=COLOR,
    )
    img.save(OUT / f"icon{size}.png")
    print(f"Wrote {OUT / f'icon{size}.png'}")
