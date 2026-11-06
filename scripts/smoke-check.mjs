const base = (process.env.SMOKE_BASE_URL || 'https://alisha-puce.vercel.app').replace(/\/$/, '');

async function check(path, expected = 200) {
  const response = await fetch(`${base}${path}`);
  if (response.status !== expected) throw new Error(`${path}: expected ${expected}, got ${response.status}`);
  return response;
}

await check('/');
await check('/alisha-new-icon.png');
for (const file of ['aurora.webp', 'sakura.webp', 'moonlit.webp', 'cloudroom.webp']) {
  await check(`/backgrounds/${file}`);
}

// Verify the active unified chat route without sending a paid/user-authenticated
// model request. Pollinations is intentionally available in anonymous mode.
const listing = await (await check('/api/chat')).json();
if (!Array.isArray(listing.models) || !listing.models.some((model) => model.provider === 'Pollinations')) {
  throw new Error(`Expected the anonymous Pollinations route in /api/chat, got ${listing.models?.length ?? 0} model(s)`);
}
console.log(`Smoke check passed for ${base}: ${listing.models.length} chat model(s) are discoverable`);
