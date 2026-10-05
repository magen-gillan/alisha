const sharp = require('sharp');
const fs = require('fs');

const OUT = '/tmp/alisha_repo/public/live2d/thumbnails';
fs.mkdirSync(OUT, { recursive: true });

// For each avatar, extract the face region from the texture
// Live2D textures are typically large (2048x2048 or 4096x4096 or 8192x8192)
// The face is usually in the top-center or top-left area
const MODELS = [
  {
    id: 'kei',
    // Kei texture is 2048x2048, face is in top-left quadrant
    src: 'public/live2d/alisha/kei_basic_free.2048/texture_00.png',
    extract: { left: 100, top: 50, width: 800, height: 800 },
  },
  {
    id: 'jane',
    // Jane has a proper preview image
    src: '/tmp/preview_src/jane.png',
    noExtract: true,
  },
  {
    id: 'icegirl',
    // IceGirl has icon.jpg
    src: '/tmp/preview_src/icegirl.jpg',
    noExtract: true,
  },
  {
    id: 'ganyu',
    // GanYu texture is 4096x4096, face is in top area
    src: 'public/live2d/ganyu/ganyu.4096/texture_00.png',
    extract: { left: 200, top: 100, width: 1600, height: 1600 },
  },
  {
    id: 'miara',
    // Miara texture is 4096x4096
    src: 'public/live2d/miara/miara_pro_t03.4096/texture_00.png',
    extract: { left: 200, top: 100, width: 1600, height: 1600 },
  },
];

async function gen(model) {
  const { id, src, extract, noExtract } = model;
  const srcPath = src.startsWith('/') ? src : `/tmp/alisha_repo/${src}`;
  if (!fs.existsSync(srcPath)) {
    console.log(`SKIP ${id}: source not found`);
    return;
  }
  const outPath = `${OUT}/${id}.png`;
  let pipeline = sharp(srcPath);

  if (!noExtract && extract) {
    // Get image metadata first to ensure extract region is valid
    const meta = await pipeline.metadata();
    const safeExtract = {
      left: Math.min(extract.left, meta.width - extract.width),
      top: Math.min(extract.top, meta.height - extract.height),
      width: Math.min(extract.width, meta.width),
      height: Math.min(extract.height, meta.height),
    };
    try {
      pipeline = sharp(srcPath).extract(safeExtract);
      console.log(`  ${id}: extracted ${safeExtract.width}x${safeExtract.height} from (${safeExtract.left},${safeExtract.top})`);
    } catch (e) {
      console.log(`  ${id}: extract failed, using full image`);
      pipeline = sharp(srcPath);
    }
  }

  await pipeline
    .resize(240, 240, {
      fit: 'cover',
      position: 'top',
      background: { r: 36, g: 27, b: 53, alpha: 1 },
    })
    .modulate({ brightness: 1.1, saturation: 1.2 })
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  console.log(`OK ${id}: ${(stat.size / 1024).toFixed(1)} KB`);
}

(async () => {
  for (const m of MODELS) {
    await gen(m);
  }
  console.log('Done.');
})();
