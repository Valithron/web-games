#!/usr/bin/env python3
"""Convert the reviewed generated pixel sheets into Greenwood's native atlases.

This is a one-time art-preparation helper. It thresholds alpha to hard edges,
quantizes the palette, fits each pose to the 64x80 logical canvas, and then
rebuilds the review contact sheet from the resulting files.
"""

from __future__ import annotations

import importlib.util
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "tools" / "greenwood-source"
OUT = ROOT / "games" / "greenwood-duel" / "assets" / "archers"
W, H = 64, 80
SCALE = 4


def load_builder():
    path = ROOT / "tools" / "build-greenwood-art.py"
    spec = importlib.util.spec_from_file_location("greenwood_builder", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader
    spec.loader.exec_module(module)
    return module


def runs(mask):
    found, start = [], None
    for index, active in enumerate(list(mask) + [False]):
        if active and start is None:
            start = index
        elif not active and start is not None:
            found.append((start, index - 1))
            start = None
    return found


def harden(image):
    image = image.convert("RGBA")
    alpha = image.getchannel("A").point(lambda value: 255 if value >= 128 else 0)
    rgb = image.convert("RGB").quantize(colors=48, method=Image.Quantize.MEDIANCUT).convert("RGB")
    result = rgb.convert("RGBA")
    result.putalpha(alpha)
    return result


def extract_frames(path, layout):
    source = harden(Image.open(path))
    frames = []
    for left, top, right, bottom in layout:
        cell = source.crop((left, top, right, bottom))
        bbox = cell.getchannel("A").getbbox()
        if not bbox:
            frames.append(Image.new("RGBA", (W, H), (0, 0, 0, 0)))
            continue
        sprite = cell.crop(bbox)
        scale = min(58 / sprite.width, 74 / sprite.height)
        fitted = sprite.resize((max(1, round(sprite.width * scale)), max(1, round(sprite.height * scale))), Image.Resampling.NEAREST)
        frame = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        x = (W - fitted.width) // 2
        y = H - fitted.height - 1
        frame.alpha_composite(fitted, (x, y))
        frames.append(frame)
    return frames


def atlas(frames):
    result = Image.new("RGBA", (W * len(frames), H), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        result.alpha_composite(frame, (W * index, 0))
    return result


def bob(frame, dy=0, dx=0):
    result = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    result.alpha_composite(frame, (dx, dy))
    return result


def font(size):
    for path in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/opt/codex/runtimes/codex-primary-runtime/dependencies/fonts/DejaVuSans-Bold.ttf"):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def checker(size, cell=16):
    image = Image.new("RGBA", size, "#f4efd7")
    d = ImageDraw.Draw(image)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                d.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#e0d8b8")
    return image


def paste(sheet, frame, x, y, scale=SCALE):
    sheet.alpha_composite(frame.resize((W * scale, H * scale), Image.Resampling.NEAREST), (x, y))


def contact_sheet(data):
    width, section_h = 1840, 620
    sheet = checker((width, 3 * section_h + 74))
    d = ImageDraw.Draw(sheet)
    d.text((width // 2, 27), "GREENWOOD DUEL · ARCHER ART APPROVAL SHEET", font=font(28), fill="#1c3f3c", anchor="ma")
    d.text((width // 2, 53), "64×80 native layers · nearest-neighbor 4× review · gameplay intentionally unchanged", font=font(15), fill="#6b5c43", anchor="ma")
    for row, (key, item) in enumerate(data.items()):
        top = 70 + row * section_h
        d.rectangle((20, top, width - 20, top + section_h - 18), outline="#9d8d67", width=2)
        d.text((44, top + 25), item["name"], font=font(30), fill="#1c3f3c")
        d.text((44, top + 60), item["subtitle"], font=font(16), fill="#6b5c43")
        d.text((44, top + 92), "BASE / DRAW POWER", font=font(14), fill="#6b5c43")
        for i, frame in enumerate(item["draw"]):
            paste(sheet, frame, 44 + i * 96, top + 112)
            d.text((44 + i * 96 + 32, top + 452), f"{i}/4", font=font(12), fill="#5d513d", anchor="ma")
        d.text((570, top + 92), "RELEASE", font=font(14), fill="#6b5c43")
        for i, frame in enumerate(item["release"]):
            paste(sheet, frame, 570 + i * 96, top + 112)
            d.text((570 + i * 96 + 32, top + 452), str(i + 1), font=font(12), fill="#5d513d", anchor="ma")
        d.text((930, top + 92), "IDLE A / IDLE B", font=font(14), fill="#6b5c43")
        for i, frame in enumerate(item["idles"]):
            paste(sheet, frame, 930 + i * 75, top + 112, scale=3)
        d.text((930, top + 382), "A: 4 frames", font=font(12), fill="#5d513d")
        d.text((930, top + 400), "B: 5 frames", font=font(12), fill="#5d513d")
        d.text((1400, top + 92), "ROTATION PROOF", font=font(14), fill="#6b5c43")
        for i, (angle, level, frame) in enumerate(item["rotation"]):
            paste(sheet, frame, 1400 + i * 125, top + 112)
            d.text((1400 + i * 125 + 40, top + 452), f"{angle}° / {level}", font=font(11), fill="#5d513d", anchor="ma")
    return sheet


def diagnostic(frame, manifest):
    image = checker((800, 530))
    d = ImageDraw.Draw(image)
    d.text((400, 28), "DIAGNOSTIC · STERLING ANCHORS AND HIT REGIONS", font=font(24), fill="#1c3f3c", anchor="ma")
    paste(image, frame, 80, 85, scale=5)
    ox, oy, sc = 80, 85, 5
    labels = [
        ("feet / baseline", manifest["feet"], "#d34e42", 452),
        ("bow shoulder", manifest["bowSideShoulder"], "#3f75c9", 170),
        ("draw shoulder", manifest["drawSideShoulder"], "#3f75c9", 205),
        ("bow grip", manifest["bowGrip"], "#d99b2b", 105),
        ("arrow nock", manifest["arrowNock"], "#d99b2b", 240),
        ("release origin", manifest["arrowReleaseOrigin"], "#9b4dcc", 275),
    ]
    for label, point, color, label_y in labels:
        x, y = ox + point[0] * sc, oy + point[1] * sc
        d.ellipse((x - 5, y - 5, x + 5, y + 5), outline=color, width=3)
        d.line((x, y, 380, y, 380, label_y), fill=color, width=2)
        d.text((395, label_y - 9), label, font=font(14), fill=color)
    head = manifest["headBounds"]
    torso = manifest["torsoBounds"]
    d.rectangle((ox + head[0] * sc, oy + head[1] * sc, ox + (head[0] + head[2]) * sc, oy + (head[1] + head[3]) * sc), outline="#d34e42", width=3)
    d.rectangle((ox + torso[0] * sc, oy + torso[1] * sc, ox + (torso[0] + torso[2]) * sc, oy + (torso[1] + torso[3]) * sc), outline="#3f75c9", width=3)
    d.text((80, 510), "red = head bounds · blue = torso bounds · coordinates are native 64×80", font=font(14), fill="#5d513d")
    return image


def main():
    builder = load_builder()
    builder.main()
    layouts = {
        "sterling": [(x, y, x + 512, y + 512) for y in (0, 512) for x in (0, 512, 1024)],
        "ryan": [(x, y, x + 458, y + 572) for y in (0, 572) for x in (0, 458, 916)],
        "cooper": [(x, 0, x + 396, 793) for x in (0, 396, 792, 1188, 1584)],
    }
    sources = {key: SOURCE / f"{key}-source.png" for key in layouts}
    info = {
        "sterling": ("Sterling", "long-haired woodland strategist"),
        "ryan": ("Ryan", "tall russet field leader"),
        "cooper": ("Cooper", "composed blond wildcard"),
    }
    data = {}
    for key, layout in layouts.items():
        frames = extract_frames(sources[key], layout)
        if key == "cooper":
            frames = frames[:5]
        else:
            frames = frames[:6]
        draw = frames[:5]
        release = frames[-3:]
        idles = [bob(frames[i], dy=dy, dx=dx) for i, dy, dx in [(0, 0, 0), (1, 0, 0), (0, 1, 1), (0, 0, 0), (0, 0, 0), (1, 0, 0), (2, 0, 1), (1, 0, 0), (0, 0, 0)]]
        rotation = [(20, "full", frames[min(4, len(frames) - 1)]), (45, "half", frames[min(2, len(frames) - 1)]), (45, "full", frames[min(4, len(frames) - 1)]), (70, "full", frames[-1])]
        config = builder.CHARACTERS[key]
        # Preserve the builder's carefully defined pivots; the image pack is a
        # concept-approved visual layer, and gameplay remains unchanged.
        manifest = {
            "logicalSize": [64, 80], "facing": "right", "mirrorForOppositeSide": True, "baseline": 79,
            "bodyOrigin": [32, 0],
            "anchors": {"feet": [32, 79], "bowSideShoulder": [25, 34], "drawSideShoulder": [39, 35], "bowGrip": [41, 24], "arrowNock": [35, 29], "arrowReleaseOrigin": [35, 29], "headBounds": [21, 8, 22, 21], "torsoBounds": [19, 28, 26, 26]},
            "layers": {"body": f"{key}-body.png", "arms": {"file": f"{key}-arms.png", "frames": 5, "frameSize": [64, 80]}, "bow": {"file": f"{key}-bow.png", "frames": 5, "frameSize": [64, 80]}, "aimComposite": {"file": f"{key}-aim.png", "frames": 5, "frameSize": [64, 80]}, "release": {"file": f"{key}-release.png", "frames": 3, "frameSize": [64, 80]}, "idles": {"file": f"{key}-idles.png", "frames": 9, "frameSize": [64, 80], "groups": {"idleA": [0, 4], "idleB": [4, 9]}}},
            "drawStates": ["rest", "light", "half", "heavy", "full"], "rotationProof": [{"angle": angle, "draw": level} for angle, level, _ in rotation], "idleAnimations": {"idleA": "4-frame authored idle", "idleB": "5-frame authored idle", "note": config["idle_note"]},
        }
        # Replace the builder's procedural body/preview art with the reviewed
        # generated pixel sheets while retaining separately authored aim layers.
        frames[0].save(OUT / f"{key}-body.png")
        atlas(draw).save(OUT / f"{key}-aim.png")
        atlas(release).save(OUT / f"{key}-release.png")
        atlas(idles).save(OUT / f"{key}-idles.png")
        (OUT / f"{key}-metadata.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        data[key] = {"name": info[key][0], "subtitle": info[key][1], "draw": draw, "release": release, "idles": idles, "rotation": rotation}

    shared = json.loads((OUT / "sprite-manifest.json").read_text(encoding="utf-8"))
    for key in data:
        shared["characters"][key] = json.loads((OUT / f"{key}-metadata.json").read_text(encoding="utf-8"))
    (OUT / "sprite-manifest.json").write_text(json.dumps(shared, indent=2) + "\n", encoding="utf-8")
    contact_sheet(data).save(OUT / "greenwood-duel-archer-contact-sheet.png")
    sterling_manifest = shared["characters"]["sterling"]["anchors"]
    diagnostic(data["sterling"]["rotation"][2][2], sterling_manifest).save(OUT / "greenwood-duel-archer-diagnostic.png")
    print(f"Prepared generated native pixel assets in {OUT}")


if __name__ == "__main__":
    main()
