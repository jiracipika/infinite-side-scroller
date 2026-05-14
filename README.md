# Infinite Side Scroller

Cross-platform endless side scroller with:

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

## Build

```bash
npm run build
npm run start
```

