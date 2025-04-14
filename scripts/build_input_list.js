// scripts/build_input_list.js
const fs   = require('fs');
const path = require('path');

const timingFile = process.env.TIMING_FILE || 'timings.json';
const imagesDir  = 'slides_png';
const outputList = process.env.OUTPUT_LIST || 'input.txt';

const timings = JSON.parse(fs.readFileSync(timingFile, 'utf8'));
const lines   = [];

timings.forEach((item, idx) => {
    const base  = String(idx + 1);  // index: 1, 2, 3...
    const fileName3 = 'slide-' + base.padStart(3, '0') + '.png';
    const fileName  = 'slide-' + base + '.png';

    const img3 = path.join(imagesDir, fileName3);
    const img  = fs.existsSync(img3)
        ? img3
        : path.join(imagesDir, fileName);

    if (!fs.existsSync(img)) {
        throw new Error(`❌ Không tìm thấy ảnh cho index ${idx + 1}`);
    }

    lines.push(`file '${img}'`);
    lines.push(`duration ${item.timing}`);
});

// Lặp lại frame cuối
const lastBase = String(timings.length);
const lastImg3 = path.join(imagesDir, 'slide-' + lastBase.padStart(3,'0') + '.png');
const lastImg  = fs.existsSync(lastImg3)
    ? lastImg3
    : path.join(imagesDir, 'slide-' + lastBase + '.png');

lines.push(`file '${lastImg}'`);

fs.writeFileSync(outputList, lines.join('\n'));
console.log(`✅  Đã tạo ${outputList} với ${timings.length} mục`);