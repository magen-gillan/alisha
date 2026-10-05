const sharp = require('sharp');
const fs = require('fs');

const OUT = '/tmp/alisha_repo/public/live2d/thumbnails';
const ALISHA_ICON = '/tmp/alisha_repo/public/alisha-new-icon.png';

async function genSimple(id, srcPath, fit, position) {
  const outPath = `${OUT}/${id}.png`;
  await sharp(srcPath)
    .resize(240, 240, { fit, position, background: { r: 36, g: 27, b: 53, alpha: 1 } })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outPath);
  console.log(`OK ${id}: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
}

async function genWithBorder(id, srcPath, borderColor) {
  const outPath = `${OUT}/${id}.png`;
  const base = await sharp(srcPath)
    .resize(228, 228, { fit: 'cover', position: 'top' })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png()
    .toBuffer();

  const border = await sharp({
    create: { width: 240, height: 240, channels: 4, background: borderColor },
  }).png().toBuffer();

  await sharp(border)
    .composite([{ input: base, left: 6, top: 6 }])
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outPath);
  console.log(`OK ${id}: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB (with border)`);
}

async function genExtract(id, srcPath, extract) {
  const outPath = `${OUT}/${id}.png`;
  await sharp(srcPath)
    .extract(extract)
    .resize(240, 240, { fit: 'cover', position: 'top', background: { r: 36, g: 27, b: 53, alpha: 1 } })
    .modulate({ brightness: 1.1, saturation: 1.2 })
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outPath);
  console.log(`OK ${id}: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB (extracted)`);
}

(async () => {
  // Jane — real preview
  await genSimple('jane', '/tmp/preview_src/jane.png', 'cover', 'top');
  // IceGirl — real preview
  await genSimple('icegirl', '/tmp/preview_src/icegirl.jpg', 'cover', 'center');
  // Miara — extract portrait from texture (top-left quadrant)
  await genExtract('miara', 'public/live2d/miara/miara_pro_t03.4096/texture_00.png',
    { left: 0, top: 0, width: 2048, height: 2048 });
  // Kei — Alisha icon with cyan border
  await genWithBorder('kei', ALISHA_ICON, { r: 6, g: 182, b: 212, alpha: 1 });
  // GanYu — Alisha icon with green border
  await genWithBorder('ganyu', ALISHA_ICON, { r: 16, g: 185, b: 129, alpha: 1 });
  console.log('Done.');
})();
