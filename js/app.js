/* alisik — portfolio front-end
   builds the kanban board of columns from window.SITE, wires horizontal-wheel
   scrolling, the scroll reveal, and the lightbox.
--------------------------------------------------------------------------- */
(function () {
  "use strict";
  var SITE = window.SITE;
  if (!SITE || !SITE.columns) return;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function toTop() { window.scrollTo(0, 0); }
  addEventListener("load", function () { toTop(); requestAnimationFrame(toTop); setTimeout(toTop, 120); });

  // a narrow viewport, or any touch device gone short (a phone rotated to
  // landscape) — keep in sync with the mobile @media queries in style.css
  var BREAKPOINT = "(max-width:760px), (pointer:coarse) and (max-height:760px)";
  var phone = window.matchMedia(BREAKPOINT);

  var board = document.getElementById("board");
  if (phone.matches) board.removeAttribute("tabindex");
  var base = SITE.imgBase;
  var videoBase = SITE.videoBase;
  var widths = SITE.widths;
  var hi = widths[widths.length - 1];

  var flat = [];        // every work, DOM order — the lightbox walks this
  var colEls = [];

  function srcset(slug) {
    return widths.map(function (w) {
      return base + "/" + slug + "-" + w + ".webp " + w + "w";
    }).join(", ");
  }
  function src(slug) { return base + "/" + slug + "-" + hi + ".webp"; }
  function poster(slug) { return base + "/" + slug + "-poster.webp"; }
  function videoSrc(slug) { return videoBase + "/" + slug + ".mp4"; }

  /* ---- build --------------------------------------------------------------
     a tile is shared by both layouts; only its container differs. */
  function buildTile(work, radius, arOverride) {
    var idx = flat.length;
    var tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.style.setProperty("--ar", String(arOverride || work.ar || 1));
    if (radius != null) tile.style.borderRadius = typeof radius === "string" ? radius : radius + "px";
    tile.setAttribute("aria-label", "открыть работу");

    if (work.video) {
      var vid = document.createElement("video");
      vid.muted = true;
      vid.loop = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.preload = "auto";
      vid.poster = poster(work.slug);
      vid.src = videoSrc(work.slug);
      tile.appendChild(vid);
    } else {
      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = src(work.slug);
      img.srcset = srcset(work.slug);
      img.sizes = "(max-width:760px) 100vw, 32vw";
      tile.appendChild(img);
    }

    tile.addEventListener("click", function () { openLightbox(idx); });
    flat.push({ slug: work.slug, video: !!work.video });
    return tile;
  }

  if (phone.matches) {
    // hand-authored feed, matching the Figma "Frame 23" mockup exactly. Every
    // width/margin/radius below came from the frame's own exported SVG (exact
    // <rect x y width height rx>), not eyeballing — a rotated rect (Figma's
    // way of fitting a portrait image, e.g. lux_1) is pre-resolved to its
    // effective on-screen box. Percentages are of the 4096px-wide frame.
    // Referenced by each work's stable `key` (the COLUMNS/VIDEOS token in
    // build.py), not its slug — the slug's numeric suffix drifts with every
    // re-export, the key doesn't.
    var worksByKey = {};
    SITE.columns.forEach(function (c) { c.works.forEach(function (w) { worksByKey[w.key] = w; }); });

    var CIRCLE = "50%";
    var MOBILE_LAYOUT = [
      { cells: [{ key: "petals-coral-veo3", w: 100, radius: 0 }] },
      { cells: [{ key: "494370BC", w: 76.5, radius: 0 }] },
      { cells: [
        { key: "Frame 21", w: 50.0, radius: CIRCLE },
        { key: "sea view rock", w: 50.0, radius: 0 },
      ] },
      { cells: [{ key: "swinwarrior1998", w: 100, radius: 0 }] },
      { cells: [
        { key: "image 67", w: 37.2, radius: 16 },
        { key: "image 68", w: 63.0, radius: 55 },
      ] },
      { cells: [{ key: "A4 - 28 (3)", w: 61.0, ml: 19.5, radius: 16 }] },
      { cells: [
        { key: "untitled-house", w: 66.6, radius: 16 },
        { key: "IMG_0041", w: 33.4, radius: 37 },
      ] },
      { cells: [{ key: "camphoto_351212254", w: 82.6, ml: 17.4, radius: 0 }] },
      { cells: [
        { key: "type-w", w: 62.8, radius: 0, ar: 1 },
        { key: "lux_1", w: 35.3, radius: 16 },
      ] },
      { cells: [{ key: "just a regular rock", w: 70.6, ml: 28.3, radius: 0 }] },
      { cells: [{ key: "Double_Poster_Mockup", w: 100, radius: 16 }] },
      { cells: [
        { key: "image 70", w: 29.25, ml: 4.5, radius: 0 },
        { key: "photo_2022-04-30", w: 63.1, ml: 2.0, radius: 16 },
      ] },
      { cells: [{ key: "IMG_2659", w: 64.6, radius: 0 }] },
    ];

    MOBILE_LAYOUT.forEach(function (rowSpec) {
      var row = document.createElement("div");
      row.className = "mrow";
      rowSpec.cells.forEach(function (cell) {
        var work = worksByKey[cell.key];
        if (!work) return;   // a piece pulled from Figma but not yet in rt/ — skip, don't break the page
        var col = document.createElement("div");
        col.className = "mcol";
        col.style.flex = "0 0 " + cell.w + "%";
        if (cell.ml) col.style.marginLeft = cell.ml + "%";
        col.appendChild(buildTile(work, cell.radius, cell.ar));
        row.appendChild(col);
      });
      if (row.children.length) board.appendChild(row);
    });
  } else {
    var z = 0;
    SITE.columns.forEach(function (column) {
      var colEl = document.createElement("section");
      colEl.className = "col";
      colEl.style.zIndex = String(++z);

      var label = document.createElement("p");
      label.className = "col-label";
      label.textContent = column.label;
      colEl.appendChild(label);

      column.works.forEach(function (work) { colEl.appendChild(buildTile(work)); });

      board.appendChild(colEl);
      colEls.push(colEl);
    });
    if (colEls.length) {
      colEls[0].classList.add("first");
      colEls[colEls.length - 1].classList.add("last");
    }
  }

  /* ---- vertical wheel scrolls the board sideways (wide screens) ---------- */
  board.addEventListener("wheel", function (e) {
    if (phone.matches) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      board.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  addEventListener("keydown", function (e) {
    if (!win.hidden) {
      if (e.key === "Escape") closeWin();
      return;
    }
    if (!lb.hidden) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      return;
    }
    if (!phone.matches && document.activeElement === board) {
      if (e.key === "ArrowRight") board.scrollBy({ left: 340, behavior: "smooth" });
      else if (e.key === "ArrowLeft") board.scrollBy({ left: -340, behavior: "smooth" });
    }
  });

  /* ---- reveal on scroll — a tile sharpens (blur -> fade) once it scrolls
     into view, same on phone and wide screens. */
  var tiles = [].slice.call(document.querySelectorAll(".tile"));
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.remove("reveal"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -6% 0px" });
    requestAnimationFrame(function () {
      tiles.forEach(function (t) {
        var r = t.getBoundingClientRect();
        if (r.top > innerHeight * 0.98 || r.left > innerWidth * 0.98) {
          t.classList.add("reveal");
          io.observe(t);
        }
      });
    });
  }

  /* ---- keep tile videos playing — autoplay is unreliable when a video's tab
     starts hidden/backgrounded, and it never retries on its own once visible.
     Nudge .play() whenever a video tile actually enters the viewport. */
  var videoTiles = [].slice.call(document.querySelectorAll(".tile > video"));
  if (videoTiles.length && "IntersectionObserver" in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.play().catch(function () {});
        else e.target.pause();
      });
    }, { threshold: 0.15 });
    videoTiles.forEach(function (v) { vio.observe(v); });
  }

  /* ---- tap-windows (mtxt -> win) — 5heads-style card, placeholder copy for now:
     form first, Alisa fills in the real text/links per data-win key later. */
  var win = document.getElementById("win");
  var winBody = document.getElementById("win-body");
  var TG_URL = "https://t.me/";  // TODO: Alisa's handle
  var TG_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.8 19c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.6 12.8l-4.7-1.5c-1-.3-1-1 .2-1.5L20.5 2.7c.9-.3 1.6.2 1.4 1.6z"/></svg>';
  var WIN_COPY = {
    luck: "<p>you are lucky to know that</p><p>this is my creative archive since 2020</p><p>it’s a pleasure to see you there</p>",
    contact: "<p>seriously, don’t call me</p><p>but</p><p>you might text me</p>" +
      '<a class="win-link" href="' + TG_URL + '" target="_blank" rel="noopener">' + TG_ICON + "<span>telegram</span></a>"
  };
  function openWin(key) {
    winBody.innerHTML = WIN_COPY[key] || "";
    win.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeWin() {
    win.hidden = true;
    document.body.style.overflow = "";
  }
  [].slice.call(document.querySelectorAll(".mtxt[data-win]")).forEach(function (btn) {
    btn.addEventListener("click", function () { openWin(btn.dataset.win); });
  });
  win.addEventListener("click", function (e) {
    if (e.target === win || e.target.classList.contains("win-close")) closeWin();
  });

  /* ---- lightbox --------------------------------------------------------------- */
  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lb-img");
  var lbVideo = document.getElementById("lb-video");
  var cur = 0;

  function showWork(i) {
    var w = flat[i];
    lbVideo.pause();
    if (w.video) {
      lbImg.hidden = true;
      lbVideo.hidden = false;
      lbVideo.src = videoSrc(w.slug);
      lbVideo.play();
    } else {
      lbVideo.hidden = true;
      lbVideo.removeAttribute("src");
      lbImg.hidden = false;
      lbImg.src = src(w.slug);
      lbImg.srcset = srcset(w.slug);
      lbImg.sizes = "92vw";
    }
  }
  function openLightbox(i) {
    cur = i;
    showWork(cur);
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lb.hidden = true;
    lbVideo.pause();
    document.body.style.overflow = "";
  }
  function step(n) {
    cur = (cur + n + flat.length) % flat.length;
    showWork(cur);
  }

  lb.addEventListener("click", function (e) {
    if (e.target === lb || e.target.classList.contains("lb-close")) closeLightbox();
  });
  lb.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
  lb.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); step(1); });

  var sx = 0, sy = 0;
  lb.addEventListener("touchstart", function (e) {
    sx = e.changedTouches[0].clientX; sy = e.changedTouches[0].clientY;
  }, { passive: true });
  lb.addEventListener("touchend", function (e) {
    var dx = e.changedTouches[0].clientX - sx;
    var dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
    else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) closeLightbox();
  }, { passive: true });
})();
