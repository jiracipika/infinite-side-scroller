'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#000' }}>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>💀</div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: '#EBEBF5', marginBottom: 8 }}>
          Game Over
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(235,235,245,0.55)', lineHeight: 1.5, letterSpacing: '-0.23px', marginBottom: 24 }}>
          This page doesn't exist. But the adventure continues.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 50, borderRadius: 14, padding: '0 32px',
            background: 'linear-gradient(135deg, #0A84FF 0%, #0055D4 100%)',
            color: '#fff', fontSize: 17, fontWeight: 600,
            boxShadow: '0 4px 14px rgba(10,132,255,0.35)',
            textDecoration: 'none',
          }}
        >
          Play Again
        </Link>
      </div>
    </div>
  );
}
