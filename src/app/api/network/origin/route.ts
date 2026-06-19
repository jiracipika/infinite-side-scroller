import { NextRequest, NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function json(data: unknown, init?: number | ResponseInit): NextResponse {
  const response = NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function isPrivateIPv4(address: string): boolean {
  return (
    /^10\./.test(address)
    || /^192\.168\./.test(address)
    || /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function getLanIPv4Addresses(): string[] {
  const found = new Set<string>();
  const nets = networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4') continue;
      if (entry.internal) continue;
      if (!isPrivateIPv4(entry.address)) continue;
      found.add(entry.address);
    }
  }
  return [...found];
}

export async function GET(request: NextRequest) {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto = forwardedProto || request.nextUrl.protocol.replace(':', '') || 'http';
  const host = request.headers.get('host') || request.nextUrl.host;
  const port = host.includes(':') ? host.split(':').pop() : '';
  const lanHosts = getLanIPv4Addresses();
  const lanOrigins = lanHosts.map((addr) => `${proto}://${addr}${port ? `:${port}` : ''}`);

  return json({
    origin: `${proto}://${host}`,
    lanOrigins,
    preferredOrigin: lanOrigins[0] ?? `${proto}://${host}`,
  });
}
