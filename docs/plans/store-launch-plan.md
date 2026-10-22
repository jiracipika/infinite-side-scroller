# Store Launch Plan (paused 2026-10-22)

Status: Android app **tested and working** on the emulator (gameplay, tabs, pause —
tab-bar bug fixed in commit `5d2b3b3`). CI lane pushed. Nothing has been uploaded
to either store. Resume from whichever section applies.

## Already done (no action needed)

| Piece | State |
|---|---|
| Tab-bar fix + regression test | committed `5d2b3b3`, on `main` |
| `codemagic.yaml` `android-testing` workflow | committed `674e401` + `ad7b3fc` — signed AAB → Play internal, self-skips upload if creds missing |
| CI versionCode | auto = `100 + BUILD_NUMBER` (never collides with farm builds v1–v3) |
| Trigger script | `scripts/trigger-codemagic-release.sh` (needs `CM_API_TOKEN`) |
| Signed AAB (local farm) | `/Volumes/ADATA/mobile-setup/build-farm/dashverse-store-uploads/dashverse-1.0.0(3)-2026-10-21.aab` (v3, jarsigner-verified) |
| Store assets | `apps/mobile/store-assets/` verified correct dims (Play + iOS 6.9″) |
| Privacy policy | LIVE: https://infinite-side-scroller.vercel.app/privacy |
| Data-safety truth | mobile binary is offline-only → "collects nothing" is accurate |

## Step 1 — Codemagic: add the app (UI, ~2 min)

1. codemagic.io → **Add application** → GitHub → `jiracipika/infinite-side-scroller`.
2. Project type: **"Other" / codemagic.yaml** (repo root yaml is detected; workflows: `android-debug`, `android-release`, `android-testing`, `ios-release`, `release-both`).
3. No repository connect changes needed — origin is already `https://github.com/jiracipika/infinite-side-scroller.git`.

## Step 2 — Codemagic: keystore (pick ONE path)

Values: file `/Volumes/ADATA/mobile-setup/build-farm/keys/dashverse-release.jks`,
alias + passwords in that folder's `secrets.csv` (chmod 600, never paste into chat/logs).

- **Path A (UI):** Code signing → Android → upload the .jks, name it exactly **`dashverse`**
  (the workflow's `android_signing: - dashverse` picks it up).
- **Path B (API, no file upload):** give a personal API token
  (Codemagic → Settings → Integrations → Personal API tokens; same token repfinder uses)
  and the keystore goes in as env group `android_keystore_credentials` via
  `POST /api/v3/apps/{app_id}/variable-groups` with `CM_KEYSTORE` (base64 of the .jks),
  `CM_KEYSTORE_PASSWORD`, `CM_KEY_ALIAS`, `CM_KEY_PASSWORD` — the workflow decodes it.
  Then rotate the token if it was pasted in chat.

## Step 3 — Play Console: create the app (UI, ~15 min)

All listing copy is ready in `docs/STORE-RELEASE-PACK.md` §4 (authoritative).

1. play.google.com/console → **Create app**:
   - Name: **Dashverse** (Play names are NOT globally unique — safe)
   - Default language: English (US) · **Game** · Free · No ads
2. Store listing: icon `play-icon-512.png`, feature `feature-graphic-1024x500.png`,
   screenshots `shot-1…6-*.png` (1080×2400), short description (69/80 chars) and
   full description from STORE-RELEASE-PACK §4.
   - Privacy policy: `https://infinite-side-scroller.vercel.app/privacy`
3. App content: data safety = **collects nothing** (verified truthful), content
   rating questionnaire (fantasy violence → expect Everyone 10+), target audience 13+,
   no ads, no IAP.
4. **Testing → Internal testing** → create track (do not upload yet if using CI).

## Step 4 — First internal release (pick ONE path)

- **CI path:** `CM_API_TOKEN=<token> scripts/trigger-codemagic-release.sh`
  (workflow `android-testing`; monitors until the AAB lands on the internal track).
  Requires Steps 1+2 done and the Play service account (repfinder's `google_play`
  env group — account-wide) to have release permission for the new app:
  check Play Console → Users and permissions → the service account should appear
  with account-level access; invite it if it only had app-level access on repfinder.
- **Manual path:** upload the staged v3 AAB in the internal testing track
  (Step 3.4), roll out to internal testers, share the opt-in link.

## Step 5 — iOS / TestFlight (later)

- Needs Apple Developer Program ($99/yr) + Expo account (`eas init`) — OR the
  `release-both` Codemagic workflow with the account-wide `app_store_connect`
  group (ASC keys already exist there from repfinder).
- `ITSAppUsesNonExemptEncryption=false` already in app.json.
- App Store name uniqueness is a real constraint (unlike Play) — decide
  "Dashverse" vs fallback then.

## Open decisions (blocked on user)

1. SKU: `dashverse` vs `dashverse001` (docs conflict; most say `dashverse`).
2. Copyright legal name "Marcel Sabas" — confirm.
3. Which Play lane for very first upload: CI or manual (Step 4).

## Known-broken / notes

- ZCode Computer Use service never starts on this Mac ("permission broker socket
  not accepting connections") — UI automation path unavailable; restart ZCode
  Desktop may fix it, unverified.
- `docs/MOBILE-BETA.md` has stale claims (versionCode 1, keywords, codemagic
  trigger behavior) — STORE-RELEASE-PACK §4 + this doc are authoritative.
