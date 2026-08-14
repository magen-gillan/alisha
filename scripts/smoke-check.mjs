const base = (process.env.SMOKE_BASE_URL || 'https://alisha-puce.vercel.app').replace(/\/$/, '');

async function check(path, expected = 200) {
  const response = await fetch(`${base}${path}`);
  if (response.status !== expected) throw new Error(`${path}: expected ${expected}, got ${response.status}`);
  return response;
}

await check('/');
await check('/alisha-new-icon.png');
await check('/alisha-new-avatar.webp');
for (const file of ['aurora.webp', 'sakura.webp', 'moonlit.webp', 'cloudroom.webp']) {
  await check(`/backgrounds/${file}`);
}

const models = await (await check('/api/gemini')).json();
if (!Array.isArray(models.models) || models.models.length < 1) {
  throw new Error(`Expected at least one usable chat model, got ${models.models?.length ?? 0}`);
}
if (models.models.some((model) => !model.name.endsWith('-latest'))) {
  throw new Error('Model list contains a non-stable alias');
}

const response = await fetch(`${base}/api/gemini`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    model: 'gemini-flash-lite-latest',
    contents: [{ role: 'user', parts: [{ text: 'قل مرحباً باختصار' }] }],
    systemInstruction: { parts: [{ text: 'أجب بالعربية فقط وبجملة قصيرة.' }] },
    generationConfig: { temperature: 0.2, maxOutputTokens: 128 },
  }),
});
if (!response.ok) throw new Error(`/api/gemini POST: HTTP ${response.status}`);
const payload = await response.json();
const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
if (!text) throw new Error('Gemini returned an empty text response');
console.log(`Smoke check passed for ${base}: ${text}`);
