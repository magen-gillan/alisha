const sharp = require('sharp');
const fs = require('fs');

async function scanRegions(id, srcPath, regions) {
  console.log(`\nScanning ${id} (${regions.length} regions):`);
  for (const region of regions) {
    try {
      const buf = await sharp(srcPath).extract(region).resize(100, 100).png().toBuffer();
      const tmpPath = `/tmp/scan_${id}_${region.left}_${region.top}.png`;
      fs.writeFileSync(tmpPath, buf);
      console.log(`  region (${region.left},${region.top}) ${region.width}x${region.height} → ${tmpPath}`);
    } catch (e) {
      console.log(`  region (${region.left},${region.top}) FAILED: ${e.message}`);
    }
  }
}

(async () => {
  // Kei texture is 2048x2048
  // Try different quadrants
  await scanRegions('kei', 'public/live2d/alisha/kei_basic_free.2048/texture_00.png', [
    { left: 0, top: 0, width: 1024, height: 1024 },         // top-left
    { left: 1024, top: 0, width: 1024, height: 1024 },       // top-right
    { left: 0, top: 1024, width: 1024, height: 1024 },       // bottom-left
    { left: 1024, top: 1024, width: 1024, height: 1024 },    // bottom-right
    { left: 512, top: 0, width: 1024, height: 1024 },        // top-center
  ]);

  // GanYu texture is 4096x4096
  await scanRegions('ganyu', 'public/live2d/ganyu/ganyu.4096/texture_00.png', [
    { left: 0, top: 0, width: 2048, height: 2048 },          // top-left
    { left: 2048, top: 0, width: 2048, height: 2048 },      // top-right
    { left: 0, top: 2048, width: 2048, height: 2048 },       // bottom-left
    { left: 2048, top: 2048, width: 2048, height: 2048 },    // bottom-right
  ]);

  // Miara texture is 4096x4096
  await scanRegions('miara', 'public/live2d/miara/miara_pro_t03.4096/texture_00.png', [
    { left: 0, top: 0, width: 2048, height: 2048 },
    { left: 2048, top: 0, width: 2048, height: 2048 },
    { left: 0, top: 2048, width: 2048, height: 2048 },
    { left: 2048, top: 2048, width: 2048, height: 2048 },
  ]);
})();
