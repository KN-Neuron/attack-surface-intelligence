(function () {
  "use strict";

  // ---- collapsible nav groups -------------------------------------------------
  document.querySelectorAll("[data-collapse-target]").forEach(function (btn) {
    var target = document.getElementById(btn.getAttribute("data-collapse-target"));
    if (!target) return;
    btn.addEventListener("click", function () {
      var hidden = target.classList.toggle("hidden");
      btn.classList.toggle("collapsed", hidden);
      btn.setAttribute("aria-expanded", String(!hidden));
    });
  });

  // ---- top bar search (type-ahead over the navigation index) ------------------
  var searchBox = document.getElementById("search");
  var searchInput = document.getElementById("search-input");
  var searchClear = document.getElementById("search-clear");
  var searchResults = document.getElementById("search-results");
  var hits = [];
  var activeHit = -1;
  var searchTimer = null;
  var searchSeq = 0;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }

  // Wrap the matched part of the title so the typed fragment stands out.
  function highlight(text, needle) {
    var safe = escapeHtml(text);
    if (!needle) return safe;
    var lower = text.toLowerCase();
    var at = lower.indexOf(needle.toLowerCase());
    if (at === -1) return safe;
    var before = escapeHtml(text.slice(0, at));
    var match = escapeHtml(text.slice(at, at + needle.length));
    var after = escapeHtml(text.slice(at + needle.length));
    return before + "<mark>" + match + "</mark>" + after;
  }

  function closeResults() {
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    activeHit = -1;
  }

  function renderResults(needle) {
    if (!hits.length) {
      searchResults.innerHTML =
        '<div class="search-empty">No pages match <strong>' + escapeHtml(needle) + "</strong></div>";
      searchResults.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
      return;
    }

    searchResults.innerHTML = hits
      .map(function (hit, i) {
        return (
          '<a class="search-result' + (i === activeHit ? " is-active" : "") + '"' +
          ' href="' + escapeHtml(hit.href) + '" role="option" data-index="' + i + '">' +
          (hit.svg || "") +
          '<span class="search-result-main">' +
          '<span class="search-result-title">' + highlight(hit.title, needle) + "</span>" +
          '<span class="search-result-crumb">' + escapeHtml(hit.crumb) + "</span>" +
          "</span>" +
          (i === activeHit ? '<span class="search-result-enter">↵</span>' : "") +
          "</a>"
        );
      })
      .join("");

    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  }

  function runSearch() {
    var needle = searchInput.value.trim();
    searchClear.hidden = needle.length === 0;

    if (!needle) {
      hits = [];
      closeResults();
      return;
    }

    var seq = ++searchSeq;
    fetch("/api/search?limit=8&q=" + encodeURIComponent(needle))
      .then(function (r) { return r.json(); })
      .then(function (rows) {
        if (seq !== searchSeq) return; // a newer query already started
        hits = rows;
        activeHit = rows.length ? 0 : -1;
        renderResults(needle);
      })
      .catch(function () {});
  }

  function moveActive(delta) {
    if (!hits.length) return;
    activeHit = (activeHit + delta + hits.length) % hits.length;
    renderResults(searchInput.value.trim());
    var el = searchResults.querySelector('[data-index="' + activeHit + '"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }

  if (searchBox && searchInput && searchResults) {
    searchInput.addEventListener("input", function () {
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(runSearch, 90);
    });

    searchInput.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        moveActive(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveActive(-1);
      } else if (event.key === "Enter") {
        if (activeHit >= 0 && hits[activeHit]) {
          event.preventDefault();
          window.location.href = hits[activeHit].href;
        }
      } else if (event.key === "Escape") {
        closeResults();
      }
    });

    if (searchClear) {
      searchClear.addEventListener("click", function () {
        searchInput.value = "";
        searchClear.hidden = true;
        hits = [];
        closeResults();
        searchInput.focus();
      });
    }

    // clicking a result follows the link; the document handler below closes it
    searchResults.addEventListener("mousedown", function (event) {
      var row = event.target.closest(".search-result");
      if (row) event.preventDefault();
      if (row) window.location.href = row.getAttribute("href");
    });

    document.addEventListener("click", function (event) {
      if (!searchBox.contains(event.target)) closeResults();
    });

    // Cmd/Ctrl+K focuses search, as in the reference UI
    document.addEventListener("keydown", function (event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    // on pages that prefill nothing, keep the initial state clean
    searchClear.hidden = searchInput.value.length === 0;
  }

  // The collapsed/expanded choice is remembered across reloads, so a user who
  // folded the nav keeps it folded on refresh.
  var NAV_STATE_KEY = "asi.nav.collapsed";
  var sidebar = document.getElementById("sidebar");
  var railToggle = document.getElementById("sidebar-toggle");
  if (sidebar && railToggle) {
    var applyNavState = function (pinned) {
      sidebar.classList.toggle("is-pinned", pinned);
      railToggle.setAttribute("aria-expanded", String(pinned));
      railToggle.classList.toggle("is-active", pinned);
      railToggle.setAttribute("title", pinned ? "Collapse navigation" : "Expand navigation");
    };

    var stored = null;
    try {
      stored = window.localStorage.getItem(NAV_STATE_KEY);
    } catch (_) {
      // storage can be unavailable (private mode); fall back to expanded
    }
    applyNavState(stored !== "true");

    // Hand off from the pre-paint class to the real state with no transition,
    // then restore animation for later user interaction.
    document.documentElement.classList.remove("nav-collapsed");
    document.documentElement.classList.add("nav-settling");
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        document.documentElement.classList.remove("nav-settling");
      });
    });

    railToggle.addEventListener("click", function () {
      var pinned = !sidebar.classList.contains("is-pinned");
      applyNavState(pinned);
      try {
        window.localStorage.setItem(NAV_STATE_KEY, String(!pinned));
      } catch (_) {}
    });
  }

  // ---- summary carousel -------------------------------------------------------
  var slides = Array.prototype.slice.call(document.querySelectorAll("[data-slide]"));
  var dots = Array.prototype.slice.call(document.querySelectorAll("[data-dot]"));
  var current = 0;
  var timer = null;

  function show(index) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;
    slides.forEach(function (el, i) {
      el.classList.toggle("active", i === current);
    });
    dots.forEach(function (el, i) {
      el.classList.toggle("active", i === current);
    });
  }

  function startAuto() {
    stopAuto();
    timer = setInterval(function () { show(current + 1); }, 6500);
  }

  function stopAuto() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  var carousel = document.getElementById("summary");
  if (carousel) {
    carousel.querySelectorAll("[data-carousel]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var dir = btn.getAttribute("data-carousel") === "next" ? 1 : -1;
        show(current + dir);
        startAuto();
      });
    });
    carousel.addEventListener("mouseenter", stopAuto);
    carousel.addEventListener("mouseleave", startAuto);
    startAuto();
  }

  // ---- segmented controls -----------------------------------------------------
  document.querySelectorAll("[data-seg]").forEach(function (segGroup) {
    segGroup.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        segGroup.querySelectorAll("button").forEach(function (b) {
          b.classList.toggle("active", b === btn);
        });
      });
    });
  });

  // ---- tab groups -------------------------------------------------------------
  document.querySelectorAll(".tabs-bar, .ptabs").forEach(function (tabGroup) {
    var buttons = tabGroup.querySelectorAll("button");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.toggle("active", b === btn); });
      });
    });
  });

  // ---- table row selection ----------------------------------------------------
  document.querySelectorAll("table.tbl").forEach(function (table) {
    table.addEventListener("click", function (event) {
      var row = event.target.closest("tbody tr");
      if (!row) return;
      table.querySelectorAll("tbody tr.selected").forEach(function (r) {
        if (r !== row) r.classList.remove("selected");
      });
      row.classList.toggle("selected");
    });
  });

  // ---- generic client-side table filter --------------------------------------
  document.querySelectorAll("[data-table-filter]").forEach(function (input) {
    var table = document.getElementById(input.getAttribute("data-table-filter"));
    if (!table) return;
    input.addEventListener("input", function () {
      var needle = input.value.trim().toLowerCase();
      table.querySelectorAll("tbody tr").forEach(function (row) {
        var hit = row.textContent.toLowerCase().indexOf(needle) !== -1;
        row.style.display = hit ? "" : "none";
      });
    });
  });

  // ---- log "run query" refresh ------------------------------------------------
  var runBtn = document.getElementById("run-query");
  var logBody = document.getElementById("log-body");
  if (runBtn && logBody) {
    runBtn.addEventListener("click", function () {
      runBtn.classList.add("is-loading");
      runBtn.textContent = "Running...";
      fetch("/api/web-insights?page_size=100")
        .then(function (r) { return r.json(); })
        .then(function (rows) {
          logBody.innerHTML = "";
          rows.forEach(function (row, i) {
            var tr = document.createElement("tr");
            tr.style.animationDelay = (i * 8) + "ms";
            tr.innerHTML =
              "<td>" + (i + 1) + "</td>" +
              "<td>" + row.event_time + "</td>" +
              "<td><span class='link-cell'>" + row.user + "</span></td>" +
              "<td><span class='badge'>" + row.action + "</span></td>" +
              "<td>" + row.location + "</td>" +
              "<td class='right'></td>";
            logBody.appendChild(tr);
          });
        })
        .catch(function () {})
        .finally(function () {
          runBtn.classList.remove("is-loading");
          runBtn.textContent = "Run Query";
        });
    });
  }

  // ---- stagger card entrance --------------------------------------------------
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll(".card").forEach(function (card, i) {
      card.style.animationDelay = (i * 45) + "ms";
      observer.observe(card);
    });
  }

})();
