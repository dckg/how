# Merge f1fluolingo (reviser) → laf1201 (pretest)

Consolidates both apps onto the **laf1201** Firebase project, matching users by
email. The reviser's code is already repointed to laf1201 (in
`french-1/reviser/index.html`); this migrates the existing reviser user data.

## Why both apps can share one project

They write to different paths under `users/{uid}`, so they don't collide:

| Path | Owner |
|---|---|
| `users/{uid}` doc fields: `xp`, `progress`, `answered`, `correct`, `best`, `nick` | reviser |
| `users/{uid}/sessions` | reviser |
| `users/{uid}/state/xp`, `/skills`, `/runs`, `/attempts` | pretest |
| `leaderboard/{uid}` | pretest |

Once both use laf1201, the same Google account = the same `uid` in both apps.

## Run order (important)

1. **Update laf1201 Firestore rules** (below) — otherwise the reviser's writes
   are *silently denied* (it swallows errors), and progress won't save.
2. **Authorized domains** — in laf1201 → Authentication → Settings, confirm
   `fluolingo.com` is listed (it already is, since the pretest runs there).
3. **Generate service-account keys** for *both* projects:
   Firebase console → Project settings → Service accounts → Generate new private key.
4. **Dry run, then apply** the migration (see below).
5. **Merge this branch** so the repointed reviser goes live.
6. **First-party auth** — add a single custom domain (e.g. `auth.fluolingo.com`)
   to laf1201 Hosting and set `authDomain` to it in *both* configs. One subdomain
   now covers both apps (the whole point of merging).

## Migrate

```bash
cd scripts/firebase-merge
npm install firebase-admin
SRC_SA=./f1fluolingo-service-account.json \
DST_SA=./laf1201-service-account.json \
node migrate.mjs            # dry run — prints what it would do
# review output, then:
SRC_SA=./f1fluolingo-service-account.json \
DST_SA=./laf1201-service-account.json \
node migrate.mjs --apply
```

The script is idempotent (records `_mergedFrom` and skips re-merges) and never
touches the pretest's own data.

> Keep the `*-service-account.json` keys OUT of git. They are full admin
> credentials. Add them to `.gitignore` or run from outside the repo.

## Firestore rules to allow the reviser's paths on laf1201

Merge these into laf1201's existing rules (don't drop the pretest's rules):

```
match /users/{uid} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
  match /sessions/{doc} {
    allow read, write: if request.auth != null && request.auth.uid == uid;
  }
}
```

## Stage 2 — unified XP / one leaderboard (separate task)

This merge unifies **identity** (one user pool). It does **not** yet combine the
two XP numbers: the reviser tracks `users/{uid}.xp`; the pretest tracks
`users/{uid}/state/xp.totalXP` and the `leaderboard/{uid}` board. Combining them
into one total + one leaderboard is a deliberate follow-up (decide the rule —
sum, or weight each app — and have both apps write/read the shared total).
