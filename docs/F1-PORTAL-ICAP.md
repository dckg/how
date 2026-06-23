# FluoLingo · `/f1/` (LAF1201 — French 1) — structure & ICAP plan

Decisions locked from the design discussion:

- **No song generation** on FluoLingo. (Removed from the sleeve.)
- The course lives at **`fluolingo.com/f1/`** — `f1` = LAF1201 / French 1. Leaves room for
  other courses later (e.g. `/f2/`, `/f3/`).
- Activities are organised as **subdirectories by activity type** under `/f1/`.
- Exercise types are designed against **ICAP** (Chi & Wylie, 2014):
  **Passive < Active < Constructive < Interactive**, with the explicit aim of *pushing
  each task up a tier*, not just labelling it.

---

## The ICAP spine (what each tier means here)

| Tier | Definition | What the learner does |
|------|------------|------------------------|
| **Passive** | Receive without overt production | read / listen / watch; first exposure |
| **Active** | Manipulate *given* pieces | select, match, arrange supplied items |
| **Constructive** | Produce *beyond* what's given | generate a form from memory, infer, explain |
| **Interactive** | Co-construct with a responsive partner | dialogue where both sides build on each other |

**Hard constraint:** a static site (GitHub Pages) reaches **Passive → Constructive**.
**Interactive cannot be faked client-side** — it needs a responsive partner: the
**agentic-Claude dialogue track** (API backend) or **human telecollaboration**
(COIL / LAF3202). So `/f1/` static tops out at Constructive; Interactive is a separate
track, flagged below as `needs backend`.

---

## Exercise types → ICAP tier (and the tweak that raises the tier)

The key insight: the *same widget* can sit in different tiers depending on one design
choice. Build the higher-tier version.

| Activity | Default tier | Raise it by… | Final tier |
|----------|-------------|--------------|------------|
| **Reference / glossed reader** | Passive | (first exposure — leave as is) | Passive |
| **Match** | Active | — (good first-exposure recognition) | Active |
| **Memory** | Active | — | Active |
| **MCQ** | Active | distractors that *bite* (force real discrimination) | Active (strong) |
| **Word-ordering (syntax)** | Active | — (assembly from given pieces) | Active |
| **Sentence/text-ordering** | Active | — | Active |
| **Click2reveal** | Active | **require an answer attempt before reveal** | **Constructive** |
| **Letris** | Active | typed/produced response under time pressure | Active→Constructive |
| **Gapfill** | Active | **strip the word bank** — summon the form cold | **Constructive** |
| **Karaoke** | (off-axis) | judged on prosody/pronunciation, productive oral | high-value |
| **Dialogue partner** | Interactive | agentic Claude / peer telecollab | **Interactive** `needs backend` |

Notes carried from the design discussion:
- **Don't delete the Active games.** Recognition (match, memory) is the correct *first*
  exposure to new form–meaning pairs; interleaving them between harder tasks sustains
  time-on-task, which is where learning actually accrues. Right-size, don't cut.
- **Karaoke** earns its place on pronunciation/prosody alone — judge it on the competence
  it owns, not its low form-generation.
- The biggest gains come from *making each task more active*, not from chasing new types:
  no-word-bank gapfill, attempt-before-reveal, biting MCQ distractors. Three upgrades, no
  new builds.

---

## Proposed `/f1/` route map

```
/f1/                 Course home — SIO/unit dashboard + progress entry point
/f1/learn/           First exposure (Passive→Active): reference, glossed reader,
                     flashcards, match, memory
/f1/pretest/         Diagnostic MCQ (Active; biting distractors)
/f1/gapfill/         Constructive — no word bank
/f1/order/           Active assembly — word-ordering + sentence/text-ordering
/f1/letris/          Active→Constructive — timed retrieval
/f1/karaoke/         Productive oral — prosody / pronunciation
/f1/dialogue/        Interactive — agentic Claude partner   [needs backend, later]
```

Each activity is **parameterised by SIO/unit** (e.g. `/f1/pretest/?sio=0.1` or a per-SIO
subfolder), so one activity template serves all SIOs rather than a page per SIO.

---

## SIO coverage (Unit 0 — first 10, for students now)

0.1 s'appeler · 0.2 alphabet/spelling · 0.3 short self-introduction · 0.4 greet & take
leave · 0.5 tu/vous + greeting customs · 0.6 classroom consignes · 0.7 question words
(receptive) · 0.8 basic sounds/phonetics · 0.9 days & parts of the day · 0.10 basic colours.

Suggested per-SIO coverage across the ladder (recognition first, then production):
- **Passive/Active:** `learn` (reference + match/memory) for every SIO.
- **Active:** `pretest` MCQ for every SIO; `order` where structure matters (0.3, 0.5).
- **Constructive:** `gapfill` (no bank) for form-bearing SIOs (0.1, 0.6, 0.9, 0.10).
- **Productive oral:** `karaoke`/repeat for 0.2 (alphabet) and 0.8 (sounds).

---

## Build status (Unit 0)

Built and live in the repo under `/f1/`:

- **Root `/`** — course launcher; primary CTA + nav link → `/f1/` (French 2 shown as "bientôt").
- **`/f1/`** — Unit 0 dashboard: 10 SIO cards, activity nav, per-SIO progress chips.
- **`/f1/learn/`** — reference list (with French TTS) + a **match** game → Passive→Active.
- **`/f1/pretest/`** — MCQ with biting distractors + explanations → Active.
- **`/f1/gapfill/`** — no word bank, type-the-form, accent-tolerant checking → Constructive.
- **`/f1/dialogue/`** — "bientôt" placeholder (Interactive; needs the agentic backend).
- **Google login** — wired (real Google button + per-account progress) but **dormant until a
  Client ID is set in `f1/app/config.js`**; runs in guest mode with localStorage progress meanwhile.
- Content lives in `f1/data/sios.js` (one record per SIO), shared logic in `f1/app/`.

Decisions locked: root keeps a French 1 link (not a hard redirect); login = Google;
`/f1/dialogue/` = coming soon.

## Open scoping questions

1. **First slice for today:** ship `/f1/learn/` + `/f1/pretest/` across all 10 SIOs
   (covers Passive→Active, the highest-value first exposure + diagnostic), then add
   `gapfill` (Constructive)? Or a different cut?
2. **Root (`fluolingo.com/`)** — landing page, or redirect straight to `/f1/`?
3. **Progress** — none, or browser-local (localStorage) per device?
4. **Interactive track** — park `/f1/dialogue/` for the agentic-Claude build later, agreed?
