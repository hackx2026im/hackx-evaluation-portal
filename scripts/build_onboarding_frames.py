#!/usr/bin/env python3
"""
Build the onboarding slide imagery.

Reads raw screenshots from design/onboarding/raw/, crops them per
design/onboarding/shots.json, and composites each onto the same mint
surface the existing onboard1/onboard7 animations use, with rounded
corners and a soft shadow. Output lands in public/onboarding/.

Slides marked `passthrough` (the robot and shield GIFs) are left alone —
they are already assets in their own right and are only reported here so
the deck is visible in one place.

The modal renders these with object-cover inside a portrait panel, so the
screenshot is held inside a horizontal safe zone (maxInnerWidthPct) to
survive that crop, mirroring how the original GIFs centred their subject.

Usage:
    python3 scripts/build_onboarding_frames.py
    python3 scripts/build_onboarding_frames.py --only dashboard evaluation
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SPEC_PATH = ROOT / "design" / "onboarding" / "shots.json"
RAW_DIR = ROOT / "design" / "onboarding" / "raw"
OUT_DIR = ROOT / "public" / "onboarding"


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.lstrip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))  # type: ignore[return-value]


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [(0, 0), (size[0] - 1, size[1] - 1)], radius=radius, fill=255
    )
    return mask


def build_frame(spec: dict, slide: dict) -> Image.Image:
    cw = spec["canvas"]["width"]
    ch = spec["canvas"]["height"]
    margin = spec["margin"]
    radius = spec["cardRadius"]
    shadow_cfg = spec["shadow"]

    canvas = Image.new("RGB", (cw, ch), hex_to_rgb(spec["background"]))

    shot = Image.open(RAW_DIR / slide["source"]).convert("RGB")
    crop = slide.get("crop")
    if crop:
        x, y, w, h = crop
        shot = shot.crop((x, y, x + w, y + h))

    # Fit inside the margins, then clamp to the object-cover safe width.
    box_w = min(cw - 2 * margin, int(cw * spec.get("maxInnerWidthPct", 1.0)))
    box_h = ch - 2 * margin
    scale = min(box_w / shot.width, box_h / shot.height)
    inner = shot.resize(
        (max(1, round(shot.width * scale)), max(1, round(shot.height * scale))),
        Image.LANCZOS,
    )
    iw, ih = inner.size
    ox, oy = (cw - iw) // 2, (ch - ih) // 2

    # Soft shadow beneath the card.
    shadow = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        [(ox, oy + shadow_cfg["offsetY"]), (ox + iw, oy + ih + shadow_cfg["offsetY"])],
        radius=radius,
        fill=(0, 0, 0, int(255 * shadow_cfg["opacity"])),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_cfg["blur"] / 2))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow).convert("RGB")

    canvas.paste(inner, (ox, oy), rounded_mask((iw, ih), radius))

    # Hairline edge so the dark screenshot separates cleanly from the mint.
    border = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    ImageDraw.Draw(border).rounded_rectangle(
        [(ox, oy), (ox + iw - 1, oy + ih - 1)],
        radius=radius,
        outline=hex_to_rgb(spec["cardBorder"]) + (255,),
        width=2,
    )
    return Image.alpha_composite(canvas.convert("RGBA"), border).convert("RGB")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build onboarding slide frames.")
    parser.add_argument("--only", nargs="*", help="Only rebuild these slide keys.")
    args = parser.parse_args()

    spec = json.loads(SPEC_PATH.read_text())
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for i, slide in enumerate(spec["slides"], start=1):
        key = slide["key"]
        if args.only and key not in args.only:
            continue

        if "passthrough" in slide:
            print(f"  {i}. {key:<12} -> {slide['passthrough']} (reused, untouched)")
            continue

        src = RAW_DIR / slide["source"]
        if not src.exists():
            print(f"  {i}. {key:<12} -> MISSING {src.relative_to(ROOT)}", file=sys.stderr)
            continue

        frame = build_frame(spec, slide)
        out = OUT_DIR / f"slide-{key}.webp"
        frame.save(out, "WEBP", quality=90, method=6)
        print(f"  {i}. {key:<12} -> {out.name}  {frame.width}x{frame.height}  {out.stat().st_size / 1024:.1f} KB")

    print(f"\nOutput: {OUT_DIR.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
