/* =========================================================================
   FluoLingo+ · LAF1201 — interactions
   ========================================================================= */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------------------
     Signature: light each highlighter swipe as it scrolls into view
     --------------------------------------------------------------------- */
  var marks = document.querySelectorAll(".hl[data-hl]");
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          var el = e.target;
          setTimeout(function () { el.classList.add("is-on"); }, 120);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.7 });
    marks.forEach(function (m) { io.observe(m); });
  } else {
    marks.forEach(function (m) { m.classList.add("is-on"); });
  }

  /* =====================================================================
     1 · Pré-test MCQ
     ===================================================================== */
  var QUESTIONS = [
    {
      topic: "Verbes en -ER",
      q: 'Choisis la bonne forme : « Nous ____ français. »',
      raw: "parler",
      options: ["parle", "parlons", "parlez", "parlent"],
      answer: 1,
      why: 'Avec <b>nous</b>, les verbes en -er prennent la terminaison <span class="ital">-ons</span>. → nous <b>parlons</b>.'
    },
    {
      topic: "Articles",
      q: 'Complète : « J\'achète ____ pomme. »',
      raw: "article indéfini",
      options: ["un", "une", "le", "des"],
      answer: 1,
      why: '<b>Pomme</b> est féminin singulier, donc l\'article indéfini est <span class="ital">une</span>. → une pomme.'
    },
    {
      topic: "Passé composé",
      q: 'Choisis l\'auxiliaire : « Elle ____ allée au cinéma. »',
      raw: "auxiliaire",
      options: ["a", "est", "as", "ont"],
      answer: 1,
      why: '<b>Aller</b> se conjugue avec <span class="ital">être</span> au passé composé (et l\'accord : all<b>ée</b>). → elle est allée.'
    }
  ];

  var mcq = {
    i: 0, score: 0, answered: 0,
    el: {
      counter: document.getElementById("mcq-counter"),
      topic: document.getElementById("mcq-topic"),
      bar: document.getElementById("mcq-bar"),
      question: document.getElementById("mcq-question"),
      options: document.getElementById("mcq-options"),
      feedback: document.getElementById("mcq-feedback"),
      next: document.getElementById("mcq-next"),
      score: document.getElementById("mcq-score")
    }
  };

  var KEYS = ["A", "B", "C", "D"];

  function renderQuestion() {
    var Q = QUESTIONS[mcq.i];
    mcq.el.counter.textContent = "Question " + (mcq.i + 1) + " / " + QUESTIONS.length;
    mcq.el.topic.textContent = Q.topic;
    mcq.el.bar.style.width = (mcq.i / QUESTIONS.length) * 100 + "%";
    mcq.el.question.innerHTML = Q.q.replace(/____/g, "<code>____</code>");
    mcq.el.feedback.innerHTML = "";
    mcq.el.next.hidden = true;
    mcq.el.options.innerHTML = "";

    Q.options.forEach(function (text, idx) {
      var b = document.createElement("button");
      b.className = "opt";
      b.type = "button";
      b.innerHTML = '<span class="key">' + KEYS[idx] + "</span><span>" + text + "</span>";
      b.addEventListener("click", function () { choose(idx, b); });
      mcq.el.options.appendChild(b);
    });
  }

  function choose(idx, btn) {
    var Q = QUESTIONS[mcq.i];
    var buttons = mcq.el.options.querySelectorAll(".opt");
    buttons.forEach(function (b) { b.disabled = true; });

    buttons[Q.answer].classList.add("correct");
    if (idx === Q.answer) {
      mcq.score++;
    } else {
      btn.classList.add("wrong");
    }
    mcq.answered++;
    mcq.el.feedback.innerHTML = (idx === Q.answer ? "✓ Exact. " : "✗ Pas tout à fait. ") + Q.why;
    mcq.el.score.textContent = "Score : " + mcq.score + " / " + mcq.answered;
    mcq.el.bar.style.width = ((mcq.i + 1) / QUESTIONS.length) * 100 + "%";

    mcq.el.next.hidden = false;
    mcq.el.next.textContent = mcq.i < QUESTIONS.length - 1 ? "Suivant →" : "Recommencer ↺";
    mcq.el.next.focus();
  }

  mcq.el.next.addEventListener("click", function () {
    if (mcq.i < QUESTIONS.length - 1) {
      mcq.i++;
    } else {
      mcq.i = 0; mcq.score = 0; mcq.answered = 0;
      mcq.el.score.textContent = "Score : 0 / 0";
    }
    renderQuestion();
  });

  renderQuestion();

  /* =====================================================================
     3 · Générateur de chansons de grammaire
     ===================================================================== */
  var TOPICS = {
    "Verbes en -ER": {
      title: "La chanson des terminaisons",
      chorus: "-e, -es, -e, et -ons, -ez, -ent —",
      lines: [
        "Avec « je », c'est juste -e (parl<b>e</b>),",
        "« tu » prend -es, ça ne change rien à l'oreille,",
        "« il » et « elle » : encore -e, tout pareil,",
        "« nous » fait -ons, « vous » fait -ez,",
        "et « ils » termine en -ent… mais on ne l'entend jamais !"
      ]
    },
    "Articles": {
      title: "Le, la, les, un, une, des",
      chorus: "Le pour le masculin, la pour le féminin —",
      lines: [
        "Devant une voyelle, le et la deviennent l',",
        "(l'ami, l'amie — on élide, c'est plus belle),",
        "Au pluriel, tout devient les, c'est plus malin,",
        "Indéfini ? un, une, et au pluriel : des,",
        "Voilà les articles, tu les connais déjà presque !"
      ]
    },
    "Avoir vs Être": {
      title: "Avoir ou être ?",
      chorus: "Au passé composé, choisis bien ton copain —",
      lines: [
        "La plupart des verbes prennent avoir (j'ai mangé),",
        "Mais le mouvement, lui, préfère être :",
        "aller, venir, partir, monter, rester, naître,",
        "Et tous les verbes pronominaux, sans exception,",
        "Avec être, n'oublie pas… l'accord du participe !"
      ]
    },
    "Le pluriel": {
      title: "Plus on est, plus on met -s",
      chorus: "Un chat, des chats — on ajoute un -s, voilà —",
      lines: [
        "Mais -au, -eau, -eu préfèrent un -x (des châteaux),",
        "Les mots en -al deviennent -aux (cheval → chevaux),",
        "Sept exceptions en -ou prennent un -x aussi,",
        "(bijou, caillou, chou, genou, hibou, joujou, pou),",
        "Le reste suit la règle : un petit -s, et c'est fini !"
      ]
    }
  };

  var GENRES = {
    "Comptine": { intro: "(sur un air de comptine, tout doucement)" },
    "Rap": { intro: "(beat lourd, débit rapide — yo)" },
    "Pop": { intro: "(refrain entêtant, mains en l'air)" }
  };

  var song = {
    topic: "Verbes en -ER",
    genre: "Comptine",
    topicsEl: document.getElementById("song-topics"),
    genresEl: document.getElementById("song-genres"),
    titleEl: document.getElementById("song-title"),
    lyricsEl: document.getElementById("song-lyrics"),
    genreLabel: document.getElementById("song-genre-label"),
    genBtn: document.getElementById("song-generate"),
    typer: null
  };

  function buildChips(container, names, current, onPick) {
    names.forEach(function (name) {
      var b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = name;
      b.setAttribute("aria-pressed", String(name === current));
      b.addEventListener("click", function () {
        container.querySelectorAll(".chip").forEach(function (c) {
          c.setAttribute("aria-pressed", "false");
        });
        b.setAttribute("aria-pressed", "true");
        onPick(name);
      });
      container.appendChild(b);
    });
  }

  buildChips(song.topicsEl, Object.keys(TOPICS), song.topic, function (n) { song.topic = n; });
  buildChips(song.genresEl, Object.keys(GENRES), song.genre, function (n) { song.genre = n; });

  function generate() {
    if (song.typer) { clearInterval(song.typer); }
    var data = TOPICS[song.topic];
    var genre = GENRES[song.genre];
    song.genreLabel.textContent = song.genre;
    song.titleEl.textContent = "« " + data.title + " »";

    // Build the line list: intro, chorus, verse — in singing order.
    var rows = [];
    rows.push({ cls: "tag", html: genre.intro });
    rows.push({ cls: "line chorus", html: data.chorus });
    rows.push({ cls: "tag", html: "Couplet" });
    data.lines.forEach(function (l) { rows.push({ cls: "line", html: l }); });
    rows.push({ cls: "tag", html: "Refrain" });
    rows.push({ cls: "line chorus", html: data.chorus });

    song.lyricsEl.innerHTML = "";

    if (reduceMotion) {
      rows.forEach(function (r) { appendRow(r); });
      return;
    }

    // Reveal one row at a time for a "being written" feel.
    var idx = 0;
    song.lyricsEl.classList.add("cursor-blink");
    song.typer = setInterval(function () {
      if (idx >= rows.length) {
        clearInterval(song.typer);
        song.lyricsEl.classList.remove("cursor-blink");
        return;
      }
      appendRow(rows[idx]);
      idx++;
    }, 280);
  }

  function appendRow(r) {
    var span = document.createElement("span");
    span.className = r.cls;
    span.innerHTML = r.html;
    song.lyricsEl.appendChild(span);
  }

  song.genBtn.addEventListener("click", generate);
  generate(); // show one on load
})();
