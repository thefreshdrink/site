/* alisik — portfolio front-end
   builds the feed from window.SITE (js/images.js), wires reveal + lightbox.
--------------------------------------------------------------------------- */
(function () {
  "use strict";
  var SITE = window.SITE;
  if (!SITE) return;

  var feed = document.querySelector(".feed");
  var base = SITE.imgBase;
  var widths = SITE.widths;

  // flat list of every work, in document order — the lightbox walks this
  var flat = [];

  function srcset(slug) {
    return widths
      .map(function (w) { return base + "/" + slug + "-" + w + ".webp " + w + "w"; })
      .join(", ");
  }

  // desktop grid span for a work, from its aspect ratio + position rhythm
  var SQ = ["x3y3", "x4y4", "x4y4", "x3y3", "x5y5", "x4y4", "x3y3", "x4y4"];
  function sizeClass(ar, i) {
    if (ar >= 1.6) return "x6y4";
    if (ar >= 1.25) return "x5y4";
    if (i % 7 === 4) return "x6y6";     // occasional feature tile
    return SQ[i % SQ.length];
  }

  var globalIndex = 0;
  SITE.groups.forEach(function (group, gi) {
    var section = document.createElement("section");
    section.className = "grp";
    section.style.zIndex = String(gi + 1);   // each group stacks over the previous on phones

    var label = document.createElement("p");
    label.className = "grp-label";
    label.textContent = group.label;
    section.appendChild(label);

    var collage = document.createElement("div");
    collage.className = "collage";

    group.works.forEach(function (work, wi) {
      var idx = globalIndex++;
      var fig = document.createElement("button");
      fig.type = "button";
      fig.className = "tile " + sizeClass(work.ar, wi);
      fig.style.setProperty("--ar", String(work.ar));
      fig.setAttribute("aria-label", "открыть работу");
      fig.dataset.index = String(idx);

      var img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = base + "/" + work.slug + "-" + widths[widths.length - 1] + ".webp";
      img.srcset = srcset(work.slug);
      img.sizes = "(max-width:560px) 100vw, (max-width:900px) 45vw, 30vw";
      fig.appendChild(img);

      fig.addEventListener("click", function () { openLightbox(idx); });
      collage.appendChild(fig);

      flat.push({ slug: work.slug });
    });

    section.appendChild(collage);
    feed.appendChild(section);
  });

  /* ---- grid unit ---------------------------------------------------------- */
  function setUnit() {
    var probe = feed.querySelector(".collage");
    if (!probe) return;
    var w = probe.clientWidth;
    var cols = w < 560 ? 2 : w < 900 ? 8 : 13;
    var gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gap")) || 16;
    var u = Math.floor((w - gap * (cols - 1)) / cols);
    if (u > 0) document.documentElement.style.setProperty("--u", u + "px");
  }
  setUnit();
  addEventListener("resize", setUnit, { passive: true });

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
        if (t.getBoundingClientRect().top > innerHeight * 0.98) {
          t.classList.add("reveal");
          io.observe(t);
        }
      });
    });
  }

  /* ---- lightbox ------------------------------------------------------------ */
  var lb = document.getElementById("lb");
  var lbImg = document.getElementById("lb-img");
  var cur = 0;

  function hi(slug) { return base + "/" + slug + "-" + widths[widths.length - 1] + ".webp"; }

  function openLightbox(i) {
    cur = i;
    lbImg.src = hi(flat[cur].slug);
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
    lbImg.src = hi(flat[cur].slug);
    lbImg.srcset = srcset(flat[cur].slug);
  }

  lb.addEventListener("click", function (e) {
    if (e.target === lb || e.target.classList.contains("lb-close")) closeLightbox();
  });
  lb.querySelector(".lb-prev").addEventListener("click", function (e) { e.stopPropagation(); step(-1); });
  lb.querySelector(".lb-next").addEventListener("click", function (e) { e.stopPropagation(); step(1); });
  addEventListener("keydown", function (e) {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  // swipe on touch
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
