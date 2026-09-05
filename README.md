# alisik — portfolio

Single static page. Dark Miro-style canvas with a dot grid; works shown as a
quantised collage on wide screens and as a **stacking feed by series** on phones
(each group slides up and lays over the previous one). Reference: `5heads.ai/feed`.

Live: https://thefreshdrink.github.io/site/

## Structure

```
index.html         markup + <head>
css/style.css       all styling; collage grid + phone stacking effect
js/app.js           builds the feed from the manifest, reveal + lightbox
js/images.js        GENERATED manifest (window.SITE) — do not hand-edit
build.py            image pipeline: rt/*.png -> assets/img/*.webp + images.js
rt/                 source art (local only, git-ignored)
assets/img/         web-sized WebP, 3 widths per work (committed)
assets/logo.png     white monogram
```

## Add or replace works

1. Drop / swap PNGs in `rt/` (any size; transparent corners are fine — the
   pipeline flattens each onto the canvas colour so they never flash white).
2. `npm run build` (needs Python 3 + Pillow: `pip install pillow`).
3. Commit `assets/img/` and `js/images.js`, push. Pages redeploys on push.

## Groups

Edit `GROUP_LABELS` in `build.py` to rename groups or change how many there are;
works are split into even chunks in filename order. Two or more groups are needed
for the phone stacking effect to be visible.

## Deploy

GitHub Pages, source = **main branch / root**. No build step on CI — the built
`assets/img/` and `js/images.js` are committed. Every push to `main` republishes.
