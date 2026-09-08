/* alisik — portfolio front-end
   builds the kanban board of columns from window.SITE, wires horizontal-wheel
   scrolling, the scroll reveal, and the lightbox.
--------------------------------------------------------------------------- */
(function () {
  "use strict";
  var SITE = window.SITE;
  if (!SITE || !SITE.columns) return;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  addEventListener("load", function () { window.scrollTo(0, 0); });

  var board = document.getElementById("board");
  var base = SITE.imgBase;
  var widths = SITE.widths;
  var hi = widths[widths.length - 1];
  var wide = window.matchMedia("(min-width:761px)");

  var flat = [];        // every work, DOM order — the lightbox walks this
  var colEls = [];

  function srcset(slug) {
    return widths.map(function (w) {
      return base + "/" + slug + "-" + w + ".webp " + w + "w";
    }).join(", ");
  }
  function src(slug) { return base + "/" + slug + "-" + hi + ".webp"; }

  /* ---- build ------------------------------------------------------------- */
  var z = 0;
  SITE.columns.forEach(function (column) {
    var colEl = document.createElement("section");
    colEl.className = "col";
    colEl.style.zIndex = String(++z);

    var label = document.createElement("p");
    label.className = "col-label";
    label.textContent = column.label;
    colEl.appendChild(label);

    column.works.forEach(function (work) {
      var idx = flat.length;
      var tile = document.createElement("button");
      tile.type = "button";
      tile.className = "tile";
      tile.style.setProperty("--ar", String(work.ar || 1));
      tile.setAttribute("aria-label", "открыть работу");

      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = src(work.slug);
      img.srcset = srcset(work.slug);
      img.sizes = "(max-width:760px) 100vw, 32vw";
      tile.appendChild(img);

      tile.addEventListener("click", function () { openLightbox(idx); });
      colEl.appendChild(tile);
      flat.push({ slug: work.slug });
    });

    board.appendChild(colEl);
    colEls.push(colEl);
  });
  if (colEls.length) {
    colEls[0].classList.add("first");
    colEls[colEls.length - 1].classList.add("last");
  }

  /* ---- vertical wheel scrolls the board sideways (wide screens) ---------- */
  board.addEventListener("wheel", function (e) {
    if (!wide.matches) return;
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
    if (wide.matches && document.activeElement === board) {
      if (e.key === "ArrowRight") board.scrollBy({ left: 340, behavior: "smooth" });
      else if (e.key === "ArrowLeft") board.scrollBy({ left: -340, behavior: "smooth" });
    }
  });

  /* ---- reveal on scroll ------------------------------------------------------ */
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

  /* ---- lightbox --------------------------------------------------------------- */
  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lb-img");
  var cur = 0;

  function openLightbox(i) {
    cur = i;
    lbImg.src = src(flat[cur].slug);
    lbImg.srcset = srcset(flat[cur].slug);
    lbImg.sizes = "92vw";
    lb.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closeLightbox() {
    lb.hidden = true;
    document.body.style.overflow = "";
  }
  function step(n) {
    cur = (cur + n + flat.length) % flat.length;
    lbImg.src = src(flat[cur].slug);
    lbImg.srcset = srcset(flat[cur].slug);
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
