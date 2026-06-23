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
})();
