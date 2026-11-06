import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const RATE_LIMIT_PER_MINUTE = 8;
const RATE_LIMIT_MAP_MAX_SIZE = 1000;
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    if (rateLimitMap.size > RATE_LIMIT_MAP_MAX_SIZE) {
      for (const [key, value] of rateLimitMap) if (value.resetAt < now) rateLimitMap.delete(key);
    }
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_PER_MINUTE;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(request: NextRequest) {
  try {
    if (isRateLimited(getClientIp(request))) {
      return errorResponse('تم تجاوز عدد الطلبات المسموح. حاول بعد دقيقة.', 429);
    }

    const body = await request.json();
    const rawMessages = body?.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 30) {
      return errorResponse('يجب إرسال سجل محادثة صالح.', 400);
    }

    const messages = rawMessages.map((message: any) => ({
      role: message?.role,
      content: message?.content,
    }));
    const validRoles = new Set(['system', 'user', 'assistant']);
    if (messages.some((message: any) => !validRoles.has(message.role) || typeof message.content !== 'string')) {
      return errorResponse('صيغة الرسائل غير صالحة.', 400);
    }
    if (messages.reduce((sum: number, message: any) => sum + message.content.length, 0) > 16_000) {
      return errorResponse('حجم المحادثة أكبر من الحد المسموح.', 413);
    }

    const providerId = typeof body.providerId === 'string' ? body.providerId : '';
    const requestedModel = typeof body.model === 'string' ? body.model : '';
    if (!providerId) return errorResponse('اختر مزودًا من الإعدادات أولًا.', 400);

    const { getSelectedProvider, listProviderStatuses, routeChat } = await import('@/lib/alisha/llm-router');
    const providerStatus = (await listProviderStatuses({ providerId }))[0];
    if (!providerStatus || !['valid', 'partial', 'available'].includes(providerStatus.status)) {
      return errorResponse('المزود غير متاح حاليًا. افحص حالة المفتاح أو اختر مزودًا آخر.', 503);
    }

    const model = requestedModel || providerStatus.models[0]?.id;
    if (!model) return errorResponse('لا توجد نماذج دردشة متاحة لهذا المزود.', 503);
    const provider = await getSelectedProvider(providerId, model);
    if (!provider) return errorResponse('النموذج المحدد غير موجود في قائمة هذا المزود.', 400);

    const result = await routeChat(
      {
        messages,
        providerId,
        model,
        temperature: typeof body.temperature === 'number' ? Math.min(Math.max(body.temperature, 0), 1.5) : 0.7,
        max_tokens: typeof body.max_tokens === 'number' ? Math.min(Math.max(body.max_tokens, 1), 1200) : 700,
      },
      [provider],
      request.signal,
    );

    return NextResponse.json({
      choices: [{ message: { role: 'assistant', content: result.text }, finish_reason: 'stop' }],
      model: result.model,
      provider: result.provider,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') return new NextResponse(null, { status: 499 });
    // Do not return provider response bodies or credential-related details.
    return errorResponse(error?.message || 'تعذر إكمال طلب المحادثة.', 502);
  }
}

export async function GET(request: NextRequest) {
  if (isRateLimited(getClientIp(request))) return errorResponse('تم تجاوز عدد الطلبات. حاول لاحقًا.', 429);
  const providerId = request.nextUrl.searchParams.get('provider') || undefined;
  const force = request.nextUrl.searchParams.get('refresh') === '1';
  const { listProviderStatuses } = await import('@/lib/alisha/llm-router');
  const providers = await listProviderStatuses({ providerId, force });
  const models = providers.flatMap((provider) => provider.models.map((model) => ({
    id: model.id,
    provider: provider.name,
    providerId: provider.id,
    name: model.name,
  })));
  return NextResponse.json({ object: 'list', providers, data: models, models }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}
