# Alisha

<p align="center">
  <img src="public/alisha-new-icon.png" alt="Alisha" width="160" height="160" />
</p>

<p align="center"><strong>أفاتار تفاعلي يعمل مع Gemini AI أو Pollinations.ai وLive2D</strong></p>

Alisha واجهة محادثة تفاعلية تدعم الكتابة والصوت، وتستجيب باللغة التي يحددها المستخدم. يعمل التطبيق على Next.js ويُنشَر على Vercel، مع إبقاء المفاتيح الخادمية داخل متغيرات بيئية وعدم تضمينها في JavaScript العام.

## المزايا

- **مزودان مدعومان** للنصوص:
  - **Gemini** (افتراضي) — نماذج Google Gemini عبر `/api/gemini`
  - **Pollinations.ai** — مزود مجاني بمفتاح اختياري عبر `/api/pollinations`
- محادثة نصية وصوتية (TTS عبر Web Speech API في المتصفح، يعمل مع كلا المزودين).
- دعم العربية والإنجليزية واليابانية مع مزامنة لغة الرد مع لغة الصوت.
- أفاتار Live2D مع تحريك تدريجي للفم أثناء النطق ورمش طبيعي للعينين.
- صورة احتياطية للأفاتار عند تعذر تحميل runtime الخاص بـ Live2D.
- أربع خلفيات مرئية متناسقة مع الأفاتار.
- لوحة إعدادات متجاوبة مع زر واضح لحفظ التغييرات.
- عرض النماذج النصية المتاحة للمفتاح المستخدم فقط.
- إعادة المحاولة تلقائيًا عند ازدحام نموذج Gemini أو وصول رد فارغ.

## التشغيل المحلي

```bash
bun install        # أو: pnpm install
bunx prisma generate
bun run dev        # أو: pnpm run dev
```

افتح بعدها `http://localhost:3000` في المتصفح.

## متغيرات البيئة

أضف ما يلي في Vercel أو في ملف `.env.local` للتطوير المحلي:

```env
# مطلوب للمزود الافتراضي (Gemini)
GEMINI_API_KEY=your-server-side-gemini-key

# اختياري — Pollinations يعمل بدون مفتاح (طبقة مجهولة)، لكن وجوده يفتح نماذج إضافية
POLLINATIONS_API_KEY=your-pollinations-key
```

لا تستخدم اسمًا يبدأ بـ `NEXT_PUBLIC_` لهذه المفاتيح. التطبيق يمرر الطلبات عبر `/api/gemini` و `/api/pollinations` حتى لا تظهر المفاتيح في الواجهة.

## أوامر التحقق

```bash
bunx tsc --noEmit
bun run lint
bun run build
```

## النشر

الموقع الإنتاجي متاح على [alisha-puce.vercel.app](https://alisha-puce.vercel.app).

## ملاحظات الأمان

- اترك حقل مفتاح Gemini فارغًا في لوحة الإعدادات لاستخدام المفتاح الخادمي المشفّر في Vercel.
- اترك حقل مفتاح Pollinations فارغًا لاستخدام الطبقة المجهولة (anonymous tier).
- إدخال مفتاح في أي حقل يحفظ المفتاح محلياً في متصفح المستخدم فقط ويتجاوز المفتاح الخادمي.

## التقنية

Next.js، React، TypeScript، Tailwind CSS، Zustand، PixiJS، pixi-live2d-display، Web Speech API، Gemini API، Pollinations.ai API.

## الشخصية الجديدة

أضيفت شخصية Alisha الجديدة المولدة من الصفر إلى `public/alisha-new-avatar.webp`، وتُستخدم كأيقونة وصورة احتياطية عند تعذر تحميل Live2D. يبقى نموذج Live2D الحالي هو المسار المتحرك الأساسي؛ تحويل الشخصية الجديدة إلى نموذج Live2D كامل يتطلب فصل طبقات الوجه والشعر والعينين والفم ثم rigging وتصدير ملفات Cubism.

## التشخيص والإيقاف

تحتوي لوحة الإعدادات على:
- قسم **مزود الذكاء الاصطناعي** لاختيار Gemini أو Pollinations.
- زر **اختبار** للتحقق من اتصال المزود المختار.
- زر لإيقاف الرد النصي أثناء التفكير.

ويضمن `bun run test:smoke` (أو `pnpm run test:smoke`) فحص الأصول الأساسية ومسار Gemini بعد النشر.
