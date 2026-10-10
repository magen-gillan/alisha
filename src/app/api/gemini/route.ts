import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Lightweight in-memory rate limiter.
 *
 * Each unique visitor (identified by client IP) is capped at
 * RATE_LIMIT_PER_MINUTE requests. Once exceeded, the API responds with 429
 * until the window slides. This protects the server-side API key from being
 * abused by a single user flooding the endpoint.
 *
 * Note: this is per-instance state, so it resets on cold start. Acceptable
 * for a hobby deployment; for production we'd want Upstash Redis.
 */
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_MAP_MAX_SIZE = 1000; // prevent unbounded growth
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    // Periodic cleanup: remove expired entries to prevent unbounded growth
    if (rateLimitMap.size > RATE_LIMIT_MAP_MAX_SIZE) {
      for (const [key, val] of rateLimitMap) {
        if (val.resetAt < now) rateLimitMap.delete(key);
      }
    }
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

function getClientIp(request: NextRequest): string {
  // Vercel sets x-forwarded-for; x-real-ip is also commonly set.
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

/**
 * Resolve the API keys to use, in priority order.
 *
 * Order of precedence:
 *   1. Client-supplied key (user's own key from the settings UI)
 *   2. Server-side keys, ordered by the user's `keyChoice` setting:
 *      - `auto` / `primary`: GEMINI_API_KEY → GEMINI_API_KEY_LEGACY
 *      - `legacy`           : GEMINI_API_KEY_LEGACY → GEMINI_API_KEY
 *
 * Both keys coexist on Vercel so we can fall back if the primary ever fails
 * (quota exhaustion, key rotation, transient auth errors, etc).
 */
function resolveKeys(clientKey: string | undefined | null, keyChoice: string | undefined | null): string[] {
  const keys: string[] = [];
  const ck = (clientKey || '').trim();
  if (ck) {
    // Client key always wins; no need to also try the server fallbacks.
    return [ck];
  }
  const primary = (process.env.GEMINI_API_KEY || '').trim();
  const legacy = (process.env.GEMINI_API_KEY_LEGACY || '').trim();

  // Normalize the choice.
  const choice = (keyChoice || 'auto').trim().toLowerCase();
  const preferLegacy = choice === 'legacy';

  if (preferLegacy) {
    if (legacy) keys.push(legacy);
    if (primary && primary !== legacy) keys.push(primary);
  } else {
    // 'auto' or 'primary' → start with the primary (new) key.
    if (primary) keys.push(primary);
    if (legacy && legacy !== primary) keys.push(legacy);
  }
  return keys;
}

export async function POST(request: NextRequest) {
  try {
    // Rate-limit check (protects the server-side API key from abuse).
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
        { error: { message: 'لم تتم إضافة GEMINI_API_KEY في إعدادات Vercel بعد.' } },
        { status: 503 },
      );
    }

    const { apiKey: _ignored, model: requestedModel, ...geminiBody } = body ?? {};
    const model = typeof requestedModel === 'string' && requestedModel.trim()
      ? requestedModel.trim()
      : 'gemini-flash-latest';

    /**
     * Try a single Gemini request against the given key.
     * Returns the response (caller reads .json() once).
     */
    const makeRequest = (modelName: string, key: string) => fetch(
      `${API_BASE}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        cache: 'no-store',
        signal: request.signal,
      },
    );

    /** Errors that justify trying the next API key in the fallback chain. */
    const isKeySpecificError = (status: number, data: any): boolean => {
      // 400 / 401 / 403 = auth, permission, or unsupported-location errors.
      // 429 = rate limited on this key (trying the next one may help).
      // 503 = transient Gemini backend error; the legacy key might be served
      //       by a different backend, so it's worth trying too.
      if (status === 400 || status === 401 || status === 403 || status === 429 || status === 503) return true;
      // Gemini sometimes returns 200 with an "API_KEY_SERVICE_BLOCKED" style error.
      const msg: string = String(data?.error?.message || '').toLowerCase();
      if (msg.includes('api_key_service_blocked')) return true;
      if (msg.includes('user location is not supported')) return true;
      return false;
    };

    let response: Response | null = null;
    let data: any = null;
    let lastKeyUsed = '';

    for (let i = 0; i < apiKeys.length; i++) {
      const key = apiKeys[i];
      lastKeyUsed = key;
      response = await makeRequest(model, key);
      data = await response.json();

      // Success path — but verify the response actually has text content.
      if (response.ok) {
        const hasText = data?.candidates?.some((candidate: any) =>
          candidate?.content?.parts?.some((part: any) =>
            typeof part?.text === 'string' && part.text.trim(),
          ),
        );
        if (hasText) {
          return NextResponse.json(data, { status: response.status });
        }
        // Empty 200 — try gemini-flash-lite-latest alias before giving up.
        if (model !== 'gemini-flash-lite-latest') {
          const retry = await makeRequest('gemini-flash-lite-latest', key);
          data = await retry.json();
          response = retry;
          if (retry.ok) {
            const stillHasText = data?.candidates?.some((candidate: any) =>
              candidate?.content?.parts?.some((part: any) =>
                typeof part?.text === 'string' && part.text.trim(),
              ),
            );
            if (stillHasText) {
              return NextResponse.json(data, { status: retry.status });
            }
          }
        }
        // Could not extract text from a 200 response; don't try the next key,
        // because the issue isn't authentication — return what we have.
        return NextResponse.json(data, { status: response.status });
      }

      // Failure: if it's a key-specific problem, try the next key.
      if (isKeySpecificError(response.status, data) && i < apiKeys.length - 1) {
        console.warn(
          `[gemini] Key #${i + 1} failed (HTTP ${response.status}); falling back to next key.`,
        );
        continue;
      }
      // Non-key-specific error (e.g. 503 from Gemini) — retry once with
      // gemini-flash-lite-latest before giving up.
      if (
        (response.status === 429 || response.status === 503) &&
        model !== 'gemini-flash-lite-latest'
      ) {
        const retry = await makeRequest('gemini-flash-lite-latest', key);
        data = await retry.json();
        response = retry;
      }
      return NextResponse.json(data, { status: response.status });
    }

    // Loop completed without returning — return whatever we last got.
    // Don't log any key material (even the suffix) to server logs.
    console.warn(`[gemini] All ${apiKeys.length} keys exhausted`);
    return NextResponse.json(
      data || { error: { message: 'تعذر الاتصال بخدمة Gemini.' } },
      { status: response?.status || 500 },
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json(
      { error: { message: 'تعذر الاتصال بخدمة Gemini.' } },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate-limit check.
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: { message: 'تم تجاوز عدد الطلبات المسموح. حاول بعد دقيقة.' } },
      { status: 429 },
    );
  }
  const clientKey = request.headers.get('x-client-key')?.trim();
  const keyChoice = request.headers.get('x-gemini-key-choice')?.trim() || undefined;
  const apiKeys = resolveKeys(clientKey, keyChoice);
  if (apiKeys.length === 0) {
    return NextResponse.json(
      { error: { message: 'لم تتم إضافة GEMINI_API_KEY في إعدادات Vercel بعد.' } },
      { status: 503 },
    );
  }

  let payload: any = null;
  let lastStatus = 0;
  for (const key of apiKeys) {
    const response = await fetch(
      `${API_BASE}/models?key=${encodeURIComponent(key)}&pageSize=200`,
      { cache: 'no-store' },
    );
    lastStatus = response.status;
    payload = await response.json();
    if (response.ok) break;
    // 400/401/403/429 → try the next key
    const msg: string = String(payload?.error?.message || '').toLowerCase();
    if (
      response.status === 400 ||
      response.status === 401 ||
      response.status === 403 ||
      response.status === 429 ||
      msg.includes('api_key_service_blocked') ||
      msg.includes('user location is not supported')
    ) {
      continue;
    }
    // Other error: stop and return what we have.
    return NextResponse.json(payload, { status: response.status });
  }

  if (!payload || lastStatus !== 200) {
    return NextResponse.json(
      payload || { error: { message: 'تعذر الاتصال بخدمة Gemini.' } },
      { status: lastStatus || 502 },
    );
  }

  // The upstream API lists every capability enabled for the key. The app is a
  // text-chat avatar, so expose only stable production chat aliases. This is
  // deliberately enforced server-side as well as in the client.
  const models = (payload.models ?? []).filter((item: any) => {
    const name = String(item.name ?? '').replace(/^models\//, '');
    const methods = Array.isArray(item.supportedGenerationMethods)
      ? item.supportedGenerationMethods
      : [];
    return name.startsWith('gemini-')
      && name.endsWith('-latest')
      && methods.includes('generateContent')
      && !/(image|preview|exp|experimental|vision|tts|audio|live|translate|robotics|computer)/i.test(name);
  });
  return NextResponse.json({ ...payload, models }, { status: 200 });
}
