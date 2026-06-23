/* =========================================================================
   FluoLingo · /f1/ — activity chrome: per-activity header strip, the
   cross-activity link row, the SIO switcher, and French text-to-speech.
   Augments window.F1 (defined in core.js).
   ========================================================================= */
(function (g) {
  "use strict";
  var F1 = g.F1;

  var META = {
    learn:    { label: "Apprendre", icap: "passive",      tier: "Passive → Active" },
    pretest:  { label: "Pré-test",  icap: "active",       tier: "Active" },
    gapfill:  { label: "Produire",  icap: "constructive", tier: "Constructive" },
    dialogue: { label: "Dialogue",  icap: "interactive",  tier: "Interactive" }
  };
  var ORDER = ["learn", "pretest", "gapfill"];

  F1.chrome = function (sio, activity) {
    var m = META[activity] || {};
    var top = document.getElementById("acttop");
    if (top) {
      var opts = F1.SIOS.map(function (s) {
        return '<option value="' + s.code + '"' + (s.code === sio.code ? " selected" : "") + ">SIO " +
          s.code + " — " + F1.escape(s.title) + "</option>";
      }).join("");
      top.innerHTML =
        '<span class="icap ' + (m.icap || "") + '">' + (m.tier || "") + "</span>" +
        '<strong style="font-family:var(--display);font-size:1.15rem;">SIO ' + sio.code + " · " + F1.escape(sio.title) + "</strong>" +
        '<span class="sio-switch"><select id="sioswitch" aria-label="Changer de SIO">' + opts + "</select></span>";
      var sel = document.getElementById("sioswitch");
      if (sel) sel.onchange = function () { location.search = "?sio=" + sel.value; };
    }
    var links = document.getElementById("actlinks");
    if (links) {
      links.innerHTML = ORDER.map(function (a) {
        var disabled = (a === "gapfill" && !sio.gapfill);
        var cls = (a === activity ? "on" : "") + (disabled ? " " : "");
        if (disabled) return '<a aria-disabled="true" style="opacity:.4;pointer-events:none">' + META[a].label + " —</a>";
        return '<a class="' + cls + '" href="../' + a + '/?sio=' + sio.code + '">' + META[a].label + "</a>";
      }).join("");
    }
  };

  /* French text-to-speech via the Web Speech API (best-effort) */
  F1.speak = function (text) {
    if (!("speechSynthesis" in g)) return;
    try {
      g.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = "fr-FR"; u.rate = 0.92;
      var v = (g.speechSynthesis.getVoices() || []).filter(function (x) { return /fr/i.test(x.lang); })[0];
      if (v) u.voice = v;
      g.speechSynthesis.speak(u);
    } catch (e) {}
  };
})(window);
