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
    // Optional attribute filter: `data-attr-filter="data-ack"` names the row
    // attribute and `data-attr-select="<select id>"` the control that drives it.
    var attrName = table.getAttribute("data-attr-filter");
    var attrId = table.getAttribute("data-attr-select");
    var attrSel = attrId ? document.getElementById(attrId) : null;

    if (!allRows.length) {
      if (rangeOut) rangeOut.textContent = "No entries";
      if (pageNum) pageNum.textContent = "1 / 1";
      [firstBtn, prevBtn, nextBtn, lastBtn].forEach(function (btn) {
        if (btn) btn.disabled = true;
      });
      return;
    }

    var state = { page: 1, size: sizeSel ? Number(sizeSel.value) || 10 : 10, filter: "", sev: "", attr: "" };

    function matches(row) {
      if (rangeSel) {
        var days = Number(rangeSel.value);
        if (days && Number(row.getAttribute("data-days")) > days) return false;
      }
      if (state.sev && row.getAttribute("data-sev") !== state.sev) return false;
      if (state.attr && row.getAttribute(attrName) !== state.attr) return false;
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
    if (attrSel && attrName && attrSel.tagName === "SELECT") {
      state.attr = attrSel.value || "";
      attrSel.addEventListener("change", function () {
        state.attr = attrSel.value || "";
        state.page = 1;
        render();
      });
    } else if (attrSel && attrName) {
      // A group of tab buttons, each carrying the value in `data-attr-value`.
      var attrTabs = Array.prototype.slice.call(attrSel.querySelectorAll("[data-attr-value]"));
      var activeTab = attrTabs.filter(function (t) { return t.classList.contains("is-on"); })[0];
      state.attr = activeTab ? activeTab.getAttribute("data-attr-value") : "";
      attrTabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
          state.attr = tab.getAttribute("data-attr-value");
          attrTabs.forEach(function (t) {
            var on = t === tab;
            t.classList.toggle("is-on", on);
            t.setAttribute("aria-pressed", on ? "true" : "false");
          });
          state.page = 1;
          render();
        });
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
    // The Data Explorer paginates its client-side dataset itself.
    if (pager.hasAttribute("data-pager-manual")) return;
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
  // Settings — HTTP scanner tuning
  // ==========================================================================
  var scanRate = document.getElementById("scan-rate-limit");
  var scanThreads = document.getElementById("scan-threads");
  var scanMulti = document.getElementById("scan-multithreaded");
  var scanRetries = document.getElementById("scan-retries");
  var scanSave = document.getElementById("scan-settings-save");
  if (scanRate && scanThreads && scanMulti) {
    var threadsRow = document.getElementById("scan-threads-row");
    var multiText = document.getElementById("scan-multithreaded-text");
    var savedNote = document.getElementById("settings-saved");
    var savedTimer = 0;

    // Threads only make sense while multithreading is on; the server forces the
    // count to 1 when it is off, so the field is disabled to match. The save
    // button only renders for accounts that may write, so its absence means
    // every control stays read-only.
    var readOnly = !scanSave;
    function syncThreadsField() {
      var on = scanMulti.checked;
      scanThreads.disabled = readOnly || !on;
      if (multiText) multiText.textContent = on ? "On" : "Off";
      if (threadsRow) threadsRow.classList.toggle("is-disabled", !on);
    }
    scanMulti.addEventListener("change", syncThreadsField);
    syncThreadsField();

    function flashSaved() {
      if (!savedNote) return;
      savedNote.hidden = false;
      window.clearTimeout(savedTimer);
      savedTimer = window.setTimeout(function () { savedNote.hidden = true; }, 2500);
    }

    if (scanSave) {
      scanSave.addEventListener("click", function () {
        var payload = {
          max_requests_per_second: Number(scanRate.value) || 1,
          threads: Number(scanThreads.value) || 1,
          multithreaded: scanMulti.checked,
          retries: scanRetries ? Number(scanRetries.value) || 0 : 0
        };
        scanSave.disabled = true;
        fetch("/api/settings/scan", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (response) {
            if (!response.ok) throw new Error();
            flashSaved();
          })
          .catch(function () { window.alert("Could not save scanner settings."); })
          .then(function () { scanSave.disabled = false; });
      });
    }
  }

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
    var scanEngine = document.getElementById("scan-engine");
    var pauseBtn = document.getElementById("scan-pause");
    var pauseIcon = document.getElementById("scan-pause-icon");
    var pauseText = document.getElementById("scan-pause-text");
    var scanTypeSel = document.getElementById("scan-type");

    var SCAN_TYPE_LABELS = { full: "Full scan test", reachability: "Reachability" };
    var ENGINE_LABELS = { httpx: "httpx", masscan: "masscan", tcp: "TCP probe" };

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
      var scanAlerts = document.getElementById("scan-alerts");
      if (scanAlerts) scanAlerts.textContent = s.alerts_found;

      if (pauseBtn) pauseBtn.setAttribute("data-paused", s.paused ? "true" : "false");
      if (pauseIcon) pauseIcon.innerHTML = s.paused ? PLAY_SVG : PAUSE_SVG;
      if (pauseText) pauseText.textContent = s.paused ? "Resume scan" : "Pause scan";

      if (scanLast && !s.running && s.completed_at) {
        scanLast.textContent = "Last scan finished " + s.completed_at + ".";
      }
      if (scanEngine) {
        var typeLabel = SCAN_TYPE_LABELS[s.scan_type] || s.scan_type || "";
        var engineLabel = ENGINE_LABELS[s.engine] || s.engine || "";
        scanEngine.textContent = typeLabel + (engineLabel ? " · " + engineLabel : "");
      }
    };

    var pollScan = function () {
      fetch("/api/scan/status")
        .then(function (r) { return r.json(); })
        .then(renderScan)
        .catch(function () {});
    };

    var scanAction = function (path, body) {
      return fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      })
        .then(function (r) {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(renderScan)
        .catch(function () {
          window.alert("Could not start the scan. Another scan may already be running.");
        });
    };

    if (pauseBtn) pauseBtn.addEventListener("click", function () { scanAction("/api/scan/pause"); });
    var cancelBtn = document.getElementById("scan-cancel");
    if (cancelBtn) cancelBtn.addEventListener("click", function () { scanAction("/api/scan/cancel"); });
    ["scan-start", "scan-start-upcoming"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener("click", function () {
        var type = scanTypeSel ? scanTypeSel.value : "full";
        scanAction("/api/scan/run", { scan_type: type });
      });
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
    var typeEl = document.getElementById("policy-type");
    var typeHint = document.getElementById("policy-type-hint");

    var TYPE_HINTS = {
      full: "Runs httpx against every target: host status, HTTP responses, TLS and technologies. Updates all captured data.",
      reachability: "Runs masscan (falling back to a TCP probe) to check which hosts are up. Leaves captured HTTP and technology data untouched."
    };

    function syncTypeHint() {
      if (typeEl && typeHint) typeHint.textContent = TYPE_HINTS[typeEl.value] || "";
    }

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
    if (typeEl) typeEl.addEventListener("change", syncTypeHint);

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
      if (typeEl) typeEl.value = "full";
      syncTypeHint();
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
      var scanType = "full";
      (policy.criteria || []).forEach(function (c) {
        if (c.kind === "frequency") {
          frequency = c.value;
        } else if (c.kind === "when") {
          when = parseWhen(c.value);
        } else if (c.kind === "type") {
          scanType = c.value === "reachability" ? "reachability" : "full";
        } else {
          // Match on kind as well as value: a tag can share its text with an IP
          // or group name, and only the right checkbox should come back checked.
          var kind = String(c.kind || "").trim().toLowerCase();
          policyForm.querySelectorAll("input[name=targets]").forEach(function (box) {
            if (box.value !== c.value) return;
            var boxKind = String(box.getAttribute("data-picker-kind") || "").trim().toLowerCase();
            if (boxKind === kind) box.checked = true;
          });
        }
      });

      if (typeEl) typeEl.value = scanType;
      syncTypeHint();

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

    document.querySelectorAll("[data-policy-run]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-policy-run");
        btn.disabled = true;
        fetch("/api/policies/" + id + "/run", { method: "POST" })
          .then(function (r) {
            if (!r.ok) throw new Error();
            return r.json();
          })
          .then(function () { window.location.assign("/scanning/management"); })
          .catch(function () {
            btn.disabled = false;
            window.alert("Could not start this scan. Another scan may already be running.");
          });
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
      criteria.push({ kind: "type", value: typeEl ? typeEl.value : "full" });

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
    var form = modal.querySelector("form[data-host-add]");
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
  var importScope = document.querySelector("[data-host-import]");
  var resultModal = document.getElementById("import-result-modal");

  function parseImportEntries(text) {
    return String(text || "")
      .split(/[\n,;]+/)
      .map(function (s) { return s.trim().replace(/^"|"$/g, ""); })
      .filter(function (s) { return s.length > 0; });
  }

  function fillImportCounts(counts) {
    ["ips", "ranges", "fqdns", "duplicates", "skipped"].forEach(function (key) {
      var cell = resultModal.querySelector("[data-result-" + key + "]");
      if (cell) cell.textContent = counts[key] || 0;
    });
  }

  // The result dialog has two states: a preview the user still has to confirm,
  // and the summary of what was actually written.
  function setImportResultState(done) {
    resultModal.querySelector("#import-result-title").textContent = done ? "Import complete" : "Import preview";
    resultModal.querySelector("[data-import-tags]").hidden = done;
    resultModal.querySelector("[data-import-undo]").hidden = done;
    var confirm = resultModal.querySelector("[data-import-confirm]");
    confirm.textContent = done ? "Done" : "Confirm";
    confirm.disabled = false;
  }

  if (importScope && resultModal) {
    var importModal = document.getElementById("import-modal");
    var importFile = importScope.querySelector("input[type=file]");
    var dropzone = importScope.querySelector("[data-dropzone]");
    var importStatus = importScope.querySelector("[data-import-status]");
    var importTags = initTagInput(resultModal.querySelector("[data-import-tags]"));
    var importConfirm = resultModal.querySelector("[data-import-confirm]");

    function setStatus(text, isError) {
      importStatus.textContent = text || "";
      importStatus.classList.toggle("is-error", !!isError);
    }

    function setBusy(on) {
      dropzone.classList.toggle("is-busy", on);
      dropzone.disabled = on;
      if (on) dropzone.setAttribute("aria-busy", "true");
      else dropzone.removeAttribute("aria-busy");
    }

    // Reads the file and asks the server what it would add; picking or dropping
    // a file is the whole first step, there is no separate Import button.
    function startImport(file) {
      if (!file) return;
      setStatus("Reading " + file.name + "…");
      setBusy(true);
      var reader = new FileReader();
      reader.onerror = function () {
        setBusy(false);
        setStatus("Could not read " + file.name + ".", true);
      };
      reader.onload = function () {
        var entries = parseImportEntries(reader.result);
        if (!entries.length) {
          setBusy(false);
          setStatus("No entries found in " + file.name + ".", true);
          return;
        }
        var endpoint = importScope.getAttribute("data-endpoint");
        fetch(endpoint + "/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entries: entries })
        })
          .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
          .then(function (preview) {
            setBusy(false);
            setStatus("");
            pendingImport = { entries: entries, endpoint: endpoint };
            resultModal.querySelector("[data-result-file]").textContent = file.name;
            fillImportCounts(preview);
            importTags.reset();
            setImportResultState(false);
            importConfirm.disabled = !(preview.ips + preview.ranges + preview.fqdns);
            closeModal(importModal);
            openModal("import-result-modal");
          })
          .catch(function () {
            setBusy(false);
            setStatus("Could not read the entries. Please try again.", true);
          });
      };
      reader.readAsText(file);
    }

    dropzone.addEventListener("click", function () { importFile.click(); });
    importFile.addEventListener("change", function () {
      startImport(importFile.files && importFile.files[0]);
      importFile.value = "";
    });

    var dragDepth = 0;
    dropzone.addEventListener("dragenter", function (e) {
      e.preventDefault();
      dragDepth += 1;
      dropzone.classList.add("is-dragover");
    });
    dropzone.addEventListener("dragover", function (e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    });
    dropzone.addEventListener("dragleave", function () {
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dropzone.classList.remove("is-dragover");
    });
    dropzone.addEventListener("drop", function (e) {
      e.preventDefault();
      dragDepth = 0;
      dropzone.classList.remove("is-dragover");
      if (dropzone.disabled) return;
      startImport(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]);
    });
    // A file dropped next to the zone should not navigate away from the page.
    importModal.addEventListener("dragover", function (e) { e.preventDefault(); });
    importModal.addEventListener("drop", function (e) { e.preventDefault(); });

    var importOpen = document.querySelector('[data-open-modal="import-modal"]');
    if (importOpen) importOpen.addEventListener("click", function () {
      pendingImport = null;
      setBusy(false);
      setStatus("");
      dropzone.classList.remove("is-dragover");
      setTimeout(function () { dropzone.focus(); }, 0);
    });

    importConfirm.addEventListener("click", function () {
      if (!pendingImport) {
        window.location.reload();
        return;
      }
      importConfirm.disabled = true;
      fetch(pendingImport.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: pendingImport.entries, tags: importTags.values() })
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function (summary) {
          pendingImport = null;
          fillImportCounts(summary);
          setImportResultState(true);
          importConfirm.focus();
        })
        .catch(function () {
          importConfirm.disabled = false;
          window.alert("Could not import the file. Please try again.");
        });
    });

    resultModal.querySelector("[data-import-undo]").addEventListener("click", function () {
      pendingImport = null;
      closeModal(resultModal);
    });
  }

  // ==========================================================================
  // Data Explorer — columns, filters, timeframe, pagination, edit mode
  // ==========================================================================
  var explorer = document.getElementById("explorer");
  var assetsDataEl = document.getElementById("assets-data");
  if (explorer && assetsDataEl) {
    var assets = [];
    try { assets = JSON.parse(assetsDataEl.textContent || "[]"); } catch (_) {}

    // The server only renders the edit toggle for accounts with write access;
    // the API enforces the same rule independently.
    var canEdit = explorer.getAttribute("data-can-edit") === "true";

    // Every column carries the operator set its values support. `ts` names the
    // timestamp field the timeframe filter uses for date columns.
    var COLUMNS = [
      { key: "address", label: "Host", type: "text", mono: true, primary: true },
      { key: "scan", label: "Scan", type: "text", mono: true },
      { key: "tags", label: "Tags", type: "list", tech: true },
      { key: "up", label: "Status", type: "bool" },
      { key: "scheme", label: "Scheme", type: "text" },
      { key: "port", label: "Port", type: "number", right: true, mono: true },
      { key: "status_code", label: "HTTP", type: "number", right: true, mono: true },
      { key: "content_type", label: "Content type", type: "text" },
      { key: "title", label: "Title", type: "text", wrap: true, editable: "title" },
      { key: "webserver", label: "Server", type: "text", editable: "webserver" },
      { key: "technologies", label: "Technologies", type: "list", tech: true },
      { key: "vulnerabilities", label: "Vulnerabilities", type: "list", tech: true },
      { key: "open_ports", label: "Open ports", type: "text", mono: true },
      { key: "cdn", label: "CDN", type: "text", editable: "cdn" },
      { key: "cdn_type", label: "CDN type", type: "text" },
      { key: "cname", label: "CNAME", type: "text", editable: "cname" },
      { key: "resolves_to", label: "Resolves to", type: "text", mono: true },
      { key: "host_ip", label: "Host IP", type: "text", mono: true },
      { key: "asn", label: "ASN", type: "text" },
      { key: "tls", label: "TLS", type: "text" },
      { key: "tls_expires", label: "Cert expires", type: "date" },
      { key: "tls_serial", label: "Cert serial", type: "text", mono: true },
      { key: "tls_fingerprint", label: "Cert fingerprint", type: "text", mono: true },
      { key: "jarm", label: "JARM", type: "text", mono: true },
      { key: "favicon", label: "Favicon hash", type: "text", mono: true },
      { key: "http2", label: "HTTP/2", type: "flag" },
      { key: "pipeline", label: "Pipeline", type: "flag" },
      { key: "vhost", label: "VHOST", type: "flag" },
      { key: "content_length", label: "Size", type: "number", right: true, mono: true },
      { key: "words", label: "Words", type: "number", right: true, mono: true },
      { key: "lines", label: "Lines", type: "number", right: true, mono: true },
      { key: "body_hash", label: "Body hash", type: "text", mono: true },
      { key: "header_hash", label: "Header hash", type: "text", mono: true },
      { key: "response_time", label: "Response", type: "text" },
      { key: "url", label: "URL", type: "text", wrap: true },
      { key: "final_url", label: "Final URL", type: "text", wrap: true },
      { key: "path", label: "Path", type: "text", mono: true },
      { key: "method", label: "Method", type: "text" },
      { key: "captured", label: "Captured", type: "date", ts: "captured_ts" },
      { key: "last_checked", label: "Last checked", type: "date", ts: "last_checked_ts" },
      { key: "last_seen", label: "Last seen", type: "date", ts: "last_seen_ts" },
      { key: "first_seen", label: "First seen", type: "date", ts: "first_seen_ts" },
      { key: "last_scan", label: "Last scan", type: "text", mono: true }
    ];

    var COLUMN_BY_KEY = {};
    COLUMNS.forEach(function (col) { COLUMN_BY_KEY[col.key] = col; });

    var OPS = {
      text: [
        { id: "contains", label: "contains" },
        { id: "not_contains", label: "does not contain" },
        { id: "equals", label: "equals" },
        { id: "starts", label: "starts with" },
        { id: "empty", label: "is empty" },
        { id: "not_empty", label: "is not empty" }
      ],
      number: [
        { id: "eq", label: "=" },
        { id: "ne", label: "≠" },
        { id: "gt", label: ">" },
        { id: "gte", label: "≥" },
        { id: "lt", label: "<" },
        { id: "lte", label: "≤" }
      ],
      bool: [
        { id: "true", label: "is up" },
        { id: "false", label: "is down" }
      ],
      flag: [
        { id: "true", label: "is yes" },
        { id: "false", label: "is no" }
      ],
      date: [
        { id: "after", label: "after" },
        { id: "before", label: "before" }
      ],
      list: [
        { id: "contains", label: "contains" },
        { id: "not_contains", label: "does not contain" },
        { id: "empty", label: "is empty" },
        { id: "not_empty", label: "is not empty" }
      ]
    };

    // Operators that carry no value, so their chip only shows a column + verb.
    function isValueless(filter) {
      var col = COLUMN_BY_KEY[filter.key];
      return (col && (col.type === "bool" || col.type === "flag"))
        || filter.op === "empty" || filter.op === "not_empty";
    }

    function valueOf(row, key) {
      var value = row[key];
      if (Array.isArray(value)) return value.join(" ");
      if (typeof value === "boolean") return value ? "up" : "down";
      return value == null ? "" : String(value);
    }

    function matchesFilter(row, filter) {
      var col = COLUMN_BY_KEY[filter.key];
      if (!col) return true;
      var raw = row[filter.key];
      var op = filter.op;
      var needle = filter.value;

      if (col.type === "bool" || col.type === "flag") {
        return op === "true" ? raw === true : raw === false;
      }
      if (col.type === "list") {
        var list = Array.isArray(raw) ? raw : [];
        if (op === "empty") return list.length === 0;
        if (op === "not_empty") return list.length > 0;
        var joined = list.join(" ").toLowerCase();
        var box = String(needle || "").toLowerCase();
        return op === "not_contains" ? joined.indexOf(box) === -1 : joined.indexOf(box) !== -1;
      }
      if (col.type === "number") {
        var left = parseFloat(String(raw).replace(/[^0-9.\-]/g, ""));
        var right = parseFloat(needle);
        if (isNaN(left) || isNaN(right)) return false;
        switch (op) {
          case "eq": return left === right;
          case "ne": return left !== right;
          case "gt": return left > right;
          case "gte": return left >= right;
          case "lt": return left < right;
          case "lte": return left <= right;
          default: return true;
        }
      }

      var hay = valueOf(row, filter.key).toLowerCase();
      var pin = String(needle || "").toLowerCase();
      switch (op) {
        case "empty": return hay === "";
        case "not_empty": return hay !== "";
        case "equals": return hay === pin;
        case "not_contains": return hay.indexOf(pin) === -1;
        case "starts": return hay.indexOf(pin) === 0;
        default: return pin ? hay.indexOf(pin) !== -1 : true;
      }
    }

    function startOf(range, now) {
      var date = new Date(now);
      date.setHours(0, 0, 0, 0);
      if (range === "week") {
        // Weeks start on Monday, matching the scan scheduling UI.
        var offset = (date.getDay() + 6) % 7;
        date.setDate(date.getDate() - offset);
      } else if (range === "month") {
        date.setDate(1);
      }
      return Math.floor(date.getTime() / 1000);
    }

    // `draft` holds the filters as they are being edited; `applied` is what the
    // table is actually showing. Apply copies draft onto applied, so a half-typed
    // filter never changes the results until the operator asks for it.
    var state = {
      draft: [],
      applied: [],
      timeframe: "month",
      from: null,
      to: null,
      page: 1,
      size: 100,
      editing: false
    };

    var els = {
      timeframe: document.getElementById("explorer-timeframe"),
      custom: document.getElementById("custom-range"),
      from: document.getElementById("explorer-from"),
      to: document.getElementById("explorer-to"),
      addBtn: document.getElementById("explorer-add-filter"),
      addMore: document.getElementById("explorer-add-more"),
      filterCount: explorer.querySelector("[data-filter-tally]"),
      menu: document.getElementById("filter-menu"),
      menuSearch: document.getElementById("filter-menu-search"),
      menuList: document.getElementById("filter-menu-list"),
      active: document.getElementById("filter-active"),
      summary: document.getElementById("filter-summary"),
      count: explorer.querySelector("[data-filter-count]"),
      clear: document.getElementById("explorer-clear"),
      head: document.getElementById("assets-head"),
      body: document.getElementById("assets-body"),
      empty: document.getElementById("assets-empty"),
      exportBtn: document.getElementById("explorer-export"),
      importWrap: document.getElementById("filter-import"),
      importBtn: document.getElementById("explorer-import"),
      importFile: document.getElementById("explorer-import-file"),
      editBtn: document.getElementById("explorer-edit"),
      pager: explorer.parentElement.querySelector("[data-pager]")
    };

    var pagerEls = {
      size: els.pager ? els.pager.querySelector("[data-page-size]") : null,
      range: els.pager ? els.pager.querySelector("[data-page-range]") : null,
      num: els.pager ? els.pager.querySelector("[data-page-num]") : null,
      first: els.pager ? els.pager.querySelector("[data-page-first]") : null,
      prev: els.pager ? els.pager.querySelector("[data-page-prev]") : null,
      next: els.pager ? els.pager.querySelector("[data-page-next]") : null,
      last: els.pager ? els.pager.querySelector("[data-page-last]") : null
    };

    function timeframeBounds() {
      var now = Date.now();
      if (state.timeframe === "custom") {
        return { from: state.from, to: state.to };
      }
      return { from: startOf(state.timeframe, now), to: null };
    }

    function visibleRows() {
      var bounds = timeframeBounds();
      return assets.filter(function (row) {
        var stamp = row.last_checked_ts || row.last_seen_ts || row.first_seen_ts || 0;
        if (bounds.from != null && stamp < bounds.from) return false;
        if (bounds.to != null && stamp > bounds.to) return false;
        return state.applied.every(function (filter) { return matchesFilter(row, filter); });
      });
    }

    // ---- table rendering -----------------------------------------------------

    function renderHead() {
      els.head.innerHTML = "";
      var tr = document.createElement("tr");
      COLUMNS.forEach(function (col) {
        var th = document.createElement("th");
        th.textContent = col.label;
        if (col.right) th.className = "right";
        tr.appendChild(th);
      });
      if (state.editing) {
        var actions = document.createElement("th");
        actions.className = "w-actions";
        actions.textContent = "Actions";
        tr.insertBefore(actions, tr.firstChild);
      }
      els.head.appendChild(tr);
    }

    function renderCell(col, row) {
      var td = document.createElement("td");
      if (col.right) td.className = "right";
      if (col.wrap) td.className = "wrap-cell";

      if (col.key === "up") {
        var badge = document.createElement("span");
        badge.className = "badge" + (row.up ? "" : " blocked");
        badge.textContent = row.up ? "Up" : "Down";
        td.appendChild(badge);
        return td;
      }
      if (col.type === "flag") {
        td.textContent = row[col.key] ? "Yes" : "No";
        if (!row[col.key]) td.className += " muted";
        return td;
      }
      if (col.tech) {
        td.className = "asset-tech";
        var list = Array.isArray(row[col.key]) ? row[col.key] : [];
        if (!list.length) {
          td.textContent = "—";
          td.className += " muted";
          return td;
        }
        list.forEach(function (tech) {
          var chip = document.createElement("span");
          chip.className = "host-chip";
          chip.textContent = tech;
          td.appendChild(chip);
        });
        return td;
      }

      var text = valueOf(row, col.key);
      if (col.primary) {
        var span = document.createElement("span");
        span.className = "mono strong-cell";
        span.textContent = text;
        td.appendChild(span);
      } else if (col.mono) {
        td.className += " mono";
        td.textContent = text || "—";
      } else {
        td.textContent = text || "—";
      }
      if (!text) td.classList.add("muted");
      return td;
    }

    function renderBody(rows) {
      els.body.innerHTML = "";
      if (!rows.length) {
        els.empty.hidden = false;
        return;
      }
      els.empty.hidden = true;
      rows.forEach(function (row) {
        var tr = document.createElement("tr");
        COLUMNS.forEach(function (col) { tr.appendChild(renderCell(col, row)); });
        if (state.editing) {
          var td = document.createElement("td");
          td.className = "w-actions";
          var btn = document.createElement("button");
          btn.type = "button";
          btn.className = "link-btn";
          btn.innerHTML = 'Edit';
          btn.setAttribute("data-asset-edit", row.address);
          btn.setAttribute("data-asset-scan", row.scan_id);
          td.appendChild(btn);
          tr.insertBefore(td, tr.firstChild);
        }
        els.body.appendChild(tr);
      });
    }

    function renderPager(total) {
      var pages = Math.max(1, Math.ceil(total / state.size));
      if (state.page > pages) state.page = pages;
      if (state.page < 1) state.page = 1;
      var start = (state.page - 1) * state.size;
      var end = Math.min(start + state.size, total);

      if (pagerEls.range) {
        pagerEls.range.textContent = total
          ? (start + 1) + "–" + end + " of " + total
          : "No entries";
      }
      if (pagerEls.num) pagerEls.num.textContent = state.page + " / " + pages;
      [pagerEls.first, pagerEls.prev].forEach(function (btn) {
        if (btn) btn.disabled = state.page <= 1;
      });
      [pagerEls.next, pagerEls.last].forEach(function (btn) {
        if (btn) btn.disabled = state.page >= pages;
      });
    }

    function render() {
      var rows = visibleRows();
      if (els.count) els.count.textContent = rows.length + (rows.length === 1 ? " host" : " hosts");
      renderPager(rows.length);
      var start = (state.page - 1) * state.size;
      renderBody(rows.slice(start, start + state.size));
      syncApplyButton();
      syncExport(rows.length);
    }

    // ---- CSV export ----------------------------------------------------------
    // Exports exactly what the filters and timeframe currently show, not just the
    // page on screen: an operator scopes the table, then takes the whole result.

    function csvCell(value) {
      var text = value == null ? "" : String(value);
      return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }

    function csvValue(row, col) {
      var raw = row[col.key];
      if (col.type === "flag") return raw ? "Yes" : "No";
      if (Array.isArray(raw)) return raw.join("; ");
      if (typeof raw === "boolean") return raw ? "Up" : "Down";
      return valueOf(row, col.key);
    }

    function exportCsv() {
      var rows = visibleRows();
      var lines = [COLUMNS.map(function (col) { return csvCell(col.label); }).join(",")];
      rows.forEach(function (row) {
        lines.push(COLUMNS.map(function (col) { return csvCell(csvValue(row, col)); }).join(","));
      });
      // The BOM keeps Excel from mangling non-ASCII host titles.
      var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      var stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = "data-explorer-" + stamp + ".csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    function syncExport(total) {
      if (els.exportBtn) els.exportBtn.disabled = total === 0;
    }

    // ---- CSV import ----------------------------------------------------------
    // Reads a file produced by the export above and sends the rows back. The
    // header marks which column is which, so column order does not matter.

    // RFC 4180 parsing: quoted cells may contain commas, newlines and doubled
    // quotes. Returns an array of records (each an array of cell strings).
    function parseCsv(text) {
      var records = [];
      var record = [];
      var cell = "";
      var quoted = false;
      var i = 0;

      // A UTF-8 BOM survives the file read; drop it or the first header is
      // "\ufeffHost" and the Host column is never found.
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      while (i < text.length) {
        var ch = text[i];
        if (quoted) {
          if (ch === '"') {
            if (text[i + 1] === '"') { cell += '"'; i += 2; continue; }
            quoted = false; i += 1; continue;
          }
          cell += ch; i += 1; continue;
        }
        if (ch === '"') { quoted = true; i += 1; continue; }
        if (ch === ",") { record.push(cell); cell = ""; i += 1; continue; }
        if (ch === "\r") { i += 1; continue; }
        if (ch === "\n") { record.push(cell); records.push(record); record = []; cell = ""; i += 1; continue; }
        cell += ch; i += 1;
      }
      if (cell !== "" || record.length) { record.push(cell); records.push(record); }
      // Drop a trailing blank line so it is not counted as a skipped row.
      return records.filter(function (row) {
        return row.some(function (value) { return value.trim() !== ""; });
      });
    }

    function importCsv(text) {
      var records = parseCsv(text);
      if (records.length < 2) {
        window.alert("That CSV has no data rows.");
        return;
      }
      var headers = records[0].map(function (h) { return h.trim(); });
      if (headers.indexOf("Host") === -1) {
        window.alert('That CSV has no "Host" column. Export the table from this page and edit the file.');
        return;
      }
      var rows = records.slice(1).map(function (values) {
        var row = {};
        headers.forEach(function (header, index) {
          if (header) row[header] = values[index] == null ? "" : values[index];
        });
        return row;
      });

      if (!window.confirm("Import " + rows.length + (rows.length === 1 ? " row" : " rows") + " into the Data Explorer?")) {
        return;
      }
      if (els.importBtn) els.importBtn.disabled = true;
      fetch("/api/assets/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rows })
      })
        .then(function (response) {
          if (!response.ok) throw new Error();
          return response.json();
        })
        .then(function (result) {
          var message = "Imported " + result.imported +
            (result.imported === 1 ? " row" : " rows") + ".";
          if (result.skipped) message += " Skipped " + result.skipped + " without a Host.";
          window.alert(message);
          if (result.imported) window.location.reload();
        })
        .catch(function () { window.alert("Could not import that CSV."); })
        .then(function () { if (els.importBtn) els.importBtn.disabled = false; });
    }

    if (els.importBtn && els.importFile) {
      els.importBtn.addEventListener("click", function () { els.importFile.click(); });
      els.importFile.addEventListener("change", function () {
        var file = els.importFile.files && els.importFile.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          // Reset first so picking the same file again still fires `change`.
          els.importFile.value = "";
          importCsv(String(reader.result || ""));
        };
        reader.onerror = function () { window.alert("Could not read that file."); };
        reader.readAsText(file);
      });
    }

    // ---- main action button --------------------------------------------------
    // One button serves both jobs: it adds a filter column, and once at least one
    // filter exists it becomes Apply, which runs every filter at once.

    function hasDraft() {
      return state.draft.length > 0;
    }

    function draftDiffers() {
      if (state.draft.length !== state.applied.length) return true;
      return state.draft.some(function (filter, index) {
        var other = state.applied[index];
        return !other || other.key !== filter.key || other.op !== filter.op ||
          other.value !== filter.value;
      });
    }

    function syncApplyButton() {
      if (!els.addBtn) return;
      var label = hasDraft() ? "Apply" : "Add filter";
      if (els.addBtn.textContent !== label) els.addBtn.textContent = label;
      els.addBtn.classList.toggle("is-apply", hasDraft());
      var pending = hasDraft() && draftDiffers();
      els.addBtn.setAttribute("aria-expanded", String(!els.menu.hidden));
      els.addBtn.setAttribute("aria-label", hasDraft()
        ? "Apply all filters"
        : "Add a filter");
      els.addBtn.classList.toggle("is-pending", pending);
      if (els.addMore) els.addMore.hidden = !hasDraft();
      if (els.clear) els.clear.hidden = !hasDraft();
      if (els.filterCount) {
        els.filterCount.textContent = state.draft.length
          ? state.draft.length + (state.draft.length === 1 ? " filter" : " filters")
          : "";
      }
    }

    function applyFilters() {
      state.applied = state.draft.map(function (filter) {
        return { key: filter.key, op: filter.op, value: filter.value };
      });
      state.page = 1;
      render();
    }

    // ---- active filter chips -------------------------------------------------

    // Every chip is editable at all times: the operator and value controls are
    // part of the chip, and removing it just drops that one filter.
    function renderActiveFilters() {
      if (!els.active) return;
      els.active.innerHTML = "";
      if (!state.draft.length) {
        var hint = document.createElement("p");
        hint.className = "filter-empty";
        hint.textContent = "No filters yet. Use Add filter to narrow the results.";
        els.active.appendChild(hint);
        syncApplyButton();
        return;
      }

      state.draft.forEach(function (filter, index) {
        var col = COLUMN_BY_KEY[filter.key];
        if (!col) return;

        var chip = document.createElement("div");
        chip.className = "filter-chip";

        var head = document.createElement("div");
        head.className = "filter-chip-head";

        var name = document.createElement("span");
        name.className = "filter-chip-name";
        name.textContent = col.label;
        head.appendChild(name);

        var remove = document.createElement("button");
        remove.type = "button";
        remove.className = "chip-x";
        remove.setAttribute("aria-label", "Remove " + col.label + " filter");
        remove.innerHTML = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"/></svg>';
        remove.addEventListener("click", function () {
          state.draft.splice(index, 1);
          renderActiveFilters();
          syncApplyButton();
        });
        head.appendChild(remove);
        chip.appendChild(head);

        var controls = document.createElement("div");
        controls.className = "filter-chip-controls";

        var opSel = document.createElement("select");
        opSel.className = "filter-op";
        opSel.setAttribute("aria-label", col.label + " operator");
        (OPS[col.type] || []).forEach(function (op) {
          var option = document.createElement("option");
          option.value = op.id;
          option.textContent = op.label;
          if (op.id === filter.op) option.selected = true;
          opSel.appendChild(option);
        });
        controls.appendChild(opSel);

        var valueInput = null;
        if (!isValueless(filter)) {
          valueInput = document.createElement("input");
          valueInput.className = "filter-value";
          valueInput.type = col.type === "number" ? "number" : "text";
          valueInput.value = filter.value || "";
          valueInput.placeholder = col.type === "date" ? "YYYY-MM-DD" : "value";
          valueInput.setAttribute("aria-label", col.label + " value");
          controls.appendChild(valueInput);
        }
        chip.appendChild(controls);

        opSel.addEventListener("change", function () {
          filter.op = opSel.value;
          filter.value = "";
          renderActiveFilters();
          syncApplyButton();
        });
        if (valueInput) {
          valueInput.addEventListener("input", function () {
            filter.value = valueInput.value;
            syncApplyButton();
          });
          valueInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
              event.preventDefault();
              applyFilters();
            }
          });
        }

        els.active.appendChild(chip);
      });
      syncApplyButton();
    }

    // ---- add-filter menu -----------------------------------------------------

    function renderMenu() {
      var needle = (els.menuSearch.value || "").trim().toLowerCase();
      els.menuList.innerHTML = "";
      var matches = COLUMNS.filter(function (col) {
        return !needle || col.label.toLowerCase().indexOf(needle) !== -1;
      });
      if (!matches.length) {
        els.menuList.innerHTML = "<div class='filter-menu-empty'>No columns match that search.</div>";
        return;
      }
      matches.forEach(function (col) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "filter-menu-item";
        item.setAttribute("role", "option");
        item.textContent = col.label;
        item.addEventListener("click", function () {
          state.draft.push({
            key: col.key,
            op: (OPS[col.type] || [{ id: "contains" }])[0].id,
            value: ""
          });
          renderActiveFilters();
          closeMenu();
          var inputs = els.active.querySelectorAll(".filter-value");
          if (inputs.length) inputs[inputs.length - 1].focus();
        });
        els.menuList.appendChild(item);
      });
    }

    // The menu floats over the page next to the add button: below it when
    // there is room, otherwise above, so it is never clipped by the sidebar.
    function placeMenu() {
      if (els.menu.hidden) return;
      var anchor = els.addBtn.parentElement.getBoundingClientRect();
      var below = window.innerHeight - anchor.bottom;
      els.menu.style.left = anchor.left + "px";
      els.menu.style.width = anchor.width + "px";
      if (below >= 320 || below >= anchor.top) {
        els.menu.style.top = (anchor.bottom + 6) + "px";
        els.menu.style.bottom = "auto";
      } else {
        els.menu.style.top = "auto";
        els.menu.style.bottom = (window.innerHeight - anchor.top + 6) + "px";
      }
    }

    function openMenu() {
      els.menu.hidden = false;
      els.addBtn.setAttribute("aria-expanded", "true");
      els.menuSearch.value = "";
      renderMenu();
      placeMenu();
      els.menuSearch.focus({ preventScroll: true });
    }

    function closeMenu() {
      els.menu.hidden = true;
      els.addBtn.setAttribute("aria-expanded", "false");
    }

    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);

    // ---- timeframe -----------------------------------------------------------

    function syncTimeframe() {
      state.timeframe = els.timeframe.value;
      els.custom.hidden = state.timeframe !== "custom";
      if (state.timeframe === "custom") {
        if (!els.from.value) els.from.value = toLocalInput(Date.now() - 7 * 86400000);
        if (!els.to.value) els.to.value = toLocalInput(Date.now());
        state.from = fromLocalInput(els.from.value);
        state.to = fromLocalInput(els.to.value);
        if (state.to != null) state.to += 59; // include the selected minute
      } else {
        state.from = null;
        state.to = null;
      }
      state.page = 1;
      render();
    }

    function toLocalInput(ms) {
      var date = new Date(ms);
      var pad = function (n) { return (n < 10 ? "0" : "") + n; };
      return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
        "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
    }

    function fromLocalInput(value) {
      if (!value) return null;
      var stamp = new Date(value).getTime();
      return isNaN(stamp) ? null : Math.floor(stamp / 1000);
    }

    // ---- wire up -------------------------------------------------------------

    els.timeframe.addEventListener("change", syncTimeframe);
    [els.from, els.to].forEach(function (input) {
      input.addEventListener("change", syncTimeframe);
    });

    // The button adds a filter while the list is empty and applies all of them
    // afterwards. Adding a further column stays available from the menu, which
    // the small caret next to the button opens.
    els.addBtn.addEventListener("click", function () {
      if (!hasDraft()) {
        if (els.menu.hidden) openMenu();
        else closeMenu();
        return;
      }
      applyFilters();
    });
    if (els.addMore) {
      els.addMore.addEventListener("click", function () {
        if (els.menu.hidden) openMenu();
        else closeMenu();
      });
    }
    els.menuSearch.addEventListener("input", renderMenu);
    if (els.exportBtn) {
      els.exportBtn.addEventListener("click", exportCsv);
    }
    document.addEventListener("click", function (event) {
      if (els.menu.hidden) return;
      if (els.menu.contains(event.target) ||
          els.addBtn.contains(event.target) ||
          (els.addMore && els.addMore.contains(event.target))) return;
      closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !els.menu.hidden) closeMenu();
    });

    if (els.clear) {
      els.clear.addEventListener("click", function () {
        state.draft = [];
        state.applied = [];
        state.page = 1;
        renderActiveFilters();
        render();
      });
    }

    if (pagerEls.size) {
      state.size = Number(pagerEls.size.value) || 10;
      pagerEls.size.addEventListener("change", function () {
        state.size = Number(pagerEls.size.value) || 10;
        state.page = 1;
        render();
      });
    }
    if (pagerEls.first) pagerEls.first.addEventListener("click", function () { state.page = 1; render(); });
    if (pagerEls.prev) pagerEls.prev.addEventListener("click", function () { state.page -= 1; render(); });
    if (pagerEls.next) pagerEls.next.addEventListener("click", function () { state.page += 1; render(); });
    if (pagerEls.last) {
      pagerEls.last.addEventListener("click", function () {
        state.page = Math.ceil(visibleRows().length / state.size) || 1;
        render();
      });
    }

    // ---- edit mode -----------------------------------------------------------

    var editModal = document.getElementById("asset-edit-modal");
    var editForm = document.getElementById("asset-edit-form");
    var editingAddress = null;
    var editingScan = null;

    function syncUpText() {
      var box = document.getElementById("asset-up");
      var text = document.getElementById("asset-up-text");
      if (box && text) text.textContent = box.checked ? "Up" : "Down";
    }

    if (els.editBtn && canEdit) {
      els.editBtn.addEventListener("click", function () {
        state.editing = !state.editing;
        els.editBtn.setAttribute("aria-pressed", String(state.editing));
        els.editBtn.classList.toggle("is-active", state.editing);
        // The CSV import is an edit-mode action, so it only shows while editing.
        if (els.importWrap) els.importWrap.hidden = !state.editing;
        renderHead();
        render();
      });
    }

    if (editModal && editForm) {
      var upBox = document.getElementById("asset-up");
      if (upBox) upBox.addEventListener("change", syncUpText);

      els.body.addEventListener("click", function (event) {
        var btn = event.target.closest("[data-asset-edit]");
        if (!btn) return;
        var address = btn.getAttribute("data-asset-edit");
        var scanId = Number(btn.getAttribute("data-asset-scan"));
        // Each row is one scan's capture, so match on both to edit the right one.
        var row = assets.filter(function (asset) {
          return asset.address === address && asset.scan_id === scanId;
        })[0];
        if (!row) return;
        editingAddress = address;
        editingScan = scanId;
        document.getElementById("asset-edit-sub").textContent = address + " · " + row.scan;
        document.getElementById("asset-title").value = row.title || "";
        document.getElementById("asset-webserver").value = row.webserver || "";
        document.getElementById("asset-scheme").value = row.scheme || "";
        document.getElementById("asset-port").value = row.port || "";
        document.getElementById("asset-status").value = row.status_code || "";
        document.getElementById("asset-cdn").value = row.cdn || "";
        document.getElementById("asset-cname").value = row.cname || "";
        document.getElementById("asset-up").checked = !!row.up;
        syncUpText();
        openModal("asset-edit-modal");
      });

      editForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!editingAddress) return;
        var num = function (id) {
          var raw = document.getElementById(id).value.trim();
          if (!raw) return null;
          var parsed = Number(raw);
          return isNaN(parsed) ? null : parsed;
        };
        var payload = {
          title: document.getElementById("asset-title").value,
          webserver: document.getElementById("asset-webserver").value,
          scheme: document.getElementById("asset-scheme").value,
          port: num("asset-port"),
          status_code: num("asset-status"),
          cdn: document.getElementById("asset-cdn").value,
          cname: document.getElementById("asset-cname").value,
          up: document.getElementById("asset-up").checked
        };
        fetch("/api/scans/" + editingScan + "/assets/" + encodeURIComponent(editingAddress), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (response) {
            if (!response.ok) throw new Error();
            window.location.reload();
          })
          .catch(function () { window.alert("Could not save this host. Please try again."); });
      });
    }

    renderHead();
    renderActiveFilters();
    syncTimeframe();

    // Dashboards deep-link here with `?filter=<key>|<op>|<value>`, repeated for
    // as many filters as the view needs. They land pre-applied so the Explorer
    // opens already scoped to what the dashboard was showing.
    var params = new URLSearchParams(window.location.search);
    var incoming = params.getAll("filter");
    if (incoming.length) {
      incoming.forEach(function (raw) {
        var parts = raw.split("|");
        var col = COLUMN_BY_KEY[parts[0]];
        if (!col) return;
        var op = parts[1] || (OPS[col.type] || [{ id: "contains" }])[0].id;
        state.draft.push({ key: col.key, op: op, value: parts.slice(2).join("|") });
      });
      renderActiveFilters();
      applyFilters();
    }
  }

  // ==========================================================================
  // Scan Results — maximized detail view
  // ==========================================================================
  var scanDetailModal = document.getElementById("scan-detail-modal");
  if (scanDetailModal) {
    var detailSeq = 0;

    var setText = function (id, value) {
      var el = document.getElementById(id);
      if (el) el.textContent = value;
    };

    var renderList = function (id, items, emptyText) {
      var list = document.getElementById(id);
      if (!list) return;
      list.innerHTML = "";
      if (!items || !items.length) {
        var none = document.createElement("li");
        none.className = "detail-empty";
        none.textContent = emptyText;
        list.appendChild(none);
        return;
      }
      items.forEach(function (item) {
        var li = document.createElement("li");
        var name = document.createElement("span");
        name.textContent = item.name || item.label || "";
        var count = document.createElement("span");
        count.className = "detail-list-count";
        count.textContent = item.hosts;
        li.appendChild(name);
        li.appendChild(count);
        list.appendChild(li);
      });
    };

    var renderDetail = function (scan) {
      var title = document.getElementById("scan-detail-title");
      if (title) title.textContent = scan.label;
      setText("scan-detail-sub", [scan.scan_type_label, scan.engine]
        .filter(function (part) { return part; }).join(" · "));

      var meta = document.getElementById("scan-detail-meta");
      if (meta) {
        meta.innerHTML = "";
        [
          ["Status", scan.status],
          ["Trigger", scan.trigger],
          ["Started", scan.started],
          ["Finished", scan.finished],
          ["Duration", scan.duration]
        ].forEach(function (pair) {
          var row = document.createElement("div");
          row.className = "detail-meta-row";
          var key = document.createElement("span");
          key.className = "detail-meta-key";
          key.textContent = pair[0];
          var value = document.createElement("span");
          value.className = "detail-meta-value";
          value.textContent = pair[1];
          row.appendChild(key);
          row.appendChild(value);
          meta.appendChild(row);
        });
      }

      setText("scan-detail-hosts", scan.hosts_total);
      setText("scan-detail-alive", scan.alive);
      setText("scan-detail-down", scan.down);
      setText("scan-detail-services", scan.services);
      setText("scan-detail-tech", scan.technologies);
      setText("scan-detail-vulns", scan.vulns);
      setText("scan-detail-alert-host", scan.alerts_new_host);
      setText("scan-detail-alert-down", scan.alerts_host_down);
      setText("scan-detail-alert-cve", scan.alerts_new_cve);
      setText("scan-detail-alert-open", scan.alerts_open);

      var targets = document.getElementById("scan-detail-targets");
      if (targets) {
        targets.innerHTML = "";
        (scan.targets || []).forEach(function (target) {
          var chip = document.createElement("span");
          chip.className = "criteria-chip mono";
          chip.textContent = target;
          targets.appendChild(chip);
        });
        if (!scan.targets || !scan.targets.length) {
          targets.innerHTML = "<span class='muted'>No targets recorded.</span>";
        }
      }

      renderList("scan-detail-top-tech", scan.top_technologies, "No technologies captured.");
      renderList("scan-detail-top-services", scan.top_services, "No services captured.");

      var banner = document.getElementById("scan-detail-error");
      if (banner) {
        banner.textContent = scan.error || "";
        banner.hidden = !scan.error;
      }

      // Real scans have their captured hosts tagged with `last_scan_id`, so the
      // Explorer can open scoped to exactly this run. Demo rows are synthetic and
      // have no matching hosts, so they open the Explorer unfiltered instead.
      var explorerLink = document.getElementById("scan-detail-explorer");
      if (explorerLink) {
        explorerLink.href = scan.demo
          ? "/log-center/data-explorer"
          : "/log-center/data-explorer?" + new URLSearchParams({
            filter: ["last_scan", "equals", "#" + scan.id].join("|")
          }).toString();
      }
    };

    document.querySelectorAll("[data-scan-details]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-scan-details");
        var seq = ++detailSeq;
        fetch("/api/scans/" + id)
          .then(function (r) {
            if (!r.ok) throw new Error();
            return r.json();
          })
          .then(function (scan) {
            if (seq !== detailSeq) return;
            renderDetail(scan);
            openModal("scan-detail-modal");
          })
          .catch(function () {
            window.alert("Could not load this scan's details.");
          });
      });
    });
  }

  // ==========================================================================
  // Alerts — acknowledge one or many
  // ==========================================================================
  var alertsTable = document.getElementById("alerts-table");
  if (alertsTable) {
    var picks = Array.prototype.slice.call(alertsTable.querySelectorAll("[data-alert-pick]"));
    var ackSelected = document.getElementById("alerts-ack-selected");

    var selectedIds = function () {
      return picks
        .filter(function (box) { return box.checked; })
        .map(function (box) { return Number(box.getAttribute("data-alert-pick")); });
    };

    var syncAckButton = function () {
      if (ackSelected) ackSelected.disabled = selectedIds().length === 0;
    };

    picks.forEach(function (box) { box.addEventListener("change", syncAckButton); });
    syncAckButton();

    var acknowledge = function (ids) {
      if (!ids.length) return;
      fetch("/api/alerts/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ids })
      })
        .then(function (r) {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not acknowledge these alerts."); });
    };

    if (ackSelected) {
      ackSelected.addEventListener("click", function () { acknowledge(selectedIds()); });
    }

    document.querySelectorAll("[data-alert-ack]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        acknowledge([Number(btn.getAttribute("data-alert-ack"))]);
      });
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
