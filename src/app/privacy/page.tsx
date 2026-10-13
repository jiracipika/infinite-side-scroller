import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashverse Privacy Policy',
  description: 'How the Dashverse app handles (and does not handle) your data.',
};

// Store-required privacy policy — both Google Play and the App Store need a
// public URL for this, which after deploy is:
//   https://infinite-side-scroller.vercel.app/privacy
// Contact address = the one already published on avolab.ca (contact + privacy pages).

const CONTACT_EMAIL = 'hello@avolab.ca';

export default function PrivacyPage() {
  return (
    <main style={{ background: '#060814', color: '#e8e4f2', minHeight: '100vh', padding: '48px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.7 }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>Dashverse Privacy Policy</h1>
        <p style={{ color: '#b9a5e3', marginBottom: 28 }}>Last updated: October 13, 2026</p>

        <p>
          <strong>
            Short version: Dashverse never sells your data, has no ads, no analytics, and no
            accounts. The only data that ever leaves your device is what you choose to submit to
            the online leaderboards or use to join an online race — a nickname, an avatar pick,
            and your run scores.
          </strong>
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>What the app stores</h2>
        <p>
          Your runs, coins, upgrades, and settings are saved <em>only on your device</em> in the
          app&apos;s local storage. They never leave your device unless you use the app&apos;s
          Share button, which sends run details you choose to share through your own apps.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>What we collect</h2>
        <p>
          Offline play — the default — sends nothing anywhere: the game runs entirely on your
          device. Data only leaves your device when you use an online feature:
        </p>
        <ul style={{ paddingLeft: 20 }}>
          <li>
            <strong>Online leaderboards:</strong> when you submit a score we store the nickname
            you typed, your avatar choice, and the run&apos;s score, distance, coins, and combo.
            Submitting a score with a leaderboard rank can also attach a replay of that run&apos;s
            movement path so other players can race your ghost — replays contain only movement
            coordinates, never account or device data.
          </li>
          <li>
            <strong>Online races (Same-Wi-Fi / room codes):</strong> our server briefly relays
            the room code and connection handshake needed to link the players; gameplay itself
            then flows directly between the players&apos; devices.
          </li>
        </ul>
        <p>
          There are no accounts, no advertising, no analytics, no third-party tracking SDKs, and
          we do not sell or share this data with anyone. To stop spam and abuse, the server
          briefly keeps visitors&apos; IP addresses in memory purely for rate-limiting; they are
          not attached to leaderboard entries and are not persisted.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>Deleting your data</h2>
        <p>
          All single-player progress is local — uninstalling the app (or clearing its storage in
          your device settings) permanently deletes everything, and no server copy exists. To
          remove a leaderboard entry or a ghost replay, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#c7ff4d' }}>{CONTACT_EMAIL}</a>{' '}
          with the nickname used and we will delete it.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>The web version</h2>
        <p>
          The browser version of Dashverse at this site works the same way: single-player saves
          live in your browser&apos;s local storage on your device, and the same online
          leaderboard and race features apply. This static site does not set tracking cookies and
          does not use analytics on game pages.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>Children</h2>
        <p>
          The game has no chat, no ads, and no purchases of real money. The only user-generated
          content is the optional leaderboard nickname, which is length-limited and filtered.
          Parents control app installs through their store account&apos;s parental settings.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>Contact</h2>
        <p>
          Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#c7ff4d' }}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </main>
  );
}
