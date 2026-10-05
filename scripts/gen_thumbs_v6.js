const sharp = require('sharp');
const fs = require('fs');

const OUT = '/tmp/alisha_repo/public/live2d/thumbnails';
const ALISHA_ICON = '/tmp/alisha_repo/public/alisha-new-icon.png';

// Stronger color borders for models without a proper preview image
// Each gets a distinct colored border + a subtle tint
const STYLES = {
  kei: { color: '#06b6d4', name: 'Cyan' },     // cyan
  ganyu: { color: '#10b981', name: 'Green' },   // green
  miara: { color: '#f59e0b', name: 'Amber' },   // amber
};

async function genWithBorder(id, srcPath, borderColor, labelText) {
  const outPath = `${OUT}/${id}.png`;
  // Create the base thumbnail (240x240 cover, top)
  const base = await sharp(srcPath)
    .resize(240, 240, {
      fit: 'cover',
      position: 'top',
      background: { r: 36, g: 27, b: 53, alpha: 1 },
    })
    .modulate({ brightness: 1.05, saturation: 1.1 })
    .png()
    .toBuffer();

  // Create a 6px colored border
  const border = await sharp({
    create: {
      width: 240,
      height: 240,
      channels: 4,
      background: borderColor,
    },
  }).png().toBuffer();

  // Create the inner image area (228x228)
  const inner = await sharp(base)
    .extract({ left: 0, top: 0, width: 240, height: 240 })
    .resize(228, 228, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer();

  // Composite: border + inner image + label
  await sharp(border)
    .composite([
      { input: inner, left: 6, top: 6 },
    ])
    .png({ quality: 85, compressionLevel: 9 })
    .toFile(outPath);

  const stat = fs.statSync(outPath);
  console.log(`OK ${id}: ${(stat.size / 1024).toFixed(1)} KB`);
}

async function genSimple(id, srcPath, fit, position) {
  const outPath = `${OUT}/${id}.png`;
  await sharp(srcPath)
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
  // Jane and IceGirl — real previews
  await genSimple('jane', '/tmp/preview_src/jane.png', 'cover', 'top');
  await genSimple('icegirl', '/tmp/preview_src/icegirl.jpg', 'cover', 'center');

  // Kei, GanYu, Miara — alisha-new-icon with distinct colored borders
  await genWithBorder('kei', ALISHA_ICON, { r: 6, g: 182, b: 212, alpha: 1 }, 'Kei');
  await genWithBorder('ganyu', ALISHA_ICON, { r: 16, g: 185, b: 129, alpha: 1 }, 'Gan Yu');
  await genWithBorder('miara', ALISHA_ICON, { r: 245, g: 158, b: 11, alpha: 1 }, 'Miara');

  console.log('Done.');
})();
