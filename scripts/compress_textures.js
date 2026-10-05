const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const PUBLIC = '/home/z/alisha_repo/public/live2d';

// Find all texture PNGs
function findTextures(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      results.push(...findTextures(fullPath));
    } else if (entry.isFile() && entry.name.match(/^texture_\d+\.png$/)) {
      results.push(fullPath);
    }
  }
  return results;
}

const textures = findTextures(PUBLIC);
console.log(`Found ${textures.length} textures to compress`);

(async () => {
  for (const tex of textures) {
    const stat = fs.statSync(tex);
    const beforeMB = (stat.size / 1048576).toFixed(2);
    
    // Read the original, optimize it (palette reduction + compression level 9)
    // Keep the same dimensions (Live2D needs exact UV mapping)
    const buf = await sharp(tex)
      .png({
        quality: 80,
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true,
      })
      .toBuffer();
    
    fs.writeFileSync(tex, buf);
    const afterMB = (buf.length / 1048576).toFixed(2);
    const reduction = ((1 - buf.length / stat.size) * 100).toFixed(1);
    console.log(`  ${path.relative(PUBLIC, tex)}: ${beforeMB} MB → ${afterMB} MB (-${reduction}%)`);
  }
  console.log('Done.');
})();
