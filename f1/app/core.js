/* =========================================================================
   FluoLingo · /f1/ — shared core
   Data access, answer-checking, progress, and the shared header / auth bar.
   Loaded after f1/data/sios.js. Exposes window.F1.
   ========================================================================= */
(function (g) {
  "use strict";

  var SIOS = g.SIOS || [];

  /* ---- SIO lookup ---- */
  function byCode(code) { return SIOS.filter(function (s) { return s.code === code; })[0]; }
  function bySlug(slug) { return SIOS.filter(function (s) { return s.slug === slug; })[0]; }
  function current() {
    var sio = new URLSearchParams(location.search).get("sio");
    return sio ? (byCode(sio) || bySlug(sio)) : null;
  }

  /* ---- accent-insensitive answer checking ---- */
  function normalize(s) {
    return (s == null ? "" : String(s)).trim().toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[’']/g, "'").replace(/\s+/g, " ").replace(/[.!?;:]+$/, "");
  }
  function matches(input, answer, accept) {
    var n = normalize(input);
    if (!n) return false;
    if (n === normalize(answer)) return true;
    return (accept || []).some(function (a) { return normalize(a) === n; });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---- progress (localStorage, keyed by account when signed in) ----
     NOTE: localStorage is per-device. Cross-device sync needs a backend
     (Firebase/Firestore) — see docs. */
  function uid() { return (g.FLUO_USER && g.FLUO_USER.sub) || "guest"; }
  function pkey() { return "fluo.f1.progress." + uid(); }
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(pkey()) || "{}"); } catch (e) { return {}; }
  }
  function recordScore(activity, code, score, total) {
    try {
      var p = loadProgress();
      p[code] = p[code] || {};
      p[code][activity] = { score: score, total: total, at: Date.now() };
      localStorage.setItem(pkey(), JSON.stringify(p));
    } catch (e) {}
    if (typeof g.F1_ON_PROGRESS === "function") g.F1_ON_PROGRESS();
  }

  /* ---- Google sign-in (only real when FLUO_GOOGLE_CLIENT_ID is set) ---- */
  function decodeJwt(t) {
    try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
    catch (e) { return null; }
  }
  function onCredential(resp) {
    var p = decodeJwt(resp && resp.credential);
    if (!p) return;
    g.FLUO_USER = { sub: p.sub, name: p.name, email: p.email, picture: p.picture };
    try { sessionStorage.setItem("fluo.user", JSON.stringify(g.FLUO_USER)); } catch (e) {}
    renderAuth();
  }
  function signIn() {
    if (g.google && g.google.accounts && g.google.accounts.id) g.google.accounts.id.prompt();
  }
  function signOut() {
    g.FLUO_USER = null;
    try { sessionStorage.removeItem("fluo.user"); } catch (e) {}
    if (g.google && g.google.accounts && g.google.accounts.id) g.google.accounts.id.disableAutoSelect();
    renderAuth();
  }
  function initGoogle() {
    try {
      var u = JSON.parse(sessionStorage.getItem("fluo.user") || "null");
      if (u) g.FLUO_USER = u;
    } catch (e) {}
    if (g.FLUO_GOOGLE_CLIENT_ID && g.google && g.google.accounts && g.google.accounts.id) {
      g.google.accounts.id.initialize({ client_id: g.FLUO_GOOGLE_CLIENT_ID, callback: onCredential });
    }
    renderAuth();
  }

  var GICON = '<svg viewBox="0 0 48 48" width="16" height="16" aria-hidden="true">' +
    '<path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.3 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.9 6.1C12.3 13.2 17.7 9.5 24 9.5z"/>' +
    '<path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-3.9 6.8-9.7 6.8-17.2z"/>' +
    '<path fill="#FBBC05" d="M10.4 28.6A14.5 14.5 0 0 1 9.6 24c0-1.6.3-3.1.8-4.6l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l7.9-6.1z"/>' +
    '<path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.5-5.7l-7.3-5.7c-2 1.4-4.7 2.3-8.2 2.3-6.3 0-11.7-3.7-13.6-9.1l-7.9 6.1C6.4 42.6 14.6 48 24 48z"/></svg>';

  function renderAuth() {
    var slot = document.getElementById("authslot");
    if (!slot) return;
    if (g.FLUO_USER) {
      slot.innerHTML =
        '<span class="user-chip">' +
          (g.FLUO_USER.picture ? '<img src="' + g.FLUO_USER.picture + '" alt="" referrerpolicy="no-referrer">' : "") +
          "<b>" + (g.FLUO_USER.name || "Connecté·e") + "</b></span>" +
        '<button class="btn-mini" id="signout">Se déconnecter</button>';
      document.getElementById("signout").onclick = signOut;
    } else if (g.FLUO_GOOGLE_CLIENT_ID) {
      slot.innerHTML = '<button class="btn-google" id="signin">' + GICON + "<span>Se connecter avec Google</span></button>";
      document.getElementById("signin").onclick = signIn;
    } else {
      slot.innerHTML = '<button class="btn-google is-soon" disabled title="Activé une fois la clé Google ajoutée">' +
        GICON + "<span>Connexion Google — bientôt</span></button>";
    }
  }

  /* ---- shared header ---- */
  function mountHeader(opts) {
    opts = opts || {};
    var el = document.getElementById("f1head");
    if (!el) return;
    var home = opts.home || "./";
    var crumb = opts.crumb ? '<span class="crumb">' + opts.crumb + "</span>" : "";
    el.innerHTML =
      '<div class="f1head-in">' +
        '<a class="brand" href="' + home + '">FluoLingo<span class="plus">+</span>' +
          '<span class="code">F1 · LAF1201</span></a>' +
        crumb +
        '<div class="authslot" id="authslot"></div>' +
      "</div>";
    if (g.FLUO_GOOGLE_CLIENT_ID) {
      var tries = 0, t = setInterval(function () {
        if ((g.google && g.google.accounts) || ++tries > 20) { clearInterval(t); initGoogle(); }
      }, 200);
    } else {
      initGoogle();
    }
  }

  g.F1 = {
    SIOS: SIOS, byCode: byCode, bySlug: bySlug, current: current,
    normalize: normalize, matches: matches, shuffle: shuffle,
    loadProgress: loadProgress, recordScore: recordScore,
    mountHeader: mountHeader, renderAuth: renderAuth, escape: function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    }
  };
})(window);
