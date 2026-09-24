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
COLUMNS = [
    ("petals",    ["IMG_2159"]),
    ("club room", ["494370BC", "subrosa (4)", "A4 - 28 (3)", "lux_1"]),
    ("prostor",   ["image 67", "image 68", "swinwarrior1998", "image 53"]),
    ("posters",   ["Double_Poster_Mockup", "sea view rock", "just a regular rock", "photo_2022-04-30"]),
    ("jinx bomb", ["Frame 21", "IMG_6242"]),
    ("3d",        ["IMG_2659", "camphoto_351212254", "untitled"]),
    ("type",      []),
]
EXCLUDE = ["9757D019", "MOCKUP-01", "image 50", "abstrakt_cover", "Frame 1907", "image 51", "image 60"]

# video works: label -> ordered list of rt_video/*.mp4 tokens (same substring
# match as COLUMNS). A label here can be new or can add onto a COLUMNS label.
VIDEOS = [
    ("type", ["type-w"]),
    ("petals", ["petals-coral-veo3"]),
]


def slugify(path):
    stem = os.path.splitext(os.path.basename(path))[0]
    return re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")


def encode(path):
    slug = slugify(path)
    im = Image.open(path).convert("RGBA")
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
    tw = min(VIDEO_MAX_WIDTH, w)
    th = round(tw * h / w / 2) * 2  # even height — required for yuv420p
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", path,
        "-vf", f"scale={tw}:{th}",
        "-an", "-c:v", "libx264", "-preset", "slower", "-crf", str(VIDEO_CRF),
        "-pix_fmt", "yuv420p", "-movflags", "+faststart",
        os.path.join(VIDEO_OUT, f"{slug}.mp4"),
    ], check=True)
    # a poster frame so the tile has something to show before the video can play
    poster_png = os.path.join(VIDEO_OUT, f"{slug}-poster.png")
    subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", path,
        "-vf", f"scale={tw}:{th}", "-frames:v", "1", poster_png,
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

    video_files = sorted(glob.glob(os.path.join(VIDEO_SRC, "*.mp4"))) if os.path.isdir(VIDEO_SRC) else []

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
            picked.append(encode(path))
            print(f"  {label:10}  {os.path.basename(path)}")
        works_by_label[label] = picked

    for label, tokens in VIDEOS:
        picked = works_by_label.setdefault(label, [])
        for t in tokens:
            path = match_video(t)
            used_video.add(path)
            picked.append(encode_video(path))
            print(f"  {label:10}  {os.path.basename(path)} (video)")

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
