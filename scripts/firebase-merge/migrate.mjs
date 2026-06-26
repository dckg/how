// ============================================================================
// Merge reviser users (f1fluolingo) INTO the pretest project (laf1201),
// matched by email. Idempotent: safe to re-run.
//
// What it does, per user that exists in the SOURCE (f1fluolingo) Auth:
//   1. Look up the same email in the TARGET (laf1201) Auth.
//        - found    -> use that uid
//        - not found-> create the user in laf1201 Auth (email + profile),
//                      so they keep a stable identity and sign in with Google.
//   2. Copy the reviser's per-user data onto users/{targetUid} in laf1201:
//        - top-level fields: xp, answered, correct, best, progress, nick,
//          name, email, photo  (written under a `reviser`-safe merge so they
//          do NOT overwrite the pretest's own fields)
//        - the users/{uid}/sessions subcollection (reviser round telemetry)
//   3. Records a migration marker so re-runs skip already-merged users.
//
// It does NOT touch the pretest's data (state/xp, skills, runs, attempts,
// leaderboard). XP stays in each app's own location — combining the two into
// a single number is a separate, deliberate step (see README "Stage 2").
//
// Usage:
//   npm install firebase-admin
//   SRC_SA=./f1fluolingo-service-account.json \
//   DST_SA=./laf1201-service-account.json \
//   node migrate.mjs            # dry run: prints what it WOULD do
//   node migrate.mjs --apply    # actually writes
//
// Generate the two service-account JSON keys in:
//   Firebase console -> Project settings -> Service accounts -> Generate new private key
// ============================================================================

import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.argv.includes('--apply');
const SRC_SA = process.env.SRC_SA;
const DST_SA = process.env.DST_SA;

if (!SRC_SA || !DST_SA) {
  console.error('Set SRC_SA (f1fluolingo key) and DST_SA (laf1201 key) env vars.');
  process.exit(1);
}

const srcCred = JSON.parse(readFileSync(SRC_SA, 'utf8'));
const dstCred = JSON.parse(readFileSync(DST_SA, 'utf8'));

const srcApp = initializeApp({ credential: cert(srcCred) }, 'src');
const dstApp = initializeApp({ credential: cert(dstCred) }, 'dst');

const srcAuth = getAuth(srcApp),   dstAuth = getAuth(dstApp);
const srcDb   = getFirestore(srcApp), dstDb = getFirestore(dstApp);

// Fields from the reviser's users/{uid} doc that we carry over.
const REVISER_FIELDS = ['xp', 'answered', 'correct', 'best', 'progress', 'nick', 'name', 'photo'];

const log = (...a) => console.log(APPLY ? '[apply]' : '[dry] ', ...a);

async function* allSourceUsers() {
  let pageToken;
  do {
    const res = await srcAuth.listUsers(1000, pageToken);
    for (const u of res.users) yield u;
    pageToken = res.pageToken;
  } while (pageToken);
}

async function resolveTargetUid(email, srcUser) {
  try {
    const existing = await dstAuth.getUserByEmail(email);
    return existing.uid;
  } catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    if (!APPLY) return '(would-create)';
    const created = await dstAuth.createUser({
      email,
      emailVerified: true,
      displayName: srcUser.displayName || undefined,
      photoURL: srcUser.photoURL || undefined,
    });
    return created.uid;
  }
}

async function copySessions(srcUid, dstUid) {
  const snap = await srcDb.collection('users').doc(srcUid).collection('sessions').get();
  if (snap.empty) return 0;
  if (!APPLY) return snap.size;
  let n = 0;
  // Deterministic IDs so re-runs don't duplicate.
  for (const d of snap.docs) {
    await dstDb.collection('users').doc(dstUid)
      .collection('sessions').doc('rev_' + d.id).set(d.data(), { merge: true });
    n++;
  }
  return n;
}

async function main() {
  let seen = 0, migrated = 0, skipped = 0, noEmail = 0, errors = 0;

  for await (const u of allSourceUsers()) {
    seen++;
    const email = (u.email || '').toLowerCase().trim();
    if (!email) { noEmail++; log('skip (no email)', u.uid); continue; }

    try {
      const srcDoc = await srcDb.collection('users').doc(u.uid).get();
      const src = srcDoc.exists ? srcDoc.data() : {};

      const dstUid = await resolveTargetUid(email, u);

      // Idempotency: skip if we've already merged this source uid.
      if (APPLY) {
        const marker = await dstDb.collection('users').doc(dstUid).get();
        const prev = marker.exists ? marker.data() : {};
        if (prev._mergedFrom && prev._mergedFrom[u.uid]) { skipped++; continue; }
      }

      const payload = { email };
      for (const f of REVISER_FIELDS) if (src[f] !== undefined) payload[f] = src[f];
      if (APPLY) {
        payload._mergedFrom = { [u.uid]: Date.now() };
        await dstDb.collection('users').doc(dstUid).set(payload, { merge: true });
      }
      const sCount = await copySessions(u.uid, dstUid);

      migrated++;
      log(`merge ${email}  src=${u.uid} -> dst=${dstUid}  xp=${src.xp || 0}  sessions=${sCount}`);
    } catch (e) {
      errors++;
      console.error('ERROR for', email, '-', e.code || e.message);
    }
  }

  console.log('\n=== summary ===');
  console.log({ seen, migrated, skipped, noEmail, errors, applied: APPLY });
  if (!APPLY) console.log('Dry run only. Re-run with --apply to write.');
}

main().then(() => process.exit(0));
