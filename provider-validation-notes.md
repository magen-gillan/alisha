# نتائج اختبار مفاتيح وموديلات Alisha

وقت الاختبار: 6 نوفمبر 2026. أُرسلت طلبات دردشة فعلية لكل موديل مرشح من كتالوج المفتاح المعني. لا يحتوي هذا الملف أو التطبيق على قيم المفاتيح أو نصوص أخطاء المزودين. **النموذج لا يظهر في Alisha إلا إذا نجح طلب الدردشة نفسه**.

| المزود / خانة المفتاح | اختُبر | اجتاز | لم يجتز | مؤقت/غير محسوم | الحالة |
|---|---:|---:|---:|---:|---|
| Google Gemini · `GEMINI_API_KEY_2` | 47 | 7 | 25 | 15 | صالح — 7 موديلات flash مجتازة |
| OpenAI · `OPENAI_API_KEY` | 50 | 0 | 50 | 0 | صالح لكن بلا رصيد (insufficient_quota) |
| OpenRouter · `OPENROUTER_API_KEY` | 414 | 0 | 414 | 0 | مفتاح إدارة (management key — غير مؤهل للدردشة) |
| OpenRouter · `OPENROUTER_API_KEY_2` | 414 | 213 | 196 | 5 | صالح — رصيد متبقٍ ~$99.85 USD |
| Hugging Face · `HUGGINGFACE_API_KEY` | 126 | 0 | 126 | 0 | صالح لكن يتطلب اشتراك PRO أو رصيد مسبق الدفع (402) |
| Z.ai / GLM · `ZAI_API_KEY` | 12 | 0 | 12 | 0 | صالح لكن بلا رصيد كافٍ (1113) |
| Pollinations · بلا مفتاح | 5 | 2 | 3 | 0 | متاح مجاناً (`openai-fast`, `openai`) |

الموديلات التي اجتازت الاختبار فقط موجودة في `src/lib/alisha/verified-models.json`. القائمة الحالية تشمل:
- **7 موديلات Google Gemini**: `gemini-3-flash-preview`، `gemini-3.1-flash-lite`، `gemini-3.1-flash-lite-preview`، `gemini-3.5-flash`، `gemini-3.5-flash-lite`، `gemini-3.6-flash`، `gemini-flash-lite-latest`. (الموديلات القديمة `gemini-2.5-*` ألغيت، و`gemini-3.7/3.8-flash` تحت ضغط طلب عالي مؤقت 503).
- **213 موديلاً لـ OpenRouter** تعمل مع `OPENROUTER_API_KEY_2`، من بينها GPT-4o و Claude 5 و DeepSeek و Grok و Mistral و Llama و Kimi.
- **2 موديل Pollinations**: `openai-fast` و `openai` (مجاني دون مفتاح).

بقيت المفاتيح الأخرى في إعدادات الخادم كما هي ولم تُحذف، وستعرض موديلاتها تلقائياً بمجرد شحن الرصيد وإعادة الاختبار.

المراجع الرسمية: [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)، [Gemini API reference](https://ai.google.dev/api)، [OpenRouter](https://openrouter.ai).
