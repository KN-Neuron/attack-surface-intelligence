(function () {
  "use strict";

  var flash = document.getElementById("dd-flash");
  var flashTimer = 0;

  function showFlash(message, kind) {
    if (!flash) return;
    flash.hidden = false;
    flash.className = "dd-flash" + (kind ? " " + kind : "");
    flash.textContent = message;
    window.clearTimeout(flashTimer);
    flashTimer = window.setTimeout(function () {
      if (kind === "ok" || kind === "bad") flash.hidden = true;
    }, 7000);
  }

  function request(url, method, body) {
    var options = { method: method };
    if (body !== undefined) {
      options.headers = { "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }
    return fetch(url, options).then(function (response) {
      return response.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (error) {}
        if (!response.ok) {
          var message = (data && (data.error || data.message)) || text || ("HTTP " + response.status);
          throw new Error(message);
        }
        return data;
      });
    });
  }

  document.querySelectorAll("[data-dd-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      var target = button.getAttribute("data-dd-tab");
      document.querySelectorAll("#dd-tabs [data-dd-tab]").forEach(function (tab) {
        var on = tab.getAttribute("data-dd-tab") === target;
        tab.classList.toggle("is-on", on);
        tab.setAttribute("aria-pressed", on ? "true" : "false");
      });
      document.querySelectorAll("[data-dd-panel]").forEach(function (panel) {
        var on = panel.getAttribute("data-dd-panel") === target;
        panel.hidden = !on;
        panel.classList.toggle("is-on", on);
      });
      if (window.location.hash !== "#" + target) {
        try { window.history.replaceState(null, "", "#" + target); } catch (error) {}
      }
    });
  });

  function openHashTab() {
    var target = (window.location.hash || "").replace("#", "");
    if (!target) return;
    var button = document.querySelector('#dd-tabs [data-dd-tab="' + target + '"]');
    if (button) button.click();
  }
  openHashTab();

  function bindSwitch(inputId, textId) {
    var input = document.getElementById(inputId);
    var text = document.getElementById(textId);
    if (!input || !text) return;
    function sync() { text.textContent = input.checked ? "On" : "Off"; }
    input.addEventListener("change", sync);
    sync();
  }

  bindSwitch("dd-enabled", "dd-enabled-text");
  bindSwitch("dd-verify-tls", "dd-verify-tls-text");
  bindSwitch("dd-auto-sync", "dd-auto-sync-text");
  bindSwitch("dd-close-old", "dd-close-old-text");
  bindSwitch("dd-push-cves", "dd-push-cves-text");
  bindSwitch("dd-push-signatures", "dd-push-signatures-text");

  function value(id) {
    var element = document.getElementById(id);
    return element ? element.value.trim() : "";
  }

  function checked(id) {
    var element = document.getElementById(id);
    return element ? element.checked : false;
  }

  function withButton(button, label, task, reload) {
    if (button) button.disabled = true;
    showFlash(label, "");
    return task()
      .then(function (data) {
        showFlash((data && data.message) || "Done.", "ok");
        if (reload) {
          window.setTimeout(function () { window.location.reload(); }, 900);
        } else if (button) {
          button.disabled = false;
        }
      })
      .catch(function (error) {
        showFlash(error && error.message ? error.message : "The request failed.", "bad");
        if (button) button.disabled = false;
      });
  }

  var save = document.getElementById("dd-save");
  if (save) {
    save.addEventListener("click", function () {
      var payload = {
        enabled: checked("dd-enabled"),
        base_url: value("dd-base-url"),
        product_type_name: value("dd-product-type"),
        default_product_name: value("dd-default-product"),
        auto_sync: checked("dd-auto-sync"),
        close_old_findings: checked("dd-close-old"),
        minimum_severity: value("dd-min-severity"),
        verify_tls: checked("dd-verify-tls"),
        push_cves: checked("dd-push-cves"),
        push_signatures: checked("dd-push-signatures")
      };
      var token = value("dd-token");
      if (checked("dd-clear-token")) {
        payload.clear_token = true;
      } else if (token) {
        payload.api_token = token;
      }
      withButton(save, "Saving DefectDojo settings...", function () {
        return request("/api/defectdojo/settings", "PUT", payload);
      }, true);
    });
  }

  var test = document.getElementById("dd-test");
  if (test) {
    test.addEventListener("click", function () {
      withButton(test, "Testing the DefectDojo connection...", function () {
        return request("/api/defectdojo/test", "POST");
      }, false);
    });
  }

  var pull = document.getElementById("dd-pull");
  if (pull) {
    pull.addEventListener("click", function () {
      withButton(pull, "Pulling findings from DefectDojo...", function () {
        return request("/api/defectdojo/pull", "POST");
      }, true);
    });
  }

  var pushLatest = document.getElementById("dd-push-latest");
  if (pushLatest) {
    pushLatest.addEventListener("click", function () {
      withButton(pushLatest, "Pushing the latest completed scan...", function () {
        return request("/api/defectdojo/sync", "POST", {});
      }, true);
    });
  }

  var pushSelected = document.getElementById("dd-push-selected");
  if (pushSelected) {
    pushSelected.addEventListener("click", function () {
      var select = document.getElementById("dd-scan-select");
      var scanId = select ? Number(select.value) : 0;
      if (!scanId) {
        showFlash("Choose a scan to push.", "bad");
        return;
      }
      withButton(pushSelected, "Pushing the selected scan...", function () {
        return request("/api/defectdojo/sync", "POST", { scan_id: scanId });
      }, true);
    });
  }
})();
