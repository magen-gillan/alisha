import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Pollinations.ai proxy.
 *
 * Two endpoints:
 *   POST /api/pollinations/ → OpenAI-compatible chat completions
 *   GET  /api/pollinations/ → list available text models
 *
 * API key resolution (same pattern as /api/gemini):
 *   1. User-supplied key from request body / header (x-client-key)
 *   2. Server-side baked-in POLLINATIONS_API_KEY (optional)
 *   3. Anonymous tier (no auth header sent at all)
 *
 * Rate limiting: per-IP cap to protect the server-side key from abuse.
 * Body validation: only a whitelist of fields is forwarded to Pollinations.
 */

const POLLINATIONS_BASE = 'https://text.pollinations.ai';
const POLLINATIONS_OPENAI = `${POLLINATIONS_BASE}/openai`;

const RATE_LIMIT_PER_MINUTE = 60;
const MAX_BODY_SIZE_BYTES = 32 * 1024; // 32 KB
const MAX_INPUT_CHARS = 8000;

const RATE_LIMIT_MAP_MAX_SIZE = 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
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
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip')?.trim() ||
    'unknown'
  );
}

function resolveKey(clientKey: string | undefined): string {
  const ck = (clientKey || '').trim();
  if (ck) return ck;
  return (process.env.POLLINATIONS_API_KEY || '').trim();
}

/**
 * Whitelisted fields allowed in the client request body. Anything else
 * (including our internal `apiKey` field) is dropped before forwarding
 * to Pollinations. This prevents parameter injection attacks.
 */
const ALLOWED_BODY_FIELDS = new Set([
  'model',
  'messages',
  'temperature',
  'top_p',
  'top_k',
  'max_tokens',
  'frequency_penalty',
  'presence_penalty',
  'seed',
  'n',
  'stop',
]);

/**
 * Validate and sanitize the incoming chat body.
 * Returns { ok, sanitized, error }.
 */
function sanitizeBody(body: any): {
  ok: boolean;
  sanitized?: Record<string, unknown>;
  error?: string;
} {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid body.' };
  }

  // Pick only allowed fields.
  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (ALLOWED_BODY_FIELDS.has(key)) {
      sanitized[key] = body[key];
    }
  }

  // Validate messages shape.
  const messages = sanitized.messages;
  if (Array.isArray(messages)) {
    if (messages.length === 0) {
      return { ok: false, error: 'messages must not be empty.' };
    }
    if (messages.length > 50) {
      return { ok: false, error: 'Too many messages (max 50).' };
    }
    // Cap total content length to prevent abuse.
    let totalChars = 0;
    for (const m of messages) {
      if (!m || typeof m !== 'object') continue;
      const content = typeof m.content === 'string' ? m.content : '';
      totalChars += content.length;
      if (totalChars > MAX_INPUT_CHARS * 4) {
        return { ok: false, error: 'Conversation too long. Please start a new chat.' };
      }
    }
  }

  // Clamp numeric fields.
  if (sanitized.temperature != null) {
    const t = Number(sanitized.temperature);
    if (!Number.isFinite(t)) delete sanitized.temperature;
    else sanitized.temperature = Math.max(0, Math.min(2, t));
  }
  if (sanitized.max_tokens != null) {
    const mt = Number(sanitized.max_tokens);
    if (!Number.isFinite(mt)) delete sanitized.max_tokens;
    else sanitized.max_tokens = Math.max(1, Math.min(2048, Math.floor(mt)));
  }

  return { ok: true, sanitized };
}

export async function POST(request: NextRequest) {
  try {
    // Rate-limit check.
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: { message: 'تم تجاوز عدد الطلبات المسموح. حاول بعد دقيقة.' } },
        { status: 429 },
      );
    }

    // Body size guard (Vercel's runtime reads the body before our code runs,
    // but we can still reject requests that obviously exceed our limit by
    // reading Content-Length).
    const contentLength = Number(request.headers.get('content-length') || '0');
    if (contentLength > MAX_BODY_SIZE_BYTES) {
      return NextResponse.json(
        { error: { message: 'Request body too large.' } },
        { status: 413 },
      );
    }

    const rawBody = await request.json();
    const clientKey = typeof rawBody?.apiKey === 'string' ? rawBody.apiKey.trim() : '';
    const apiKey = resolveKey(clientKey);

    const sanitized = sanitizeBody(rawBody);
    if (!sanitized.ok) {
      return NextResponse.json(
        { error: { message: sanitized.error || 'Invalid request body.' } },
        { status: 400 },
      );
    }
    const safeBody = sanitized.sanitized!;

    const requestedModel = typeof safeBody.model === 'string' && safeBody.model.trim()
      ? safeBody.model.trim()
      : 'openai-fast';

    const makeRequest = (modelName: string) =>
      fetch(`${POLLINATIONS_OPENAI}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ ...safeBody, model: modelName, stream: false }),
        cache: 'no-store',
        signal: request.signal,
      });

    let response = await makeRequest(requestedModel);

    // Pollinations sometimes 404s for specific deprecated model names.
    // Retry once with the universal fallback that always works on anonymous tier.
    if (response.status === 404 && requestedModel !== 'openai-fast') {
      response = await makeRequest('openai-fast');
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json(
      { error: { message: 'تعذر الاتصال بخدمة Pollinations.' } },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Rate-limit check (model listing is cheaper, but still protect).
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: { message: 'تم تجاوز عدد الطلبات المسموح. حاول بعد دقيقة.' } },
      { status: 429 },
    );
  }

  const clientKey = request.headers.get('x-client-key')?.trim();
  const apiKey = resolveKey(clientKey);

  // Pollinations exposes the model list at /openai/models (OpenAI-compatible)
  // or /models (legacy). Try OpenAI shape first; fall back to legacy.
  const tryEndpoints = [
    `${POLLINATIONS_OPENAI}/models`,
    `${POLLINATIONS_BASE}/models`,
  ];

  let payload: any = null;
  let status = 200;
  for (const url of tryEndpoints) {
    try {
      const r = await fetch(url, {
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        cache: 'no-store',
      });
      if (!r.ok) {
        status = r.status;
        continue;
      }
      payload = await r.json();
      status = 200;
      break;
    } catch {
      continue;
    }
  }

  if (!payload) {
    return NextResponse.json(
      { error: { message: `Failed to fetch Pollinations models (HTTP ${status}).` } },
      { status: status || 502 },
    );
  }

  // Normalize: support both shapes
  //   OpenAI:  { object: "list", data: [{ id, ... }] }
  //   Legacy:  [ { name, ... }, ... ]
  let models: any[] = [];
  if (Array.isArray(payload)) {
    models = payload;
  } else if (Array.isArray(payload?.data)) {
    models = payload.data.map((m: any) => ({ ...m, name: m.name || m.id }));
  } else if (Array.isArray(payload?.models)) {
    models = payload.models;
  }

  // Keep only text-capable models.
  const filtered = models.filter((m: any) => {
    const name = String(m?.name || m?.id || '').trim();
    if (!name) return false;
    const inputs = Array.isArray(m?.input_modalities) ? m.input_modalities : [];
    const outputs = Array.isArray(m?.output_modalities) ? m.output_modalities : [];
    if (inputs.length > 0 && !inputs.includes('text')) return false;
    if (outputs.length > 0 && !outputs.includes('text')) return false;
    return true;
  });

  return NextResponse.json(
    { object: 'list', data: filtered, models: filtered },
    { status: 200 },
  );
}
