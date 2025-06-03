const PPTXGenJS = require("pptxgenjs");
const fs = require("fs");
const nlp = require("compromise");

// ---- Load config ----------------------------------------------------------
const configKey = process.env.CONFIG_KEY;
console.log("CONFIG_KEY:", configKey);
if (!configKey) {
    console.error("❌ CONFIG_KEY not set");
    process.exit(1);
}
const configPath = `configs/${configKey}.json`;
if (!fs.existsSync(configPath)) {
    console.error(`❌ Missing config file at ${configPath}`);
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
console.log("✅ Loaded config.");

// ---- Read content.txt -----------------------------------------------------
const contentPath = "content.txt";
if (!fs.existsSync(contentPath)) {
    console.error("❌ Missing content.txt");
    process.exit(1);
}
let rawContent = fs.readFileSync(contentPath, "utf8").trim();

// ---- Split text -----------------------------------------------------------
const maxChar = parseInt(config.maxChar || "200", 10);
const minChar = parseInt(config.minChar || "100", 10);

const slideTexts = splitText(rawContent, maxChar);

function splitText(text, charLimit) {
    console.log('split text')
    const doc = nlp(text);
    const sentences = doc.sentences().out('array')

    let currentChunk = '';
    const results = [];

    sentences.forEach(sentence => {
        if ((currentChunk.length + sentence.length) <= charLimit) {
            currentChunk += ' ' + sentence;
        } else {
            if (currentChunk) {
                results.push(currentChunk);
            }
            currentChunk = sentence;
        }
    });

    if (currentChunk) {
        results.push(currentChunk);
    }

    return results;
}

// ---- Background setup -----------------------------------------------------
let backgroundPath = config.background;
if (fs.existsSync("background.jpg")) {
    console.log("✅ Using downloaded background.jpg for slide background.");
    backgroundPath = "background.jpg";
} else if (fs.existsSync(backgroundPath)) {
    console.log(`✅ Using background from config: ${backgroundPath}`);
} else {
    console.warn(`⚠️ Background not found: ${backgroundPath}. Slides will use default white.`);
    backgroundPath = null;
}

// ---- Create PPTX ----------------------------------------------------------
const pptx = new PPTXGenJS();
pptx.defineLayout({ name: "WIDESCREEN_HD", width: 10, height: 5.625 });
pptx.layout = "WIDESCREEN_HD";

// ---- Define master slide --------------------------------------------------
if (backgroundPath) {
    pptx.defineSlideMaster({
        title: "MASTER_SLIDE",
        background: { path: backgroundPath }
    });
}

// ---- Add slides -----------------------------------------------------------
slideTexts.forEach((text, idx) => {
    const slide = pptx.addSlide({ masterName: backgroundPath ? "MASTER_SLIDE" : undefined });
    slide.addText(text, config.textOptions);
});

// ---- Save file ------------------------------------------------------------
pptx.writeFile({ fileName: "slides.pptx" })
    .then(() => console.log("✅ Created slides.pptx"))
    .catch(err => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
