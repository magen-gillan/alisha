const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC = '/home/z/alisha_repo/public';
const OUT = `${PUBLIC}/live2d/thumbnails`;
fs.mkdirSync(OUT, { recursive: true });

async function gen(id, sourcePath, outName) {
  if (!fs.existsSync(sourcePath)) {
    console.log(`SKIP ${id}: source not found at ${sourcePath}`);
    return;
  }
  const outPath = `${OUT}/${outName}`;
  await sharp(sourcePath)
    .resize(160, 160, { fit: 'cover', position: 'top' })
    .png({ quality: 80, compressionLevel: 9 })
    .toFile(outPath);
  const stat = fs.statSync(outPath);
  console.log(`OK ${id}: ${outPath} (${(stat.size/1024).toFixed(1)} KB)`);
}

(async () => {
  // IceGirl has a preview icon.jpg
  await gen('icegirl', `${PUBLIC}/live2d/icegirl/icon.jpg`, 'icegirl.png');
  // Others: use first texture as thumbnail
  await gen('kei', `${PUBLIC}/live2d/alisha/kei_basic_free.2048/texture_00.png`, 'kei.png');
  await gen('jane', `${PUBLIC}/live2d/jane/jane.8192/texture_00.png`, 'jane.png');
  await gen('ganyu', `${PUBLIC}/live2d/ganyu/ganyu.4096/texture_00.png`, 'ganyu.png');
  await gen('miara', `${PUBLIC}/live2d/miara/miara_pro_t03.4096/texture_00.png`, 'miara.png');
  console.log('Done.');
})();
