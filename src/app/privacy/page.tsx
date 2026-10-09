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
        <p style={{ color: '#b9a5e3', marginBottom: 28 }}>Last updated: October 7, 2026</p>

        <p><strong>Short version: Dashverse does not collect, share, or sell any of your personal data.</strong></p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>What the app stores</h2>
        <p>
          Your runs, coins, upgrades, and settings are saved <em>only on your device</em> in the
          app&apos;s local storage. They never leave your device unless you use the app&apos;s
          Share button, which sends run details you choose to share through your own apps.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>What we collect</h2>
        <p>
          Nothing. The mobile app has no accounts, no analytics, no advertising, and no
          third-party tracking SDKs. It makes no network requests during normal play — the game
          runs entirely on your device.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>Deleting your data</h2>
        <p>
          All progress is local. Uninstalling the app (or clearing its storage in your device
          settings) permanently deletes everything. No server copy exists to request removal of.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>The web version</h2>
        <p>
          The browser version of Dashverse at this site works the same way: game saves live in
          your browser&apos;s local storage on your device. This static site does not set tracking
          cookies and does not use analytics on game pages.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>Online leaderboards (beta roadmap)</h2>
        <p>
          Online leaderboards are announced in-app as &quot;coming soon&quot;. If and when they
          launch, only a player-chosen nickname and submitted scores would leave your device, this
          policy would be updated before that happens, and the store listings would be updated to
          match.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>Children</h2>
        <p>
          The app contains no chat, no user-generated content, and no data collection, so it is
          safe for all ages in that respect. Parents control app installs through their store
          account&apos;s parental settings.
        </p>

        <h2 style={{ fontSize: 20, marginTop: 28 }}>Contact</h2>
        <p>
          Questions about this policy: <a href={`mailto:${CONTACT_EMAIL}`} style={{ color: '#c7ff4d' }}>{CONTACT_EMAIL}</a>
        </p>
      </div>
    </main>
  );
}
