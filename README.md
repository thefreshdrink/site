# alisik — portfolio

Single static page. Dark Miro-style canvas with a dot grid.

- **Wide screens (>760px):** a **kanban board** — every series is a column, the
  whole row scrolls sideways (mouse wheel scrolls it horizontally). Columns are
  staggered vertically for an organic feel.
- **Phones (≤760px):** the same columns, stacked — each pins to the top and the
  next column slides up and lays over it.

Art is shown straight from the exports, which already carry their rounded corners
in the alpha channel — nothing is painted behind them.

Reference: `5heads.ai/feed` + the Claude Design board (`rt/Design - desktop.pdf`).

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

## Columns

The board is defined by `COLUMNS` in `build.py` — an ordered list of
`(label, [slugs])`. Slugs are `w01..wNN` in `rt/` filename order (run `build.py`
once to see the mapping printed). Reorder columns, move slugs between them, or
rename labels freely; any slug you don't list is swept into a trailing column.

## Deploy

GitHub Pages, source = **main branch / root**. No build step on CI — the built
`assets/img/` and `js/images.js` are committed. Every push to `main` republishes.
