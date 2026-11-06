const base = (process.env.SMOKE_BASE_URL || 'https://alisha-puce.vercel.app').replace(/\/$/, '');

async function check(path, expected = 200) {
  const response = await fetch(`${base}${path}`);
  if (response.status !== expected) throw new Error(`${path}: expected ${expected}, got ${response.status}`);
  return response;
}

await check('/');
await check('/alisha-new-icon.png');
await check('/avatar-studio', 404);
for (const file of ['kei-gallery.webp', 'jane-gallery.webp', 'ganyu-gallery.webp', 'miara-gallery.webp']) {
  await check(`/live2d/thumbnails/${file}`);
}
for (const file of ['aurora.webp', 'sakura.webp', 'moonlit.webp', 'cloudroom.webp']) {
  await check(`/backgrounds/${file}`);
}

// Verify the active unified chat route without sending a paid/user-authenticated
// model request. Pollinations is intentionally available in anonymous mode.
const listing = await (await check('/api/chat')).json();
if (!Array.isArray(listing.models) || !listing.models.some((model) => model.provider === 'Pollinations')) {
  throw new Error(`Expected the anonymous Pollinations route in /api/chat, got ${listing.models?.length ?? 0} model(s)`);
}
const statusData = await (await check('/api/providers')).json();
if (!Array.isArray(statusData.providers)) throw new Error('Expected a provider status list from /api/providers');
for (const provider of statusData.providers) {
  if (!Array.isArray(provider.models)
    || !Number.isInteger(provider.verifiedKeyCount)
    || 'apiKeys' in provider || 'apiKeyNames' in provider || 'key' in provider || 'apiKey' in provider) {
    throw new Error(`Unsafe or malformed provider response: ${provider.id}`);
  }
  if (provider.status === 'no-tested-models' && provider.models.length > 0) {
    throw new Error(`Provider ${provider.id} exposes models despite a no-tested-models status`);
  }
}
for (const model of listing.models) {
  const provider = statusData.providers.find((candidate) => candidate.id === model.providerId);
  if (!provider?.models.some((candidate) => candidate.id === model.id)) {
    throw new Error(`Unverified chat model exposed in /api/chat: ${model.providerId}/${model.id}`);
  }
}
console.log(`Smoke check passed for ${base}: ${listing.models.length} chat model(s), ${statusData.providers.length} safe provider status(es)`);
