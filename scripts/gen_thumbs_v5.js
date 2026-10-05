const sharp = require('sharp');
const fs = require('fs');

const OUT = '/tmp/alisha_repo/public/live2d/thumbnails';
const ALISHA_ICON = '/tmp/alisha_repo/public/alisha-new-icon.png';

// Color tints for models without a proper preview image
// This makes each thumbnail visually distinct
const TINTS = {
  kei: { r: 100, g: 200, b: 255 },    // cyan
  ganyu: { r: 150, g: 255, b: 150 },  // green
  miara: { r: 255, g: 200, b: 100 }, // amber
};

async function gen(id, srcPath, fit, position, extract, tint) {
  const outPath = `${OUT}/${id}.png`;
  let pipeline = sharp(srcPath);
  if (extract) {
    try {
      pipeline = pipeline.extract(extract);
    } catch (e) {}
  }
  let img = await pipeline
    .resize(240, 240, {
      fit: fit,
      position: position,
      background: { r: 36, g: 27, b: 53, alpha: 1 },
    })
    .modulate({ brightness: 1.05, saturation: 1.1 });

  // Apply tint overlay for models without a proper preview
  if (tint) {
    const tintBuffer = await sharp({
      create: {
        width: 240,
        height: 240,
        channels: 4,
        background: { r: tint.r, g: tint.g, b: tint.b, alpha: 0.3 },
      },
    }).png().toBuffer();
    img = await sharp(await img.png().toBuffer())
      .composite([{ input: tintBuffer, blend: 'over' }])
      .png();
  }

  await img.toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log(`OK ${id}: ${(stat.size / 1024).toFixed(1)} KB`);
}

(async () => {
  // Jane and IceGirl — use real preview images
  await gen('jane', '/tmp/preview_src/jane.png', 'cover', 'top');
  await gen('icegirl', '/tmp/preview_src/icegirl.jpg', 'cover', 'center');

  // Kei, GanYu, Miara — use alisha-new-icon with distinct tints
  await gen('kei', ALISHA_ICON, 'cover', 'top', null, TINTS.kei);
  await gen('ganyu', ALISHA_ICON, 'cover', 'top', null, TINTS.ganyu);
  await gen('miara', ALISHA_ICON, 'cover', 'top', null, TINTS.miara);

  console.log('Done.');
})();
