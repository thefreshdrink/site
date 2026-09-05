/* alisik — portfolio front-end
   builds pages > columns > tiles from window.SITE, wires the pager HUD,
   scroll reveal, and the lightbox.
--------------------------------------------------------------------------- */
(function () {
  "use strict";
  var SITE = window.SITE;
  if (!SITE || !SITE.pages) return;
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  var pager = document.getElementById("pager");
  var base = SITE.imgBase;
  var widths = SITE.widths;
  var hi = widths[widths.length - 1];
  var wide = window.matchMedia("(min-width:761px)");

  var flat = [];        // every work, DOM order — the lightbox walks this
  var colEls = [];      // every .col, DOM order

  function srcset(slug) {
    return widths.map(function (w) {
      return base + "/" + slug + "-" + w + ".webp " + w + "w";
    }).join(", ");
  }
  function src(slug) { return base + "/" + slug + "-" + hi + ".webp"; }

  /* ---- build ------------------------------------------------------------- */
  var colCounter = 0;
  SITE.pages.forEach(function (page) {
    var pageEl = document.createElement("section");
    pageEl.className = "page";

    page.cols.forEach(function (col, ci) {
      var colEl = document.createElement("div");
      colEl.className = "col";
      colEl.style.zIndex = String(++colCounter);   // running order → phone stack

      if (ci === 0) {
        var lab = document.createElement("p");
        lab.className = "col-label";
        lab.textContent = page.label;
        colEl.appendChild(lab);
      }

      col.forEach(function (work) {
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
        img.sizes = "(max-width:760px) 100vw, 30vw";
        tile.appendChild(img);

        tile.addEventListener("click", function () { openLightbox(idx); });
        colEl.appendChild(tile);
        flat.push({ slug: work.slug });
      });

      pageEl.appendChild(colEl);
      colEls.push(colEl);
    });

    pager.appendChild(pageEl);
  });
  if (colEls.length) {
    colEls[0].classList.add("first");
    colEls[colEls.length - 1].classList.add("last");
  }

  /* ---- pager HUD (wide screens) --------------------------------------------- */
  var hud = document.getElementById("hud");
  var hudLabel = document.getElementById("hud-label");
  var hudFill = document.getElementById("hud-fill");
  var prevBtn = document.getElementById("page-prev");
  var nextBtn = document.getElementById("page-next");
  var pageCount = SITE.pages.length;

  function currentPage() {
    return Math.round(pager.scrollLeft / pager.clientWidth);
  }
  function goPage(n) {
    pager.scrollTo({ left: n * pager.clientWidth, behavior: "smooth" });
  }
  var ticking = false;
  function syncHud() {
    if (!wide.matches) return;
    var cur = currentPage();
    hudFill.style.width = (((cur + 1) / pageCount) * 100).toFixed(1) + "%";
    hudLabel.textContent = (SITE.pages[cur] || SITE.pages[0]).label;
    prevBtn.disabled = cur <= 0;
    nextBtn.disabled = cur >= pageCount - 1;
  }
  pager.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { syncHud(); ticking = false; });
  }, { passive: true });

  prevBtn.addEventListener("click", function () { goPage(currentPage() - 1); });
  nextBtn.addEventListener("click", function () { goPage(currentPage() + 1); });

  // vertical wheel pages the pager sideways
  pager.addEventListener("wheel", function (e) {
    if (!wide.matches) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      pager.scrollLeft += e.deltaY;
      e.preventDefault();
    }
  }, { passive: false });

  function applyMode() {
    hud.hidden = !wide.matches || pageCount < 1;
    if (wide.matches) { pager.scrollLeft = pager.scrollLeft; syncHud(); }
  }
  (wide.addEventListener ? wide.addEventListener("change", applyMode) : wide.addListener(applyMode));
  window.addEventListener("resize", function () { requestAnimationFrame(syncHud); }, { passive: true });
  applyMode();
  syncHud();

  /* ---- reveal on scroll --------------------------------------------------- */
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
        var out = r.top > innerHeight * 0.98 || r.left > innerWidth * 0.98;
        if (out) { t.classList.add("reveal"); io.observe(t); }
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

  addEventListener("keydown", function (e) {
    if (!lb.hidden) {
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      return;
    }
    if (wide.matches) {
      if (e.key === "ArrowRight") goPage(currentPage() + 1);
      else if (e.key === "ArrowLeft") goPage(currentPage() - 1);
    }
  });

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
