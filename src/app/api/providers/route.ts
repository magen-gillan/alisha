import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 20;
const requests = new Map<string, { count: number; resetAt: number }>();

function getIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

export async function GET(request: NextRequest) {
  const ip = getIp(request);
  const now = Date.now();
  const entry = requests.get(ip);
  if (entry && entry.resetAt > now && entry.count >= LIMIT_PER_WINDOW) {
    return NextResponse.json({ error: { message: 'تم تجاوز عدد فحوص المزودين. حاول بعد دقيقة.' } }, { status: 429 });
  }
  if (!entry || entry.resetAt <= now) requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;

  const providerId = request.nextUrl.searchParams.get('provider') || undefined;
  const force = request.nextUrl.searchParams.get('refresh') === '1';
  const { listProviderStatuses } = await import('@/lib/alisha/llm-router');
  const providers = await listProviderStatuses({ providerId, force });

  // The response contains only public catalog/status fields; secret values never leave the server.
  return NextResponse.json({ providers }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
}
