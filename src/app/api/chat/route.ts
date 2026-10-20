import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Unified chat API — replaces /api/gemini and /api/pollinations.
 *
 * Uses the LLM router to try multiple providers with automatic failover.
 * API keys are sent from the client (stored in localStorage) or from
 * server-side env vars (for Gemini).
 */

const RATE_LIMIT_PER_MINUTE = 60;
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

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    if (isRateLimited(clientIp)) {
      return NextResponse.json(
        { error: { message: 'تم تجاوز عدد الطلبات المسموح. حاول بعد دقيقة.' } },
        { status: 429 },
      );
    }

    const body = await request.json();
    const messages = body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: { message: 'messages array is required.' } },
        { status: 400 },
      );
    }

    // Collect provider keys from the request body
    // The client sends keys from localStorage
    const userKeys: Record<string, string> = {};
    if (body.providerKeys && typeof body.providerKeys === 'object') {
      for (const [id, key] of Object.entries(body.providerKeys)) {
        if (typeof key === 'string' && key.trim()) {
          userKeys[id] = key.trim();
        }
      }
    }

    // Build provider list
    const { buildProviderList, routeChat } = await import('@/lib/alisha/llm-router');
    const providers = buildProviderList(userKeys);

    if (providers.length === 0) {
      return NextResponse.json(
        { error: { message: 'No providers available. Add API keys in settings.' } },
        { status: 503 },
      );
    }

    const result = await routeChat(
      {
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        })),
        model: body.model,
        temperature: body.temperature,
        max_tokens: body.max_tokens,
      },
      providers,
      request.signal,
    );

    return NextResponse.json({
      choices: [{
        message: { role: 'assistant', content: result.text },
        finish_reason: 'stop',
      }],
      model: result.model,
      provider: result.provider,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json(
      { error: { message: error?.message || 'Chat request failed.' } },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const clientIp = getClientIp(request);
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: { message: 'Rate limited.' } },
      { status: 429 },
    );
  }

  const { buildProviderList, listAvailableModels } = await import('@/lib/alisha/llm-router');

  // Get keys from headers
  const userKeys: Record<string, string> = {};
  const keysHeader = request.headers.get('x-provider-keys');
  if (keysHeader) {
    try {
      const parsed = JSON.parse(keysHeader);
      for (const [id, key] of Object.entries(parsed)) {
        if (typeof key === 'string' && key.trim()) {
          userKeys[id] = key.trim();
        }
      }
    } catch {}
  }

  const providers = buildProviderList(userKeys);
  const models = listAvailableModels(providers);

  return NextResponse.json({
    object: 'list',
    data: models.map(m => ({
      id: m.id,
      provider: m.provider,
      name: m.name,
    })),
    models: models,
  });
}
