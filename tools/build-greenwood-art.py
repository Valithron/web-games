#!/usr/bin/env python3
"""Build Greenwood Duel's review-stage pixel archer assets.

The game does not import this file at runtime. It authors native 64x80 pixel
layers and the enlarged contact sheet used for visual approval.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "games" / "greenwood-duel" / "assets" / "archers"
SCALE = 4
FRAME_W, FRAME_H = 64, 80


CHARACTERS = {
    "sterling": {
        "name": "Sterling",
        "subtitle": "woodland strategist",
        "skin": "#e4aa78",
        "skin_shadow": "#ad694f",
        "hair": "#30221e",
        "hair_hi": "#5e4030",
        "shirt": "#1f5945",
        "shirt_shadow": "#123d35",
        "trim": "#c69a48",
        "pants": "#263d3d",
        "pants_hi": "#405a55",
        "boot": "#4a3026",
        "boot_hi": "#8c5c37",
        "metal": "#b9c9c3",
        "hair_style": "long",
        "body_width": 25,
        "head_width": 22,
        "shoulders": (20, 44),
        "idle_note": "settled watch / gear adjustment",
    },
    "ryan": {
        "name": "Ryan",
        "subtitle": "tall field leader",
        "skin": "#e7b17f",
        "skin_shadow": "#b97557",
        "hair": "#633727",
        "hair_hi": "#a9653b",
        "shirt": "#99472f",
        "shirt_shadow": "#5f2d29",
        "trim": "#d5a44e",
        "pants": "#4b3531",
        "pants_hi": "#765044",
        "boot": "#4b3026",
        "boot_hi": "#96643b",
        "metal": "#d6b766",
        "hair_style": "quiff",
        "body_width": 29,
        "head_width": 24,
        "shoulders": (18, 47),
        "idle_note": "lookout / shoulder reset",
    },
    "cooper": {
        "name": "Cooper",
        "subtitle": "composed wildcard",
        "skin": "#e1a571",
        "skin_shadow": "#a9614c",
        "hair": "#d4b65e",
        "hair_hi": "#f1d884",
        "shirt": "#416a4b",
        "shirt_shadow": "#294b3d",
        "trim": "#c4a243",
        "pants": "#584733",
        "pants_hi": "#7d6846",
        "boot": "#4c3024",
        "boot_hi": "#90603a",
        "metal": "#d9c982",
        "hair_style": "medium",
        "body_width": 26,
        "head_width": 22,
        "shoulders": (19, 45),
        "idle_note": "loose stance / bow fidget",
    },
}


def blank() -> Image.Image:
    return Image.new("RGBA", (FRAME_W, FRAME_H), (0, 0, 0, 0))


def px(draw: ImageDraw.ImageDraw, box, fill):
    draw.rectangle(box, fill=fill)


def pixel_line(draw: ImageDraw.ImageDraw, points, fill, width=2):
    draw.line([(round(x), round(y)) for x, y in points], fill=fill, width=width, joint="curve")


def stepped_ellipse(draw: ImageDraw.ImageDraw, box, fill, outline=None):
    """Use a deliberately stepped silhouette rather than a smooth vector oval."""
    x0, y0, x1, y1 = box
    mid = (x0 + x1) // 2
    rows = [
        (y0 + 2, x0 + 5, x1 - 5),
        (y0 + 1, x0 + 3, x1 - 3),
        (y0, x0 + 5, x1 - 5),
        (y1 - 2, x0 + 5, x1 - 5),
        (y1 - 1, x0 + 3, x1 - 3),
    ]
    draw.rectangle((x0 + 3, y0 + 3, x1 - 3, y1 - 3), fill=fill)
    for y, left, right in rows:
        draw.line((left, y, right, y), fill=fill, width=1)
    if outline:
        pixel_line(draw, [(x0 + 5, y0), (x1 - 5, y0), (x1, y0 + 5), (x1, y1 - 5), (x1 - 5, y1), (x0 + 5, y1), (x0, y1 - 5), (x0, y0 + 5), (x0 + 5, y0)], outline, 1)


def draw_hair(draw, c, cx, head_y, bob=0):
    hair = c["hair"]
    hi = c["hair_hi"]
    style = c["hair_style"]
    if style == "long":
        px(draw, (cx - 13, head_y + 2 + bob, cx + 13, head_y + 17 + bob), hair)
        px(draw, (cx - 15, head_y + 8 + bob, cx - 10, head_y + 38 + bob), hair)
        px(draw, (cx + 10, head_y + 8 + bob, cx + 15, head_y + 38 + bob), hair)
        px(draw, (cx - 17, head_y + 22 + bob, cx - 12, head_y + 43 + bob), hair)
        px(draw, (cx + 12, head_y + 21 + bob, cx + 17, head_y + 41 + bob), hair)
        pixel_line(draw, [(cx - 10, head_y + 4 + bob), (cx - 5, head_y + 1 + bob), (cx, head_y + 4 + bob)], hi, 2)
        px(draw, (cx + 7, head_y + 3 + bob, cx + 10, head_y + 5 + bob), "#a6a18b")
    elif style == "quiff":
        px(draw, (cx - 13, head_y + 3 + bob, cx + 13, head_y + 16 + bob), hair)
        px(draw, (cx - 16, head_y + 1 + bob, cx - 5, head_y + 8 + bob), hair)
        px(draw, (cx - 10, head_y - 3 + bob, cx + 4, head_y + 5 + bob), hair)
        px(draw, (cx - 2, head_y - 6 + bob, cx + 10, head_y + 5 + bob), hair)
        px(draw, (cx + 8, head_y + 2 + bob, cx + 14, head_y + 12 + bob), hair)
        pixel_line(draw, [(cx - 9, head_y + 1 + bob), (cx - 1, head_y - 3 + bob), (cx + 7, head_y - 2 + bob)], hi, 2)
    else:
        px(draw, (cx - 13, head_y + 2 + bob, cx + 13, head_y + 16 + bob), hair)
        px(draw, (cx - 15, head_y + 8 + bob, cx - 10, head_y + 28 + bob), hair)
        px(draw, (cx + 10, head_y + 8 + bob, cx + 15, head_y + 30 + bob), hair)
        pixel_line(draw, [(cx - 9, head_y + 4 + bob), (cx, head_y + 1 + bob), (cx + 8, head_y + 4 + bob)], hi, 2)
        px(draw, (cx - 2, head_y + 1 + bob, cx + 1, head_y + 3 + bob), "#f3db87")


def draw_body(c, bob=0, shift=0, expression="ready", stance=0):
    img = blank()
    d = ImageDraw.Draw(img)
    outline = "#172522"
    cx = 32 + shift
    head_y = 8 + bob
    body_w = c["body_width"]
    left, right = cx - body_w // 2, cx + body_w // 2

    # Legs and boots, kept on the shared 79-pixel baseline.
    hip_y = 51 + bob
    leg_gap = 3 + stance
    px(d, (cx - 10 - leg_gap, hip_y, cx - 2, 70 + bob), c["pants"])
    px(d, (cx + 2, hip_y, cx + 10 + leg_gap, 70 + bob), c["pants"])
    px(d, (cx - 9 - leg_gap, 68 + bob, cx - 1, 75 + bob), c["pants_hi"])
    px(d, (cx + 1, 68 + bob, cx + 9 + leg_gap, 75 + bob), c["pants_hi"])
    px(d, (cx - 12 - leg_gap, 74 + bob, cx - 1, 78 + bob), c["boot"])
    px(d, (cx + 1, 74 + bob, cx + 12 + leg_gap, 78 + bob), c["boot"])
    px(d, (cx - 10 - leg_gap, 74 + bob, cx - 4 - leg_gap, 75 + bob), c["boot_hi"])
    px(d, (cx + 3, 74 + bob, cx + 9, 75 + bob), c["boot_hi"])

    # Torso and belt.
    px(d, (left + 3, 28 + bob, right - 3, 53 + bob), c["shirt_shadow"])
    px(d, (left, 32 + bob, right, 48 + bob), c["shirt"])
    px(d, (left + 3, 29 + bob, right - 3, 34 + bob), c["shirt"])
    px(d, (left + 2, 48 + bob, right - 2, 51 + bob), c["trim"])
    px(d, (cx - 2, 48 + bob, cx + 2, 52 + bob), c["trim"])
    px(d, (cx - 1, 49 + bob, cx + 1, 50 + bob), outline)
    # A stable back arm/sleeve gives the layered arm pieces something to overlap.
    px(d, (left - 4, 32 + bob, left + 2, 46 + bob), c["shirt_shadow"])
    px(d, (left - 5, 42 + bob, left + 1, 48 + bob), c["skin_shadow"])

    # Neck and stepped face.
    px(d, (cx - 5, 23 + bob, cx + 5, 31 + bob), c["skin_shadow"])
    stepped_ellipse(d, (cx - c["head_width"] // 2, head_y, cx + c["head_width"] // 2, 29 + bob), c["skin"], outline)
    draw_hair(d, c, cx, head_y, bob)
    # Brow and eye pixels, deliberately understated at gameplay scale.
    px(d, (cx - 8, 17 + bob, cx - 3, 18 + bob), outline)
    px(d, (cx + 3, 17 + bob, cx + 8, 18 + bob), outline)
    px(d, (cx - 6, 19 + bob, cx - 4, 20 + bob), "#87523c" if c["hair_style"] != "medium" else "#6d8390")
    px(d, (cx + 4, 19 + bob, cx + 6, 20 + bob), "#87523c" if c["hair_style"] != "medium" else "#6d8390")
    # Nose and mouth / mustache recognition anchors.
    px(d, (cx - 1, 20 + bob, cx + 2, 22 + bob), c["skin_shadow"])
    if c["hair_style"] == "quiff":
        px(d, (cx - 4, 23 + bob, cx + 5, 25 + bob), c["skin"])
    else:
        px(d, (cx - 5, 22 + bob, cx + 5, 25 + bob), "#5a3327" if c["hair_style"] == "long" else "#8e5d32")
        px(d, (cx - 2, 25 + bob, cx + 3, 26 + bob), c["skin_shadow"])
    if expression == "smirk":
        px(d, (cx + 1, 25 + bob, cx + 6, 26 + bob), outline)
    elif expression == "focus":
        px(d, (cx - 5, 24 + bob, cx + 5, 25 + bob), outline)
    else:
        px(d, (cx - 2, 25 + bob, cx + 4, 26 + bob), outline)

    # Earrings / chain details are intentionally tiny recognition marks.
    if c["hair_style"] == "long":
        px(d, (cx - 12, 20 + bob, cx - 11, 23 + bob), c["metal"])
        px(d, (cx - 2, 28 + bob, cx, 32 + bob), c["metal"])
    elif c["hair_style"] == "quiff":
        px(d, (cx - 2, 28 + bob, cx + 2, 29 + bob), c["metal"])

    # Clothing outline pixels keep the shapes from reading as flat rectangles.
    pixel_line(d, [(left + 2, 32 + bob), (left - 2, 39 + bob), (left + 1, 43 + bob)], outline, 2)
    pixel_line(d, [(right - 2, 32 + bob), (right + 2, 39 + bob), (right - 1, 43 + bob)], outline, 2)
    return img


def aim_parts(c, draw_level=0, angle=45, release=False):
    arms = blank()
    bow = blank()
    da = ImageDraw.Draw(arms)
    db = ImageDraw.Draw(bow)
    outline = "#172522"
    cx = 32
    shoulder_bow = (cx - 7, 34)
    shoulder_draw = (cx + 7, 35)
    radians = math.radians(angle)
    ux, uy = math.cos(radians), -math.sin(radians)
    pxv, pyv = -uy, ux
    grip = (shoulder_bow[0] + ux * 13, shoulder_bow[1] + uy * 13)
    draw_length = 5 + draw_level * 8
    nock = (grip[0] - ux * draw_length, grip[1] - uy * draw_length)
    elbow = (shoulder_draw[0] + pxv * 7 - ux * draw_length * 0.45, shoulder_draw[1] + pyv * 7 - uy * draw_length * 0.45)
    # Pixel limbs with dark outline and a colored sleeve/skin center.
    pixel_line(da, [shoulder_bow, grip], outline, 5)
    pixel_line(da, [shoulder_bow, grip], c["skin"], 3)
    pixel_line(da, [shoulder_draw, elbow, nock], outline, 5)
    pixel_line(da, [shoulder_draw, elbow, nock], c["skin"], 3)
    px(da, (round(grip[0] - 2), round(grip[1] - 2), round(grip[0] + 2), round(grip[1] + 2)), c["skin_shadow"])
    if not release:
        px(da, (round(nock[0] - 2), round(nock[1] - 2), round(nock[0] + 2), round(nock[1] + 2)), c["skin"])

    # Bow is perpendicular to the fired arrow, slightly convex away from the string.
    span = 11 + draw_level * 0.6
    top = (grip[0] + pxv * span, grip[1] + pyv * span)
    bottom = (grip[0] - pxv * span, grip[1] - pyv * span)
    curve = (grip[0] + ux * 2, grip[1] + uy * 2)
    pixel_line(db, [top, curve, bottom], outline, 4)
    pixel_line(db, [top, curve, bottom], c["trim"], 2)
    # String and arrow are separate-looking pieces inside the bow layer.
    pixel_line(db, [top, nock, bottom], "#e8dfb9", 1)
    if draw_level or release:
        arrow_end = (nock[0] + ux * 21, nock[1] + uy * 21)
        pixel_line(db, [nock, arrow_end], outline, 3)
        pixel_line(db, [nock, arrow_end], "#d8bd78", 1)
        px(db, (round(arrow_end[0] - ux * 3 - 1), round(arrow_end[1] - uy * 3 - 1), round(arrow_end[0] - ux * 3 + 1), round(arrow_end[1] - uy * 3 + 1)), "#f4e8b2")
    return arms, bow, {"bowGrip": [round(grip[0], 2), round(grip[1], 2)], "arrowNock": [round(nock[0], 2), round(nock[1], 2)], "releaseOrigin": [round(nock[0], 2), round(nock[1], 2)]}


def composite(c, draw_level=0, angle=45, bob=0, shift=0, expression="ready", stance=0, release=False):
    body = draw_body(c, bob=bob, shift=shift, expression=expression, stance=stance)
    arms, bow, anchors = aim_parts(c, draw_level=draw_level, angle=angle, release=release)
    body.alpha_composite(arms)
    body.alpha_composite(bow)
    return body, anchors


def atlas(images, frame_w=FRAME_W, frame_h=FRAME_H):
    sheet = Image.new("RGBA", (frame_w * len(images), frame_h), (0, 0, 0, 0))
    for index, image in enumerate(images):
        sheet.alpha_composite(image, (index * frame_w, 0))
    return sheet


def label_font(size=18):
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/opt/codex/runtimes/codex-primary-runtime/dependencies/fonts/DejaVuSans-Bold.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def nearest_scale(image, factor=SCALE):
    return image.resize((image.width * factor, image.height * factor), Image.Resampling.NEAREST)


def checker_background(size, cell=16):
    img = Image.new("RGBA", size, "#f4efd7")
    d = ImageDraw.Draw(img)
    for y in range(0, size[1], cell):
        for x in range(0, size[0], cell):
            if (x // cell + y // cell) % 2:
                d.rectangle((x, y, x + cell - 1, y + cell - 1), fill="#e0d8b8")
    return img


def place_sprite(sheet, image, x, y, scale=SCALE, background=True):
    scaled = nearest_scale(image, scale)
    if background:
        sheet.alpha_composite(scaled, (x, y))
    else:
        sheet.alpha_composite(scaled, (x, y))


def draw_text(d, xy, text, size=18, fill="#332c23", anchor=None):
    d.text(xy, text, font=label_font(size), fill=fill, anchor=anchor)


def make_contact_sheet(all_data):
    width = 1840
    section_h = 620
    sheet = checker_background((width, 3 * section_h + 70), cell=16)
    d = ImageDraw.Draw(sheet)
    draw_text(d, (width // 2, 28), "GREENWOOD DUEL · ARCHER ART APPROVAL SHEET", size=28, fill="#1c3f3c", anchor="ma")
    draw_text(d, (width // 2, 54), "64×80 native layers · nearest-neighbor 4× review · gameplay intentionally unchanged", size=15, fill="#6b5c43", anchor="ma")

    for row, (key, data) in enumerate(all_data.items()):
        top = 70 + row * section_h
        d.rectangle((20, top, width - 20, top + section_h - 18), outline="#9d8d67", width=2)
        draw_text(d, (44, top + 24), data["config"]["name"], size=30, fill="#1c3f3c")
        draw_text(d, (44, top + 60), data["config"]["subtitle"], size=16, fill="#6b5c43")
        draw_text(d, (44, top + 92), "BASE / DRAW POWER", size=14, fill="#6b5c43")
        for i, frame in enumerate(data["draw_frames"]):
            place_sprite(sheet, frame, 44 + i * 96, top + 112)
            draw_text(d, (44 + i * 96 + 32, top + 112 + 4 * 80 + 8), f"{i}/4", size=12, fill="#5d513d", anchor="ma")

        draw_text(d, (570, top + 92), "RELEASE", size=14, fill="#6b5c43")
        for i, frame in enumerate(data["release_frames"]):
            place_sprite(sheet, frame, 570 + i * 96, top + 112)
            draw_text(d, (570 + i * 96 + 32, top + 112 + 4 * 80 + 8), str(i + 1), size=12, fill="#5d513d", anchor="ma")

        draw_text(d, (930, top + 92), "IDLE A / IDLE B", size=14, fill="#6b5c43")
        for i, frame in enumerate(data["idle_frames"]):
            place_sprite(sheet, frame, 930 + i * 75, top + 112, scale=3)
        draw_text(d, (930, top + 112 + 3 * 80 + 10), "A: 4 frames", size=12, fill="#5d513d")
        draw_text(d, (930, top + 112 + 3 * 80 + 28), "B: 5 frames", size=12, fill="#5d513d")

        draw_text(d, (1400, top + 92), "ROTATION PROOF", size=14, fill="#6b5c43")
        for i, (angle, level, frame) in enumerate(data["rotation_frames"]):
            place_sprite(sheet, frame, 1400 + i * 125, top + 112)
            draw_text(d, (1400 + i * 125 + 40, top + 112 + 4 * 80 + 8), f"{angle}° / {level}", size=11, fill="#5d513d", anchor="ma")

    return sheet


def make_diagnostic(data):
    img = checker_background((800, 530), cell=16)
    d = ImageDraw.Draw(img)
    draw_text(d, (400, 28), "DIAGNOSTIC · STERLING ANCHORS AND HIT REGIONS", size=24, fill="#1c3f3c", anchor="ma")
    frame, anchors = composite(CHARACTERS["sterling"], draw_level=4, angle=45, expression="focus")
    place_sprite(img, frame, 80, 85, scale=5)
    ox, oy, sc = 80, 85, 5
    points = {
        "feet / baseline": (32, 79),
        "bow shoulder": (25, 34),
        "draw shoulder": (39, 35),
        "bow grip": tuple(anchors["bowGrip"]),
        "arrow nock": tuple(anchors["arrowNock"]),
        "release origin": tuple(anchors["releaseOrigin"]),
    }
    colors = ["#d34e42", "#3f75c9", "#3f75c9", "#d99b2b", "#d99b2b", "#9b4dcc"]
    for (label, point), color in zip(points.items(), colors):
        x, y = ox + point[0] * sc, oy + point[1] * sc
        d.ellipse((x - 5, y - 5, x + 5, y + 5), outline=color, width=3)
        d.line((x, y, x + 150, y), fill=color, width=2)
        draw_text(d, (x + 158, y - 9), label, size=14, fill=color)
    d.rectangle((ox + (21 * sc), oy + (8 * sc), ox + (43 * sc), oy + (29 * sc)), outline="#d34e42", width=3)
    d.rectangle((ox + (19 * sc), oy + (28 * sc), ox + (45 * sc), oy + (54 * sc)), outline="#3f75c9", width=3)
    draw_text(d, (80, 475), "red = head bounds · blue = torso bounds · all coordinates are native 64×80", size=14, fill="#5d513d")
    return img


def build_character(key, config):
    draw_frames = []
    arms_frames = []
    bow_frames = []
    aim_frames = []
    for level in range(5):
        arms, bow, anchors = aim_parts(config, draw_level=level, angle=45)
        base = draw_body(config)
        full = base.copy()
        full.alpha_composite(arms)
        full.alpha_composite(bow)
        draw_frames.append(full)
        arms_frames.append(arms)
        bow_frames.append(bow)
        aim_frames.append(full)

    release_frames = []
    for release, level in [(False, 4), (True, 4), (False, 1)]:
        frame, _ = composite(config, draw_level=level, angle=45, release=release, expression="focus" if release else "ready")
        release_frames.append(frame)

    idle_a = [composite(config, draw_level=0, angle=40, bob=bob, shift=shift, stance=stance)[0] for bob, shift, stance in [(0, 0, 0), (1, 0, 0), (1, 1, 1), (0, 0, 0)]]
    idle_b = [composite(config, draw_level=level, angle=40 + angle, bob=bob, shift=shift, stance=stance, expression="smirk")[0] for level, angle, bob, shift, stance in [(0, 0, 0, 0, 0), (1, 3, 0, 0, 0), (2, 6, 1, 1, 1), (1, 3, 1, 0, 1), (0, 0, 0, 0, 0)]]
    idle_frames = idle_a + idle_b

    rotations = []
    for angle, level in [(20, 4), (45, 2), (45, 4), (70, 4)]:
        frame, _ = composite(config, draw_level=level, angle=angle, expression="focus")
        rotations.append((angle, f"draw {level}/4", frame))

    body = draw_body(config)
    manifest = {
        "logicalSize": [64, 80],
        "facing": "right",
        "mirrorForOppositeSide": True,
        "baseline": 79,
        "bodyOrigin": [32, 0],
        "anchors": {
            "feet": [32, 79],
            "bowSideShoulder": [25, 34],
            "drawSideShoulder": [39, 35],
            "bowGrip": [41, 24],
            "arrowNock": [35, 29],
            "arrowReleaseOrigin": [35, 29],
            "headBounds": [21, 8, 22, 21],
            "torsoBounds": [19, 28, 26, 26],
        },
        "layers": {
            "body": f"{key}-body.png",
            "arms": {"file": f"{key}-arms.png", "frames": 5, "frameSize": [64, 80]},
            "bow": {"file": f"{key}-bow.png", "frames": 5, "frameSize": [64, 80]},
            "aimComposite": {"file": f"{key}-aim.png", "frames": 5, "frameSize": [64, 80]},
            "release": {"file": f"{key}-release.png", "frames": 3, "frameSize": [64, 80]},
            "idles": {"file": f"{key}-idles.png", "frames": 9, "frameSize": [64, 80], "groups": {"idleA": [0, 4], "idleB": [4, 9]}},
        },
        "drawStates": ["rest", "light", "half", "heavy", "full"],
        "rotationProof": [{"angle": angle, "draw": level} for angle, level, _ in rotations],
        "idleAnimations": {"idleA": "4-frame breathing/weight shift", "idleB": "5-frame character fidget", "note": config["idle_note"]},
    }
    return {
        "config": config,
        "manifest": manifest,
        "body": body,
        "arms": atlas(arms_frames),
        "bow": atlas(bow_frames),
        "aim": atlas(aim_frames),
        "release": atlas(release_frames),
        "idles": atlas(idle_frames),
        "draw_frames": draw_frames,
        "release_frames": release_frames,
        "idle_frames": idle_frames,
        "rotation_frames": rotations,
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    all_data = {key: build_character(key, config) for key, config in CHARACTERS.items()}
    for key, data in all_data.items():
        for name in ("body", "arms", "bow", "aim", "release", "idles"):
            data[name].save(OUT / f"{key}-{name}.png")
        (OUT / f"{key}-metadata.json").write_text(json.dumps(data["manifest"], indent=2) + "\n", encoding="utf-8")
    shared_manifest = {
        "assetSet": "greenwood-duel-archers",
        "version": 1,
        "logicalSize": [64, 80],
        "rendering": {"nativePixelArt": True, "scale": "nearest-neighbor", "transparent": True, "antiAliased": False},
        "characters": {key: data["manifest"] for key, data in all_data.items()},
    }
    (OUT / "sprite-manifest.json").write_text(json.dumps(shared_manifest, indent=2) + "\n", encoding="utf-8")
    make_contact_sheet(all_data).save(OUT / "greenwood-duel-archer-contact-sheet.png")
    make_diagnostic(all_data["sterling"]).save(OUT / "greenwood-duel-archer-diagnostic.png")
    print(f"Wrote Greenwood Duel art assets to {OUT}")


if __name__ == "__main__":
    main()
