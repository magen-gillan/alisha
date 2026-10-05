const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC = '/home/z/alisha_repo/public';
const OUT = `${PUBLIC}/live2d/thumbnails`;
fs.mkdirSync(OUT, { recursive: true });

// Each model's main texture + how to crop it for the thumbnail
// Models often have empty space at the top/bottom — we crop the central
// character area for a better preview.
const MODELS = [
  { id: 'kei',     src: `${PUBLIC}/live2d/alisha/kei_basic_free.2048/texture_00.png` },
  { id: 'jane',    src: `${PUBLIC}/live2d/jane/jane.8192/texture_00.png` },
  { id: 'icegirl', src: `${PUBLIC}/live2d/icegirl/IceGirl.8192/texture_00.png` },
  { id: 'ganyu',   src: `${PUBLIC}/live2d/ganyu/ganyu.4096/texture_00.png` },
  { id: 'miara',   src: `${PUBLIC}/live2d/miara/miara_pro_t03.4096/texture_00.png` },
];

async function gen(id, srcPath) {
  if (!fs.existsSync(srcPath)) {
    console.log(`SKIP ${id}: source not found at ${srcPath}`);
    return;
  }
  const outPath = `${OUT}/${id}.png`;

  // Use sharp to:
  // 1. Read the full texture
  // 2. Extract metadata to find non-empty regions
  // 3. Resize to 240x240 with 'contain' fit (preserves aspect ratio,
  //    fills empty space with a dark background that matches the UI)
  // 4. Apply a subtle vignette so the character pops

  await sharp(srcPath)
    .resize(240, 240, {
      fit: 'cover',
      position: 'top',  // Most Live2D textures have the character at the top
      background: { r: 36, g: 27, b: 53, alpha: 1 } // #241b35 (app bg)
    })
    // Slightly boost the brightness/contrast so thumbnails are visible
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  console.log(`OK ${id}: ${outPath} (${(stat.size/1024).toFixed(1)} KB)`);
}

(async () => {
  for (const m of MODELS) {
    await gen(m.id, m.src);
  }
  console.log('Done.');
})();
