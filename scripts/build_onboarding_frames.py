#!/usr/bin/env python3
"""
Build the onboarding slide imagery.

Reads raw screenshots from design/onboarding/raw/, crops them per
design/onboarding/shots.json, and composites each one onto a neutral
monochrome surface with rounded corners and a soft shadow. Output lands
in public/onboarding/slideN.webp at the aspect the modal expects (4:5).

A slide whose source screenshot is missing is rendered as a labelled
placeholder in the identical frame style, so the deck is never broken
and the treatment stays reviewable while screenshots are collected.

Usage:
    python3 scripts/build_onboarding_frames.py
    python3 scripts/build_onboarding_frames.py --only 3 5
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SPEC_PATH = ROOT / "design" / "onboarding" / "shots.json"
RAW_DIR = ROOT / "design" / "onboarding" / "raw"
OUT_DIR = ROOT / "public" / "onboarding"


# ── helpers ───────────────────────────────────────────────────────────────────

def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Best-effort system font lookup; falls back to Pillow's default."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNS.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (size[0] - 1, size[1] - 1)], radius=radius, fill=255)
    return mask


def make_placeholder(size: tuple[int, int], label: str, n: int) -> Image.Image:
    """A dark, empty stand-in that matches the app's dark theme."""
    w, h = size
    img = Image.new("RGB", size, (17, 17, 17))
    draw = ImageDraw.Draw(img)

    # A couple of muted bars so the placeholder reads as "UI goes here".
    bar = (34, 34, 34)
    draw.rounded_rectangle([(48, 48), (w - 48, 108)], radius=10, fill=bar)
    for i in range(3):
        top = 140 + i * 84
        draw.rounded_rectangle([(48, top), (w - 48, top + 64)], radius=10, fill=bar)

    title_font = load_font(38)
    sub_font = load_font(26)
    title = f"Slide {n}"
    sub = label

    tw = draw.textlength(title, font=title_font)
    sw = draw.textlength(sub, font=sub_font)
    cy = h // 2 + 60
    draw.text(((w - tw) / 2, cy), title, font=title_font, fill=(180, 180, 180))
    draw.text(((w - sw) / 2, cy + 54), sub, font=sub_font, fill=(110, 110, 110))

    return img


def fit_within(img: Image.Image, box_w: int, box_h: int) -> Image.Image:
    """Scale preserving aspect so the image fits entirely inside the box."""
    scale = min(box_w / img.width, box_h / img.height)
    new_size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    return img.resize(new_size, Image.LANCZOS)


# ── frame composition ─────────────────────────────────────────────────────────

def build_frame(spec: dict, slide: dict) -> Image.Image:
    cw = spec["canvas"]["width"]
    ch = spec["canvas"]["height"]
    margin = spec["margin"]
    radius = spec["cardRadius"]
    shadow_cfg = spec["shadow"]

    canvas = Image.new("RGB", (cw, ch), hex_to_rgb(spec["background"]))

    src_path = RAW_DIR / slide["source"]
    if src_path.exists():
        shot = Image.open(src_path).convert("RGB")
        crop = slide.get("crop")
        if crop:
            x, y, w, h = crop
            shot = shot.crop((x, y, x + w, y + h))
    else:
        # Placeholder keeps the 4:5 inner area so framing matches the real thing.
        shot = make_placeholder((880, 1100), slide.get("label", ""), slide["n"])

    inner = fit_within(shot, cw - 2 * margin, ch - 2 * margin)
    iw, ih = inner.size
    ox = (cw - iw) // 2
    oy = (ch - ih) // 2

    # Soft shadow beneath the card.
    blur = shadow_cfg["blur"]
    pad = blur * 3
    shadow_layer = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow_layer)
    shadow_draw.rounded_rectangle(
        [(ox, oy + shadow_cfg["offsetY"]), (ox + iw, oy + ih + shadow_cfg["offsetY"])],
        radius=radius,
        fill=(0, 0, 0, int(255 * shadow_cfg["opacity"])),
    )
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur / 2))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow_layer).convert("RGB")

    # Rounded screenshot on top.
    mask = rounded_mask((iw, ih), radius)
    canvas.paste(inner, (ox, oy), mask)

    # Hairline border to separate a dark screenshot from the light surface.
    border = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        [(ox, oy), (ox + iw - 1, oy + ih - 1)],
        radius=radius,
        outline=hex_to_rgb(spec["cardBorder"]) + (255,),
        width=2,
    )
    canvas = Image.alpha_composite(canvas.convert("RGBA"), border).convert("RGB")

    return canvas


# ── entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Build onboarding slide frames.")
    parser.add_argument("--only", nargs="*", type=int, help="Only rebuild these slide numbers.")
    args = parser.parse_args()

    spec = json.loads(SPEC_PATH.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    built, placeholders = 0, []
    for slide in spec["slides"]:
        n = slide["n"]
        if args.only and n not in args.only:
            continue

        frame = build_frame(spec, slide)
        out_path = OUT_DIR / f"slide{n}.webp"
        frame.save(out_path, "WEBP", quality=88, method=6)

        is_placeholder = not (RAW_DIR / slide["source"]).exists()
        if is_placeholder:
            placeholders.append(n)
        built += 1
        kb = out_path.stat().st_size / 1024
        flag = "  (placeholder)" if is_placeholder else ""
        print(f"  slide{n}.webp  {frame.width}x{frame.height}  {kb:6.1f} KB{flag}")

    print(f"\nBuilt {built} frame(s) into {OUT_DIR.relative_to(ROOT)}")
    if placeholders:
        missing = ", ".join(f"slide{n}.png" for n in placeholders)
        print(f"Awaiting screenshots in design/onboarding/raw/: {missing}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
