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

    const { apiKey: _ignored, ...geminiBody } = body ?? {};
    const model = typeof geminiBody.model === 'string' && geminiBody.model.trim()
      ? geminiBody.model.trim()
      : 'gemini-flash-latest';
    const response = await fetch(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      cache: 'no-store',
      signal: request.signal,
    });
    const data = await response.json();
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
  return NextResponse.json(await response.json(), { status: response.status });
}
