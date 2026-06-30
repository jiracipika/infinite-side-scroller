# Dashverse

Cross-platform endless side-scrolling dash adventure with:

- Web game (Next.js) for desktop + mobile browsers
- Nearby multiplayer (same Wi-Fi rooms)
- Local split-screen mode
- 3-slot save system per device
- Coin bank + shop upgrades (10 unlocks)
- Local leaderboard

## Web (Desktop + Mobile Browser)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Mobile App (Expo, iOS + Android)

```bash
npm run mobile:dev
```

Or platform-specific:

```bash
npm run mobile:ios
npm run mobile:android
npm run mobile:web
```

## Save Slots + Shop

From the main menu:

1. Open `Saves + Shop`
2. Pick one of 3 save slots
3. Use coins earned from runs to buy upgrades
4. Use `Continue` to resume from the last autosaved checkpoint in that slot

Progression is stored locally on-device.

## Build and verification

```bash
npm run typecheck
npm run lint
npm run build
npm run start
```

Production builds do not suppress TypeScript or ESLint errors; run the explicit checks before pushing.

## Multiplayer Deployment

Cloud multiplayer requires shared Redis/KV storage. Without it, serverless
instances cannot see rooms or WebRTC signaling created by another device.

Attach an Upstash Redis or Vercel Marketplace Redis database and expose either
of these environment-variable pairs to Production and Preview:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

or:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

After deployment, verify the backend at:

```text
/api/multiplayer/room?health=1
```

Reliable cross-device rooms report `"storeMode":"redis"` and
`"sharedStorage":true`.
