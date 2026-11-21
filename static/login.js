(function () {
  "use strict";

  var form = document.getElementById("login-form");
  if (!form) return;

  var card = document.getElementById("card");
  var alertBox = document.getElementById("form-alert");
  var submit = document.getElementById("submit");
  var email = document.getElementById("email");
  var password = document.getElementById("password");
  var reveal = document.getElementById("reveal");
  var caps = document.getElementById("password-caps");
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var pending = false;

  var rules = {
    email: function (v) {
      if (!v.trim()) return "Enter your email.";
      if (!EMAIL_RE.test(v.trim())) return "That doesn't look like an email address.";
      return "";
    },
    password: function (v) {
      return v ? "" : "Enter your password.";
    }
  };

  // Validate on blur first; once a field shows an error it re-checks as you type.
  function check(input, live) {
    var field = input.closest(".field");
    var msg = rules[input.name](input.value);
    var error = field.querySelector(".error");
    if (msg) {
      if (!live || field.classList.contains("is-invalid")) {
        field.classList.add("is-invalid");
        field.classList.remove("is-valid");
        input.setAttribute("aria-invalid", "true");
        error.textContent = msg;
      }
    } else {
      field.classList.remove("is-invalid");
      field.classList.toggle("is-valid", input.name === "email");
      input.removeAttribute("aria-invalid");
      error.textContent = "";
    }
    return !msg;
  }

  [email, password].forEach(function (input) {
    input.addEventListener("blur", function () {
      if (input.value || input.closest(".field").classList.contains("is-invalid")) check(input, false);
    });
    input.addEventListener("input", function () {
      check(input, true);
      alertBox.hidden = true;
    });
  });

  // Show / hide password. The button stays hidden without JS.
  reveal.hidden = false;
  reveal.addEventListener("click", function () {
    var show = password.type === "password";
    var pos = password.selectionStart;
    password.type = show ? "text" : "password";
    reveal.setAttribute("aria-pressed", String(show));
    reveal.setAttribute("aria-label", show ? "Hide password" : "Show password");
    password.focus();
    try { password.setSelectionRange(pos, pos); } catch (e) {}
  });

  function capsState(event) {
    if (typeof event.getModifierState === "function") caps.hidden = !event.getModifierState("CapsLock");
  }
  password.addEventListener("keydown", capsState);
  password.addEventListener("keyup", capsState);
  password.addEventListener("blur", function () { caps.hidden = true; });

  var stage = card.parentNode;
  function shake() {
    if (reduceMotion) return;
    stage.classList.remove("is-shake");
    void stage.offsetWidth;
    stage.classList.add("is-shake");
  }
  card.addEventListener("animationend", function (e) {
    if (e.animationName === "shake") stage.classList.remove("is-shake");
  });

  // A server-side rejection (wrong password) arrives as a re-rendered page.
  if (!alertBox.hidden) {
    shake();
    email.focus();
  }

  function setPending(on) {
    pending = on;
    submit.classList.toggle("is-loading", on);
    if (on) submit.setAttribute("aria-busy", "true");
    else submit.removeAttribute("aria-busy");
  }

  form.addEventListener("submit", function (event) {
    if (pending) {
      event.preventDefault();
      return;
    }
    var okEmail = check(email, false);
    var okPass = check(password, false);
    if (!okEmail || !okPass) {
      event.preventDefault();
      (okEmail ? password : email).focus();
      shake();
      return;
    }
    alertBox.hidden = true;
    setPending(true); // the browser now posts the form to /login
  });

  // Coming back via the back button restores the page from cache mid-submit.
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) setPending(false);
  });

  // Subtle parallax: deeper layers move a few pixels with the pointer.
  if (!reduceMotion && window.matchMedia("(pointer: fine)").matches) {
    var layers = Array.prototype.slice.call(document.querySelectorAll(".layer"));
    var frame = 0;
    window.addEventListener("pointermove", function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        var nx = e.clientX / window.innerWidth - 0.5;
        var ny = e.clientY / window.innerHeight - 0.5;
        layers.forEach(function (layer) {
          var d = parseFloat(layer.getAttribute("data-depth")) || 0;
          layer.style.setProperty("--px", (-nx * d) + "px");
          layer.style.setProperty("--py", (-ny * d * 0.4) + "px");
        });
      });
    });
  }
})();
