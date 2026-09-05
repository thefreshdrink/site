# alisik — portfolio

Single static page. Dark Miro-style canvas with a dot grid.

- **Wide screens (>760px):** a horizontal **pager** — one group per screen, three
  offset columns of works, navigated with the `‹ ›` buttons, the mouse wheel, or
  a sideways swipe. A progress track + the group name sit bottom-left.
- **Phones (≤760px):** a vertical feed where **every column becomes its own
  section** — each pins to the top and the next column slides up and lays over it.

Reference: `5heads.ai/feed` + the Claude Design desktop board (`rt/Design - desktop.pdf`).

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

## Groups / columns

`build.py` flows works (filename order) into columns of `WORKS_PER_COL`, then
groups columns into pages of `COLS_PER_PAGE`. Rename pages via `PAGE_LABELS`.
Defaults: 2 works per column, 3 columns per page → 18 works = 3 pages.

## Deploy

GitHub Pages, source = **main branch / root**. No build step on CI — the built
`assets/img/` and `js/images.js` are committed. Every push to `main` republishes.
