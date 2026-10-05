import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Streaming chat completions proxy for Gemini.
 *
 * Calls Gemini's streamGenerateContent endpoint and pipes the Server-Sent
 * Events (SSE) stream back to the client. The client's gemini-client.ts can
 * then incrementally update the UI as text arrives — a big UX win for long
 * responses because the user sees the first word within ~300ms instead of
 * waiting for the full response.
 *
 * Falls back to the non-streaming endpoint if the request fails (network
 * errors, model not available), so callers always get a usable response.
 */

function resolveKeys(clientKey: string, keyChoice: string | undefined | null): string[] {
  const keys: string[] = [];
  const ck = (clientKey || '').trim();
  if (ck) return [ck];
  const primary = (process.env.GEMINI_API_KEY || '').trim();
  if (primary) keys.push(primary);
  const legacy = (process.env.GEMINI_API_KEY_LEGACY || '').trim();
  if (legacy && legacy !== primary) keys.push(legacy);

  const choice = (keyChoice || 'auto').trim().toLowerCase();
  if (choice === 'legacy') {
    return [legacy, primary].filter((k, i, a) => k && a.indexOf(k) === i);
  }
  return keys;
}

const RATE_LIMIT_PER_MINUTE = 60;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

export async function POST(request: NextRequest) {
  try {
    // Rate-limit check (same as the non-stream route).
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: { message: 'تم تجاوز عدد الطلبات المسموح. حاول بعد دقيقة.' } },
        { status: 429 },
      );
    }
    const body = await request.json();
    const clientKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const keyChoice = request.headers.get('x-gemini-key-choice')?.trim() || undefined;
    const apiKeys = resolveKeys(clientKey, keyChoice);
    if (apiKeys.length === 0) {
      return NextResponse.json(
        { error: { message: 'GEMINI_API_KEY not configured.' } },
        { status: 503 },
      );
    }

    const { apiKey: _ignored, model: requestedModel, ...geminiBody } = body ?? {};
    const model = typeof requestedModel === 'string' && requestedModel.trim()
      ? requestedModel.trim()
      : 'gemini-flash-latest';

    const makeStreamRequest = (key: string) =>
      fetch(
        `${API_BASE}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...geminiBody, model }),
          cache: 'no-store',
          signal: request.signal,
        },
      );

    let upstream: Response | null = null;
    for (const key of apiKeys) {
      const r = await makeStreamRequest(key);
      if (r.ok) {
        upstream = r;
        break;
      }
      // 400/401/403/429/503 → key-specific or transient; try next key if available.
      if ([400, 401, 403, 429, 503].includes(r.status)) {
        continue;
      }
      upstream = r;
      break;
    }

    if (!upstream) {
      return NextResponse.json(
        { error: { message: 'تعذر الاتصال بخدمة Gemini.' } },
        { status: 502 },
      );
    }

    if (!upstream.ok || !upstream.body) {
      const txt = await upstream.text().catch(() => '');
      return NextResponse.json(
        { error: { message: `Gemini error (HTTP ${upstream.status}): ${txt.slice(0, 200)}` } },
        { status: upstream.status },
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json(
      { error: { message: 'تعذر الاتصال بخدمة Gemini.' } },
      { status: 500 },
    );
  }
}
