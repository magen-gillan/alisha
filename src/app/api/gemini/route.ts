import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const clientKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const apiKey = clientKey || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: { message: 'لم تتم إضافة GEMINI_API_KEY في إعدادات Vercel بعد.' } }, { status: 503 });
    }

    const { apiKey: _ignored, model: requestedModel, ...geminiBody } = body ?? {};
    const model = typeof requestedModel === 'string' && requestedModel.trim()
      ? requestedModel.trim()
      : 'gemini-flash-latest';
    const makeRequest = (modelName: string) => fetch(
      `${API_BASE}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
        cache: 'no-store',
        signal: request.signal,
      },
    );
    let response = await makeRequest(model);
    // Gemini may temporarily reject a busy model. Retry once with the stable
    // Flash Lite alias returned by the same account, without hiding other errors.
    if ((response.status === 429 || response.status === 503) && model !== 'gemini-flash-lite-latest') {
      response = await makeRequest('gemini-flash-lite-latest');
    }
    let data = await response.json();
    const hasText = data?.candidates?.some((candidate: any) =>
      candidate?.content?.parts?.some((part: any) => typeof part?.text === 'string' && part.text.trim()),
    );
    if (response.ok && !hasText && model !== 'gemini-flash-lite-latest') {
      const retry = await makeRequest('gemini-flash-lite-latest');
      data = await retry.json();
      response = retry;
    }
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 499 });
    }
    return NextResponse.json({ error: { message: 'تعذر الاتصال بخدمة Gemini.' } }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const clientKey = request.headers.get('x-client-key')?.trim();
  const apiKey = clientKey || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: { message: 'لم تتم إضافة GEMINI_API_KEY في إعدادات Vercel بعد.' } }, { status: 503 });
  const response = await fetch(`${API_BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) return NextResponse.json(payload, { status: response.status });

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
  return NextResponse.json({ ...payload, models }, { status: response.status });
}
