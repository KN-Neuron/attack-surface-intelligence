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

    var state = { page: 1, size: sizeSel ? Number(sizeSel.value) || 10 : 10, filter: "" };

    function matches(row) {
      if (rangeSel) {
        var days = Number(rangeSel.value);
        if (days && Number(row.getAttribute("data-days")) > days) return false;
      }
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
    if (event.target.classList.contains("modal-backdrop")) {
      closeModal(event.target);
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    var open = document.querySelector(".modal-backdrop:not([hidden])");
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
  // Policies — dynamic criteria
  // ==========================================================================
  var policyForm = document.getElementById("policy-form");
  if (policyForm) {
    var optionsEl = document.getElementById("policy-options");
    var options = { groups: [], ranges: [] };
    try { options = JSON.parse(optionsEl.textContent || "{}"); } catch (_) {}
    var criteriaList = document.getElementById("criteria-list");
    var criteriaEmpty = document.getElementById("criteria-empty");

    var KINDS = ["host group", "IP to scan", "when", "frequency", "enabled"];

    function valueControl(kind, current) {
      var el;
      if (kind === "host group" && options.groups && options.groups.length) {
        el = document.createElement("select");
        options.groups.forEach(function (g) {
          var o = document.createElement("option");
          o.value = g; o.textContent = g;
          el.appendChild(o);
        });
      } else if (kind === "IP to scan" && options.ranges && options.ranges.length) {
        el = document.createElement("select");
        options.ranges.forEach(function (r) {
          var o = document.createElement("option");
          o.value = r; o.textContent = r;
          el.appendChild(o);
        });
      } else if (kind === "frequency") {
        el = document.createElement("select");
        ["Daily", "Weekly", "Monthly", "On demand"].forEach(function (f) {
          var o = document.createElement("option");
          o.value = f; o.textContent = f;
          el.appendChild(o);
        });
      } else if (kind === "enabled") {
        el = document.createElement("select");
        ["Enabled", "Disabled"].forEach(function (f) {
          var o = document.createElement("option");
          o.value = f; o.textContent = f;
          el.appendChild(o);
        });
      } else if (kind === "when") {
        el = document.createElement("input");
        el.type = "text";
        el.placeholder = "e.g. Every day at 01:00";
      } else {
        el = document.createElement("input");
        el.type = "text";
        el.placeholder = "e.g. 10.0.0.0/24";
      }
      if (current) {
        if (el.tagName === "SELECT") {
          var found = Array.prototype.some.call(el.options, function (o) { return o.value === current; });
          if (!found) {
            var opt = document.createElement("option");
            opt.value = current; opt.textContent = current;
            el.appendChild(opt);
          }
        } else {
          el.value = current;
        }
        el.value = current;
      }
      el.className = "criterion-value";
      return el;
    }

    function updateEmpty() {
      if (!criteriaEmpty) return;
      criteriaEmpty.style.display = criteriaList.children.length ? "none" : "";
    }

    function addCriterion(kind, current) {
      var row = document.createElement("div");
      row.className = "criteria-row";

      var select = document.createElement("select");
      select.className = "criterion-kind";
      KINDS.forEach(function (k) {
        var o = document.createElement("option");
        o.value = k; o.textContent = k.charAt(0).toUpperCase() + k.slice(1);
        select.appendChild(o);
      });
      select.value = kind || "host group";

      var valueSlot = document.createElement("span");
      valueSlot.style.flex = "1 1 auto";
      valueSlot.style.display = "flex";
      valueSlot.appendChild(valueControl(select.value, current));

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "icon-btn";
      remove.setAttribute("aria-label", "Remove criterion");
      remove.innerHTML = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.2 4.4h9.6M6.4 4.4V3.1h3.2v1.3M4.6 4.4l.5 8a1 1 0 001 .9h3.8a1 1 0 001-.9l.5-8"/></svg>';
      remove.addEventListener("click", function () {
        row.remove();
        updateEmpty();
      });

      select.addEventListener("change", function () {
        valueSlot.innerHTML = "";
        valueSlot.appendChild(valueControl(select.value, ""));
      });

      row.appendChild(select);
      row.appendChild(valueSlot);
      row.appendChild(remove);
      criteriaList.appendChild(row);
      updateEmpty();
    }

    var addCriterionBtn = document.querySelector("[data-add-criterion]");
    if (addCriterionBtn) addCriterionBtn.addEventListener("click", function () { addCriterion("host group"); });

    var policyDataEl = document.getElementById("policy-data");
    var policyData = [];
    try { policyData = JSON.parse(policyDataEl.textContent || "[]"); } catch (_) {}

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

    function resetPolicyForm() {
      editingPolicyId = null;
      policyForm.reset();
      if (policyIdInput) policyIdInput.value = "";
      if (policyEnabled) policyEnabled.checked = true;
      syncPolicyEnabled();
      if (policyTitle) policyTitle.textContent = "Add scan policy";
      criteriaList.innerHTML = "";
      updateEmpty();
    }

    function openPolicyEditor(policy) {
      editingPolicyId = policy.id;
      if (policyIdInput) policyIdInput.value = String(policy.id);
      policyForm.querySelector("[name=name]").value = policy.name;
      policyForm.querySelector("[name=order]").value = policy.order;
      if (policyEnabled) policyEnabled.checked = !!policy.enabled;
      syncPolicyEnabled();
      if (policyTitle) policyTitle.textContent = "Edit scan policy";
      criteriaList.innerHTML = "";
      (policy.criteria || []).forEach(function (c) { addCriterion(c.kind, c.value); });
      updateEmpty();
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
        if (!window.confirm("Remove this scan policy? This cannot be undone.")) return;
        fetch("/api/policies/" + id, { method: "DELETE" })
          .then(function (r) { if (!r.ok) throw new Error(); })
          .then(function () { window.location.reload(); })
          .catch(function () { window.alert("Could not remove the policy. Please try again."); });
      });
    });

    policyForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var crit = [];
      criteriaList.querySelectorAll(".criteria-row").forEach(function (row) {
        var kind = row.querySelector(".criterion-kind").value;
        var val = row.querySelector(".criterion-value").value;
        if (val) crit.push({ kind: kind, value: val });
      });
      if (!crit.length) {
        addCriterion("host group");
        return;
      }
      var payload = {
        name: policyForm.querySelector("[name=name]").value,
        order: Number(policyForm.querySelector("[name=order]").value) || 0,
        criteria: crit,
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
        .catch(function () { window.alert("Could not save the policy. Please try again."); });
    });

    updateEmpty();
  }

  // ==========================================================================
  // Host groups — tag input + submit
  // ==========================================================================
  var groupForm = document.getElementById("group-form");
  if (groupForm) {
    var hostInput = document.getElementById("group-host-input");
    var hostAdd = document.getElementById("group-host-add");
    var hostChips = document.getElementById("group-host-chips");
    var groupHosts = [];

    function renderHostChips() {
      hostChips.innerHTML = "";
      groupHosts.forEach(function (h, i) {
        var chip = document.createElement("span");
        chip.className = "host-chip";
        chip.appendChild(document.createTextNode(h));
        var x = document.createElement("button");
        x.type = "button";
        x.className = "chip-x";
        x.setAttribute("aria-label", "Remove " + h);
        x.innerHTML = '<svg class="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2"/></svg>';
        x.addEventListener("click", function () {
          groupHosts.splice(i, 1);
          renderHostChips();
        });
        chip.appendChild(x);
        hostChips.appendChild(chip);
      });
    }

    function addHost() {
      var value = (hostInput.value || "").trim();
      if (!value) return;
      if (groupHosts.indexOf(value) === -1) groupHosts.push(value);
      hostInput.value = "";
      hostInput.focus();
      renderHostChips();
    }

    if (hostAdd) hostAdd.addEventListener("click", addHost);
    if (hostInput) hostInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); addHost(); }
    });

    groupForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var ranges = [];
      groupForm.querySelectorAll("input[name=ranges]:checked").forEach(function (c) { ranges.push(c.value); });
      var payload = {
        name: groupForm.querySelector("[name=name]").value,
        ranges: ranges,
        hosts: groupHosts
      };
      fetch("/api/host-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not save the group. Please try again."); });
    });
  }

  // ==========================================================================
  // Admin management — submit
  // ==========================================================================
  var adminForm = document.getElementById("admin-form");
  if (adminForm) {
    var adminDataEl = document.getElementById("admin-data");
    var adminData = [];
    try { adminData = JSON.parse(adminDataEl.textContent || "[]"); } catch (_) {}

    var adminIdInput = document.getElementById("admin-id");
    var adminTitle = document.getElementById("admin-modal-title");
    var adminStatus = document.getElementById("admin-status");
    var adminPasswordField = document.getElementById("admin-password-field");
    var editingAdminId = null;

    function resetAdminForm() {
      editingAdminId = null;
      adminForm.reset();
      if (adminIdInput) adminIdInput.value = "";
      if (adminStatus) adminStatus.value = "Active";
      if (adminTitle) adminTitle.textContent = "Add administrator";
      if (adminPasswordField) adminPasswordField.hidden = false;
    }

    function openAdminEditor(admin) {
      editingAdminId = admin.id;
      if (adminIdInput) adminIdInput.value = String(admin.id);
      adminForm.querySelector("[name=name]").value = admin.name;
      adminForm.querySelector("[name=email]").value = admin.email;
      adminForm.querySelector("[name=role]").value = admin.role;
      if (adminStatus) adminStatus.value = admin.status;
      if (adminTitle) adminTitle.textContent = "Edit administrator";
      if (adminPasswordField) adminPasswordField.hidden = true;
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
        role: adminForm.querySelector("[name=role]").value,
        status: adminStatus ? adminStatus.value : "Active"
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
  // IP ranges — add single range or import CSV
  // ==========================================================================
  var ipForm = document.getElementById("ip-form");
  if (ipForm) {
    var ipMode = "single";
    var ipSingle = document.getElementById("ip-single");
    var ipImport = document.getElementById("ip-import");
    var ipAddress = document.getElementById("ip-address");
    var ipCity = document.getElementById("ip-city");
    var ipDescription = document.getElementById("ip-description");
    var ipCsv = document.getElementById("ip-csv");

    function setIpMode(mode) {
      ipMode = mode;
      document.querySelectorAll("[data-ip-mode]").forEach(function (b) {
        b.classList.toggle("active", b.getAttribute("data-ip-mode") === mode);
      });
      if (ipSingle) ipSingle.hidden = mode !== "single";
      if (ipImport) ipImport.hidden = mode !== "import";
    }

    document.querySelectorAll("[data-ip-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () { setIpMode(btn.getAttribute("data-ip-mode")); });
    });

    var ipOpenBtn = document.querySelector('[data-open-modal="ip-modal"]');
    if (ipOpenBtn) ipOpenBtn.addEventListener("click", function () {
      ipForm.reset();
      setIpMode("single");
    });

    ipForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (ipMode === "import") {
        var ranges = (ipCsv.value || "").split(/[\n,]+/).map(function (s) { return s.trim(); }).filter(Boolean);
        if (!ranges.length) {
          if (ipCsv) ipCsv.focus();
          return;
        }
        fetch("/api/ip-ranges/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ranges: ranges })
        })
          .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
          .then(function () { window.location.reload(); })
          .catch(function () { window.alert("Could not import the IP list. Please try again."); });
        return;
      }

      var address = (ipAddress.value || "").trim();
      if (!address) {
        if (ipAddress) ipAddress.focus();
        return;
      }
      fetch("/api/ip-ranges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address,
          city: (ipCity.value || "").trim(),
          description: (ipDescription.value || "").trim()
        })
      })
        .then(function (r) { if (!r.ok) throw new Error(); return r.json(); })
        .then(function () { window.location.reload(); })
        .catch(function () { window.alert("Could not add the IP range. Please try again."); });
    });
  }

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

  // ==========================================================================
  // Scan summary — range dropdown
  // ==========================================================================
  var summaryDataEl = document.getElementById("summary-data");
  if (summaryDataEl) {
    var points = [];
    try { points = JSON.parse(summaryDataEl.textContent || "[]"); } catch (_) {}
    var summaryRange = document.getElementById("summary-range");
    if (points.length && summaryRange) {
      var renderPoint = function (idx) {
        idx = Math.max(0, Math.min(points.length - 1, idx));
        var p = points[idx];

        var set = function (id, text) {
          var el = document.getElementById(id);
          if (el) el.textContent = text;
        };
        set("stat-alive", p.alive);
        set("stat-down", p.down);
        set("stat-services", p.services);
        set("donut-total", p.services);

        var aliveDelta = document.getElementById("stat-alive-delta");
        if (aliveDelta) {
          aliveDelta.textContent = (p.alive_new >= 0 ? "+" : "") + p.alive_new + " since last scan";
          aliveDelta.className = "metric-delta " + (p.alive_new >= 0 ? "up" : "down");
        }
        var downDelta = document.getElementById("stat-down-delta");
        if (downDelta) {
          downDelta.textContent = (p.down_new >= 0 ? "+" : "") + p.down_new + " since last scan";
          downDelta.className = "metric-delta " + (p.down_new >= 0 ? "down" : "up");
        }
      };

      summaryRange.addEventListener("change", function () {
        renderPoint(Number(summaryRange.value));
      });
      renderPoint(Number(summaryRange.value));
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
          nameEl.textContent = "Select a scan";
          dateEl.textContent = "No scan selected";
        }
      });
    };

    var renderCompare = function () {
      var body = document.getElementById("compare-body");
      var note = document.getElementById("compare-note");
      if (!body) return;
      if (!selected.a || !selected.b) {
        body.innerHTML = '<tr><td colspan="4" class="empty-cell">Choose two scans to compare.</td></tr>';
        if (note) note.textContent = "Choose two scans to compare";
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
        var good = m.invert ? delta <= 0 : delta >= 0;
        var cls = delta === 0 ? "" : (good ? "delta-up" : "delta-down");
        var text = delta === 0 ? "No change" : (delta > 0 ? "+" + delta : String(delta));
        return "<tr><td class='strong-cell'>" + m.label + "</td>" +
          "<td class='right'>" + av + "</td>" +
          "<td class='right'>" + bv + "</td>" +
          "<td class='right " + cls + "'>" + text + "</td></tr>";
      }).join("");
      if (note) note.textContent = a.label + " vs " + b.label;
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
