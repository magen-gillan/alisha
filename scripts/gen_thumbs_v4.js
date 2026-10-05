const sharp = require('sharp');
const fs = require('fs');

const OUT = '/tmp/alisha_repo/public/live2d/thumbnails';
fs.mkdirSync(OUT, { recursive: true });

const MODELS = [
  {
    id: 'kei',
    src: '/tmp/alisha_repo/public/live2d/alisha/kei_basic_free.2048/texture_00.png',
    extract: { left: 0, top: 0, width: 1024, height: 1024 },
    fit: 'cover',
    position: 'top',
  },
  {
    id: 'jane',
    src: '/tmp/preview_src/jane.png',
    fit: 'cover',
    position: 'top',
  },
  {
    id: 'icegirl',
    src: '/tmp/preview_src/icegirl.jpg',
    fit: 'cover',
    position: 'center',
  },
  {
    id: 'ganyu',
    src: '/tmp/alisha_repo/public/live2d/ganyu/ganyu.4096/texture_00.png',
    extract: { left: 0, top: 0, width: 2048, height: 2048 },
    fit: 'cover',
    position: 'top',
  },
  {
    id: 'miara',
    src: '/tmp/alisha_repo/public/live2d/miara/miara_pro_t03.4096/texture_00.png',
    extract: { left: 0, top: 0, width: 2048, height: 2048 },
    fit: 'cover',
    position: 'top',
  },
];

async function gen(model) {
  const { id, src, fit, position, extract } = model;
  if (!fs.existsSync(src)) {
    console.log(`SKIP ${id}: source not found at ${src}`);
    return;
  }
  const outPath = `${OUT}/${id}.png`;
  let pipeline = sharp(src);
  if (extract) {
    try {
      pipeline = pipeline.extract(extract);
      console.log(`  ${id}: extracted region ${extract.width}x${extract.height}`);
    } catch (e) {
      console.log(`  ${id}: extract failed (${e.message})`);
    }
  }
  await pipeline
    .resize(240, 240, {
      fit: fit,
      position: position,
      background: { r: 36, g: 27, b: 53, alpha: 1 },
    })
    .modulate({ brightness: 1.05, saturation: 1.1 })
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
