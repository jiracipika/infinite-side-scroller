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
          This page doesn&apos;t exist. But the adventure continues.
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
            transition: 'opacity 0.12s ease, transform 0.12s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.12s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.88';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(10,132,255,0.5)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
            (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 14px rgba(10,132,255,0.35)';
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
        >
          Play Again
        </Link>
      </div>
    </div>
  );
}
