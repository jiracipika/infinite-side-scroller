# Dashverse — Deploy Runbook (site + app stores)

Three lanes. Site deploys are automatic. Android updates are one command.
iOS goes through Codemagic cloud (manual start) — this Mac's Xcode 16.4 is
below the Expo SDK 55 floor (Xcode 26), so local iOS builds are not possible.

## Lane 1 — Website (automatic)

`git push` to `main` → Vercel builds and ships to
https://infinite-side-scroller.vercel.app (git-connected; the privacy page the
stores require lives at `/privacy`).

No action needed beyond the push. Verify after big changes:
`curl -s -o /dev/null -w "%{http_code}" https://infinite-side-scroller.vercel.app/`

## Lane 2 — Android (Google Play)

One command from the repo root:

```bash
bash scripts/release-mobile.sh          # bumps versionCode, builds signed AAB
```

Output: `/Volumes/ADATA/mobile-setup/build-farm/dashverse-store-uploads/dashverse-<code>-<date>.aab`
(farm-signed with `dashverse-release.jks`; game engine bundled and
`cmp`-verified against the WebView asset).

### First-time store setup (human clicks, ~10 min)

1. [Play Console](https://play.google.com/console) → **Create app** — name
   `Dashverse`, Game → Arcade, free. (Copy-paste listing answers:
   `docs/STORE-RELEASE-PACK.md` §1.)
2. Store listing: upload `apps/mobile/store-assets/play-icon-512.png`,
   `feature-graphic-1024x500.png`, and 4+ phone screenshots.
3. App content → Privacy policy: `https://infinite-side-scroller.vercel.app/privacy` (live).
4. **Testing → Closed testing** → create track → upload the AAB → testers.

### Play's testing requirement (new personal accounts)

New personal Play accounts must run a **closed test with 20 testers for 14
days** before production access is granted. Set up:

1. Closed testing track → "Testers" tab → create a **Google Group** (e.g.
   `dashverse-testers`) with the 20 tester accounts, or paste up to 100
   individual emails. Template list: `docs/testing/testers.txt`.
2. Copy the **opt-in link** and send it to every tester — each must opt in
   AND have the app installed to count toward the 20.
3. Start the countdown: it runs while ≥20 testers remain opted in.
4. After 14 days, apply for production access (Console asks a short
   production-access questionnaire).

The existing `google_play` service account (already driving repfinder's
uploads) can be granted access to the Dashverse app: Play Console → Users &
permissions → invite the same service-account email as Admin. Once granted,
Codemagic `release-both` uploads straight to the testing track.

### Fastest first path

Internal testing needs no 20-tester requirement: upload the AAB to **internal**
track, add a few emails, share the opt-in link, start playing today. The
closed-test clock matters only for production release.

## Lane 3 — iOS (App Store / TestFlight via Codemagic)

Local iOS builds are blocked (Xcode 16.4 < Expo 55's Xcode 26 floor). The
cloud lane is Codemagic `release-both` — manual start only, same proven flow
as repfinder (custom ASC signing recipe; managed signing block removed — it
fails when the team store lacks profiles for the bundle id).

One-time setup (human, ~15 min):

1. **App Store Connect** → Apps → **+** → New App: name `Dashverse`,
   bundle id `com.dashverse.app`, SKU `dashverse001`. (Bundle id registers
   automatically with the app entry.)
2. **Codemagic** → Applications → add application for
   `jiracipika/infinite-side-scroller` (the repo's `codemagic.yaml` is the
   workflow source).
3. Attach the account-level env groups to the new app: `app_store_connect`
   (ASC key + `DIST_CERT_PRIVATE_KEY`) and `google_play` — same groups
   repfinder uses; the Apple distribution cert is team-wide.
4. Android keystore: add env group `android_keystore_credentials` with the
   dashverse keystore values (or re-use the keystore-file pattern from
   `android_keystore_credentials`).
5. Start `release-both` from the Codemagic UI ("Start new build" → branch
   `main` → workflow `release-both`). It builds the signed AAB + IPA, uploads
   AAB → Play testing track, IPA → TestFlight. Each upload step self-skips
   with a clear log line if its env group is not attached yet.

Version discipline: every upload bumps `versionCode`/`buildNumber`
(`scripts/release-mobile.sh` does both; the Codemagic lane reads them from
`app.json`).

## What already shipped

- Privacy policy live: `https://infinite-side-scroller.vercel.app/privacy`
- Signed AAB v2 (versionCode 2, full painted roster + ink-style unlock):
  `dashverse-store-uploads/dashverse-1.0.0(2)-2026-10-13.aab`
- Store listing art: `apps/mobile/store-assets/` (Play + iOS sets)
- Release pack (all form answers): `docs/STORE-RELEASE-PACK.md`
