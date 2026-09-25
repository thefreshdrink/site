#!/usr/bin/env python3
"""Image pipeline for the portfolio.

Reads the source art from rt/*.png, writes three WebP widths per work into
assets/img/ (keeping the alpha — the exports already carry rounded corners, so
we never paint a background behind them), and emits js/images.js, the manifest
the page reads.

Run:  python3 build.py
Needs: Pillow  (pip install pillow)
"""
import glob
import json
import os
import re
import shutil
import subprocess
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "rt")
OUT_IMG = os.path.join(ROOT, "assets", "img")
WIDTHS = [480, 900, 1500]
QUALITY = 82

# video works: source .mp4 originals live in rt_video/ (gitignored, like rt/),
# compressed silent web copies land in assets/video/ (committed, like assets/img/)
VIDEO_SRC = os.path.join(ROOT, "rt_video")
VIDEO_OUT = os.path.join(ROOT, "assets", "video")
VIDEO_MAX_WIDTH = 1280
VIDEO_CRF = 28

# ----------------------------------------------------------------------------
# The board is columns (kanban on wide screens; a single scroll feed on phones).
# Each entry below is a column: a label and an ordered list of source files,
# matched by a case-insensitive substring of the filename. Reorder freely,
# move a file between columns, rename a label — all safe, nothing is keyed by
# position any more. Files listed in EXCLUDE are dropped; any file that matches
# nothing lands in a trailing "more" column so it is never lost silently.
# 5 columns, matching the Figma "Best" frame exactly (both grouping and the
# top-to-bottom order within each) rather than 7 separate categories — the
# frame pairs petals with lux_1, and jinx-bomb pieces with the 3d ones.
COLUMNS = [
    ("petals",    ["lux_1", "IMG_2159"]),
    ("club room", ["494370BC", "A4 - 28 (3)"]),
    ("prostor",   ["swinwarrior1998", "image 67", "image 68"]),
    ("posters",   ["just a regular rock", "Double_Poster_Mockup", "photo_2022-04-30", "sea view rock"]),
    ("jinx bomb", ["Frame 21", "IMG_0041", "image 70", "camphoto_351212254", "IMG_2659"]),
]
EXCLUDE = ["9757D019", "MOCKUP-01", "image 50", "abstrakt_cover", "Frame 1907", "image 51", "image 60",
           "subrosa (4)", "image 53", "IMG_6242", "Frame 23", "2024_05_13"]

# video works: label -> ordered list of rt_video/*.mp4|mov tokens (same
# substring match as COLUMNS), optionally with a 3rd "start" element to
# prepend instead of append (matches the piece's position among its
# column's Figma siblings).
VIDEOS = [
    ("posters", ["type-w"], "start"),
    ("petals", ["petals-coral-veo3"], "start"),
    ("jinx bomb", ["untitled-house"], "start"),
]

# some generator exports pillarbox/letterbox a vertical render into a 16:9
# canvas — a hard black bar, not the subject's own negative space. token ->
# (x, y, w, h) crop rect in source pixels, applied before scaling. type-w's
# box is the union of its content across several post-trim frames (the fuzzy
# growth animation shifts a little — this box never clips it).
VIDEO_CROP = {
    "petals-coral-veo3": (240, 0, 1439, 1080),
    "type-w": (400, 0, 1322, 1078),
}

# label -> seconds to trim off the start (a slow intro before the piece settles)
VIDEO_TRIM = {
    "type-w": 3.0,
}


def slugify(path):
    stem = os.path.splitext(os.path.basename(path))[0]
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")


def restore_corner_alpha(im, tolerance=6, scan=300):
    """Figma's node export bakes the page background into a frame's rounded
    corners instead of leaving them transparent (only affects assets pulled
    via the Figma MCP — the original hand-exported PNGs already have real
    alpha there). Flood-fill each corner from the page-background colour back
    to alpha 0, so a rounded frame reads as rounded again instead of showing
    a square matte. A no-op on images that already have real transparency."""
    w, h = im.size
    px = im.load()
    if px[0, 0][3] != 255:
        return im  # real transparency already — nothing baked in to fix
    bg = px[0, 0][:3]

    def close(c):
        return all(abs(c[i] - bg[i]) <= tolerance for i in range(3))

    for cx, cy, dx, dy in ((0, 0, 1, 1), (w - 1, 0, -1, 1), (0, h - 1, 1, -1), (w - 1, h - 1, -1, -1)):
        if not close(px[cx, cy][:3]):
            continue
        sw, sh = min(scan, w), min(scan, h)
        x0 = 0 if dx == 1 else w - sw
        y0 = 0 if dy == 1 else h - sh
        start = (cx - x0, cy - y0)
        seen = [[False] * sw for _ in range(sh)]
        seen[start[1]][start[0]] = True
        q = deque([start])
        while q:
            lx, ly = q.popleft()
            gx, gy = lx + x0, ly + y0
            r, g, b, _ = px[gx, gy]
            px[gx, gy] = (r, g, b, 0)
            for ddx, ddy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = lx + ddx, ly + ddy
                if 0 <= nx < sw and 0 <= ny < sh and not seen[ny][nx]:
                    ngx, ngy = nx + x0, ny + y0
                    if close(px[ngx, ngy][:3]):
                        seen[ny][nx] = True
                        q.append((nx, ny))
    return im


def encode(path):
    slug = slugify(path)
    im = restore_corner_alpha(Image.open(path).convert("RGBA"))
    ow, oh = im.size
    for w in WIDTHS:
        tw = min(w, ow)
        th = round(tw * oh / ow)
        resized = im if (tw, th) == (ow, oh) else im.resize((tw, th), Image.LANCZOS)
        resized.save(os.path.join(OUT_IMG, f"{slug}-{w}.webp"), "WEBP", quality=QUALITY, method=6)
        if tw == ow:
            break
    return {"slug": slug, "ar": round(ow / oh, 4)}


def probe_video_size(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "json", path],
        capture_output=True, text=True, check=True,
    ).stdout
    info = json.loads(out)["streams"][0]
    return info["width"], info["height"]


def encode_video(path):
    slug = slugify(path)
    w, h = probe_video_size(path)
    crop = VIDEO_CROP.get(slug)
    if crop:
        cx, cy, cw, ch = crop
        w, h = cw, ch
    tw = min(VIDEO_MAX_WIDTH, w)
    th = round(tw * h / w / 2) * 2  # even height — required for yuv420p
    vf = (f"crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},scale={tw}:{th}" if crop
          else f"scale={tw}:{th}")
    trim = VIDEO_TRIM.get(slug)
    seek = ["-ss", str(trim)] if trim else []
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", *seek, "-i", path,
        "-vf", vf,
        "-an", "-c:v", "libx264", "-preset", "slower", "-crf", str(VIDEO_CRF),
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        os.path.join(VIDEO_OUT, f"{slug}.mp4"),
    ], check=True)
    # a poster frame so the tile has something to show before the video can play
    poster_png = os.path.join(VIDEO_OUT, f"{slug}-poster.png")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", *seek, "-i", path,
        "-vf", vf, "-frames:v", "1", poster_png,
    ], check=True)
    Image.open(poster_png).convert("RGBA").save(
        os.path.join(OUT_IMG, f"{slug}-poster.webp"), "WEBP", quality=QUALITY, method=6)
    os.remove(poster_png)
    return {"slug": slug, "ar": round(w / h, 4), "video": True}


def main():
    os.makedirs(OUT_IMG, exist_ok=True)
    for f in glob.glob(os.path.join(OUT_IMG, "*.webp")):
        os.remove(f)
    os.makedirs(VIDEO_OUT, exist_ok=True)
    for f in glob.glob(os.path.join(VIDEO_OUT, "*.mp4")):
        os.remove(f)

    files = [f for f in sorted(glob.glob(os.path.join(SRC, "*.png")))
             if not any(x.lower() in os.path.basename(f).lower() for x in EXCLUDE)]
    if not files:
        raise SystemExit("no source images in rt/")

    def match(token):
        hits = [f for f in files if token.lower() in os.path.basename(f).lower()]
        if len(hits) != 1:
            raise SystemExit(f"COLUMNS token {token!r} matched {len(hits)} files: {[os.path.basename(h) for h in hits]}")
        return hits[0]

    video_files = sorted(
        glob.glob(os.path.join(VIDEO_SRC, "*.mp4")) + glob.glob(os.path.join(VIDEO_SRC, "*.mov")) +
        glob.glob(os.path.join(VIDEO_SRC, "*.MOV"))
    ) if os.path.isdir(VIDEO_SRC) else []

    def match_video(token):
        hits = [f for f in video_files if token.lower() in os.path.basename(f).lower()]
        if len(hits) != 1:
            raise SystemExit(f"VIDEOS token {token!r} matched {len(hits)} files: {[os.path.basename(h) for h in hits]}")
        return hits[0]

    used, used_video = set(), set()
    works_by_label = {}
    for label, tokens in COLUMNS:
        picked = []
        for t in tokens:
            path = match(t)
            used.add(path)
            work = encode(path)
            work["key"] = t          # stable id for MOBILE_LAYOUT in app.js — survives re-exports
            picked.append(work)
            print(f"  {label:10}  {os.path.basename(path)}")
        works_by_label[label] = picked

    for entry in VIDEOS:
        label, tokens = entry[0], entry[1]
        position = entry[2] if len(entry) > 2 else "end"
        existing = works_by_label.setdefault(label, [])
        new_works = []
        for t in tokens:
            path = match_video(t)
            used_video.add(path)
            work = encode_video(path)
            work["key"] = t
            new_works.append(work)
            print(f"  {label:10}  {os.path.basename(path)} (video)")
        works_by_label[label] = new_works + existing if position == "start" else existing + new_works

    columns = [{"label": label, "works": works_by_label[label]}
               for label, _ in COLUMNS if works_by_label.get(label)]

    leftover = [f for f in files if f not in used]
    if leftover:
        columns.append({"label": "more", "works": [encode(f) for f in leftover]})
        for f in leftover:
            print(f"  {'more':10}  {os.path.basename(f)}")

    leftover_video = [f for f in video_files if f not in used_video]
    if leftover_video:
        print(f"\nNOTE: unused files in rt_video/ (not in VIDEOS): {[os.path.basename(f) for f in leftover_video]}")

    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    shutil.copyfile(os.path.join(ROOT, "Vector.png"), os.path.join(ROOT, "assets", "logo.png"))

    manifest = {
        "logo": "assets/logo.png",
        "imgBase": "assets/img",
        "videoBase": "assets/video",
        "widths": WIDTHS,
        "columns": columns,
    }
    with open(os.path.join(ROOT, "js", "images.js"), "w") as fh:
        fh.write("/* generated by build.py — do not edit by hand */\n")
        fh.write("window.SITE = " + json.dumps(manifest, ensure_ascii=False, indent=2) + ";\n")
    total = sum(len(c["works"]) for c in columns)
    print(f"\nwrote js/images.js — {len(columns)} columns, {total} works")


if __name__ == "__main__":
    main()
