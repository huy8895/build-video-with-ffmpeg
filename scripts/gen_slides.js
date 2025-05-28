const PPTXGenJS = require("pptxgenjs");
const fs        = require("fs");
const nlp       = require("compromise");

// ---- Load config ----------------------------------------------------------
const configKey = process.env.CONFIG_KEY;
console.log("CONFIG_KEY:", configKey);
if (!configKey) {
    console.error("❌ CONFIG_KEY not set");
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(`configs/${configKey}.json`, "utf8"));
console.log("CONFIG:", config);
const slideData = JSON.parse(fs.readFileSync("timings.json", "utf8"));

// ---- Xác định ảnh nền -----------------------------------------------------
let backgroundPath = config.background;
if (fs.existsSync("background.jpg")) {
    console.log("✅ Using downloaded background.jpg for slide background.");
    backgroundPath = "background.jpg";
} else {
    console.log("ℹ️ Using default background from config.");
}

// ---- Helper để làm sạch text ----------------------------------------------
function cleanText(raw) {
    return nlp(raw)
        .normalize({ punctuation: true, unicode: true, whitespace: true })
        .out('text')
        .replace(/[^\w\s]|_/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// ---- Build PPTX -----------------------------------------------------------
const pptx = new PPTXGenJS();
pptx.defineLayout({ name: "WIDESCREEN_HD", width: 10, height: 5.625 });
pptx.layout = "WIDESCREEN_HD";

// 🎯 Định nghĩa master slide với ảnh nền duy nhất
pptx.defineSlideMaster({
    title: 'MASTER_SLIDE',
    background: { path: backgroundPath }
});

// 👉 Sử dụng master slide khi tạo từng slide mới
slideData.forEach(({ text }) => {
    const slide = pptx.addSlide({ masterName: 'MASTER_SLIDE' });

    const displayText = config.isOnlySubtitle ? cleanText(text) : text;
    slide.addText(displayText, config.textOptions);
});

// ---- Save -----------------------------------------------------------------
pptx.writeFile({ fileName: "slides.pptx" })
    .then(() => console.log("✅ Created slides.pptx"))
    .catch(err => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
