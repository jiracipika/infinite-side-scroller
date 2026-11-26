'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';

type LinkPointerEvent = React.MouseEvent<HTMLAnchorElement>;

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 65% 0, var(--dv-raised), var(--dv-ink) 65%)' }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--dv-text)', marginBottom: 20 }}>
          <Icon name="skull" size={64} strokeWidth={1.75} />
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--dv-text)', marginBottom: 8 }}>
          Game Over
        </h1>
        <p style={{ fontSize: 15, color: 'var(--dv-muted)', lineHeight: 1.5, letterSpacing: '-0.23px', marginBottom: 24 }}>
          This page doesn&apos;t exist. But the adventure continues.
        </p>
        <Link
          href="/"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 50, borderRadius: 5, padding: '0 32px',
            background: 'var(--dv-action)',
            color: 'var(--dv-ink)', fontSize: 17, fontWeight: 700,
            boxShadow: '3px 4px #584372',
            textDecoration: 'none',
            transition: 'opacity 0.12s ease, transform 0.12s ease, box-shadow 0.12s ease',
          }}
          onMouseEnter={(e: LinkPointerEvent) => {
            e.currentTarget.style.background = '#d8ff83';
            e.currentTarget.style.boxShadow = '4px 5px #584372';
          }}
          onMouseLeave={(e: LinkPointerEvent) => {
            e.currentTarget.style.background = 'var(--dv-action)';
            e.currentTarget.style.boxShadow = '3px 4px #584372';
          }}
          onMouseDown={(e: LinkPointerEvent) => { e.currentTarget.style.boxShadow = '1px 2px #584372'; }}
          onMouseUp={(e: LinkPointerEvent) => { e.currentTarget.style.boxShadow = '4px 5px #584372'; }}
        >
          Play Again
        </Link>
      </div>
    </div>
  );
}
