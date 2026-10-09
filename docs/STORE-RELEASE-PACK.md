# Dashverse — Store Release Pack (copy/paste answers for every form)

Everything you will be asked in **Google Play Console** and **App Store
Connect**, pre-answered. Local working draft — nothing committed or pushed.
Review, then push once to make the privacy page live (both stores require
that URL), then paste away.

**Assets live in `apps/mobile/store-assets/`:**
- Android set: `play-icon-512.png`, `feature-graphic-1024x500.png`, `shot-1…6*.png` (1080×2400)
- iOS set: `ios/shot-1…6*.png` (1290×2796 — exact App Store 6.9″/6.7″ slot size)
- Upload AAB: `/Volumes/ADATA/mobile-setup/build-farm/dashverse-store-uploads/dashverse-1.0.0(1)-2026-10-07.aab`

---

## 1. GOOGLE PLAY CONSOLE

### Create app
| Field | Answer |
|---|---|
| App name | `Dashverse` |
| Default language | English (United States) |
| App or game | Game |
| Free or paid | Free |

### Store listing
| Field | Answer |
|---|---|
| App name (30 max) | `Dashverse` (9) |
| Short description (80 max) | `Endless side-scroll dash — bank coins, keep the flow, beat your best.` (70) |
| Full description (4000 max) | see §4 below |
| App icon | `play-icon-512.png` (512×512 PNG) |
| Feature graphic (1024×500 required) | `feature-graphic-1024x500.png` |
| Phone screenshots (min 2) | `shot-1-menu`, `shot-2-gameplay`, `shot-3-run-start`, `shot-4-pause`, `shot-5-stats`, `shot-6-settings` (all 1080×2400 PNG) |
| 7″/10″ tablet screenshots | optional — skip for beta |
| Video (optional) | skip for beta |

### App content → Privacy policy
- URL: `https://infinite-side-scroller.vercel.app/privacy`
- ⚠️ Page is drafted at `src/app/privacy/page.tsx` but **not deployed** — it goes
  live on the next push. Do this first; both stores ask for the URL.

### App content → Ads
- **No, my app does not contain ads.**

### App content → App access
- **All functionality is available without restrictions** (no login, no gated areas).

### App content → Data safety
Every "does your app collect/share…" answer flows from one fact: **the app
collects nothing** (no accounts, no analytics, no ads, no trackers, no
network calls during play).

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | N/A (nothing collected — form accepts "No data" and skips this) |
| Do you provide a way for users to request that their data is deleted? | **Yes** (all data is on-device; uninstalling deletes it — say this in the notes) |

### App content → Target audience
| Question | Answer |
|---|---|
| Target age group | **13 and up** (avoid selecting under-13; choosing children triggers the Families policy which this beta doesn't need) |
| Could the app appeal to children? | No (style is dark/neon arcade) |

### App content → Content rating (IARC questionnaire)
| Question | Answer |
|---|---|
| Category | Game |
| Does the app contain violence? | **Yes — fantasy/cartoon violence only** (stylized character fights cartoon monsters; no blood, no gore, no realistic weapons harm) |
| Realistic violence? | No |
| Nudity/sexual content? | No |
| Profanity/hate speech? | No |
| Drugs/alcohol/tobacco? | No |
| Gambling (real money or simulated)? | No |
| Does the app share your location? | No |
| Users can interact/UGC (chat, user images)? | No |
| Digital purchases (IAP)? | No |
| Expected outcome: **Everyone 10+ (ESRB) / PEGI 7** — auto-computed, takes minutes |

### App content → News / COVID / Government / Financial / Health / VPN
All **No** (not a news app, no COVID info, not a government app, no financial
features, no health claims, no VPN).

### App release setup
| Field | Answer |
|---|---|
| Countries/regions | All (or your pick) |
| Release track | **Internal testing** (up to 100 testers, no review) — Closed testing when ready for more |
| App bundle | the staged AAB (versionCode 1) |
| What's new text | `First beta release — endless dash runs, coins and shop upgrades, character roster, offline saves.` |

**First-upload note:** Play will enroll the app in **Play App Signing** using
our upload key automatically — accept the defaults. The upload key is the
farm keystore (`CN=dashverse`); **back up `/Volumes/ADATA/mobile-setup/build-farm/keys/`**
— losing it after enrollment complicates every future update.

---

## 2. APP STORE CONNECT (iOS)

Prereqs you own: Apple Developer Program enrollment → then on this Mac:
`npm i -g eas-cli && eas login` → `cd apps/mobile && eas init` (fills the
null `projectId` in app.json) → `eas build -p ios --profile production` →
`eas submit -p ios --latest`. EAS registers certs/bundle ID on first run.

### New app in App Store Connect
| Field | Answer |
|---|---|
| Name (30 max) | `Dashverse` (9) |
| Primary language | English (U.S.) |
| Bundle ID | `com.dashverse.app` (registered by EAS) |
| SKU | `dashverse` |
| Access | Full |

### App Information
| Field | Answer |
|---|---|
| Subtitle (30 max) | `Run. Collect. Compete.` (22) |
| Privacy policy URL | `https://infinite-side-scroller.vercel.app/privacy` (⚠️ deploy first) |
| Support URL (required) | `https://infinite-side-scroller.vercel.app` (site root for beta; a dedicated /support page can come later) |
| Marketing URL (optional) | same as support |
| Category | Games → **Arcade** (secondary: Casual) |
| Copyright | © 2026 Marcel Sabas ← *confirm exact legal name* |

### Pricing and Availability
- Price: **Free**. Availability: all countries (default 175).

### App Privacy ("privacy nutrition labels")
| Question | Answer |
|---|---|
| Do you or your third-party partners collect data from this app? | **No** |
That's the whole flow — no labels to declare. (Matches Play Data safety: no
accounts, analytics, ads, or trackers; saves are on-device only.)

### Age rating questionnaire
| Question | Answer |
|---|---|
| Cartoon or fantasy violence | **Mild** |
| Every other category | None |
| Expected outcome: **9+** |
| (Unrestricted web access: No · Gambling: No) |

### Version page (1.0.0)
| Field | Answer |
|---|---|
| Promotional text (170 max) | `Dash through neon skylines, bank coins, and beat your best run. One-thumb controls, offline saves, and a shop full of permanent upgrades.` (139) |
| Description (4000 max) | see §4 below |
| Keywords (100 max) | `endless runner,arcade,dash,side scroller,retro,neon,offline,jump,one thumb,free` (80) |
| Screenshots — 6.9″ (or 6.7″) required slot | `ios/shot-1-menu` … `shot-6-settings` (6 shots, exactly 1290×2796) |
| Build | select after `eas submit` finishes processing |
| TestFlight | Internal group (up to 100, instant) · External group needs a short **Beta App Review** (~1 day, no IAP/ads = smooth) |

### Export compliance
- App uses only standard HTTPS (via OS) and **no proprietary encryption** →
  answer **No** to "uses encryption beyond exempt" → no export paperwork.

---

## 3. App Store review-avoidance notes (beta)

- No account required to play — reviewers can exercise everything immediately.
- "Online leaderboard — Coming soon" is shown honestly in-app; do **not**
  ship dead UI claims anywhere in the listing (the copy below complies).
- Offline game that requests no permissions = no privacy manifest headaches;
  EAS-generated builds include the default privacy manifest.

---

## 4. Descriptions (rule-compliant, honest)

### Full description — paste into BOTH stores (4000 max, 1,031 used)

> Dashverse is an endless side-scrolling dash adventure. One-thumb control:
> move, jump, and dash as the world speeds up and the obstacles get meaner.
>
> THE RUN
> • Endless side-scrolling dashes through neon skylines and shifting biomes
> • Autosaving checkpoints — continue from where you died, not from zero
> • Hearts, shields and power-ups keep runs alive
> • Every run recorded: distance, coins, combo, defeats
>
> PROGRESSION THAT STICKS
> • Bank coins from every run
> • Shop with 11 permanent upgrades — build the run you want
> • Character roster to unlock, each with its own look
> • 3 save slots per device
>
> COMPETE
> • Personal best tracking with your strongest run saved on device
> • Ghost of your best run as the bar to beat
> • Beat-the-board stats: distance, coins, best combo
>
> BUILT FOR YOUR PHONE
> • One-thumb friendly touch controls (left/right + jump + dash)
> • Works offline — play on the subway, on a plane, anywhere
> • Tune audio, particles, and touch-control size in Settings
> • Small, fast, no account, no ads, no tracking
>
> BETA NOTES
> This is the Dashverse mobile beta. Online leaderboards and multiplayer are
> on the roadmap — the beta focuses on the core run loop. Progress saves on
> your device. Found something broken? Tell us and we'll fix it in the next
> build.

**Rules it follows:** no store-name mentions, no "beta/test" boilerplate
violations, no pricing/platform claims, no ALL-CAPS spam beyond section
headers, no keyword stuffing, nothing that requires a feature the binary
doesn't ship (checked against the app: coins, 11 upgrades, roster, 3 slots,
hearts/shields, Settings toggles, offline all exist; online leaderboard is
labeled "Coming soon" in the binary itself).

### Play short description (80 max) — 70 chars
`Endless side-scroll dash — bank coins, keep the flow, beat your best.`

### Apple subtitle (30 max) — 22 chars
`Run. Collect. Compete.`

### Apple keywords (100 max) — 80 chars, no duplicate words from name/subtitle
`endless runner,arcade,dash,side scroller,retro,neon,offline,jump,one thumb,free`

---

## 5. Review checklist (things only you can decide)

1. ☐ Push (when ready) so `…vercel.app/privacy` goes live — then paste that URL in both stores.
2. ☐ Replace `CONTACT_EMAIL` in `src/app/privacy/page.tsx` with your real support address before pushing.
3. ☐ Copyright line: confirm "© 2026 Marcel Sabas" (or company name) in App Store Connect.
4. ☐ Play Console developer profile: first-app setup walks you through the paid-apps/identity flow once.
5. ☐ Join Apple Developer Program ($99) → run the 4 EAS commands (docs/MOBILE-BETA.md §iOS).
6. ☐ Back up `/Volumes/ADATA/mobile-setup/build-farm/keys/` somewhere off-machine before the first Play upload.
