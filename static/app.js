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

  // ---- reusable tag chip input ------------------------------------------------
  // Wires an entry field, an "Add" button and a chip container inside `scope`.
  // Returns the current tag list plus a reset helper.
  function initTagInput(scope) {
    var entry = scope.querySelector("[data-tag-entry]");
    var addBtn = scope.querySelector("[data-tag-add]");
    var chips = scope.querySelector("[data-tag-chips]");
    var values = [];

    function render() {
      if (!chips) return;
      chips.innerHTML = "";
      values.forEach(function (tag, i) {
        var chip = document.createElement("span");
        chip.className = "host-chip";
        chip.appendChild(document.createTextNode(tag));
        var x = document.createElement("button");
        x.type = "button";
        x.className = "chip-x";
        x.setAttribute("aria-label", "Remove " + tag);
        x.innerHTML = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"/></svg>';
        x.addEventListener("click", function () {
          values.splice(i, 1);
          render();
        });
        chip.appendChild(x);
        chips.appendChild(chip);
      });
    }

    function add() {
      var value = (entry && entry.value || "").trim();
      if (!value) return;
      if (values.indexOf(value) === -1) values.push(value);
      if (entry) { entry.value = ""; entry.focus(); }
      render();
    }

    if (addBtn) addBtn.addEventListener("click", add);
    if (entry) entry.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); add(); }
    });

    render();

    return {
      values: function () { return values.slice(); },
      add: function (tag) {
        tag = String(tag == null ? "" : tag).trim();
        if (!tag || values.indexOf(tag) !== -1) return;
        values.push(tag);
        render();
      },
      reset: function () { values = []; if (entry) entry.value = ""; render(); }
    };
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
      stored = String(!pinned);
      try {
        window.localStorage.setItem(NAV_STATE_KEY, stored);
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

  // ---- page tabs (switch in-place panels and tab-scoped actions) -------------
  // A `[data-tabs]` bar holds `[data-tab]` buttons; the matching
  // `[data-tab-panel]` containers are shown one at a time. Elements carrying
  // `data-tab-show="<name>"` are only visible while that tab is active.
  document.querySelectorAll("[data-tabs]").forEach(function (bar) {
    var buttons = Array.prototype.slice.call(bar.querySelectorAll("[data-tab]"));
    var panels = bar.parentElement.querySelectorAll("[data-tab-panel]");
    var scoped = document.querySelectorAll("[data-tab-show]");

    function activate(name) {
      buttons.forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-tab") === name);
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.getAttribute("data-tab-panel") !== name;
      });
      scoped.forEach(function (el) {
        el.hidden = el.getAttribute("data-tab-show") !== name;
      });
      try {
        var key = "asi.tab." + (bar.getAttribute("data-tabs") || "");
        window.sessionStorage.setItem(key, name);
      } catch (_) {}
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () { activate(btn.getAttribute("data-tab")); });
    });

    var stored = null;
    try {
      stored = window.sessionStorage.getItem("asi.tab." + (bar.getAttribute("data-tabs") || ""));
    } catch (_) {}
    var names = buttons.map(function (b) { return b.getAttribute("data-tab"); });
    activate(names.indexOf(stored) !== -1 ? stored : (names[0] || ""));
  });

  // ---- generic client-side table filter --------------------------------------
  document.querySelectorAll("[data-table-filter]").forEach(function (input) {
    var table = document.getElementById(input.getAttribute("data-table-filter"));
    if (!table) return;
    // Tables with a pager are filtered by the pager controller below.
    var container = table.closest(".card, .log-panel");
    if (container && container.querySelector("[data-pager]")) return;
    input.addEventListener("input", function () {
      var needle = input.value.trim().toLowerCase();
      table.querySelectorAll("tbody tr").forEach(function (row) {
        var hit = row.textContent.toLowerCase().indexOf(needle) !== -1;
        row.style.display = hit ? "" : "none";
      });
    });
  });

  // ---- shared table pager -----------------------------------------------------
  // Every `[data-pager]` footer drives the nearest table in its card. Optional
  // features: a `[data-table-filter="<table id>"]` search box and a
  // `data-page-range="<select id>"` time-range select (rows carry `data-days`).
  function initTablePager(table, pager) {
    var tbody = table.querySelector("tbody");
    if (!tbody) return;

    var allRows = Array.prototype.slice.call(tbody.querySelectorAll("tr")).filter(function (row) {
      return !row.querySelector(".empty-cell");
    });

    var sizeSel = pager.querySelector("[data-page-size]");
    var rangeOut = pager.querySelector("[data-page-range]");
    var pageNum = pager.querySelector("[data-page-num]");
    var firstBtn = pager.querySelector("[data-page-first]");
    var prevBtn = pager.querySelector("[data-page-prev]");
    var nextBtn = pager.querySelector("[data-page-next]");
    var lastBtn = pager.querySelector("[data-page-last]");

    var filterInput = table.id
      ? document.querySelector('[data-table-filter="' + table.id + '"]')
      : null;
    var rangeId = table.getAttribute("data-page-range");
    var rangeSel = rangeId ? document.getElementById(rangeId) : null;

    if (!allRows.length) {
      if (rangeOut) rangeOut.textContent = "No entries";
      if (pageNum) pageNum.textContent = "1 / 1";
      [firstBtn, prevBtn, nextBtn, lastBtn].forEach(function (btn) {
        if (btn) btn.disabled = true;
      });
      return;
    }

    var state = { page: 1, size: sizeSel ? Number(sizeSel.value) || 10 : 10, filter: "", sev: "" };

    function matches(row) {
      if (rangeSel) {
        var days = Number(rangeSel.value);
        if (days && Number(row.getAttribute("data-days")) > days) return false;
      }
      if (state.sev && row.getAttribute("data-sev") !== state.sev) return false;
      if (state.filter && row.textContent.toLowerCase().indexOf(state.filter) === -1) return false;
      return true;
    }

    function render() {
      var rows = allRows.filter(matches);
      var pages = Math.max(1, Math.ceil(rows.length / state.size));
      if (state.page > pages) state.page = pages;
      if (state.page < 1) state.page = 1;

      var start = (state.page - 1) * state.size;
      var end = Math.min(start + state.size, rows.length);

      allRows.forEach(function (row) { row.style.display = "none"; });
      rows.slice(start, end).forEach(function (row) { row.style.display = ""; });

      if (rangeOut) {
        rangeOut.textContent = rows.length
          ? (start + 1) + "–" + end + " of " + rows.length
          : "No entries";
      }
      if (pageNum) pageNum.textContent = state.page + " / " + pages;
      if (firstBtn) firstBtn.disabled = state.page <= 1;
      if (prevBtn) prevBtn.disabled = state.page <= 1;
      if (nextBtn) nextBtn.disabled = state.page >= pages;
      if (lastBtn) lastBtn.disabled = state.page >= pages;
    }

    if (sizeSel) {
      state.size = Number(sizeSel.value) || 10;
      sizeSel.addEventListener("change", function () {
        state.size = Number(sizeSel.value) || 10;
        state.page = 1;
        render();
      });
    }
    if (filterInput) {
      filterInput.addEventListener("input", function () {
        state.filter = filterInput.value.trim().toLowerCase();
        state.page = 1;
        render();
      });
    }
    if (rangeSel) {
      rangeSel.addEventListener("change", function () {
        state.page = 1;
        render();
      });
    }
    // Optional severity tiles: `[data-sev-filter]` buttons filter rows by `data-sev`.
    var sevTiles = table.id === "vuln-table"
      ? Array.prototype.slice.call(document.querySelectorAll("[data-sev-filter]"))
      : [];
    sevTiles.forEach(function (tile) {
      tile.addEventListener("click", function () {
        var value = tile.getAttribute("data-sev-filter");
        state.sev = value;
        sevTiles.forEach(function (t) {
          var on = t.getAttribute("data-sev-filter") === state.sev;
          t.classList.toggle("is-on", on);
          t.setAttribute("aria-pressed", on ? "true" : "false");
        });
        state.page = 1;
        render();
      });
    });
    if (firstBtn) firstBtn.addEventListener("click", function () { state.page = 1; render(); });
    if (prevBtn) prevBtn.addEventListener("click", function () { state.page -= 1; render(); });
    if (nextBtn) nextBtn.addEventListener("click", function () { state.page += 1; render(); });
    if (lastBtn) lastBtn.addEventListener("click", function () {
      state.page = Math.ceil(allRows.filter(matches).length / state.size) || 1;
      render();
    });

    render();
  }

  document.querySelectorAll("[data-pager]").forEach(function (pager) {
    var card = pager.closest(".card") || pager.parentElement;
    var table = card ? card.querySelector("table.tbl") : null;
    if (table) initTablePager(table, pager);
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

  // ==========================================================================
  // Modals
  // ==========================================================================
  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal(backdrop) {
    if (!backdrop) return;
    backdrop.hidden = true;
    if (!document.querySelector(".modal-backdrop:not([hidden])")) {
      document.body.classList.remove("modal-open");
    }
  }

  document.addEventListener("click", function (event) {
    var opener = event.target.closest("[data-open-modal]");
    if (opener) {
      openModal(opener.getAttribute("data-open-modal"));
      return;
    }
    var closer = event.target.closest("[data-close-modal]");
    if (closer) {
      closeModal(closer.closest(".modal-backdrop"));
      return;
    }
    if (event.target.classList.contains("modal-backdrop") && !event.target.hasAttribute("data-static-modal")) {
      closeModal(event.target);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var open = document.querySelector(".modal-backdrop:not([hidden]):not([data-static-modal])");
    if (open) closeModal(open);
  });

  // ==========================================================================
  // Theme
  // ==========================================================================
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try { window.localStorage.setItem("asi.theme", theme); } catch (_) {}
    syncThemeButtons(theme);
  }

  function syncThemeButtons(theme) {
    document.querySelectorAll("[data-theme-choice]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-theme-choice") === theme);
    });
  }

  document.querySelectorAll("[data-theme-choice]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      applyTheme(btn.getAttribute("data-theme-choice"));
    });
  });
  syncThemeButtons(document.documentElement.getAttribute("data-theme") || "dark");

  // ==========================================================================
  // Scan management — live status
  // ==========================================================================
  var scanActive = document.querySelector("[data-scan-active]");
  if (scanActive) {
    var scanIdle = document.querySelector("[data-scan-idle]");
    var scanPill = document.getElementById("scan-state");
    var scanPillText = document.getElementById("scan-state-text");
    var scanFill = document.getElementById("scan-progress-fill");
    var scanBar = document.getElementById("scan-progress");
    var scanLabel = document.getElementById("scan-progress-label");
    var scanTargets = document.getElementById("scan-targets");
    var scanHosts = document.getElementById("scan-hosts");
    var scanStarted = document.getElementById("scan-started");
    var scanCurrent = document.getElementById("scan-current");
    var scanLast = document.getElementById("scan-last");
    var pauseBtn = document.getElementById("scan-pause");
    var pauseIcon = document.getElementById("scan-pause-icon");
    var pauseText = document.getElementById("scan-pause-text");

    var PAUSE_SVG = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M5.7 3.4v9.2M10.3 3.4v9.2"/></svg>';
    var PLAY_SVG = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M4.6 2.9l8 5.1-8 5.1z"/></svg>';

    var renderScan = function (s) {
      var state = s.running ? (s.paused ? "paused" : "running") : "idle";
      if (scanPill) scanPill.setAttribute("data-state", state);
      if (scanPillText) scanPillText.textContent = s.paused ? "Paused" : (s.running ? "Running" : "Idle");

      if (scanActive) scanActive.hidden = !s.running;
      if (scanIdle) scanIdle.hidden = !!s.running;

      var pct = Math.max(0, Math.min(100, s.progress));
      if (scanFill) scanFill.style.width = pct + "%";
      if (scanBar) scanBar.setAttribute("aria-valuenow", String(Math.round(pct)));
      if (scanLabel) scanLabel.textContent = Math.round(pct) + "%";
      if (scanTargets) scanTargets.textContent = s.targets_done + " / " + s.target_total;
      if (scanHosts) scanHosts.textContent = s.hosts_found;
      if (scanStarted && s.started_at) scanStarted.textContent = s.started_at;
      if (scanCurrent) scanCurrent.textContent = s.current_target;

      if (pauseBtn) pauseBtn.setAttribute("data-paused", s.paused ? "true" : "false");
      if (pauseIcon) pauseIcon.innerHTML = s.paused ? PLAY_SVG : PAUSE_SVG;
      if (pauseText) pauseText.textContent = s.paused ? "Resume scan" : "Pause scan";

      if (scanLast && !s.running && s.completed_at) {
        scanLast.textContent = "Last scan finished " + s.completed_at + ".";
      }
    };

    var pollScan = function () {
      fetch("/api/scan/status")
        .then(function (r) { return r.json(); })
        .then(renderScan)
        .catch(function () {});
    };

    var scanAction = function (path) {
      return fetch(path, { method: "POST" })
        .then(function (r) { return r.json(); })
        .then(renderScan)
        .catch(function () {});
    };

    if (pauseBtn) pauseBtn.addEventListener("click", function () { scanAction("/api/scan/pause"); });
    var cancelBtn = document.getElementById("scan-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", function () { scanAction("/api/scan/cancel"); });
    ["scan-start", "scan-start-upcoming"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener("click", function () { scanAction("/api/scan/start"); });
    });

    window.setInterval(pollScan, 1500);
  }

  // ==========================================================================
  // Scans — targets from host management + schedule pickers
  // ==========================================================================
  var policyForm = document.getElementById("policy-form");
  if (policyForm) {
    var policyDataEl = document.getElementById("policy-data");
    var policyData = [];
    try { policyData = JSON.parse(policyDataEl.textContent || "[]"); } catch (_) {}

    var targetCount = policyForm.querySelector("[data-target-count]");
    var frequencyEl = document.getElementById("policy-frequency");
    var dayEl = document.getElementById("policy-day");
    var dayField = document.getElementById("policy-day-field");
    var hourEl = document.getElementById("policy-hour");
    var hourField = document.getElementById("policy-hour-field");
    var minuteEl = document.getElementById("policy-minute");
    var minuteField = document.getElementById("policy-minute-field");
    var scheduleHint = document.getElementById("policy-schedule-hint");

    var DAY_NAMES = {
      mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
      fri: "Friday", sat: "Saturday", sun: "Sunday"
    };

    function fillSelect(select, values) {
      select.innerHTML = "";
      values.forEach(function (value) {
        var opt = document.createElement("option");
        opt.value = value.value;
        opt.textContent = value.label;
        select.appendChild(opt);
      });
    }

    function pad(n) { return (n < 10 ? "0" : "") + n; }

    (function initStaticOptions() {
      var hours = [];
      for (var h = 0; h < 24; h++) hours.push({ value: pad(h), label: pad(h) });
      fillSelect(hourEl, hours);

      var minutes = [];
      for (var m = 0; m < 60; m += 5) minutes.push({ value: pad(m), label: pad(m) });
      fillSelect(minuteEl, minutes);
    })();

    function dayOptions(frequency) {
      if (frequency === "Weekly") {
        return ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(function (d) {
          return { value: d, label: DAY_NAMES[d] };
        });
      }
      if (frequency === "Monthly") {
        var days = [];
        for (var d = 1; d <= 28; d++) days.push({ value: "d" + d, label: "Day " + d });
        return days;
      }
      return [];
    }

    function dayLabel(value) {
      if (DAY_NAMES[value]) return DAY_NAMES[value];
      var dayOfMonth = /^d(\d+)$/.exec(value);
      return dayOfMonth ? "Day " + dayOfMonth[1] : value;
    }

    function ensureOption(select, value) {
      var found = Array.prototype.some.call(select.options, function (o) { return o.value === value; });
      if (!found && value) {
        var opt = document.createElement("option");
        opt.value = value;
        opt.textContent = select === dayEl ? dayLabel(value) : value;
        select.appendChild(opt);
      }
    }

    function syncScheduleFields() {
      var frequency = frequencyEl.value;
      var timed = frequency !== "On demand";

      if (timed && frequency !== "Daily") {
        var previousDay = dayEl.value;
        fillSelect(dayEl, dayOptions(frequency));
        var valid = Array.prototype.some.call(dayEl.options, function (o) { return o.value === previousDay; });
        dayEl.value = valid ? previousDay : dayEl.options[0].value;
        dayField.hidden = false;
      } else {
        dayField.hidden = true;
      }

      hourField.hidden = !timed;
      minuteField.hidden = !timed;

      if (!timed) {
        scheduleHint.textContent = "This scan only runs when started manually.";
        return;
      }

      var dayLabel = frequency === "Daily"
        ? "every day"
        : frequency === "Weekly"
          ? "every " + DAY_NAMES[dayEl.value]
          : "on day " + dayEl.value.slice(1) + " of the month";
      scheduleHint.textContent = "Runs " + dayLabel + " at " + hourEl.value + ":" + minuteEl.value + ".";
    }

    function updateTargetCount() {
      var count = policyForm.querySelectorAll("input[name=targets]:checked").length;
      if (targetCount) targetCount.textContent = count + " selected";
    }

    policyForm.querySelectorAll("input[name=targets]").forEach(function (box) {
      box.addEventListener("change", updateTargetCount);
    });
    frequencyEl.addEventListener("change", syncScheduleFields);
    [dayEl, hourEl, minuteEl].forEach(function (el) {
      el.addEventListener("change", syncScheduleFields);
    });

    var policyIdInput = document.getElementById("policy-id");
    var policyTitle = document.getElementById("policy-modal-title");
    var policyEnabled = document.getElementById("policy-enabled");
    var policyEnabledText = document.getElementById("policy-enabled-text");
    var editingPolicyId = null;

    function syncPolicyEnabled() {
      if (policyEnabledText) {
        policyEnabledText.textContent = policyEnabled && policyEnabled.checked ? "Enabled" : "Disabled";
      }
    }

    if (policyEnabled) policyEnabled.addEventListener("change", syncPolicyEnabled);

    function clearTargets() {
      policyForm.querySelectorAll("input[name=targets]").forEach(function (box) { box.checked = false; });
    }

    function resetPolicyForm() {
      editingPolicyId = null;
      policyForm.reset();
      if (policyIdInput) policyIdInput.value = "";
      if (policyEnabled) policyEnabled.checked = true;
      syncPolicyEnabled();
      if (policyTitle) policyTitle.textContent = "New scan";
      clearTargets();
      frequencyEl.value = "Daily";
      hourEl.value = "01";
      minuteEl.value = "00";
      syncScheduleFields();
      updateTargetCount();
    }

    // Schedule values are stored as `<day> <HH:MM>`; older readable values
    // such as "Sundays at 22:00" are still understood when editing.
    function parseWhen(value) {
      var raw = String(value || "").trim().toLowerCase();
      var match = raw.match(/^(every|every day|(?:mon|tue|wed|thu|fri|sat|sun)(?:days?)?|day (\d+)|d(\d+))\s+(?:at\s+)?(\d{1,2}):(\d{2})$/);
      if (!match) return null;

      var day = match[1];
      if (day === "every" || day === "every day") {
        day = "every";
      } else if (/^d\d+$/.test(day)) {
        day = day;
      } else if (day.indexOf("day ") === 0) {
        day = "d" + day.slice(4);
      } else {
        day = day.slice(0, 3);
      }

      return {
        day: day,
        hour: pad(Number(match[4])),
        minute: pad(Number(match[5]))
      };
    }

    function openPolicyEditor(policy) {
      editingPolicyId = policy.id;
      if (policyIdInput) policyIdInput.value = String(policy.id);
      policyForm.querySelector("[name=name]").value = policy.name;
      policyForm.querySelector("[name=order]").value = policy.order;
      if (policyEnabled) policyEnabled.checked = !!policy.enabled;
      syncPolicyEnabled();
      if (policyTitle) policyTitle.textContent = "Edit scan";

      clearTargets();
      var frequency = "Daily";
      var when = null;
      (policy.criteria || []).forEach(function (c) {
        if (c.kind === "frequency") {
          frequency = c.value;
        } else if (c.kind === "when") {
          when = parseWhen(c.value);
        } else {
          policyForm.querySelectorAll("input[name=targets]").forEach(function (box) {
            if (box.value === c.value) box.checked = true;
          });
        }
      });

      frequencyEl.value = frequency;
      if (frequencyEl.value !== frequency) frequencyEl.value = "Daily";
      syncScheduleFields();

      if (when) {
        if (when.day !== "every") ensureOption(dayEl, when.day);
        ensureOption(hourEl, when.hour);
        ensureOption(minuteEl, when.minute);
        if (when.day !== "every") dayEl.value = when.day;
        hourEl.value = when.hour;
        minuteEl.value = when.minute;
      }
      syncScheduleFields();
      updateTargetCount();
      openModal("policy-modal");
    }

    var addPolicyBtn = document.querySelector("[data-policy-add]");
    if (addPolicyBtn) addPolicyBtn.addEventListener("click", resetPolicyForm);

    document.querySelectorAll("[data-policy-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-policy-edit"));
        var policy = policyData.filter(function (p) { return p.id === id; })[0];
        if (policy) openPolicyEditor(policy);
      });
    });

    document.querySelectorAll("[data-policy-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-policy-remove");
        if (!window.confirm("Remove this scan? This cannot be undone.")) return;
        fetch("/api/policies/" + id, { method: "DELETE" })
          .then(function (r) { if (!r.ok) throw new Error(); })
          .then(function () { window.location.reload(); })
          .catch(function () { window.alert("Could not remove the scan. Please try again."); });
      });
    });

    policyForm.addEventListener("submit", function (event) {
      event.preventDefault();

      var criteria = [];
      policyForm.querySelectorAll("input[name=targets]:checked").forEach(function (box) {
        criteria.push({ kind: box.getAttribute("data-picker-kind"), value: box.value });
      });
      if (!criteria.length) {
        window.alert("Pick at least one target from host management.");
        return;
      }

      var frequency = frequencyEl.value;
      criteria.push({ kind: "frequency", value: frequency });

      if (frequency !== "On demand") {
        var day = frequency === "Daily" ? "every" : dayEl.value;
        criteria.push({ kind: "when", value: day + " " + hourEl.value + ":" + minuteEl.value });
      }

      var payload = {
        name: policyForm.querySelector("[name=name]").value,
        order: Number(policyForm.querySelector("[name=order]").value) || 0,
        criteria: criteria,
        enabled: policyEnabled ? policyEnabled.checked : true
      };
      var url = editingPolicyId ? "/api/policies/" + editingPolicyId : "/api/policies";
      var method = editingPolicyId ? "PUT" : "POST";
      fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not save the scan. Please try again."); });
    });

    resetPolicyForm();
  }

  // ==========================================================================
  // Host groups — create, edit, remove
  // ==========================================================================
  var groupForm = document.querySelector("[data-group-form]");
  if (groupForm) {
    groupForm._tagHandle = initTagInput(groupForm);

    var groupDataEl = document.getElementById("group-data");
    var groupData = [];
    try { groupData = JSON.parse(groupDataEl.textContent || "[]"); } catch (_) {}

    var groupIdInput = groupForm.querySelector("[name=id]");
    var groupTitle = document.getElementById("group-modal-title");
    var groupNameInput = groupForm.querySelector("[name=name]");
    var editingGroupId = null;

    function setGroupMembers(name, values) {
      var wanted = {};
      (values || []).forEach(function (v) { wanted[v] = true; });
      groupForm.querySelectorAll("input[name=" + name + "]").forEach(function (box) {
        box.checked = !!wanted[box.value];
      });
    }

    function clearGroupFilters() {
      groupForm.querySelectorAll("[data-filter-input]").forEach(function (input) {
        input.value = "";
        input.dispatchEvent(new Event("input"));
      });
    }

    function resetGroupForm() {
      editingGroupId = null;
      groupForm.reset();
      if (groupIdInput) groupIdInput.value = "";
      if (groupTitle) groupTitle.textContent = "New host group";
      if (groupForm._tagHandle) groupForm._tagHandle.reset();
      clearGroupFilters();
    }

    function openGroupEditor(group) {
      editingGroupId = group.id;
      if (groupIdInput) groupIdInput.value = String(group.id);
      if (groupNameInput) groupNameInput.value = group.name;
      if (groupTitle) groupTitle.textContent = "Edit host group";
      if (groupForm._tagHandle) {
        groupForm._tagHandle.reset();
        group.tags.forEach(function (tag) { groupForm._tagHandle.add(tag); });
      }
      setGroupMembers("ips", group.ips);
      setGroupMembers("ranges", group.ranges);
      setGroupMembers("fqdns", group.fqdns);
      clearGroupFilters();
      openModal("group-modal");
    }

    document.querySelectorAll("[data-group-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-group-edit"));
        var group = groupData.filter(function (g) { return g.id === id; })[0];
        if (group) openGroupEditor(group);
      });
    });

    document.querySelectorAll("[data-group-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = btn.getAttribute("data-group-name");
        if (!window.confirm("Remove the host group \"" + name + "\"? Inventory entries are kept.")) return;
        fetch("/api/host-groups/" + btn.getAttribute("data-group-remove"), { method: "DELETE" })
          .then(function (r) { if (!r.ok) throw new Error(); })
          .then(function () { window.location.reload(); })
          .catch(function () { window.alert("Could not remove the group. Please try again."); });
      });
    });

    groupForm.addEventListener("submit", function (event) {
      event.preventDefault();

      function checked(name) {
        var out = [];
        groupForm.querySelectorAll("input[name=" + name + "]:checked").forEach(function (c) { out.push(c.value); });
        return out;
      }

      var payload = {
        name: groupNameInput.value,
        ips: checked("ips"),
        ranges: checked("ranges"),
        fqdns: checked("fqdns"),
        tags: groupForm._tagHandle.values()
      };
      fetch(editingGroupId ? "/api/host-groups/" + editingGroupId : "/api/host-groups", {
        method: editingGroupId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not save the group. Please try again."); });
    });

    resetGroupForm();

    var groupOpen = document.querySelector('[data-open-modal="group-modal"]');
    if (groupOpen) groupOpen.addEventListener("click", resetGroupForm);
  }

  // Filterable checkbox lists (host group modal + scan targets).
  document.querySelectorAll("[data-filter-input]").forEach(function (input) {
    var scope = input.closest(".field") || input.closest(".target-group");
    var list = scope ? scope.querySelector("[data-filter-list]") : null;
    if (!list) return;
    input.addEventListener("input", function () {
      var needle = input.value.trim().toLowerCase();
      list.querySelectorAll("[data-filter-item]").forEach(function (row) {
        row.hidden = needle.length > 0 && row.textContent.toLowerCase().indexOf(needle) === -1;
      });
    });
  });

  // ==========================================================================
  // Admin management — accounts (role-based) + roles
  // ==========================================================================
  var adminForm = document.getElementById("admin-form");
  if (adminForm) {
    var adminDataEl = document.getElementById("admin-data");
    var adminData = [];
    try { adminData = JSON.parse(adminDataEl.textContent || "[]"); } catch (_) {}

    var adminIdInput = document.getElementById("admin-id");
    var adminTitle = document.getElementById("admin-modal-title");
    var adminStatus = document.getElementById("admin-status");
    var adminRole = document.getElementById("admin-role");
    var adminPassword = document.getElementById("admin-password");
    var editingAdminId = null;

    function resetAdminForm() {
      editingAdminId = null;
      adminForm.reset();
      if (adminIdInput) adminIdInput.value = "";
      if (adminStatus) adminStatus.value = "Active";
      if (adminTitle) adminTitle.textContent = "Add administrator";
      if (adminPassword) { adminPassword.required = true; adminPassword.value = ""; }
    }

    function openAdminEditor(admin) {
      editingAdminId = admin.id;
      if (adminIdInput) adminIdInput.value = String(admin.id);
      adminForm.querySelector("[name=name]").value = admin.name;
      adminForm.querySelector("[name=email]").value = admin.email;
      if (adminRole) adminRole.value = admin.role;
      if (adminStatus) adminStatus.value = admin.status;
      if (adminTitle) adminTitle.textContent = "Edit administrator";
      if (adminPassword) { adminPassword.required = false; adminPassword.value = ""; }
      openModal("admin-modal");
    }

    var addAdminBtn = document.querySelector("[data-admin-add]");
    if (addAdminBtn) addAdminBtn.addEventListener("click", resetAdminForm);

    document.querySelectorAll("[data-admin-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-admin-edit"));
        var admin = adminData.filter(function (a) { return a.id === id; })[0];
        if (admin) openAdminEditor(admin);
      });
    });

    document.querySelectorAll("[data-admin-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-admin-toggle");
        fetch("/api/admins/" + id + "/toggle", { method: "POST" })
          .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
          .then(function () { window.location.reload(); })
          .catch(function () { window.alert("Could not update the administrator. Please try again."); });
      });
    });

    adminForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var payload = {
        name: adminForm.querySelector("[name=name]").value,
        email: adminForm.querySelector("[name=email]").value,
        role: adminRole ? adminRole.value : "",
        status: adminStatus ? adminStatus.value : "Active",
        password: adminPassword ? adminPassword.value : ""
      };
      var url = editingAdminId ? "/api/admins/" + editingAdminId : "/api/admins";
      var method = editingAdminId ? "PUT" : "POST";
      fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not save the administrator. Please try again."); });
    });
  }

  // ==========================================================================
  // Admin management — roles
  // ==========================================================================
  var roleForm = document.getElementById("role-form");
  if (roleForm) {
    var roleDataEl = document.getElementById("role-data");
    var roleData = [];
    try { roleData = JSON.parse(roleDataEl.textContent || "[]"); } catch (_) {}

    var roleIdInput = document.getElementById("role-id");
    var roleTitle = document.getElementById("role-modal-title");
    var editingRoleId = null;

    function rolePermRows() {
      return roleForm.querySelectorAll("[data-perm]");
    }

    function syncPermRow(row) {
      var read = row.querySelector("[data-perm-read]");
      var write = row.querySelector("[data-perm-write]");
      if (!read || !write) return;
      if (!read.checked) {
        write.checked = false;
        write.disabled = true;
      } else {
        write.disabled = false;
      }
    }

    rolePermRows().forEach(function (row) {
      var read = row.querySelector("[data-perm-read]");
      if (read) read.addEventListener("change", function () { syncPermRow(row); });
    });

    function clearPermissions() {
      rolePermRows().forEach(function (row) {
        var read = row.querySelector("[data-perm-read]");
        var write = row.querySelector("[data-perm-write]");
        if (read) read.checked = false;
        if (write) { write.checked = false; write.disabled = true; }
      });
    }

    function collectPermissions() {
      var out = [];
      rolePermRows().forEach(function (row) {
        var key = row.getAttribute("data-perm");
        var read = row.querySelector("[data-perm-read]");
        var write = row.querySelector("[data-perm-write]");
        if (read && (read.checked || (write && write.checked))) {
          out.push({
            page: key,
            can_read: read.checked,
            can_write: !!(write && write.checked)
          });
        }
      });
      return out;
    }

    function resetRoleForm() {
      editingRoleId = null;
      roleForm.reset();
      if (roleIdInput) roleIdInput.value = "";
      if (roleTitle) roleTitle.textContent = "Add role";
      clearPermissions();
    }

    function openRoleEditor(role) {
      editingRoleId = role.id;
      if (roleIdInput) roleIdInput.value = String(role.id);
      roleForm.querySelector("[name=name]").value = role.name;
      if (roleTitle) roleTitle.textContent = "Edit role";
      clearPermissions();
      (role.permissions || []).forEach(function (perm) {
        var row = roleForm.querySelector('[data-perm="' + perm.page + '"]');
        if (!row) return;
        var read = row.querySelector("[data-perm-read]");
        var write = row.querySelector("[data-perm-write]");
        if (read) read.checked = !!perm.can_read;
        if (write) {
          write.checked = !!perm.can_write;
          write.disabled = !perm.can_read;
        }
      });
      openModal("role-modal");
    }

    var addRoleBtn = document.querySelector("[data-role-add]");
    if (addRoleBtn) addRoleBtn.addEventListener("click", resetRoleForm);

    document.querySelectorAll("[data-role-edit]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-role-edit"));
        var role = roleData.filter(function (r) { return r.id === id; })[0];
        if (role) openRoleEditor(role);
      });
    });

    document.querySelectorAll("[data-role-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) return;
        var id = btn.getAttribute("data-role-remove");
        if (!window.confirm("Remove this role? This cannot be undone.")) return;
        fetch("/api/roles/" + id, { method: "DELETE" })
          .then(function (r) { if (!r.ok) throw new Error(); })
          .then(function () { window.location.reload(); })
          .catch(function () { window.alert("Could not remove the role. Reassign its accounts first."); });
      });
    });

    roleForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var payload = {
        name: roleForm.querySelector("[name=name]").value,
        permissions: collectPermissions()
      };
      var url = editingRoleId ? "/api/roles/" + editingRoleId : "/api/roles";
      var method = editingRoleId ? "PUT" : "POST";
      fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not save the role. Please try again."); });
    });
  }

  // ==========================================================================
  // Host inventory — add IPs, ranges or FQDNs with optional tags
  // ==========================================================================
  document.querySelectorAll("form[data-host-add]").forEach(function (form) {
    form._tagHandle = initTagInput(form);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var field = form.querySelector("textarea[name=values]");
      var values = String((field && field.value) || "")
        .split(/[\n,;]+/)
        .map(function (s) { return s.trim(); })
        .filter(function (s) { return s.length > 0; });
      if (!values.length) {
        if (field) field.focus();
        return;
      }
      fetch(form.getAttribute("data-endpoint"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values: values, tags: form._tagHandle.values() })
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not save these entries. Please try again."); });
    });
  });

  // Reset an add form whenever its modal is opened. The group form has its own
  // reset (title, id and tag chips) wired above.
  document.querySelectorAll("[data-open-modal]").forEach(function (btn) {
    var modal = document.getElementById(btn.getAttribute("data-open-modal"));
    if (!modal) return;
    var form = modal.querySelector("form[data-host-add], form[data-host-import]");
    if (!form) return;
    btn.addEventListener("click", function () {
      form.reset();
      if (form._tagHandle) form._tagHandle.reset();
    });
  });

  // ==========================================================================
  // Host inventory — edit and remove rows
  // ==========================================================================
  var HOST_ENDPOINTS = {
    ip: "/api/host-ips",
    range: "/api/host-ranges",
    fqdn: "/api/host-fqdns"
  };

  document.querySelectorAll("form[data-host-edit]").forEach(function (form) {
    form._tagHandle = initTagInput(form);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var id = form.querySelector("[name=id]").value;
      var valueField = form.querySelector("[name=value]");
      var value = (valueField.value || "").trim();
      if (!value) {
        valueField.focus();
        return;
      }
      fetch(form.getAttribute("data-endpoint") + "/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value, tags: form._tagHandle.values() })
      })
        .then(function (r) { if (!r.ok) throw new Error(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not save this entry. Please try again."); });
    });
  });

  document.querySelectorAll("[data-edit]").forEach(function (btn) {
    var kind = btn.getAttribute("data-edit");
    var modal = document.getElementById(kind + "-edit-modal");
    if (!modal) return;
    btn.addEventListener("click", function () {
      var form = modal.querySelector("form[data-host-edit]");
      if (!form) return;
      form.reset();
      form.querySelector("[name=id]").value = btn.getAttribute("data-id");
      form.querySelector("[name=value]").value = btn.getAttribute("data-value");
      if (form._tagHandle) form._tagHandle.reset();
      var row = btn.closest("tr");
      if (row && form._tagHandle) {
        row.querySelectorAll("[data-tag]").forEach(function (chip) {
          form._tagHandle.add(chip.getAttribute("data-tag"));
        });
      }
      openModal(kind + "-edit-modal");
    });
  });

  document.querySelectorAll("[data-delete]").forEach(function (btn) {
    var kind = btn.getAttribute("data-delete");
    btn.addEventListener("click", function () {
      if (!window.confirm("Remove this entry from the inventory?")) return;
      fetch(HOST_ENDPOINTS[kind] + "/" + btn.getAttribute("data-id"), { method: "DELETE" })
        .then(function (r) { if (!r.ok) throw new Error(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not remove this entry. Please try again."); });
    });
  });

  // ==========================================================================
  // Host inventory — CSV import (preview, then commit only on Confirm)
  // ==========================================================================
  var pendingImport = null;

  function showImportPreview(preview) {
    var modal = document.getElementById("import-result-modal");
    if (!modal) return;
    modal.querySelector("[data-result-ips]").textContent = preview.ips;
    modal.querySelector("[data-result-ranges]").textContent = preview.ranges;
    modal.querySelector("[data-result-fqdns]").textContent = preview.fqdns;
    var extra = modal.querySelector("[data-result-extra]");
    if (extra) {
      extra.textContent = preview.skipped
        ? preview.skipped + " unmatchable entry(ies) will be skipped."
        : "";
    }
    closeModal(document.getElementById("import-modal"));
    openModal("import-result-modal");
  }

  var importForm = document.querySelector("form[data-host-import]");
  if (importForm) {
    importForm._tagHandle = initTagInput(importForm);
    var importFile = importForm.querySelector("input[type=file]");
    var importStatus = importForm.querySelector("[data-import-status]");
    var importEntries = [];

    function parseImportEntries(text) {
      return String(text || "")
        .split(/[\n,;]+/)
        .map(function (s) { return s.trim().replace(/^"|"$/g, ""); })
        .filter(function (s) { return s.length > 0; });
    }

    if (importFile) {
      importFile.addEventListener("change", function () {
        importEntries = [];
        if (importStatus) importStatus.textContent = "";
        var file = importFile.files && importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          importEntries = parseImportEntries(reader.result);
          if (importStatus) {
            importStatus.textContent = importEntries.length
              ? importEntries.length + " entries found in " + file.name
              : "No entries found in " + file.name + ".";
          }
        };
        reader.onerror = function () {
          if (importStatus) importStatus.textContent = "Could not read " + file.name + ".";
        };
        reader.readAsText(file);
      });
    }

    importForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!importEntries.length) {
        if (importFile) importFile.focus();
        return;
      }
      var endpoint = importForm.getAttribute("data-endpoint");
      fetch(endpoint + "/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: importEntries })
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (preview) {
          pendingImport = {
            entries: importEntries.slice(),
            tags: importForm._tagHandle.values(),
            endpoint: endpoint
          };
          showImportPreview(preview);
        })
        .catch(function () { window.alert("Could not read the entries. Please try again."); });
    });

    var importOpen = document.querySelector('[data-open-modal="import-modal"]');
    if (importOpen) importOpen.addEventListener("click", function () {
      importEntries = [];
      pendingImport = null;
      if (importStatus) importStatus.textContent = "";
    });
  }

  var importConfirm = document.querySelector("[data-import-confirm]");
  if (importConfirm) importConfirm.addEventListener("click", function () {
    if (!pendingImport) {
      closeModal(document.getElementById("import-result-modal"));
      return;
    }
    fetch(pendingImport.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: pendingImport.entries, tags: pendingImport.tags })
    })
      .then(function (r) { if (!r.ok) throw new Error(); })
      .then(function () { window.location.reload(); })
      .catch(function () { window.alert("Could not import the file. Please try again."); });
  });

  var importUndo = document.querySelector("[data-import-undo]");
  if (importUndo) importUndo.addEventListener("click", function () {
    pendingImport = null;
    closeModal(document.getElementById("import-result-modal"));
  });

  // ==========================================================================
  // Data Explorer — run query
  // ==========================================================================
  var explorerRun = document.getElementById("explorer-run");
  var explorerFilter = document.getElementById("explorer-filter");
  if (explorerRun && explorerFilter) {
    explorerRun.addEventListener("click", function () {
      explorerFilter.dispatchEvent(new Event("input"));
    });
  }

  // ==========================================================================
  // Technologies — detail modal
  // ==========================================================================
  var techDataEl = document.getElementById("tech-data");
  if (techDataEl) {
    var techData = [];
    try { techData = JSON.parse(techDataEl.textContent || "[]"); } catch (_) {}
    var techTitle = document.getElementById("tech-modal-title");
    var techSub = document.getElementById("tech-modal-sub");
    var techHosts = document.getElementById("tech-modal-hosts");

    document.querySelectorAll("[data-tech-view]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = Number(btn.getAttribute("data-tech-view"));
        var tech = techData.filter(function (t) { return t.id === id; })[0];
        if (!tech) return;
        techTitle.textContent = tech.name;
        techSub.textContent = tech.versions + " · " + tech.category + " · " + tech.host_count + " hosts";
        techHosts.innerHTML = tech.hosts.map(function (h) {
          return "<tr><td class='strong-cell'>" + h.ip + "<div class='section-note'>" + h.hostname + "</div></td>" +
            "<td>" + h.os + "</td><td>" + h.port + "</td><td>" + h.service + "</td>" +
            "<td>" + h.first_seen + "</td><td>" + h.last_seen + "</td></tr>";
        }).join("");
        openModal("tech-modal");
      });
    });
  }

  // Scan summary
  var overviewMenu = document.getElementById("overview-menu");
  if (overviewMenu && sidebar) {
    var mobileOverview = window.matchMedia("(max-width: 760px)");
    var setOverviewMenu = function (open) {
      sidebar.classList.toggle("overview-nav-open", open);
      overviewMenu.setAttribute("aria-expanded", String(open));
    };
    var syncOverviewNav = function () {
      applyNavState(mobileOverview.matches || stored !== "true");
      setOverviewMenu(false);
    };

    document.body.classList.add("overview-menu-ready");
    overviewMenu.hidden = false;
    if (mobileOverview.matches) syncOverviewNav();
    overviewMenu.addEventListener("click", function () {
      var open = overviewMenu.getAttribute("aria-expanded") !== "true";
      setOverviewMenu(open);
      if (open) {
        var activeLink = sidebar.querySelector('[aria-current="page"]');
        if (activeLink && activeLink.getClientRects().length) activeLink.focus();
        else sidebar.querySelector("button, a").focus();
      }
    });
    mobileOverview.addEventListener("change", syncOverviewNav);
    document.addEventListener("click", function (event) {
      if (!sidebar.contains(event.target) && !overviewMenu.contains(event.target)) {
        setOverviewMenu(false);
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overviewMenu.getAttribute("aria-expanded") === "true") {
        setOverviewMenu(false);
        overviewMenu.focus();
      }
    });
  }

  var overviewShortcut = document.getElementById("overview-shortcut");
  if (overviewShortcut) {
    overviewShortcut.textContent = /^Mac/.test(navigator.platform) ? "⌘ K" : "Ctrl K";
    overviewShortcut.hidden = false;
    searchInput.setAttribute("aria-keyshortcuts", "Meta+K Control+K");
  }

  var summaryDataEl = document.getElementById("summary-data");
  var summaryRange = document.getElementById("summary-range");
  if (summaryDataEl && summaryRange) {
    var summaryPoints = [];
    try { summaryPoints = JSON.parse(summaryDataEl.textContent); } catch (_) {}

    if (summaryPoints.length) {
      var chart = document.getElementById("summary-chart");
      var bars = document.getElementById("summary-bars");
      var number = new Intl.NumberFormat(document.documentElement.lang);
      var serviceMax = Math.max(1, ...summaryPoints.map(function (point) { return point.services; }));

      var rangeButtons = summaryPoints.map(function (point, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "overview-bar";
        button.setAttribute("aria-label", "Last " + point.label + ", " + number.format(point.services) + " services");
        button.innerHTML = '<span class="overview-bar-track" aria-hidden="true">' +
          '<span class="overview-bar-column"></span><span class="overview-bar-value"></span></span>' +
          '<span class="overview-bar-label" aria-hidden="true"></span>';
        button.style.setProperty("--bar-height", (100 * point.services / serviceMax) + "%");
        button.querySelector(".overview-bar-value").textContent = number.format(point.services);
        button.querySelector(".overview-bar-label").textContent = point.label;

        button.addEventListener("click", function () {
          summaryRange.value = String(index);
          renderSummary(index);
        });
        bars.appendChild(button);
        return button;
      });

      function setSummaryDelta(id, value, positiveIsGood) {
        var delta = document.getElementById(id);
        delta.textContent = (value > 0 ? "+" : "") + number.format(value) + " since last scan";
        delta.classList.toggle("up", value !== 0 && (value > 0) === positiveIsGood);
        delta.classList.toggle("down", value !== 0 && (value > 0) !== positiveIsGood);
      }

      function renderSummary(index) {
        var point = summaryPoints[index];
        if (!point) return;
        document.getElementById("stat-alive").textContent = number.format(point.alive);
        document.getElementById("stat-down").textContent = number.format(point.down);
        document.getElementById("stat-services").textContent = number.format(point.services);
        setSummaryDelta("stat-alive-delta", point.alive_new, true);
        setSummaryDelta("stat-down-delta", point.down_new, false);
        rangeButtons.forEach(function (button, i) {
          button.setAttribute("aria-pressed", String(i === index));
        });
      }

      summaryRange.addEventListener("change", function () {
        renderSummary(Number(summaryRange.value));
      });
      renderSummary(Number(summaryRange.value));
      summaryRange.disabled = false;
      chart.hidden = false;
    }
  }

  // ==========================================================================
  // Scan compare — scan picker + comparison
  // ==========================================================================
  var scanDataEl = document.getElementById("scan-data");
  if (scanDataEl) {
    var scans = [];
    try { scans = JSON.parse(scanDataEl.textContent || "[]"); } catch (_) {}
    var selected = { a: scans[0] || null, b: scans[1] || null };
    var pickTarget = null;
    var ICON_UP = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12.5V3.9M4.5 7.4L8 3.9l3.5 3.5"/></svg>';
    var ICON_DOWN = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3.5v8.6M4.5 8.6L8 12.1l3.5-3.5"/></svg>';
    var ICON_SAME = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.6 8h8.8"/></svg>';

    var slotName = function (slot) { return document.getElementById("slot-" + slot + "-name"); };
    var slotDate = function (slot) { return document.getElementById("slot-" + slot + "-date"); };

    var renderSlots = function () {
      ["a", "b"].forEach(function (slot) {
        var scan = selected[slot];
        var nameEl = slotName(slot);
        var dateEl = slotDate(slot);
        if (!nameEl || !dateEl) return;
        if (scan) {
          nameEl.textContent = scan.label;
          dateEl.textContent = scan.started + " · " + scan.target;
        } else {
          nameEl.textContent = "\u2014";
          dateEl.textContent = "";
        }
      });
    };

    var renderCompare = function () {
      var body = document.getElementById("compare-body");
      if (!body) return;
      if (!selected.a || !selected.b) {
        body.innerHTML = '<tr><td colspan="4" class="empty-cell">Choose two scans to compare.</td></tr>';
        return;
      }
      var a = selected.a, b = selected.b;
      var metrics = [
        { label: "Alive hosts", key: "alive", invert: false },
        { label: "Hosts down", key: "down", invert: true },
        { label: "Services", key: "services", invert: false },
        { label: "Technologies", key: "technologies", invert: false },
        { label: "Vulnerabilities", key: "vulns", invert: true }
      ];
      body.innerHTML = metrics.map(function (m) {
        var av = a[m.key] || 0;
        var bv = b[m.key] || 0;
        var delta = bv - av;
        var state = delta === 0 ? "same" : ((m.invert ? delta < 0 : delta > 0) ? "better" : "worse");
        var icon = delta === 0 ? ICON_SAME : (delta > 0 ? ICON_UP : ICON_DOWN);
        var sign = delta > 0 ? "+" : "";
        var pct = av > 0 && delta !== 0
          ? "(" + (delta > 0 ? "+" : "") + (delta / av * 100).toFixed(1) + "%)"
          : "";
        return "<tr class='compare-row row-" + state + "'>" +
          "<td class='strong-cell'>" + m.label + "</td>" +
          "<td class='right mono'>" + av + "</td>" +
          "<td class='right mono'>" + bv + "</td>" +
          "<td class='right'><div class='compare-change'>" +
            "<span class='delta-pill delta-" + state + "'>" + icon + sign + delta + "</span>" +
            "<span class='delta-pct'>" + pct + "</span></div></td></tr>";
      }).join("");
    };

    var renderPicker = function (filter) {
      var list = document.getElementById("scan-picker-list");
      if (!list) return;
      var needle = (filter || "").trim().toLowerCase();
      list.innerHTML = "";
      scans.filter(function (s) {
        return !needle || (s.label + " " + s.started + " " + s.target).toLowerCase().indexOf(needle) !== -1;
      }).forEach(function (s) {
        var item = document.createElement("div");
        item.className = "picker-item";
        item.innerHTML = "<span class='picker-item-name'>" + s.label + "</span>" +
          "<span class='picker-item-meta'>" + s.started + " · " + s.target + "</span>";
        item.addEventListener("click", function () {
          if (pickTarget) selected[pickTarget] = s;
          renderSlots();
          renderCompare();
          closeModal(document.getElementById("scan-picker"));
        });
        list.appendChild(item);
      });
      if (!list.children.length) {
        list.innerHTML = "<div class='empty-cell'>No scans match that filter.</div>";
      }
    };

    document.querySelectorAll("[data-pick-scan]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        pickTarget = btn.getAttribute("data-pick-scan");
        var title = document.getElementById("scan-picker-title");
        if (title) title.textContent = "Select scan " + pickTarget.toUpperCase();
        var filter = document.getElementById("scan-picker-filter");
        if (filter) filter.value = "";
        renderPicker("");
        openModal("scan-picker");
        if (filter) filter.focus();
      });
    });

    var pickerFilter = document.getElementById("scan-picker-filter");
    if (pickerFilter) pickerFilter.addEventListener("input", function () { renderPicker(pickerFilter.value); });

    renderSlots();
    renderCompare();
  }

})();
