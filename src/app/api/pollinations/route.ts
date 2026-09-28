import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Pollinations.ai proxy.
 *
 * Two endpoints:
 *   POST /api/pollinations/chat  → OpenAI-compatible chat completions
 *   GET  /api/pollinations/models → list available text models
 *
 * API key resolution (same pattern as /api/gemini):
 *   1. User-supplied key from request body / header (x-client-key)
 *   2. Server-side baked-in POLLINATIONS_API_KEY (optional)
 *   3. Anonymous tier (no auth header sent at all)
 *
 * Pollinations allows anonymous requests, so the route always works even
 * without any key. Authenticated requests unlock more models.
 */

const POLLINATIONS_BASE = 'https://text.pollinations.ai';
const POLLINATIONS_OPENAI = `${POLLINATIONS_BASE}/openai`;

function resolveKey(clientKey: string | undefined): string {
  const ck = (clientKey || '').trim();
  if (ck) return ck;
  return (process.env.POLLINATIONS_API_KEY || '').trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const apiKey = resolveKey(clientKey);

    // Separate body: drop our internal `apiKey` field before forwarding.
    const { apiKey: _ignored, model: requestedModel, ...restBody } = body ?? {};
    const model = typeof requestedModel === 'string' && requestedModel.trim()
      ? requestedModel.trim()
      : 'openai-fast';

    const makeRequest = (modelName: string) => fetch(
      `${POLLINATIONS_OPENAI}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ ...restBody, model: modelName, stream: false }),
        cache: 'no-store',
        signal: request.signal,
      },
    );

    let response = await makeRequest(model);

    // Pollinations sometimes 404s for specific deprecated model names.
    // Retry once with the universal fallback that always works on anonymous tier.
    if (response.status === 404 && model !== 'openai-fast') {
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
    if (inputs.length && !inputs.includes('text')) return false;
    if (outputs.length && !outputs.includes('text')) return false;
    // Hide image/video/audio-only models from the chat picker.
    if (outputs.length && outputs.length > 0 && !outputs.includes('text')) return false;
    return true;
  });

  return NextResponse.json(
    { object: 'list', data: filtered, models: filtered },
    { status: 200 },
  );
}
