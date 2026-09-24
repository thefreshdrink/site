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
  function buildTile(work, radius) {
    var idx = flat.length;
    var tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.style.setProperty("--ar", String(work.ar || 1));
    if (radius != null) tile.style.borderRadius = radius + "px";
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
    // 5heads-style scattered feed: one flat sequence (series order kept, the
    // grouping just isn't shown visually), packed into rows of 1-2 columns.
    // A column can stack 2 items — since .mrow uses align-items:flex-start,
    // a column that finishes first just leaves black behind it instead of
    // stretching, which is exactly where the reference's black voids come
    // from. Corner radius alternates 0/60, the reference's own two-value mix.
    var ROW_TEMPLATES = [
      [{ w: 100, n: 1 }],
      [{ w: 45, n: 1 }, { w: 55, n: 1 }],
      [{ w: 38, n: 2 }, { w: 62, n: 1 }],
      [{ w: 62, n: 1 }, { w: 38, n: 1 }],
      [{ w: 100, n: 1 }],
      [{ w: 55, n: 1 }, { w: 45, n: 2 }],
      [{ w: 30, n: 1 }, { w: 70, n: 1 }],
      [{ w: 70, n: 1 }, { w: 30, n: 2 }],
    ];
    var RADII = [0, 60, 0, 0, 60, 0];
    var works = [];
    SITE.columns.forEach(function (c) { c.works.forEach(function (w) { works.push(w); }); });
    var ti = 0, wi = 0;
    while (wi < works.length) {
      var tmpl = ROW_TEMPLATES[ti++ % ROW_TEMPLATES.length];
      var row = document.createElement("div");
      row.className = "mrow";
      for (var c = 0; c < tmpl.length && wi < works.length; c++) {
        var col = document.createElement("div");
        col.className = "mcol";
        col.style.flex = tmpl[c].w + " 1 0%";
        for (var n = 0; n < tmpl[c].n && wi < works.length; n++, wi++) {
          col.appendChild(buildTile(works[wi], RADII[flat.length % RADII.length]));
        }
        row.appendChild(col);
      }
      board.appendChild(row);
    }
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
