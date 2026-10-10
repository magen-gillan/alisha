const sharp = require('sharp');
const fs = require('fs');

const OUT = '/home/z/alisha_repo/public/live2d/thumbnails';
const ALISHA_ICON = '/home/z/alisha_repo/public/alisha-new-icon.png';

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
  console.log(`OK ${id}: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB (bordered)`);
}

(async () => {
  // Jane — real preview (jane.png is a complete character)
  await genSimple('jane', '/home/z/alisha_repo/public/live2d/jane/jane.png', 'cover', 'top');
  // IceGirl — real preview (icon.jpg)
  await genSimple('icegirl', '/home/z/alisha_repo/public/live2d/icegirl/icon.jpg', 'cover', 'center');
  // Kei, GanYu, Miara — Alisha icon with colored borders
  await genWithBorder('kei', ALISHA_ICON, { r: 6, g: 182, b: 212, alpha: 1 });   // cyan
  await genWithBorder('ganyu', ALISHA_ICON, { r: 16, g: 185, b: 129, alpha: 1 }); // green
  await genWithBorder('miara', ALISHA_ICON, { r: 245, g: 158, b: 11, alpha: 1 }); // amber
  console.log('Done.');
})();
