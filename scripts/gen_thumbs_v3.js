const sharp = require('sharp');
const fs = require('fs');

const PUBLIC = '/home/z/alisha_repo/public';
const OUT = `${PUBLIC}/live2d/thumbnails`;
fs.mkdirSync(OUT, { recursive: true });

// Each model: source image + how to process it
const MODELS = [
  // Jane has a complete character PNG
  { id: 'jane', src: `${PUBLIC}/live2d/jane/jane.png`, fit: 'cover', position: 'top' },
  // IceGirl has icon.jpg (complete character)
  { id: 'icegirl', src: `${PUBLIC}/live2d/icegirl/icon.jpg`, fit: 'cover', position: 'center' },
  // Kei, GanYu, Miara don't have previews — fall back to the Alisha icon
  { id: 'kei', src: `${PUBLIC}/alisha-new-icon.png`, fit: 'cover', position: 'top' },
  { id: 'ganyu', src: `${PUBLIC}/alisha-new-icon.png`, fit: 'cover', position: 'top' },
  { id: 'miara', src: `${PUBLIC}/alisha-new-icon.png`, fit: 'cover', position: 'top' },
];

async function gen(id, srcPath, fit, position) {
  if (!fs.existsSync(srcPath)) {
    console.log(`SKIP ${id}: source not found`);
    return;
  }
  const outPath = `${OUT}/${id}.png`;
  await sharp(srcPath)
    .resize(240, 240, {
      fit: fit,
      position: position,
      background: { r: 36, g: 27, b: 53, alpha: 1 }
    })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log(`OK ${id}: ${(stat.size/1024).toFixed(1)} KB`);
}

(async () => {
  for (const m of MODELS) {
    await gen(m.id, m.src, m.fit, m.position);
  }
  console.log('Done.');
})();
