# اليشيا — Alisha

<p align="center">
  <img src="public/alisha-icon.png" alt="أيقونة اليشيا" width="160" height="160" />
</p>

<p align="center"><strong>أفاتار تفاعلي يعمل مع Gemini AI وLive2D</strong></p>

اليشيا واجهة محادثة تفاعلية تدعم الكتابة والصوت، وتستجيب باللغة التي يحددها المستخدم. يعمل التطبيق على Next.js ويُنشَر على Vercel، مع إبقاء مفتاح Gemini داخل متغير بيئي خادمي وعدم تضمينه في JavaScript العام.

## المزايا

- محادثة نصية وصوتية مع Gemini AI.
- دعم العربية والإنجليزية واليابانية مع مزامنة لغة الرد مع لغة الصوت.
- أفاتار Live2D مع تحريك تدريجي للفم أثناء النطق ورمش طبيعي للعينين.
- صورة احتياطية للأفاتار عند تعذر تحميل runtime الخاص بـ Live2D.
- أربع خلفيات مرئية متناسقة مع الأفاتار.
- لوحة إعدادات متجاوبة مع زر واضح لحفظ التغييرات.
- عرض النماذج النصية المتاحة للمفتاح المستخدم فقط.
- إعادة المحاولة تلقائيًا عند ازدحام نموذج Gemini أو وصول رد فارغ.

## التشغيل المحلي

```bash
pnpm install
pnpm exec prisma generate
pnpm run dev
```

افتح بعدها `http://localhost:3000` في المتصفح.

## متغيرات البيئة

أضف المتغير التالي في Vercel أو في ملف `.env.local` للتطوير المحلي:

```env
GEMINI_API_KEY=your-server-side-gemini-key
```

لا تستخدم اسمًا يبدأ بـ `NEXT_PUBLIC_` لهذا المفتاح. التطبيق يمرر طلبات Gemini عبر `/api/gemini` حتى لا يظهر المفتاح في الواجهة.

## أوامر التحقق

```bash
pnpm exec tsc --noEmit
pnpm run lint
pnpm run build
```

## النشر

الموقع الإنتاجي متاح على [alisha-puce.vercel.app](https://alisha-puce.vercel.app). يمكن نشر نسخة جديدة باستخدام:

```bash
pnpm dlx vercel@latest deploy --prod
```

## ملاحظات الأمان

اترك حقل مفتاح Gemini في لوحة الإعدادات فارغًا لاستخدام المفتاح الخادمي المشفّر في Vercel. إدخال مفتاح في الحقل يحفظ مفتاحًا مخصصًا لهذا المتصفح فقط ويجعله يتجاوز مفتاح Vercel لهذا المستخدم.

## التقنية

Next.js، React، TypeScript، Tailwind CSS، Zustand، PixiJS، pixi-live2d-display، Web Speech API، وGemini API.
