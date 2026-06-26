/* ===============================================================
   pre-lesson-shared.js
   Shared engine for all pre-lesson skill pages.
   Provides: speech synthesis with quality-ranked gendered voices,
            pretest engine, recap table builder, progress storage.
   =============================================================== */

const PreLesson = (() => {

  /* ---- Test UIDs (instructor-side accounts) -----------------------------
     These UIDs are excluded from the public hi-score board so the instructor
     does not appear on the student leaderboard. They can still use the app
     normally; only the /leaderboard/{uid} mirror is blocked, and any existing
     entry is purged on next sync. */
  const TEST_UIDS = new Set([
    'A7BPzNnI3MWlSIXqSkdKpwGALFB2',
    'Xtn5klg5SVa4eUtI09pWxFcJFZi2',
    'mEIo5BfpAWZKFVvB3W10oT10yMA3',
  ]);
  function _isTestUid(uid) { return !!uid && TEST_UIDS.has(uid); }

  /* UID aliases — when a single student has signed in with two different
     Google accounts and we've already merged their Firestore data, redirect
     all reads/writes from the secondary UID to the primary so they keep
     using the same record going forward.
       key   = secondary (deprecated) UID
       value = primary (kept) UID */
  const UID_ALIASES = {
    'TW4D8HEgNHONelHbtlAY83KR7EG2': 'oJRObzsgLOQw9BfFGRmqJAWwBOy1',
  };
  function _canonicalUid(uid) {
    return (uid && UID_ALIASES[uid]) ? UID_ALIASES[uid] : uid;
  }
  /* Wrap a Firebase user object so .uid returns the canonical (post-alias)
     UID without touching other fields. */
  function _aliasUser(user) {
    if (!user || !UID_ALIASES[user.uid]) return user;
    const canonical = UID_ALIASES[user.uid];
    return new Proxy(user, {
      get(target, prop) {
        if (prop === 'uid') return canonical;
        const v = target[prop];
        return typeof v === 'function' ? v.bind(target) : v;
      }
    });
  }

  /* -- Speech synthesis -- */

  let frenchVoiceFemale = null;
  let frenchVoiceMale = null;
  let englishVoice = null;
  let voiceOverride = 'auto';

  /* Strip accents from a voice name so our ASCII regexes match accented
     voice names like "Amelie" (with or without acute-e), "Aurelie", "Jerome",
     "Francoise", and so on. We strip diacritics from BOTH sides of the
     comparison, normalising before testing. */
  function normName(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function qualityScore(v) {
    const n = normName(v.name);
    let score = 0;
    if (n.includes('google') && (n.includes('francais') || n.includes('french'))) score += 100;
    if (n.includes('online') || n.includes('neural')) score += 80;
    if (n.includes('premium') || n.includes('enhanced')) score += 60;
    if (/\b(amelie|thomas|audrey|aurelie|denise|henri|vivienne)\b/.test(n)) score += 30;
    if (/\b(julie|paul|guillaume|hortense)\b/.test(n)) score += 20;
    if (/\b(daniel|marie|jacques|virginie)\b/.test(n)) score += 10;
    if (v.lang === 'fr-FR') score += 5;
    return score;
  }

  function englishQualityScore(v) {
    const n = normName(v.name);
    let score = 0;
    if (n.includes('google') && n.includes('english')) score += 100;
    if (n.includes('online') || n.includes('neural')) score += 80;
    if (n.includes('premium') || n.includes('enhanced')) score += 60;
    /* Prefer en-GB (British English) for the Singapore academic context. */
    if (v.lang === 'en-GB') score += 20;
    if (v.lang === 'en-US') score += 10;
    /* Preferable named voices */
    if (/\b(daniel|samantha|kate|serena|alex|aria|ava|libby|sonia)\b/.test(n)) score += 15;
    return score;
  }

  function genderOf(v) {
    const n = normName(v.name);
    /* Generic markers first */
    if (/\bmale\b/.test(n) && !n.includes('female')) return 'm';
    if (n.includes('female')) return 'f';
    if (n.includes('grandma')) return 'f';
    if (n.includes('grandpa')) return 'm';

    /* Female French voices (classic + modern Apple lineup + Microsoft + Google) */
    if (/\b(amelie|audrey|aurelie|julie|hortense|caroline|denise|brigitte|celeste|coralie|eloise|marie|virginie|jacqueline|josephine|yvette|vivienne|francoise|flo|sandy|shelley)\b/.test(n)) return 'f';

    /* Male French voices (classic + modern Apple lineup + Microsoft) */
    if (/\b(thomas|daniel|jacques|sebastien|nicolas|paul|guillaume|henri|claude|alain|maurice|jerome|yves|eddy|reed|rocko)\b/.test(n)) return 'm';

    /* Google's branded French voice is presented as female */
    if (n.includes('google') && (n.includes('francais') || n.includes('french'))) return 'f';
    return null;
  }

  function pickVoices() {
    const all = speechSynthesis.getVoices();
    /* French -- prefer fr-FR, fall back to fr-CA, then any other fr-* */
    const fr = all.filter(v => v.lang && v.lang.startsWith('fr'));
    /* Sort by quality score with a fr-FR preference baked in */
    fr.sort((a, b) => {
      const sa = qualityScore(a) + (a.lang === 'fr-FR' ? 50 : 0);
      const sb = qualityScore(b) + (b.lang === 'fr-FR' ? 50 : 0);
      return sb - sa;
    });

    /* Strict gender selection: a "female voice" must actually be female,
       a "male voice" must actually be male. Never substitute one for the
       other -- voice gender carries grammatical meaning in French
       (je suis etudiant vs je suis etudiante, je suis sportif vs sportive). */
    frenchVoiceFemale = fr.find(v => genderOf(v) === 'f') || null;
    frenchVoiceMale = fr.find(v => genderOf(v) === 'm') || null;

    /* English */
    const en = all.filter(v => v.lang && v.lang.startsWith('en'));
    en.sort((a, b) => englishQualityScore(b) - englishQualityScore(a));
    englishVoice = en[0] || null;
    updateVoiceUI();
  }

  function updateVoiceUI() {
    const fBtn = document.querySelector('.voice-btn[data-voice="f"]');
    const mBtn = document.querySelector('.voice-btn[data-voice="m"]');
    const using = document.getElementById('voice-using');
    if (!fBtn || !mBtn || !using) return;
    fBtn.disabled = !frenchVoiceFemale;
    mBtn.disabled = !frenchVoiceMale;
    const shortName = (v) => {
      if (!v) return '--';
      let n = v.name;
      n = n.replace(/^Microsoft\s+/i, '').replace(/\s+Online.*$/i, ' (online)').replace(/\s+\(.*\)$/, '');
      return n;
    };
    if (frenchVoiceFemale && frenchVoiceMale) {
      using.textContent = `Using ${shortName(frenchVoiceFemale)} (\u2640) . ${shortName(frenchVoiceMale)} (\u2642)`;
      using.className = 'voice-using';
    } else if (frenchVoiceFemale) {
      using.textContent = `Using ${shortName(frenchVoiceFemale)} -- no male French voice on this device`;
      using.className = 'voice-using warn';
    } else if (frenchVoiceMale) {
      using.textContent = `Using ${shortName(frenchVoiceMale)} -- no female French voice on this device`;
      using.className = 'voice-using warn';
    } else {
      using.textContent = '\u26a0 no French voice -- try Chrome, Edge, or Safari';
      using.className = 'voice-using warn';
      const w = document.getElementById('voice-warning');
      if (w) w.classList.add('visible');
    }
    if ((voiceOverride === 'f' && !frenchVoiceFemale) || (voiceOverride === 'm' && !frenchVoiceMale)) {
      voiceOverride = 'auto';
      document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('active'));
      const a = document.querySelector('.voice-btn[data-voice="auto"]');
      if (a) a.classList.add('active');
    }
  }

  /**
   * Speak text aloud.
   * @param {string} text
   * @param {'f'|'m'|'any'} [gender='any']  Speaker gender for French (ignored for English).
   * @param {'fr'|'en'} [lang='fr']  Language. English uses englishVoice regardless of gender.
   */
  function speak(text, gender, lang) {
    if (!('speechSynthesis' in window)) return null;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (lang === 'en') {
      u.lang = englishVoice?.lang || 'en-GB';
      u.rate = 1.0;
      if (englishVoice) u.voice = englishVoice;
    } else {
      u.lang = 'fr-FR';
      u.rate = 0.9;
      /* Per-call gender takes precedence over the global picker.
         If the caller explicitly says 'f' or 'm', honour it.
         Otherwise fall through to the global override; otherwise default to female. */
      let chosen;
      if (gender === 'f' || gender === 'm') chosen = gender;
      else if (voiceOverride === 'f' || voiceOverride === 'm') chosen = voiceOverride;
      else chosen = 'f';
      let voice = chosen === 'm' ? frenchVoiceMale : frenchVoiceFemale;
      if (!voice) voice = frenchVoiceFemale || frenchVoiceMale;
      if (voice) u.voice = voice;
    }
    speechSynthesis.speak(u);
    return u;
  }

  /**
   * Attach a small "\u25b8" read-aloud button to an element.
   * Clicking the button speaks the element's text in English.
   * The button glows/pulses while speech is active.
   */
  /**
   * Walk a DOM subtree and produce an ordered list of speech segments.
   * Text inside <em> tags is treated as French; everything else as English.
   * <strong> is treated as English emphasis (still English).
   * @returns {Array<{text: string, lang: 'en'|'fr'}>}
   */
  function extractSpeechSegments(rootEl) {
    const segments = [];
    let currentLang = 'en';
    let buffer = '';

    function flushBuffer() {
      const cleaned = buffer.replace(/\s+/g, ' ').trim();
      if (cleaned) segments.push({ text: cleaned, lang: currentLang });
      buffer = '';
    }

    function walk(node, lang) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (lang !== currentLang) {
          flushBuffer();
          currentLang = lang;
        }
        buffer += node.textContent;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      /* Skip the read-aloud button itself */
      if (node.classList && node.classList.contains('read-aloud-btn')) return;
      /* Class-based markers: any element with class "spoken-fr" or "fr" is
         treated as French content (and its descendants too). Class "en" is
         English. This lets us mark French inside spoken-example blocks
         without forcing italic styling. */
      let langForChildren = lang;
      if (node.classList) {
        if (node.classList.contains('spoken-fr') || node.classList.contains('fr')) {
          langForChildren = 'fr';
        } else if (node.classList.contains('spoken-en') || node.classList.contains('en')) {
          langForChildren = 'en';
        }
      }
      const tag = node.tagName?.toLowerCase();
      /* Tag-based: <em>/<i>/<cite> still mark French (overrides class only if
         class hasn't already set a language) */
      if (langForChildren === lang && (tag === 'em' || tag === 'i' || tag === 'cite')) {
        langForChildren = 'fr';
      }
      for (const child of node.childNodes) walk(child, langForChildren);
    }

    walk(rootEl, 'en');
    flushBuffer();
    return segments;
  }

  /**
   * Speak a sequence of segments, each with its own language.
   * Each segment plays as its own utterance. Returns a controller object
   * with .stop() to interrupt and a Promise that resolves on completion.
   */
  function speakSegments(segments, onSegmentStart, onAllDone) {
    let cancelled = false;
    let i = 0;
    function playNext() {
      if (cancelled || i >= segments.length) {
        if (onAllDone) onAllDone();
        return;
      }
      const seg = segments[i++];
      if (onSegmentStart) onSegmentStart(seg);
      const u = speak(seg.text, 'any', seg.lang);
      if (!u) {
        /* Speech synthesis unavailable -- bail out */
        if (onAllDone) onAllDone();
        return;
      }
      u.addEventListener('end', () => {
        if (!cancelled) playNext();
      });
      u.addEventListener('error', () => {
        if (!cancelled) playNext();
      });
    }
    playNext();
    return {
      stop: () => {
        cancelled = true;
        if ('speechSynthesis' in window) speechSynthesis.cancel();
        if (onAllDone) onAllDone();
      },
    };
  }

  function attachReadAloud(targetEl, opts = {}) {
    if (!targetEl) return;
    if (targetEl.querySelector('.read-aloud-btn')) return; /* already attached */
    const btn = document.createElement('button');
    btn.className = 'read-aloud-btn';
    btn.title = 'Read the French aloud';
    btn.setAttribute('aria-label', 'Read the French parts aloud');
    btn.textContent = '\u25b8';
    targetEl.style.position = targetEl.style.position || 'relative';
    targetEl.appendChild(btn);

    let activeController = null;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      /* If already speaking, clicking again stops it. */
      if (activeController) {
        activeController.stop();
        return;
      }
      /* Walk the element to extract segments with language tags.
         IMPORTANT: read-aloud is for French content only. Skip English
         segments entirely (translations, phonetic hints, glosses). */
      const segments = extractSpeechSegments(targetEl).filter(s => s.lang === 'fr');
      if (segments.length === 0) return;
      btn.classList.add('speaking');
      btn.textContent = '\u25fc';
      activeController = speakSegments(
        segments,
        null,
        () => {
          btn.classList.remove('speaking');
          btn.textContent = '\u25b8';
          activeController = null;
        }
      );
    });
  }

  /**
   * Return HTML for a paired \u2640/\u2642 listen-button group.
   * Use in recap row cells, or anywhere two-voice playback is wanted.
   * The text to speak is encoded as a data attribute so a single delegated
   * click handler can read it and call speak().
   *
   * @param {string} text -- the French to speak
   * @returns {string} HTML for two small round buttons side by side
   */
  function listenPairHTML(text) {
    const safe = String(text).replace(/"/g, '&quot;');
    return `<span class="listen-pair">
      <button class="listen-mini" data-listen="${safe}" data-voice="f" title="Hear (female)" aria-label="Hear in female voice">\u2640</button>
      <button class="listen-mini" data-listen="${safe}" data-voice="m" title="Hear (male)" aria-label="Hear in male voice">\u2642</button>
    </span>`;
  }

  /**
   * Wire up a delegated click handler on a container element so that
   * any descendant .listen-mini button will speak its data-listen text
   * in its data-voice gender. Pulses while speaking.
   * Also disables male/female buttons when their voice isn't available.
   *
   * @param {HTMLElement} root -- the container to delegate clicks within
   */
  function bindListenPairs(root) {
    if (!root) return;
    /* Click handler -- speak whatever voice this button asks for.
       speak() handles fallback if the requested voice isn't available
       (uses whatever French voice IS available instead).
       We do NOT disable buttons -- better UX to let them click and hear
       the available voice than to grey out and confuse the user. */
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.listen-mini');
      if (!btn || !root.contains(btn)) return;
      e.stopPropagation();
      const text = btn.dataset.listen;
      const gender = btn.dataset.voice;
      if (!text) return;
      const u = speak(text, gender);
      if (!u) return;
      btn.classList.add('speaking');
      const restore = () => btn.classList.remove('speaking');
      u.addEventListener('end', restore);
      u.addEventListener('error', restore);
    });
  }

  function initVoice() {
    if ('speechSynthesis' in window) {
      pickVoices();
      speechSynthesis.addEventListener('voiceschanged', pickVoices);
    } else {
      const w = document.getElementById('voice-warning');
      if (w) w.classList.add('visible');
    }
    document.querySelectorAll('.voice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        document.querySelectorAll('.voice-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        voiceOverride = btn.dataset.voice;
      });
    });
    /* read-aloud is intentionally NOT attached to .skill-context:
       those paragraphs mix English explanation, correct French forms, and
       incorrect/nonexistent forms being called out — speaking them via TTS
       would voice the wrong forms and confuse learners. */
    initTheme();
  }

  /* -- Utils -- */

  function shuffle(arr) {
    const c = [...arr];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  }

  function normFrench(s) {
    return s.toLowerCase().trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/['']/g, "'");
  }

  function compareFrench(typed, target) {
    if (!typed) return 'wrong';
    const t = typed.trim().toLowerCase();
    if (t === target.toLowerCase()) return 'right';
    if (normFrench(typed) === normFrench(target)) return 'close';
    return 'wrong';
  }

  /* -- Pretest engine --
     Each skill provides:
       items[]                  -- full data array
       renderStimulus(item, el) -- paint the prompt area
       getChoices(item, items)  -- return array of choice objects
       choiceLabel(choice)      -- HTML for the choice button
       isCorrect(choice, item)  -- boolean (single-select mode)
       feedbackAnswer(item)     -- { display: string, trans: string, explain?: string }
       speakOnFeedback(item)    -- { text, gender }

     Per-item modes (set on item.mode):
       'single'   (default) -- one correct answer, click to select
       'multi'    -- multiple correct answers, toggle then submit
       'negative' -- pick the ONE that is NOT acceptable
     For 'multi' mode, isCorrect(choice, item) should still return true for
     each individual correct choice. The engine collects all toggled choices
     and marks the answer correct iff the set of toggled choices exactly
     matches the set of choices for which isCorrect() is true.
     For 'negative' mode, isCorrect(choice, item) should return true for the
     ONE choice that is the WRONG-fit answer (the one to flag).
  */

  function makePretest(config) {
    const { skillId, items, renderStimulus, getChoices, choiceLabel, isCorrect,
            feedbackAnswer, speakOnFeedback, onFinish } = config;

    const state = {
      order: [], index: 0, correct: 0, missed: [],
      /* Phase 2 telemetry */
      sessionId: null,             /* unique id per pretest run, for joining attempts */
      retakeNum: 0,                /* this run's retake number (1 = first attempt) */
      startedAt: null,             /* Date.now() when start() was called */
      itemShownAt: null,           /* Date.now() when current item was rendered */
    };
    /* Per-item working state for multi-select mode */
    let multiSelectionState = null;

    function start() {
      state.order = shuffle(items.map((_, i) => i));
      state.index = 0;
      state.correct = 0;
      state.missed = [];
      /* Phase 2: per-run telemetry init */
      state.sessionId = generateSessionId();
      state.retakeNum = nextRetakeNumber(skillId);
      state.startedAt = Date.now();
      state.itemShownAt = null;
      logSkillStart(skillId, state.sessionId, state.retakeNum);
      document.getElementById(`${skillId}-pretest`).style.display = '';
      const c = document.getElementById(`${skillId}-complete`);
      if (c) c.classList.remove('visible');
      /* Bind any feedback-panel listen-pair buttons once (idempotent) */
      const fb = document.getElementById(`${skillId}-feedback`);
      if (fb && !fb.dataset.listenPairsBound) {
        bindListenPairs(fb);
        fb.dataset.listenPairsBound = 'true';
      }
      render();
    }

    function render() {
      const item = items[state.order[state.index]];
      const mode = item.mode || 'single';
      multiSelectionState = mode === 'multi' ? new Set() : null;

      const stimEl = document.getElementById(`${skillId}-stimulus`);
      if (stimEl) renderStimulus(item, stimEl);

      /* Update the pretest prompt based on item mode. Skills can override
         the default prompt text by setting <p class="pretest-prompt"> with
         a data-default attribute. We change the prompt for non-single modes. */
      const promptEl = document.querySelector(`#${skillId}-pretest .pretest-prompt`);
      if (promptEl) {
        if (!promptEl.dataset.default) {
          promptEl.dataset.default = promptEl.innerHTML;
        }
        if (mode === 'multi') {
          const n = (typeof item.correctCount === 'number') ? item.correctCount : 2;
          promptEl.innerHTML = `Pick the <strong>${n}</strong> phrases that work here, then submit.`;
        } else if (mode === 'negative') {
          promptEl.innerHTML = `Which phrase is <strong>NOT</strong> appropriate in this situation?`;
        } else {
          promptEl.innerHTML = promptEl.dataset.default;
        }
      }

      const choices = getChoices(item, items);
      const choicesEl = document.getElementById(`${skillId}-choices`);
      choicesEl.innerHTML = '';
      choices.forEach(c => {
        const btn = document.createElement('button');
        btn.className = 'choice';
        btn.innerHTML = choiceLabel(c);
        if (mode === 'multi') {
          btn.dataset.choiceLabel = choiceLabel(c);
          btn.addEventListener('click', () => toggleMultiChoice(btn, c, item, choicesEl));
        } else {
          /* 'single' and 'negative' modes both use single-click flow */
          btn.addEventListener('click', () => answer(btn, c, item, choicesEl));
        }
        choicesEl.appendChild(btn);
      });

      /* Add a Submit button for multi-select mode */
      if (mode === 'multi') {
        const submitBtn = document.createElement('button');
        submitBtn.className = 'multi-submit-btn';
        submitBtn.textContent = 'Submit answer';
        submitBtn.disabled = true;
        submitBtn.addEventListener('click', () => submitMultiChoice(item, choicesEl, submitBtn));
        choicesEl.appendChild(submitBtn);
      }

      const fb = document.getElementById(`${skillId}-feedback`);
      if (fb) fb.classList.remove('visible');
      /* Hide the back button on the first item, show it from the second onward */
      const backBtn = document.getElementById(`${skillId}-back`);
      if (backBtn) backBtn.style.visibility = state.index === 0 ? 'hidden' : '';
      updateProgress();
      /* Phase 2: capture render timestamp for time-to-submit */
      state.itemShownAt = Date.now();
    }

    /* Multi-select toggle. Marks the choice as selected and assigns it an
       ordinal (1, 2, ...) which shows on the badge before submit. */
    function toggleMultiChoice(btn, choiceObj, item, choicesEl) {
      if (!multiSelectionState) return;
      const label = btn.dataset.choiceLabel;
      if (multiSelectionState.has(label)) {
        multiSelectionState.delete(label);
        btn.classList.remove('multi-selected');
        btn.removeAttribute('data-pick-order');
      } else {
        multiSelectionState.add(label);
        btn.classList.add('multi-selected');
      }
      /* Re-number the order badges across all currently-selected buttons */
      const ordered = [...multiSelectionState];
      const allBtns = choicesEl.querySelectorAll('.choice');
      allBtns.forEach(b => {
        const lbl = b.dataset.choiceLabel;
        const idx = ordered.indexOf(lbl);
        if (idx >= 0) {
          b.setAttribute('data-pick-order', String(idx + 1));
        } else {
          b.removeAttribute('data-pick-order');
        }
      });
      /* Enable submit button when at least one is selected */
      const submitBtn = choicesEl.querySelector('.multi-submit-btn');
      if (submitBtn) submitBtn.disabled = multiSelectionState.size === 0;
    }

    /* Submit handler for multi-select. Compares user's set against the
       set of choices for which isCorrect() is true. */
    function submitMultiChoice(item, choicesEl, submitBtn) {
      const choices = getChoices(item, items);
      const correctSet = new Set();
      choices.forEach(c => {
        if (isCorrect(c, item)) correctSet.add(choiceLabel(c));
      });
      const userSet = multiSelectionState || new Set();
      /* Set equality: same size AND every element in userSet is in correctSet */
      const setsMatch = (userSet.size === correctSet.size) &&
                        [...userSet].every(x => correctSet.has(x));

      /* Style each choice button based on its truth + selection */
      const buttons = choicesEl.querySelectorAll('.choice');
      buttons.forEach(b => {
        b.disabled = true;
        const label = b.dataset.choiceLabel;
        const wasSelected = userSet.has(label);
        const isRight = correctSet.has(label);
        b.classList.remove('multi-selected');
        if (isRight && wasSelected) b.classList.add('correct');
        else if (isRight && !wasSelected) b.classList.add('correct'); /* show what should have been */
        else if (!isRight && wasSelected) b.classList.add('wrong');
        else b.classList.add('dimmed');
      });
      submitBtn.disabled = true;
      submitBtn.style.display = 'none';

      if (setsMatch) state.correct++;
      else state.missed.push(state.order[state.index]);

      /* Award XP for the attempt */
      awardItemAttempt(skillId);

      /* Phase 2: log per-attempt telemetry */
      const itemIdx = state.order[state.index];
      const timeToSubmit = state.itemShownAt ? (Date.now() - state.itemShownAt) : null;
      logAttempt({
        skillId, sessionId: state.sessionId, retakeNum: state.retakeNum,
        itemIdx, mode: 'multi', isCorrect: setsMatch, timeToSubmitMs: timeToSubmit,
        positionInRun: state.index,
      });

      setTimeout(() => showFeedback(item, setsMatch), 550);
    }

    function answer(btn, picked, item, choicesEl) {
      const correct = isCorrect(picked, item);
      const choices = choicesEl.querySelectorAll('.choice');
      choices.forEach((b, i) => {
        b.disabled = true;
        const c = getChoices(item, items)[i];
        if (b === btn && correct) b.classList.add('correct');
        else if (b === btn && !correct) b.classList.add('wrong');
        else b.classList.add('dimmed');
      });
      // Always highlight the correct one (by re-evaluating choices order)
      choices.forEach((b, i) => {
        const choiceObjs = getChoices(item, items);
        // We can't get the original choice array post-render -- so we'd lose ordering.
        // Instead, force a class on whichever button has the correct label.
      });

      if (correct) state.correct++;
      else state.missed.push(state.order[state.index]);

      /* Award XP for the attempt (regardless of correctness) */
      awardItemAttempt(skillId);

      /* Phase 2: log per-attempt telemetry */
      const itemIdx = state.order[state.index];
      const timeToSubmit = state.itemShownAt ? (Date.now() - state.itemShownAt) : null;
      const itemMode = item.mode || 'single';
      logAttempt({
        skillId, sessionId: state.sessionId, retakeNum: state.retakeNum,
        itemIdx, mode: itemMode, isCorrect: correct, timeToSubmitMs: timeToSubmit,
        positionInRun: state.index,
      });

      // Find and mark the correct button
      const targetLabel = choiceLabel(getChoices(item, items).find(c => isCorrect(c, item)));
      // Re-mark: scan all current buttons, set 'correct' on the one whose innerHTML matches the answer
      // (Even if user got it right, ensure it's styled green.)
      choices.forEach(b => {
        if (b.innerHTML === targetLabel && !b.classList.contains('correct')) {
          b.classList.remove('dimmed');
          b.classList.add('correct');
        }
      });

      setTimeout(() => showFeedback(item, correct), 550);
    }

    function showFeedback(item, wasCorrect) {
      const v = document.getElementById(`${skillId}-verdict`);
      v.textContent = wasCorrect ? '\u2713 Correct' : '\u2717 Not quite';
      v.className = 'verdict-pill ' + (wasCorrect ? 'ok' : 'no');

      const ans = feedbackAnswer(item);
      const ansEl = document.getElementById(`${skillId}-answer`);
      const trEl  = document.getElementById(`${skillId}-trans`);
      const exEl  = document.getElementById(`${skillId}-explain`);
      if (ansEl) ansEl.innerHTML = ans.display;
      if (trEl)  trEl.textContent = ans.trans || '';
      if (exEl) {
        if (ans.explain) {
          exEl.innerHTML = ans.explain;
          exEl.style.display = '';
          attachReadAloud(exEl);
        } else {
          exEl.style.display = 'none';
        }
      }

      document.getElementById(`${skillId}-feedback`).classList.add('visible');

      /* speakOnFeedback is optional. If a skill doesn't provide one (e.g.
         the alphabet skill, where audio is handled by inline replay
         buttons), we skip the auto-play and the female/male buttons. */
      const audio = (typeof speakOnFeedback === 'function') ? speakOnFeedback(item) : null;

      /* If the feedback panel has a listen-pair (\u2640/\u2642 buttons), update its
         data-listen text to whatever this item's audio is, so the buttons
         play the right thing for the current question. */
      const listenSlot = document.getElementById(`${skillId}-listen-slot`);
      if (listenSlot && audio) {
        listenSlot.querySelectorAll('.listen-mini').forEach(btn => {
          btn.dataset.listen = audio.text;
        });
      }

      if (audio) setTimeout(() => speak(audio.text, audio.gender || 'any'), 200);
    }

    function next() {
      state.index++;
      if (state.index >= state.order.length) finish();
      else render();
    }

    function prev() {
      if (state.index <= 0) return; /* can't go back from first item */
      state.index--;
      /* Reset the missed/correct count for the item we're returning to,
         so a re-answer doesn't double-count. */
      const idx = state.order[state.index];
      const wasMissed = state.missed.indexOf(idx);
      if (wasMissed > -1) state.missed.splice(wasMissed, 1);
      else if (state.correct > 0) state.correct--;
      render();
    }

    function finish() {
      document.getElementById(`${skillId}-pretest`).style.display = 'none';
      const scoreEl = document.getElementById(`${skillId}-final-score`);
      if (scoreEl) scoreEl.textContent = `${state.correct} / ${state.order.length}`;
      /* Award skill completion XP. The result includes the awarded amount
         and the improvement delta -- surface it via the completion banner
         so the student sees what they earned this session. */
      const xpResult = awardSkillCompletion(skillId, state.correct, state.order.length);
      const xpEl = document.getElementById(`${skillId}-xp-earned`);
      if (xpEl) {
        let txt = `+${xpResult.xpAwarded} XP`;
        if (xpResult.improvementDelta > 0) {
          txt += ` (improved by ${xpResult.improvementDelta})`;
        }
        if (xpResult.multiplier > 1.0) {
          txt += ` \u00d7${xpResult.multiplier} streak`;
        }
        xpEl.textContent = txt;
        xpEl.style.display = '';
      }
      if (onFinish) onFinish(state);
      const c = document.getElementById(`${skillId}-complete`);
      if (c) c.classList.add('visible');
      markSkillDone(skillId);
      /* Phase 2: pass session + retake metadata for richer logging */
      const durationMs = state.startedAt ? (Date.now() - state.startedAt) : null;
      logSkillCompletion(skillId, state.correct, state.order.length, {
        sessionId: state.sessionId,
        retakeNum: state.retakeNum,
        durationMs: durationMs,
        missedItemIndices: state.missed.slice(),
      });
      updateProgress();
    }

    function updateProgress() {
      const total = state.order.length || items.length;
      const done = state.index;
      const pct = (done / total) * 100;
      const fill = document.getElementById(`${skillId}-progress`);
      const counter = document.getElementById(`${skillId}-counter`);
      if (fill) fill.style.width = `${pct}%`;
      if (counter) counter.textContent = `${done} / ${total}`;
    }

    /* Programmatic submission for production-style items (typed answers,
       drag-arrange, etc) where the skill itself manages input UI inside
       renderStimulus and decides correctness. The skill calls this when
       the user submits. We update score/missed and show feedback exactly
       like answer() does. */
    function submitProduction(wasCorrect) {
      if (wasCorrect) state.correct++;
      else state.missed.push(state.order[state.index]);
      /* Award XP for the attempt */
      awardItemAttempt(skillId);
      /* Phase 2: log per-attempt telemetry */
      const itemIdx = state.order[state.index];
      const timeToSubmit = state.itemShownAt ? (Date.now() - state.itemShownAt) : null;
      const item = items[state.order[state.index]];
      const itemMode = item.mode || 'production';
      logAttempt({
        skillId, sessionId: state.sessionId, retakeNum: state.retakeNum,
        itemIdx, mode: itemMode, isCorrect: wasCorrect, timeToSubmitMs: timeToSubmit,
        positionInRun: state.index,
      });
      setTimeout(() => showFeedback(item, wasCorrect), 250);
    }

    return { start, next, prev, state, submitProduction };
  }

  /* -- Recap table -- */

  function buildRecap(config) {
    const { skillId, items, columns, renderRow } = config;
    const body = document.getElementById(`${skillId}-recap-body`);
    body.innerHTML = '';
    items.forEach((item, i) => {
      const tr = document.createElement('tr');
      tr.dataset.idx = i;
      tr.innerHTML = renderRow(item, i);
      body.appendChild(tr);
    });
    body.querySelectorAll('tr').forEach(tr => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('.row-listen')) return;
        if (e.target.closest('.listen-mini')) return;
        if (e.target.tagName === 'INPUT') return;
        tr.classList.toggle('row-revealed');
      });
    });
    body.querySelectorAll('.row-listen').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        speak(b.dataset.fr, b.dataset.voice || 'any');
      });
    });
    /* Auto-wire any listen-pair buttons inside this recap body */
    bindListenPairs(body);
  }

  function setupColumnToggles(skillId, typeColumnTarget) {
    const togglesEl = document.getElementById(`${skillId}-toggles`);
    const tableEl = document.getElementById(`${skillId}-recap-table`);
    if (!togglesEl || !tableEl) return;
    togglesEl.querySelectorAll('.col-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const col = btn.dataset.col;
        const isHidden = btn.classList.toggle('hidden-col');
        tableEl.classList.toggle(`col-hidden-${col}`, isHidden);
      });
    });
    const typeBtn = document.getElementById(`${skillId}-type-toggle`);
    if (!typeBtn || !typeColumnTarget) return;
    let typeMode = false;
    typeBtn.addEventListener('click', () => {
      typeMode = !typeMode;
      typeBtn.classList.toggle('active', typeMode);
      typeBtn.textContent = typeMode ? typeColumnTarget.activeLabel : typeColumnTarget.inactiveLabel;
      typeColumnTarget.apply(typeMode);
    });
  }

  /* -- Progress persistence -- */

  function markSkillDone(skillId) {
    try {
      const raw = localStorage.getItem('laf1201-prelesson-progress');
      const data = raw ? JSON.parse(raw) : {};
      data[skillId] = { done: true, at: Date.now() };
      localStorage.setItem('laf1201-prelesson-progress', JSON.stringify(data));
    } catch (e) { /* private mode etc */ }
  }

  function getSkillProgress() {
    try {
      const raw = localStorage.getItem('laf1201-prelesson-progress');
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function clearProgress() {
    try { localStorage.removeItem('laf1201-prelesson-progress'); } catch (e) {}
  }

  /* -- Firebase auth + Firestore logging --
     Lazy-loads Firebase modules only when initFirebaseAuth() is called.
     Until a Firebase config is provided in firebase-config.js, this is a no-op
     and the rest of the module continues to function (with localStorage only).
  */

  let _firebase = null;        /* { app, auth, db } once initialised */
  let _currentUser = null;
  let _authCallbacks = [];

  async function initFirebaseAuth(config) {
    if (!config || !config.apiKey) {
      console.info('[PreLesson] Firebase auth not configured. Sign-in is disabled; localStorage progress only.');
      return false;
    }
    try {
      const [{ initializeApp }, { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut: fbSignOut, onAuthStateChanged },
             { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp, deleteDoc }] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js'),
      ]);
      const app = initializeApp(config);
      const auth = getAuth(app);
      const db = getFirestore(app);
      _firebase = {
        app, auth, db,
        GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, fbSignOut, onAuthStateChanged,
        doc, setDoc, getDoc, collection, addDoc, serverTimestamp, deleteDoc,
      };
      onAuthStateChanged(auth, (user) => {
        _currentUser = _aliasUser(user);
        _authCallbacks.forEach(cb => {
          try { cb(_currentUser); } catch (e) { console.warn(e); }
        });
      });
      /* Popup auth only — no getRedirectResult path (that was the redirect-loop cause). */
      _injectTopnavAuth();
      return true;
    } catch (e) {
      console.error('[PreLesson] Firebase initialisation failed:', e);
      return false;
    }
  }

  /* Inject a compact sign-in/out widget into .topnav on skill pages.
     Skipped automatically on hub pages (they have #user-corner already)
     and on the root index (no .topnav element). */
  function _injectTopnavAuth() {
    const nav = document.querySelector('.topnav');
    if (!nav) return;
    if (document.getElementById('user-corner')) return;
    if (document.getElementById('topnav-auth')) return;

    const widget = document.createElement('div');
    widget.id = 'topnav-auth';
    widget.className = 'topnav-auth';
    widget.innerHTML =
      '<span class="topnav-auth-name" id="topnav-auth-name"></span>' +
      '<button class="topnav-auth-btn" id="topnav-auth-btn">Sign in</button>';
    nav.appendChild(widget);

    onAuthStateChange((user) => {
      const w   = document.getElementById('topnav-auth');
      const nm  = document.getElementById('topnav-auth-name');
      const btn = document.getElementById('topnav-auth-btn');
      if (!w || !nm || !btn) return;
      if (user) {
        w.classList.add('signed-in');
        nm.textContent  = '';                    // user's name not displayed
        btn.textContent = 'Sign out';
        btn.classList.add('is-out');             // outlined / muted style
        btn.onclick     = () => signOut();
      } else {
        w.classList.remove('signed-in');
        nm.textContent  = '';
        btn.textContent = 'Sign in';
        btn.classList.remove('is-out');          // filled orange pill
        btn.onclick     = () => signInWithGoogle();
      }
    });
  }

  function onAuthStateChange(cb) {
    _authCallbacks.push(cb);
    /* Fire immediately with the current state */
    if (_currentUser !== undefined) cb(_currentUser);
  }

  function getCurrentUser() { return _currentUser; }

  async function signInWithGoogle(opts = {}) {
    if (!_firebase) {
      alert('Sign-in is not available -- Firebase has not been configured for this site.');
      return null;
    }
    const provider = new _firebase.GoogleAuthProvider();
    /* Restrict to a hosted domain only if explicitly set. Empty string = any account. */
    const hd = opts.hd || '';
    if (hd) provider.setCustomParameters({ hd });
    provider.addScope('email');
    provider.addScope('profile');
    /* Popup sign-in on the shared same-origin session. Popup (not redirect)
       avoids the cross-domain redirect loop; the shared session means a
       hub/pretest/reviser sign-in carries across all three. */
    try {
      const result = await _firebase.signInWithPopup(_firebase.auth, provider);
      return result.user;
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') return null;
      console.error('[PreLesson] Sign-in failed:', e);
      alert('Sign-in failed: ' + (e.message || e.code));
      return null;
    }
  }

  async function signOut() {
    if (!_firebase) return;
    try {
      await _firebase.fbSignOut(_firebase.auth);
    } catch (e) {
      console.error('[PreLesson] Sign-out failed:', e);
    }
  }

  /**
   * Log a skill completion to Firestore.
   * Writes both:
   *   - users/{uid}/skills/{skillId}  (one doc per skill, latest state)
   *   - events/{auto}                 (event log, append-only)
   */
  /**
   * Hard-auth gate for skill pages.
   * Call this once near the top of a skill page's script.
   * Behaviour:
   *   - Until auth state is known, hides the gated content (showing a "checking..." message)
   *   - If signed out, shows a sign-in gate (button + explanation)
   *   - If signed in, reveals the gated content and the rest of the page runs normally
   * The gated content is whatever has the class .gated-content on it.
   */
  function requireAuth(opts = {}) {
    const skillName = opts.skillName || 'this skill';
    const body = document.body;
    body.classList.add('auth-pending');

    /* Insert a placeholder gate node early so something is visible before auth resolves */
    const container = document.querySelector('.container') || body;
    const gateEl = document.createElement('div');
    gateEl.className = 'auth-gate';
    gateEl.id = 'auth-gate';
    gateEl.innerHTML = `<span class="auth-gate-loading">Checking sign-in...</span>`;
    /* Insert near the top of container, after masthead/topnav if present */
    const after = container.querySelector('.masthead') || container.firstChild;
    if (after && after.nextSibling) {
      container.insertBefore(gateEl, after.nextSibling);
    } else {
      container.appendChild(gateEl);
    }

    /* Poll for Firebase to finish initialising. If after 4 seconds it still
       isn't ready, assume Firebase isn't configured and show a friendly
       fallback rather than locking the page indefinitely. */
    let waited = 0;
    const checkInterval = setInterval(() => {
      waited += 100;
      if (_firebase) {
        clearInterval(checkInterval);
        wireGate();
      } else if (waited >= 4000) {
        clearInterval(checkInterval);
        gateEl.innerHTML = `
          <span class="auth-gate-icon">\u2699</span>
          <h2>Sign-in not yet set up</h2>
          <p>This page requires sign-in to track your completion, but Firebase has not been configured for this site yet. Contact your instructor.</p>
        `;
      }
    }, 100);

    function wireGate() {
      onAuthStateChange((user) => {
        if (user) {
          body.classList.remove('auth-pending');
          body.classList.remove('auth-signed-out');
          body.classList.add('auth-signed-in');
          gateEl.style.display = 'none';
        } else {
          body.classList.remove('auth-pending');
          body.classList.remove('auth-signed-in');
          body.classList.add('auth-signed-out');
          gateEl.style.display = '';
          gateEl.innerHTML = `
            <span class="auth-gate-icon">\u1f512</span>
            <h2>Sign in to start <em>${skillName}</em></h2>
            <p>This pre-lesson is part of your LAF1201 preparation. <strong>Sign in with Google</strong> so your progress is recorded for class.</p>
            <button class="gate-btn" id="gate-signin-btn">Sign in with Google</button>
            <div class="gate-meta">We log your attempts (item, correctness, time, retake number) to help us improve the course. You'll see a one-time consent prompt for academic research use after sign-in.</div>
          `;
          document.getElementById('gate-signin-btn').addEventListener('click', () => {
            signInWithGoogle({
              hd: typeof FIREBASE_HOSTED_DOMAIN !== 'undefined' ? FIREBASE_HOSTED_DOMAIN : '',
            });
          });
        }
      });
    }
  }

  /**
   * Log a skill completion to Firestore.
   * Writes:
   *   - users/{uid}/skills/{skillId}    (latest state for this skill)
   *   - users/{uid}/runs/{sessionId}    (history: one doc per retake)
   *   - events/{auto}                   (legacy event log, append-only)
   *
   * @param {string} skillId
   * @param {number} score
   * @param {number} total
   * @param {object} [meta] Phase 2 metadata: sessionId, retakeNum, durationMs, missedItemIndices
   */
  async function logSkillCompletion(skillId, score, total, meta) {
    if (!_firebase || !_currentUser) return;
    const { db, doc, setDoc, collection, addDoc, serverTimestamp } = _firebase;
    const uid = _currentUser.uid;
    const email = _currentUser.email || null;
    const name = _currentUser.displayName || null;
    const m = meta || {};
    try {
      /* Per-user skill state (overwritten each completion) -- now includes
         attemptCount so we can see how many times this skill has been retaken. */
      await setDoc(doc(db, 'users', uid, 'skills', skillId), {
        skillId, score, total, email, name,
        latestRetakeNum: m.retakeNum || 1,
        latestSessionId: m.sessionId || null,
        latestDurationMs: m.durationMs || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      /* Phase 2: per-run history. One doc per (user, skill, retakeNum). */
      if (m.sessionId) {
        await setDoc(doc(db, 'users', uid, 'runs', m.sessionId), {
          skillId, score, total,
          retakeNum: m.retakeNum || 1,
          durationMs: m.durationMs || null,
          missedItemIndices: m.missedItemIndices || [],
          finishedAt: serverTimestamp(),
          email, name,
        });
      }
      /* Legacy event log -- preserved for backwards compatibility. */
      await addDoc(collection(db, 'events'), {
        uid, email, name, skillId, score, total, ts: serverTimestamp(),
        retakeNum: m.retakeNum || 1,
        sessionId: m.sessionId || null,
      });
    } catch (e) {
      console.error('[PreLesson] Logging failed:', e);
    }
  }

  /* =================================================================
     XP / Gamification module.

     Storage key: laf1201-xp-state
     Schema (matches a future Firestore document shape so v2 sync is a
     drop-in replacement of read/write functions, not a redesign):

       {
         schemaVersion: 1,
         totalXP: number,
         currentStreak: number,
         bestStreak: number,
         streakHistory: number[],   // capped at 10, most recent last
         freezeTokens: number,      // 0-3
         freezesEarned: number,     // running count, used to compute new tokens
         lastVisitDate: 'YYYY-MM-DD' | null,
         skillBests: {
           [skillId]: { correct: number, total: number, attemptedAt: 'YYYY-MM-DD' }
         }
       }

     XP sources:
       - Item attempt: 10 XP (regardless of correctness)
       - Skill completion: 50 XP
       - Improvement on retake: (newCorrect - oldBest) * 20 XP
     All XP earned during a session is multiplied by the current streak
     multiplier (1.0x, 1.1x at day 3+, 1.25x at day 7+, 1.5x at day 14+,
     2.0x at day 30+).

     Streak rules (Q9 = c+d):
       - "Day" is the user's local calendar day.
       - "Visit" counts when the user submits at least one item.
       - Daily-visit detection: when an item is submitted and the date
         differs from lastVisitDate, evaluate streak transition.
       - If lastVisitDate was yesterday: streak += 1.
       - If gap is exactly 2 days AND a freeze token is available: consume
         token, streak += 1 (the missed day is "frozen" without breaking).
       - Otherwise: push currentStreak onto streakHistory, reset to 1.
       - Freeze tokens earned at every 7-day milestone (when streak hits
         7, 14, 21, 28...). Cap at 3 stockpiled.
  ============================================================== */

  const XP_KEY = 'laf1201-xp-state';
  const XP_SCHEMA_VERSION = 1;

  /* XP rates */
  const XP_PER_ATTEMPT = 10;
  const XP_PER_SKILL_COMPLETE = 50;
  const XP_PER_IMPROVEMENT_POINT = 20;

  /* ── Course profile: choose '6-week' (Special Term) or '14-week' (regular semester).
       Set window.LAF1201_COURSE_PROFILE = '6-week' or '14-week' in firebase-config.js
       (loaded BEFORE this script) to pick which tier table is used. Defaults to 6-week. */
  const COURSE_PROFILES = {
    '6-week': {
      /* Calibrated for a 6-week term: top performers ~12k XP, median ~6-7k.
         Streak peaks at 21 days × 1.8 — 30-day tier would be unreachable. */
      multipliers: [
        [21, 1.8],
        [14, 1.6],
        [10, 1.4],
        [7,  1.25],
        [3,  1.1],
        [0,  1.0],
      ],
      levels: [
        [0,      'Bienvenue'],
        [500,    'Premier pas'],
        [1500,   'Apprenti·e'],
        [3000,   'Découvreur·euse'],
        [5500,   'Praticien·ne'],
        [8500,   'Polyglotte en herbe'],
        [12000,  'Maître / Maîtresse de l\'atelier'],
      ],
    },
    '14-week': {
      /* Calibrated for a regular 14-week semester: top performers ~28k XP, median ~15k.
         Streak tiers extended out to 90 days × 2.0 — reachable but rare. */
      multipliers: [
        [90, 2.0],
        [60, 1.8],
        [30, 1.6],
        [14, 1.4],
        [7,  1.25],
        [3,  1.1],
        [0,  1.0],
      ],
      levels: [
        [0,      'Bienvenue'],
        [750,    'Premier pas'],
        [2500,   'Apprenti·e'],
        [5500,   'Découvreur·euse'],
        [10000,  'Praticien·ne'],
        [17500,  'Polyglotte en herbe'],
        [28000,  'Maître / Maîtresse de l\'atelier'],
      ],
    },
  };
  const _profileName = (typeof window !== 'undefined' && window.LAF1201_COURSE_PROFILE) ||
                       (typeof globalThis !== 'undefined' && globalThis.LAF1201_COURSE_PROFILE) ||
                       '6-week';
  const _profile = COURSE_PROFILES[_profileName] || COURSE_PROFILES['6-week'];
  if (!COURSE_PROFILES[_profileName]) {
    console.warn('[LAF1201] Unknown course profile "' + _profileName + '", falling back to 6-week.');
  }
  const MULTIPLIER_TIERS = _profile.multipliers;
  const LEVELS           = _profile.levels;

  function getLevel(totalXP) {
    /* Returns { num, name, xp, nextXP, nextName, progress } */
    let num = 1;
    let xp = 0;
    let name = LEVELS[0][1];
    let nextXP = null;
    let nextName = null;
    for (let i = 0; i < LEVELS.length; i++) {
      const [threshold, label] = LEVELS[i];
      if (totalXP >= threshold) {
        num = i + 1;
        xp = threshold;
        name = label;
        nextXP = (i + 1 < LEVELS.length) ? LEVELS[i + 1][0] : null;
        nextName = (i + 1 < LEVELS.length) ? LEVELS[i + 1][1] : null;
      } else { break; }
    }
    const progress = nextXP === null ? 1.0 : (totalXP - xp) / (nextXP - xp);
    return { num, name, xp, nextXP, nextName, progress, profile: _profileName };
  }

  const MAX_FREEZE_TOKENS = 3;
  const MAX_STREAK_HISTORY = 10;

  function todayLocalString() {
    /* YYYY-MM-DD in user's local timezone */
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function daysBetween(dateStrA, dateStrB) {
    /* Returns positive integer days between two YYYY-MM-DD strings.
       a < b -> positive. */
    const [ya, ma, da] = dateStrA.split('-').map(Number);
    const [yb, mb, db] = dateStrB.split('-').map(Number);
    const a = Date.UTC(ya, ma - 1, da);
    const b = Date.UTC(yb, mb - 1, db);
    return Math.round((b - a) / (24 * 60 * 60 * 1000));
  }

  function defaultXPState() {
    return {
      schemaVersion: XP_SCHEMA_VERSION,
      totalXP: 0,
      currentStreak: 0,
      bestStreak: 0,
      streakHistory: [],
      freezeTokens: 0,
      freezesEarned: 0,
      lastVisitDate: null,
      skillBests: {},
    };
  }

  function readXPState() {
    try {
      const raw = localStorage.getItem(XP_KEY);
      if (!raw) return defaultXPState();
      const parsed = JSON.parse(raw);
      /* Future-proof: if schemaVersion mismatches, do migrations here. */
      if (!parsed || parsed.schemaVersion !== XP_SCHEMA_VERSION) {
        return defaultXPState();
      }
      /* Defensive defaulting for missing fields */
      return Object.assign(defaultXPState(), parsed);
    } catch (e) {
      console.warn('[XP] readXPState failed:', e);
      return defaultXPState();
    }
  }

  function writeXPState(state) {
    try {
      localStorage.setItem(XP_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[XP] writeXPState failed:', e);
    }
  }

  function getMultiplier(streakDays) {
    for (const [minDays, mult] of MULTIPLIER_TIERS) {
      if (streakDays >= minDays) return mult;
    }
    return 1.0;
  }

  function applyMultiplier(baseXP, state) {
    return Math.round(baseXP * getMultiplier(state.currentStreak));
  }

  /* Update streak based on visit date relative to lastVisitDate. Returns
     a description of what happened (for optional UI flashes). Mutates state. */
  function evaluateStreakTransition(state, today) {
    const transition = { kind: 'none', freezeUsed: false, tokenEarned: false };

    if (state.lastVisitDate === today) {
      /* Same day visit, no change */
      transition.kind = 'same-day';
      return transition;
    }

    if (state.lastVisitDate === null) {
      /* First ever visit */
      state.currentStreak = 1;
      state.lastVisitDate = today;
      if (state.currentStreak > state.bestStreak) state.bestStreak = state.currentStreak;
      transition.kind = 'started';
      return transition;
    }

    const gap = daysBetween(state.lastVisitDate, today);

    if (gap === 1) {
      /* Consecutive day */
      state.currentStreak += 1;
      state.lastVisitDate = today;
      if (state.currentStreak > state.bestStreak) state.bestStreak = state.currentStreak;
      transition.kind = 'extended';
    } else if (gap === 2 && state.freezeTokens > 0) {
      /* Used a freeze to skip exactly one missed day */
      state.freezeTokens -= 1;
      state.currentStreak += 1;
      state.lastVisitDate = today;
      if (state.currentStreak > state.bestStreak) state.bestStreak = state.currentStreak;
      transition.kind = 'extended';
      transition.freezeUsed = true;
    } else if (gap > 0) {
      /* Streak broken: push onto history (cap), reset to 1 */
      if (state.currentStreak > 0) {
        state.streakHistory.push(state.currentStreak);
        if (state.streakHistory.length > MAX_STREAK_HISTORY) {
          state.streakHistory.shift();
        }
      }
      state.currentStreak = 1;
      state.lastVisitDate = today;
      if (state.currentStreak > state.bestStreak) state.bestStreak = state.currentStreak;
      transition.kind = 'broken';
    } else {
      /* gap < 0 or 0; treat as same-day */
      transition.kind = 'same-day';
      return transition;
    }

    /* Award freeze token at every 7-day milestone, capped at MAX */
    const earnedTokens = Math.floor(state.currentStreak / 7);
    if (earnedTokens > state.freezesEarned && state.freezeTokens < MAX_FREEZE_TOKENS) {
      state.freezeTokens = Math.min(MAX_FREEZE_TOKENS, state.freezeTokens + (earnedTokens - state.freezesEarned));
      state.freezesEarned = earnedTokens;
      transition.tokenEarned = true;
    } else if (earnedTokens > state.freezesEarned) {
      /* Cap reached; just mark them as earned so we don't re-award later */
      state.freezesEarned = earnedTokens;
    }
    return transition;
  }

  /* Public API: call when student submits any item. Returns the XP awarded
     for this attempt (already streak-multiplied). Also handles streak
     transitions on the day's first submission. */
  function awardItemAttempt(skillId) {
    const state = readXPState();
    const today = todayLocalString();
    evaluateStreakTransition(state, today);
    const xp = applyMultiplier(XP_PER_ATTEMPT, state);
    const _xpBefore = state.totalXP - xp;
    const _lvlBefore = getLevel(_xpBefore);
    const _lvlAfter  = getLevel(state.totalXP);
    if (_lvlAfter.num > _lvlBefore.num && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try { window.dispatchEvent(new CustomEvent('laf1201:level-up', { detail: _lvlAfter })); } catch(e) {}
    }
    const _newlyEarned = checkAndUpdateBadges(state);
    if (_newlyEarned.length && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try { window.dispatchEvent(new CustomEvent('laf1201:badges-earned', { detail: _newlyEarned })); } catch(e) {}
    }
    writeXPState(state);
    /* Phase 2: mirror to Firestore (fire-and-forget). */
    if (typeof syncXPState === 'function') syncXPState();
    return xp;
  }

  /* Public API: call when a skill is completed (after the last item). Awards
     completion bonus + improvement delta. Returns total XP awarded this call. */
  function awardSkillCompletion(skillId, correct, total) {
    const state = readXPState();
    const today = todayLocalString();
    /* Defensive: if for some reason no item was submitted today, still
       evaluate streak. (Shouldn't happen but keeps state consistent.) */
    evaluateStreakTransition(state, today);

    let baseXP = XP_PER_SKILL_COMPLETE;

    /* Improvement on retake */
    const prev = state.skillBests[skillId];
    let improvement = 0;
    if (prev && typeof prev.correct === 'number') {
      if (correct > prev.correct) {
        improvement = correct - prev.correct;
      }
    } else {
      /* First attempt: not "improvement" per se. We only award completion XP
         here; the per-item XP already covered the work. */
      improvement = 0;
    }
    baseXP += improvement * XP_PER_IMPROVEMENT_POINT;

    /* Update best score record */
    if (!prev || correct > prev.correct) {
      state.skillBests[skillId] = {
        correct: correct,
        total: total,
        attemptedAt: today,
      };
    }

    const xp = applyMultiplier(baseXP, state);
    const _xpBefore = state.totalXP - xp;
    const _lvlBefore = getLevel(_xpBefore);
    const _lvlAfter  = getLevel(state.totalXP);
    if (_lvlAfter.num > _lvlBefore.num && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try { window.dispatchEvent(new CustomEvent('laf1201:level-up', { detail: _lvlAfter })); } catch(e) {}
    }
    const _newlyEarned = checkAndUpdateBadges(state);
    if (_newlyEarned.length && typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try { window.dispatchEvent(new CustomEvent('laf1201:badges-earned', { detail: _newlyEarned })); } catch(e) {}
    }
    writeXPState(state);
    /* Phase 2: mirror to Firestore (fire-and-forget). */
    if (typeof syncXPState === 'function') syncXPState();

    return {
      xpAwarded: xp,
      improvementDelta: improvement,
      multiplier: getMultiplier(state.currentStreak),
    };
  }

  /* ── Badges ────────────────────────────────────────────────────────
     Each badge has: id, icon, label, description, earned(state)
     Returns true once when the condition first becomes true. */
  const BADGES = [
    { id: 'first-skill',   icon: '🥖', label: 'Premier croissant',  description: 'Complete your first skill.',                                          earned: (st) => Object.keys(st.skillBests || {}).length >= 1 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'perfect',       icon: '🎯', label: 'Sans faute',          description: 'Score 100% on any skill.',                                            earned: (st) => Object.values(st.skillBests || {}).some(b => b && b.correct === b.total && b.total > 0) , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'momentum',      icon: '🔁', label: 'Momentum',            description: 'Complete 5 different skills.',                                       earned: (st) => Object.keys(st.skillBests || {}).length >= 5 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'streak-3',      icon: '📅', label: 'Trois jours',         description: 'Reach a 3-day streak.',                                               earned: (st) => Math.max(st.currentStreak || 0, st.bestStreak || 0) >= 3 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'streak-7',      icon: '📅', label: 'Une semaine',         description: 'Reach a 7-day streak.',                                               earned: (st) => Math.max(st.currentStreak || 0, st.bestStreak || 0) >= 7 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'streak-14',     icon: '📅', label: 'Deux semaines',       description: 'Reach a 14-day streak.',                                              earned: (st) => Math.max(st.currentStreak || 0, st.bestStreak || 0) >= 14 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'streak-21',     icon: '📅', label: 'Trois semaines',      description: 'Reach a 21-day streak.',                                              earned: (st) => Math.max(st.currentStreak || 0, st.bestStreak || 0) >= 21 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'unit-0',        icon: '🌅', label: 'Unité 0',             description: 'Complete every skill in Unit 0 (Foundations).',                       earned: (st) => Object.keys(st.skillBests || {}).filter(k => k.startsWith('0-')).length >= 11 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'unit-1',        icon: '🤝', label: 'Unité 1',             description: 'Complete every skill in Unit 1 (Identity & introductions).',          earned: (st) => Object.keys(st.skillBests || {}).filter(k => k.startsWith('1-')).length >= 11 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'unit-2',        icon: '🥐', label: 'Unité 2',             description: 'Complete every skill in Unit 2 (Daily life above the boulangerie).',  earned: (st) => Object.keys(st.skillBests || {}).filter(k => k.startsWith('2-')).length >= 13 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'unit-3',        icon: '🗺️', label: 'Unité 3',             description: 'Complete every skill in Unit 3 (Paris, weather, directions).',        earned: (st) => Object.keys(st.skillBests || {}).filter(k => k.startsWith('3-')).length >= 11 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'unit-4',        icon: '🍽️', label: 'Unité 4',             description: 'Complete every skill in Unit 4 (Le grand dîner & Bilan).',            earned: (st) => Object.keys(st.skillBests || {}).filter(k => k.startsWith('4-')).length >= 11 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'xp-1000',       icon: '⭐', label: 'Mille XP',             description: 'Reach 1,000 XP.',                                                     earned: (st) => (st.totalXP || 0) >= 1000 , treat: "🎁 A small surprise to claim from Daniel in class"},
    { id: 'xp-5500',       icon: '✨', label: 'Praticien·ne',         description: 'Reach 5,500 XP — the median engaged student.',                        earned: (st) => (st.totalXP || 0) >= 5500 , treat: "🎁 A bigger surprise — collect at the last class"},
    { id: 'xp-12000',      icon: '🏆', label: 'Sommet',               description: 'Reach 12,000 XP — the top performer cap.',                            earned: (st) => (st.totalXP || 0) >= 12000 , treat: "✨ A top-tier surprise — collect at the last class"},
  ];

  /* Persist badges in state.badges (array of ids). On every award, check and append. */
  function checkAndUpdateBadges(state) {
    if (!Array.isArray(state.badges)) state.badges = [];
    const earned = new Set(state.badges);
    const newlyEarned = [];
    for (const b of BADGES) {
      if (!earned.has(b.id) && b.earned(state)) {
        earned.add(b.id);
        newlyEarned.push(b);
      }
    }
    state.badges = Array.from(earned);
    return newlyEarned;  /* caller can show toasts for these */
  }

  function getBadges() {
    const state = readXPState();
    const earned = new Set(state.badges || []);
    return BADGES.map(b => ({ id: b.id, icon: b.icon, label: b.label, description: b.description, treat: b.treat || '', earned: earned.has(b.id) }));
  }

  /* Public API: read current state for UI display (hub renders this). */
  function getXPState() {
    return readXPState();
  }

  /* Public API: reset all XP state (paired with the existing progress reset). */
  function clearXPState() {
    try { localStorage.removeItem(XP_KEY); } catch (e) {}
  }

  /* Public API: record a visit without awarding XP. Useful if we want to
     extend the streak by simply opening the hub. We're NOT calling this on
     hub load (Q8 = c, only item submission counts). Exposed for future use. */
  function recordVisit() {
    const state = readXPState();
    const today = todayLocalString();
    evaluateStreakTransition(state, today);
    writeXPState(state);
    return state;
  }

  /* Public API: format a multiplier description ("1.25x" etc.) */
  function describeMultiplier(streakDays) {
    return getMultiplier(streakDays);
  }

  /* =================================================================
     End XP module
  ============================================================== */

  /* =================================================================
     Phase 2 telemetry module.

     Adds dossier-grade logging to the existing pretest engine without
     touching any skill page. Hooks already inserted in makePretest()
     call into this module via:
       - logSkillStart(skillId, sessionId, retakeNum)
       - logAttempt({skillId, sessionId, retakeNum, itemIdx, mode,
                     isCorrect, timeToSubmitMs, positionInRun})
     This module also:
       - generates per-run session ids
       - tracks retake numbers (incremented at each pretest start)
       - mirrors XP/streak state to Firestore on every change
       - manages a one-time research-consent flag per user
       - logs auth telemetry (sign-in successes/failures)

     Storage shape (Firestore):
       users/{uid}                           consent + profile
         /skills/{skillId}                   latest state (existing)
         /runs/{sessionId}                   one doc per pretest run
         /attempts/{auto}                    one doc per item submission
         /state/xp                           mirrored XP state
       events/{auto}                         legacy, kept

     localStorage adds one new key:
       laf1201-retake-counts: { [skillId]: number }
  ============================================================== */

  const RETAKE_KEY = 'laf1201-retake-counts';

  /* ---- Session IDs ---- */
  function generateSessionId() {
    /* Compact, sortable, unique enough: timestamp + 6 random chars */
    const t = Date.now().toString(36);
    const r = Math.random().toString(36).slice(2, 8);
    return `${t}-${r}`;
  }

  /* ---- Retake counter ---- */
  function readRetakeCounts() {
    try {
      const raw = localStorage.getItem(RETAKE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function writeRetakeCounts(counts) {
    try { localStorage.setItem(RETAKE_KEY, JSON.stringify(counts)); }
    catch (e) {}
  }

  /* Returns the retake number for THIS run (1 = first attempt). Increments
     and persists. Called once at start() of each pretest run. */
  function nextRetakeNumber(skillId) {
    const counts = readRetakeCounts();
    const next = (counts[skillId] || 0) + 1;
    counts[skillId] = next;
    writeRetakeCounts(counts);
    return next;
  }

  /* ---- Skill start logging ---- */
  async function logSkillStart(skillId, sessionId, retakeNum) {
    if (!_firebase || !_currentUser) return;
    const { db, doc, setDoc, serverTimestamp } = _firebase;
    const uid = _currentUser.uid;
    try {
      /* Pre-create the run doc so even abandoned runs are visible. The
         finish() handler will overwrite with score/total/duration later. */
      await setDoc(doc(db, 'users', uid, 'runs', sessionId), {
        skillId, retakeNum,
        startedAt: serverTimestamp(),
        email: _currentUser.email || null,
        name: _currentUser.displayName || null,
      }, { merge: true });
    } catch (e) {
      console.warn('[PreLesson] logSkillStart failed:', e);
    }
  }

  /* ---- Per-attempt logging ---- */
  async function logAttempt(attempt) {
    if (!_firebase || !_currentUser) return;
    const { db, collection, addDoc, serverTimestamp } = _firebase;
    const uid = _currentUser.uid;
    try {
      await addDoc(collection(db, 'users', uid, 'attempts'), {
        skillId: attempt.skillId,
        sessionId: attempt.sessionId,
        retakeNum: attempt.retakeNum,
        itemIdx: attempt.itemIdx,
        mode: attempt.mode,
        isCorrect: !!attempt.isCorrect,
        timeToSubmitMs: attempt.timeToSubmitMs,
        positionInRun: attempt.positionInRun,
        ts: serverTimestamp(),
      });
    } catch (e) {
      /* Attempt logging is best-effort and must never break the pretest. */
      console.warn('[PreLesson] logAttempt failed:', e);
    }
  }

  /* ---- XP/streak state sync to Firestore ---- */
  let _xpSyncInFlight = false;
  let _xpSyncQueued = false;

  async function syncXPState() {
    if (!_firebase || !_currentUser) return;
    if (_xpSyncInFlight) { _xpSyncQueued = true; return; }
    _xpSyncInFlight = true;
    try {
      const { db, doc, setDoc, serverTimestamp } = _firebase;
      const uid = _currentUser.uid;
      const state = readXPState();
      await setDoc(doc(db, 'users', uid, 'state', 'xp'), {
        ...state,
        syncedAt: serverTimestamp(),
      }, { merge: true });
      /* Also mirror to leaderboard if user has opted in (default yes). */
      try {
        const optedIn = (typeof localStorage !== 'undefined')
          && localStorage.getItem('laf1201-leaderboard-optin') !== '0';
        await syncToLeaderboard(optedIn);
      } catch (e) { /* non-fatal */ }
    } catch (e) {
      console.warn('[PreLesson] syncXPState failed:', e);
    } finally {
      _xpSyncInFlight = false;
      if (_xpSyncQueued) {
        _xpSyncQueued = false;
        /* Coalesce: one more sync to capture any state updated mid-flight */
        setTimeout(syncXPState, 100);
      }
    }
  }

  /* ---- Hi-Score leaderboard ---- */
  /* Mirrors the user's totalXP and a privacy-friendly first name (or
     "__anon__") into a top-level /leaderboard/{uid} doc that any
     authenticated user can read. Controlled by the optedIn flag. */
  async function syncToLeaderboard(optedIn) {
    if (!_firebase || !_currentUser) return;
    try {
      const { db, doc, setDoc, deleteDoc, serverTimestamp } = _firebase;
      const uid = _currentUser.uid;
      if (_isTestUid(uid)) {
        /* Test/instructor account: never write to the public board.
           Also purge any leftover entry from prior runs. */
        try { await deleteDoc(doc(db, 'leaderboard', uid)); }
        catch (e) { /* ignore */ }
        return;
      }
      if (!optedIn) {
        /* User opted out: remove their entry so they don't appear. */
        try { await deleteDoc(doc(db, 'leaderboard', uid)); }
        catch (e) { /* doc may not exist yet — ignore */ }
        return;
      }
      const state = readXPState();
      const fullName = (_currentUser.displayName || '').trim();
      const firstName = fullName ? fullName.split(/\s+/)[0] : 'Student';
      const pretestXP = state.totalXP || 0;
      /* Unified French-1 board: add the reviser's XP (read from the shared
         users/{uid} doc) so totalXP spans the whole ecosystem. */
      let reviserXP = 0;
      try {
        const { getDoc } = _firebase;
        const us = await getDoc(doc(db, 'users', uid));
        if (us.exists()) reviserXP = us.data().xp || 0;
      } catch (e) { /* offline — fall back to pretest-only */ }
      await setDoc(doc(db, 'leaderboard', uid), {
        uid: uid,
        displayName: firstName,
        pretestXP: pretestXP,
        reviserXP: reviserXP,
        totalXP: pretestXP + reviserXP,
        lastUpdated: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn('[PreLesson] syncToLeaderboard failed:', e);
    }
  }

  /* Returns up to `limitN` leaderboard entries sorted by totalXP desc. */
  async function loadLeaderboard(limitN) {
    if (!_firebase) return [];
    try {
      const { db } = _firebase;
      const fbStore = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js');
      const want = limitN || 10;
      /* Over-fetch a few rows so we can drop test/instructor UIDs without
         shrinking the student-visible board. */
      const overfetch = want + TEST_UIDS.size + 2;
      const q = fbStore.query(
        fbStore.collection(db, 'leaderboard'),
        fbStore.orderBy('totalXP', 'desc'),
        fbStore.limit(overfetch)
      );
      const snap = await fbStore.getDocs(q);
      const rows = [];
      snap.forEach((d) => {
        const row = d.data();
        if (_isTestUid(row && row.uid)) return;   /* hide instructor */
        rows.push(row);
      });
      return rows.slice(0, want);
    } catch (e) {
      console.warn('[PreLesson] loadLeaderboard failed:', e);
      return [];
    }
  }

  /* ---- Consent flow ---- */
  const CONSENT_LOCAL_KEY = 'laf1201-consent-asked';

  async function checkAndPromptConsent() {
    if (!_firebase || !_currentUser) return;
    /* Avoid re-prompting on every page load if we've already asked locally.
       The Firestore record is the source of truth, but the local flag
       prevents extra reads on each page. */
    let askedLocally = false;
    try { askedLocally = localStorage.getItem(CONSENT_LOCAL_KEY) === '1'; }
    catch (e) {}
    if (askedLocally) return;

    const { db, doc, getDoc, setDoc, serverTimestamp } = _firebase;
    const uid = _currentUser.uid;
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      const data = userDoc.exists() ? userDoc.data() : {};
      if (typeof data.consentResearch !== 'undefined') {
        /* Already answered. Cache locally and exit. */
        try { localStorage.setItem(CONSENT_LOCAL_KEY, '1'); } catch (e) {}
        return;
      }
      /* Show the prompt. */
      const choice = await showConsentPrompt();
      await setDoc(doc(db, 'users', uid), {
        consentResearch: choice,
        consentAskedAt: serverTimestamp(),
        email: _currentUser.email || null,
        name: _currentUser.displayName || null,
      }, { merge: true });
      try { localStorage.setItem(CONSENT_LOCAL_KEY, '1'); } catch (e) {}
    } catch (e) {
      console.warn('[PreLesson] consent flow failed:', e);
    }
  }

  function showConsentPrompt() {
    return new Promise((resolve) => {
      /* ── Step 1: initial ask ── */
      const overlay = document.createElement('div');
      overlay.className = 'consent-overlay';
      overlay.innerHTML = `
        <div class="consent-modal" role="dialog" aria-labelledby="consent-title">
          <h2 id="consent-title">A note on your data</h2>
          <p>May I use your anonymised exercise data for research on teaching French at NUS?</p>
          <p class="consent-tiny">Your name and email are never shared. Either choice is fine — the exercises work the same.</p>
          <div class="consent-buttons">
            <button class="consent-btn consent-yes" type="button" id="consent-yes">Yes, you can use my data</button>
            <button class="consent-btn consent-no" type="button" id="consent-no">No, just for class</button>
          </div>
          <div class="consent-meta">Dr Daniel Chan \u00b7 Centre for Language Studies \u00b7 NUS</div>
        </div>
      `;
      document.body.appendChild(overlay);

      const finalize = (val) => {
        if (overlay.parentNode) document.body.removeChild(overlay);
        resolve(val);
      };

      /* ── Step 2: re-confirm "No" with a friendly explanation ── */
      const showAreYouSure = () => {
        overlay.innerHTML = `
          <div class="consent-modal" role="dialog" aria-labelledby="consent-confirm-title">
            <h2 id="consent-confirm-title">Are you sure?</h2>
            <p>It costs you nothing, and only class-wide patterns (never names) appear in research write-ups.</p>
            <p class="consent-tiny">You can email me any time to opt out.</p>
            <div class="consent-buttons">
              <button class="consent-btn consent-yes" type="button" id="consent-yes-now">OK, you can use my data</button>
              <button class="consent-btn consent-no" type="button" id="consent-still-no">Still no, thanks</button>
            </div>
            <div class="consent-meta">Dr Daniel Chan \u00b7 Centre for Language Studies \u00b7 NUS</div>
          </div>
        `;
        overlay.querySelector('#consent-yes-now').addEventListener('click', () => finalize(true));
        overlay.querySelector('#consent-still-no').addEventListener('click', () => finalize(false));
      };

      overlay.querySelector('#consent-yes').addEventListener('click', () => finalize(true));
      overlay.querySelector('#consent-no').addEventListener('click', showAreYouSure);
    });
  }

  /* ---- Auth telemetry ---- */
  async function logAuthEvent(kind, detail) {
    if (!_firebase) return;
    try {
      const { db, collection, addDoc, serverTimestamp } = _firebase;
      await addDoc(collection(db, 'authEvents'), {
        kind,
        detail: detail || null,
        uid: _currentUser ? _currentUser.uid : null,
        email: _currentUser ? _currentUser.email : null,
        ts: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[PreLesson] logAuthEvent failed:', e);
    }
  }

  /* Hook: when auth state changes to signed-in, sync XP and check consent. */
  let _phase2HooksInstalled = false;
  function installPhase2AuthHooks() {
    if (_phase2HooksInstalled) return;
    _phase2HooksInstalled = true;
    onAuthStateChange((user) => {
      if (user) {
        /* Sync any localStorage XP that accumulated while signed out, then
           ask for consent if we haven't already. */
        syncXPState();
        checkAndPromptConsent();
        logAuthEvent('signed-in');
      }
    });
  }
  installPhase2AuthHooks();

  /* Patch writeXPState so every state mutation triggers a Firestore sync.
     We do this at the source, inside awardItemAttempt and awardSkillCompletion,
     since those are the only mutation entry points used by the pretest engine.
     The wrapper-pattern alternative would only catch calls via the public API,
     which isn't sufficient because makePretest calls the closure-bound originals. */

  /* ---- Public Phase 2 helpers (for admin/debug pages) ---- */
  function getRetakeNumber(skillId) {
    return readRetakeCounts()[skillId] || 0;
  }

  function clearRetakeCounts() {
    try { localStorage.removeItem(RETAKE_KEY); } catch (e) {}
  }

  /* =================================================================
     End Phase 2 telemetry module
  ============================================================== */

  /* ── Cross-ecosystem TOP BANNER ──
     Inject the unified .utb banner on every laf1201 sub-page (lesson
     pages, unit hubs) so it matches the root index.html and the other
     two ecosystem sites. Idempotent: skips if .utb is already present. */
  function injectEcoBanner() {
    if (document.querySelector('.utb')) return;

    // Inject the inline <style> so we don't depend on shared CSS being loaded
    // Load Google Fonts via <link> tags in <head> (faster than @import in injected CSS)
    if (!document.getElementById('utb-fonts-link')) {
      var pc1 = document.createElement('link'); pc1.rel='preconnect'; pc1.href='https://fonts.googleapis.com'; document.head.appendChild(pc1);
      var pc2 = document.createElement('link'); pc2.rel='preconnect'; pc2.href='https://fonts.gstatic.com'; pc2.crossOrigin=''; document.head.appendChild(pc2);
      var fl  = document.createElement('link'); fl.id='utb-fonts-link'; fl.rel='stylesheet';
      fl.href='https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,400&family=Roboto+Mono:wght@400;500;600;700&display=swap';
      document.head.appendChild(fl);
    }

        if (!document.getElementById('utb-banner-style')) {
      var style = document.createElement('style');
      style.id = 'utb-banner-style';
      style.textContent =
        ".utb{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:99999!important;display:flex!important;align-items:center;gap:18px;padding:0 28px;height:56px!important;min-height:56px!important;max-height:56px!important;box-sizing:border-box!important;background:#142346!important;border-bottom:1px solid rgba(200,150,62,0.15);box-shadow:0 2px 12px rgba(0,0,0,0.35);color:#e8ddd0!important;line-height:1!important}.utb *{box-sizing:border-box}" +
        ".utb a{text-decoration:none!important}" +
        ".utb-brand{display:flex;align-items:baseline;gap:8px;color:#e8ddd0!important;font-family:'Playfair Display',Georgia,serif!important;font-size:17.6px}" +
        ".utb-brand .utb-code{font-family:'Roboto Mono',Menlo,Consolas,monospace!important;font-size:13.6px;letter-spacing:0.14em;color:#f08c48!important;font-style:normal;font-weight:500}" +
        ".utb-brand .utb-bsep{color:rgba(232,221,208,0.35);font-weight:300;font-style:normal}" +
        ".utb-brand .utb-name{font-style:italic;font-weight:400}" +
        ".utb-links{display:flex;align-items:center;gap:4px;margin-left:auto}" +
        ".utb-links a{font-family:'Roboto Mono',Menlo,Consolas,monospace!important;font-size:11px!important;letter-spacing:0.12em;text-transform:uppercase;color:rgba(232,221,208,0.55)!important;padding:8px 10px;border-radius:4px;transition:color 0.15s,background 0.15s;white-space:nowrap;display:inline-flex;align-items:center;min-height:36px}" +
        ".utb-links a:hover{color:#f08c48!important;background:rgba(200,150,62,0.05)}" +
        ".utb-links a.is-here{color:#f08c48!important;border-bottom:2px solid #f08c48;border-radius:0;cursor:default}" +
        ".utb-links a.is-here:hover{background:transparent}" +
        ".utb-links .utb-sep{color:rgba(232,221,208,0.20);user-select:none}" +
        ".utb-signin{display:inline-flex!important;align-items:center;background:#e06a28!important;color:#1e1610!important;padding:7px 16px!important;border-radius:999px!important;font-family:'Roboto Mono',Menlo,Consolas,monospace!important;font-size:11px!important;font-weight:700!important;letter-spacing:0.1em;text-transform:uppercase;box-shadow:2px 2px 6px rgba(0,0,0,0.4);border:none!important;cursor:pointer;transition:background 0.15s;margin-left:12px;white-space:nowrap;height:32px!important;min-height:32px!important;max-height:32px!important;line-height:1!important;box-sizing:border-box!important;-webkit-appearance:none;appearance:none;text-decoration:none!important}" +
        ".utb-signin:hover{background:#f08c48!important}" +
        ".utb-theme{display:inline-flex!important;align-items:center;justify-content:center;width:32px;height:32px;margin-left:8px;background:transparent;border:1px solid rgba(200,150,62,0.25);border-radius:999px;color:rgba(232,221,208,0.7);font-size:14px;cursor:pointer;transition:color 0.15s,border-color 0.15s;font-family:inherit;line-height:1;padding:0}" +
        ".utb-theme:hover{color:#f08c48;border-color:#f08c48}" +
        "@media (max-width:720px){.utb-links{font-size:10px}.utb-links a{padding:6px 6px}.utb{padding:0 14px!important}.utb-signin{padding:6px 12px!important;margin-left:8px}.utb-theme{width:28px;height:28px;margin-left:4px}}" +
        ".hiw-fab{position:fixed;right:24px;bottom:24px;z-index:9990;width:52px;height:52px;border-radius:50%;background:#e06a28;color:#1e1610;font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:700;font-style:italic;border:none;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.45);display:inline-flex;align-items:center;justify-content:center;line-height:1;padding:0;transition:background 0.15s,transform 0.15s,box-shadow 0.15s}" +
        ".hiw-fab:hover{background:#f08c48;transform:translateY(-2px);box-shadow:0 6px 18px rgba(0,0,0,0.55)}" +
        ".hiw-fab:active{transform:translateY(0)}" +
        "@media (max-width:720px){.hiw-fab{width:46px;height:46px;font-size:24px;right:18px;bottom:18px}}" +
        ".hiw-dialog{position:fixed;inset:0;margin:auto;border:none;border-radius:18px;padding:0;max-width:560px;width:calc(100% - 48px);max-height:80vh;background:#231a10;color:#e8ddd0;box-shadow:0 24px 60px rgba(0,0,0,0.6)}" +
        ".hiw-dialog::backdrop{background:rgba(0,0,0,0.55)}" +
        ".hiw-dialog-inner{padding:36px 36px 28px;overflow-y:auto;max-height:calc(80vh - 0px)}" +
        ".hiw-dialog .hiw-eyebrow{font-family:'Roboto Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#f08c48;margin:0 0 6px 0}" +
        ".hiw-dialog h2{font-family:'Playfair Display',Georgia,serif;font-size:1.8rem;font-weight:600;color:#fff;margin:0 0 18px 0}" +
        ".hiw-dialog h2 em{color:#f08c48;font-style:italic}" +
        ".hiw-dialog p{font-size:0.96rem;line-height:1.6;margin:0 0 12px 0}" +
        ".hiw-dialog strong{color:#fff;font-weight:600}" +
        ".hiw-dialog em{color:#f08c48;font-style:italic}" +
        ".hiw-dialog a{color:#f08c48;text-decoration:underline}" +
        ".hiw-dialog .hiw-close{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:999px;background:#d32f2f;border:1px solid #d32f2f;color:#fff;font-size:16px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;transition:background 0.15s,transform 0.15s}" +
        ".hiw-dialog .hiw-close:hover{background:#b71c1c;border-color:#b71c1c;transform:scale(1.06)}" +
        ".hiw-dialog .hiw-close:active{transform:scale(0.96)}" +
        "body{padding-top:56px!important}";
      document.head.appendChild(style);
    }

    var nav = document.createElement('nav');
    nav.className = 'utb';
    nav.setAttribute('aria-label', 'LAF1201 ecosystem');
    nav.innerHTML =
      '<a class="utb-brand" href="https://st1fr26.withdrchan.com/">' +
        '<span class="utb-code">LAF1201</span>' +
        '<span class="utb-bsep" aria-hidden="true">·</span>' +
        '<span class="utb-name">French I</span>' +
      '</a>' +
      '<div class="utb-links">' +
        '<a href="https://st1fr26.withdrchan.com/">st1fr26</a>' +
        '<span class="utb-sep" aria-hidden="true">·</span>' +
        '<a href="https://french1.withdrchan.com/">Course Info</a>' +
        '<span class="utb-sep" aria-hidden="true">·</span>' +
        '<a href="https://4aparis.withdrchan.com/">Story Reader</a>' +
        '<span class="utb-sep" aria-hidden="true">·</span>' +
        '<a href="https://laf1201.withdrchan.com/" class="is-here" aria-current="page">Language Practice</a>' +
      '</div>' +
      '<a class="utb-signin" href="https://laf1201.withdrchan.com/" title="Sign in via Language Practice">Sign In</a>' +
      '<button class="utb-theme" id="utb-theme-btn" type="button" aria-label="Toggle theme" title="Toggle light / dark mode">☀️</button>';

    document.body.insertBefore(nav, document.body.firstChild);

    // Floating "How it Works" trigger + dialog (replaces banner link)
    if (!document.getElementById('hiw-fab')) {
      var dlg = document.createElement('dialog');
      dlg.className = 'hiw-dialog';
      dlg.id = 'hiw-dialog';
      dlg.innerHTML =
        '<div class="hiw-dialog-inner">' +
          '<button class="hiw-close" id="hiw-close" aria-label="Close">✕</button>' +
          '<p class="hiw-eyebrow">How these exercises work</p>' +
          '<h2>How these exercises <em>work</em></h2>' +
          '<p>These exercises are built on the <strong>pretesting effect</strong> (<a href="https://fass.nus.edu.sg/news/2026/04/16/study-confirms-guessing-before-learning-improves-memory-in-language-learning/" target="_blank" rel="noopener">Pan &amp; Chua, NUS 2026</a>): attempting an answer <em>before</em> you have fully learned the material — even when you will likely get it wrong — strengthens later memory more than passive study, provided you receive immediate feedback.</p>' +
          '<p>You will be asked to guess, often without knowing. <strong>Wrong guesses are not failures.</strong> They are the mechanism. What matters is that you read the feedback after each item and let the correct answer land.</p>' +
          '<p>The pretest score at the end of each skill is <strong>not a grade.</strong> It is a private signal of what to revisit. Class itself is where the actual learning happens; these exercises prime your memory for it.</p>' +
        '</div>';
      document.body.appendChild(dlg);

      var fab = document.createElement('button');
      fab.className = 'hiw-fab';
      fab.id = 'hiw-fab';
      fab.type = 'button';
      fab.setAttribute('aria-label', 'How these exercises work');
      fab.title = 'How these exercises work';
      fab.textContent = '?';
      document.body.appendChild(fab);

      fab.addEventListener('click', function(){ dlg.showModal(); });
      var hclose = dlg.querySelector('#hiw-close');
      if (hclose) hclose.addEventListener('click', function(){ dlg.close(); });
      dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });
    }

    // Wire up the .utb-theme button (toggle data-theme + persist in localStorage)
    var themeBtn = document.getElementById('utb-theme-btn');
    if (themeBtn) {
      var saved = localStorage.getItem('laf-theme') || 'dark';
      document.documentElement.setAttribute('data-theme', saved);
      themeBtn.textContent = saved === 'light' ? '🌙' : '☀️';
      themeBtn.addEventListener('click', function(){
        var next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('laf-theme', next);
        themeBtn.textContent = next === 'light' ? '🌙' : '☀️';
      });
    }
  }

  /* ── Cross-ecosystem footer ──
     Auto-inject so every page that loads this shared script gets a
     consistent footer linking to the other two LAF1201 sites.
     Idempotent: if .eco-footer-laf is already present we skip. */
  function injectEcoFooter() {
    if (document.querySelector('.eco-footer-laf')) return;
    const aside = document.createElement('aside');
    aside.className = 'eco-footer-laf';
    aside.setAttribute('aria-label', 'LAF1201 ecosystem');
    aside.innerHTML =
      '<div class="eco-eyebrow">Part of the LAF1201 ecosystem</div>' +
      '<a href="https://french1.withdrchan.com/">Course Info</a>' +
      '<span class="sep" aria-hidden="true">·</span>' +
      '<a href="https://4aparis.withdrchan.com/">Story Reader</a>' +
      '<span class="sep" aria-hidden="true">·</span>' +
      '<a href="https://laf1201.withdrchan.com/">Language Practice</a>' +
      '<span class="here">You are here: <strong>Language Practice</strong></span>';
    const target = document.querySelector('main') || document.body;
    if (target) target.appendChild(aside);
  }

  /* ── Theme toggle ── */
  function initTheme() {
    const saved = localStorage.getItem('laf-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);

    // Best-effort: also inject the cross-ecosystem footer.
    try { injectEcoBanner(); } catch (e) { /* non-fatal */ }
    try { injectEcoFooter(); } catch (e) { /* non-fatal */ }

    const nav = document.querySelector('.topnav, .unit-topnav, .topbar-right');
    if (!nav) return;

    const btn = document.createElement('button');
    btn.className = 'theme-toggle';
    btn.title = 'Toggle light / dark mode';
    btn.setAttribute('aria-label', 'Toggle theme');
    btn.textContent = saved === 'light' ? '🌙' : '☀️';

    btn.addEventListener('click', () => {
      const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('laf-theme', next);
      btn.textContent = next === 'light' ? '🌙' : '☀️';
    });

    nav.appendChild(btn);
  }

  // Auto-inject the cross-ecosystem footer on every page that loads
  // this shared script — running once the DOM is ready.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try { injectEcoBanner(); } catch (e) { /* non-fatal */ }
    try { injectEcoFooter(); } catch (e) { /* non-fatal */ }
      }, { once: true });
    } else {
      try { injectEcoBanner(); } catch (e) { /* non-fatal */ }
    try { injectEcoFooter(); } catch (e) { /* non-fatal */ }
    }
  }

  return {
    initVoice,
    speak,
    attachReadAloud,
    listenPairHTML,
    bindListenPairs,
    shuffle,
    normFrench,
    compareFrench,
    makePretest,
    buildRecap,
    setupColumnToggles,
    markSkillDone,
    getSkillProgress,
    clearProgress,
    initFirebaseAuth,
    onAuthStateChange,
    getCurrentUser,
    signInWithGoogle,
    signOut,
    logSkillCompletion,
    requireAuth,
    /* XP / Gamification (sync to Firestore happens internally) */
    awardItemAttempt,
    awardSkillCompletion,
    getXPState,
    clearXPState,
    recordVisit,
    describeMultiplier,
    getLevel,
    getBadges,
    /* Phase 2 */
    getRetakeNumber,
    clearRetakeCounts,
    syncXPState,
    syncToLeaderboard,
    loadLeaderboard,
    initTheme,
  };

})();

// Expose PreLesson on the global object so any <script> tag (including modules
// or other independent scripts on the same page) can access it via window.PreLesson.
if (typeof window !== 'undefined') { window.PreLesson = PreLesson; }
if (typeof globalThis !== 'undefined') { globalThis.PreLesson = PreLesson; }
