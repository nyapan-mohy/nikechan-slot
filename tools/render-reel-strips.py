#!/usr/bin/env python3
import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
CELL_SIZE = 128
REEL_LENGTH = 21
BONUS_BOX = 120
NORMAL_BOX = 90

SYMBOL_IMAGES = {
    "AI_NIKECHAN": ROOT / "assets/images/symbols/symbol-ai-nikechan.png",
    "MASTER_NIKECHAN": ROOT / "assets/images/symbols/symbol-master-nikechan.png",
    "LOGO_BAR": ROOT / "assets/images/symbols/source/symbol-logo-bar-alpha-1254.png",
    "BELL": ROOT / "assets/images/symbols/symbol-bell.png",
    "CHERRY": ROOT / "assets/images/symbols/symbol-cherry.png",
    "SUIKA": ROOT / "assets/images/symbols/symbol-watermelon.png",
    "REPLAY": ROOT / "assets/images/symbols/symbol-replay.png",
    "BLANK": ROOT / "assets/images/symbols/symbol-blank.png",
}

BONUS_SYMBOLS = {"AI_NIKECHAN", "MASTER_NIKECHAN", "LOGO_BAR"}
OUTPUT_DIR = ROOT / "assets/images/reel-strips"

def alpha_bbox(image):
    alpha = image.getchannel("A")
    return alpha.getbbox()


def fit_symbol(symbol_id):
    image = Image.open(SYMBOL_IMAGES[symbol_id]).convert("RGBA")
    bbox = alpha_bbox(image)
    if bbox:
        image = image.crop(bbox)

    target = BONUS_BOX if symbol_id in BONUS_SYMBOLS else NORMAL_BOX
    scale = min(target / image.width, target / image.height)
    size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
    return image.resize(size, Image.Resampling.LANCZOS)


def render_strip(reel_id, symbols, symbol_cache):
    if len(symbols) != REEL_LENGTH:
        raise ValueError(f"{reel_id} reel length must be {REEL_LENGTH}, got {len(symbols)}")

    strip = Image.new("RGBA", (CELL_SIZE, CELL_SIZE * REEL_LENGTH), (247, 244, 235, 255))
    draw = ImageDraw.Draw(strip)

    for index, symbol_id in enumerate(symbols):
        top = index * CELL_SIZE
        draw.rectangle((0, top, CELL_SIZE - 1, top + CELL_SIZE - 1), outline=(218, 209, 190, 255))

        symbol = symbol_cache[symbol_id]
        x = (CELL_SIZE - symbol.width) // 2
        y = top + (CELL_SIZE - symbol.height) // 2
        strip.alpha_composite(symbol, (x, y))

    return strip


def render_contact(strips):
    gap = 16
    width = CELL_SIZE * 3 + gap * 2
    height = CELL_SIZE * REEL_LENGTH
    contact = Image.new("RGBA", (width, height), (33, 34, 32, 255))

    for index, key in enumerate(["left", "center", "right"]):
        contact.alpha_composite(strips[key], (index * (CELL_SIZE + gap), 0))

    return contact


def main():
    reels_path = ROOT / "src/data/reels.json"
    reels = json.loads(reels_path.read_text(encoding="utf-8"))["reels"]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    symbol_cache = {symbol_id: fit_symbol(symbol_id) for symbol_id in SYMBOL_IMAGES}

    strips = {}
    for reel_id in ["left", "center", "right"]:
        strips[reel_id] = render_strip(reel_id, reels[reel_id], symbol_cache)
        strips[reel_id].save(OUTPUT_DIR / f"reel-strip-{reel_id}.png")

    render_contact(strips).save(OUTPUT_DIR / "reel-strips-contact.png")


if __name__ == "__main__":
    main()
