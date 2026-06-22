# Unified Portal — Architecture Brief

**Goal:** one redesigned portal that contains **both the pretest MCQs and the FluoLingo
activities**, on a single shared content model — not two apps linked together.

This brief is written to be handed to the Claude Code session on the main machine,
which has both codebases in the working folder. It is grounded in what actually exists
today (see "Current state").

---

## 1. Current state (what we're merging)

### A. FluoLingo (`dckg/how` — this repo)
A **static single-page site**: `index.html` + `styles.css` + `app.js`. Three activities,
all with **hardcoded data inside `app.js`**:

- **Outil 01 — Pré-test:** MCQ engine. Data = `QUESTIONS[]` (`topic`, `q`, `options`,
  `answer` index, `why` explanation).
- **Outil 02 — Lecture:** glossed reader. Words wrapped in `.gloss[data-en][data-ipa]`.
- **Outil 03 — Chansons:** grammar-song generator. Data = `TOPICS{}` + `GENRES{}`.

Design language ("le cahier fluo"): Séyès-grid substrate, red margin, highlighter swipe
on key words, neomorphic panels, Fraunces / Inter / Space Mono, lime/cyan/rose tool
accents. **This is the look the unified portal should keep.**

### B. Flashcard / pretest engine (main-machine folder)
A **routed framework app**. Observed surface:

- Content as JSON per lesson, e.g. `u3-l2-city-preps.json`; pretest items carry
  `sentenceBefore` + `answer` + `sentenceAfter` and a denormalized `fullSentence`
  (used for full-sentence TTS; falls back to assembling the three parts).
- Structure: **Unit → Lesson**; each lesson can have a pretest, a vocab deck, games.
- Routes: `/games/*` (weather, letris, matching, gapfill) and proposed deck-bound
  `/decks/[id]/letris`, `/decks/[id]/matching`.
- Deck-open MCQ button now routes to a runner.

**Recommendation:** the routed app becomes the **portal base** (it has routing, a real
content pipeline, and the richer game set). FluoLingo contributes (1) the **design
system** and (2) its **three activities** ported to be data-driven.

---

## 2. Shared content model (single source of truth)

One schema under `/content`, consumed by every activity. Sketch (TS-ish):

```ts
Unit    { id, title, order, lessonIds: string[] }

Lesson  { id, unitId, title, order,
          pretestId?: string,
          deckId?: string,
          readerId?: string,
          activities: ActivityRef[] }      // which activities are wired for this lesson

Pretest { id, lessonId, title, items: PretestItem[] }
PretestItem {
  id, topic,
  sentenceBefore, answer, sentenceAfter,   // canonical parts
  fullSentence,                            // denormalized for TTS; derivable from parts
  options: string[], correctIndex,
  why                                      // explanation shown after answering
}

Deck    { id, lessonId?, title, scope: "curated" | "user" | "world-cities",
          cards: Card[] }
Card    { id, fr, en, ipa?, pos?, example?, fullSentence? }

Reader  { id, lessonId?, title, level, blocks: ReaderBlock[] }
ReaderBlock { text, glosses: Gloss[] }
Gloss   { surface, en, ipa }

Song    { topicKey, title, chorus, lines: string[] }   // + a GENRES table
```

Notes:
- `fullSentence` stays the **denormalized convenience field** the flashcard session
  already standardized on — keep the "assemble from parts if missing" fallback so older
  content never breaks.
- FluoLingo's `QUESTIONS[]` maps onto `PretestItem` (split `q` into
  before/answer/after, keep `why`).
- FluoLingo's reader and `TOPICS`/`GENRES` become `Reader` and `Song` records — no more
  data baked into JS.

---

## 3. Activity types (one registry)

Treat every learning surface as an **activity** bound to a lesson and/or deck:

| Activity        | Source        | Bind to   |
|-----------------|---------------|-----------|
| `pretest-mcq`   | both          | lesson    |
| `flashcards`    | engine        | deck      |
| `deck-mcq`      | engine        | deck      |
| `letris`        | engine        | deck      |
| `matching`      | engine        | deck      |
| `gapfill`       | engine        | deck (needs items with `example`) |
| `weather`       | engine        | (special) |
| `reader`        | FluoLingo     | lesson/reader |
| `song`          | FluoLingo     | global / topic |

A single `ACTIVITIES` registry (id, label, fluo accent color, route builder, which
content it needs) drives nav, the lesson hub, and routing — so adding an activity is one
entry, not scattered edits.

---

## 4. Route map

```
/                              Portal home — unit/lesson grid (fluo hero)
/unit/[u]/lesson/[l]           Lesson hub — pretest + deck + activities available
/lesson/[id]/pretest           Pretest MCQ runner
/decks/[id]                    Deck overview
/decks/[id]/flashcards
/decks/[id]/mcq
/decks/[id]/letris
/decks/[id]/matching
/decks/[id]/gapfill
/read/[id]                     Glossed reader  (FluoLingo Lecture)
/songs                         Grammar song generator (FluoLingo Chansons)
/games/*                       LEGACY → 301/redirect to /decks/[id]/<game>
```

The deck-bound game routes are the flashcard session's "#2 refactor." Do that **with the
redirects in place** so existing `/games/*` links keep working.

---

## 5. Portal shell & design system

- Extract fluo tokens (colors, Séyès grid, fonts, highlighter, neomorphic panel,
  dark-mode toggle) into a shared stylesheet / token file consumed app-wide.
- One **shell**: top bar (brand + unit nav), the cahier substrate, footer.
- Every activity renders **inside** the shell, picking up its fluo accent from the
  `ACTIVITIES` registry.
- Reuse FluoLingo's existing MCQ markup/interaction (`renderQuestion` / `choose`) as the
  `pretest-mcq` component, now reading from `Pretest` JSON instead of `QUESTIONS[]`.

---

## 6. Migration path (ordered, low-risk first)

1. **Lock the schema** above and create `/content` as the single source of truth.
2. **Batch-migrate the 9 remaining pretests** into the schema (the session's #3 — safe,
   mechanical, do this first/unattended).
3. **Port FluoLingo's 3 datasets** out of `app.js` into schema JSON
   (`QUESTIONS`→Pretest, reader text→Reader, `TOPICS`/`GENRES`→Song).
4. **Stand up the portal shell** with the fluo tokens + unit/lesson home + lesson hub.
5. **Wire activities** to the shared content via the registry.
6. **Deck-bind the game routes** (`/decks/[id]/letris` …) with `/games/*` redirects.
7. **Repaint games in fluo** last (cosmetic; the session's #4).

Steps 1–3 are content/foundation and safe to run while away. Steps 4 and 6 are the real
structural work — review the plan before those touch existing URLs.

---

## 7. Open questions (for Dan)

1. **Framework:** confirm the engine's stack (Next / SvelteKit / other) so routes and the
   shell are written idiomatically.
2. **Repo layout:** does the unified portal live in the engine's repo, in `dckg/how`, or
   a fresh repo? (Affects where the ported FluoLingo assets land.)
3. **Decks vs lessons:** should every lesson always expose a vocab deck, or can a lesson
   be pretest-only (as `u3-l2-city-preps` currently is)?
4. **Auth/analytics:** the older french2 work had Firebase + Plausible + Formspree —
   carry those into the unified portal or drop them?
5. **World-cities deck** (Mexico/Québec, the session's #5): seed now, or wait for the
   importer?
```
