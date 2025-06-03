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

// ---- Clean text -----------------------------------------------------------
function cleanText(text) {
    return nlp(text)
        .normalize({ punctuation: true, unicode: true, whitespace: true })
        .out("text")
        .replace(/[^\w\s]|_/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
rawContent = cleanText(rawContent);

// ---- Split text -----------------------------------------------------------
const maxChar = parseInt(config.maxChar || "200", 10);
const minChar = parseInt(config.minChar || "100", 10);

const slideTexts = splitTextUsingNLP(rawContent, maxChar, minChar);
function splitTextUsingNLP(text, maxLen, minLen) {
    const doc = nlp(text);
    const paragraphs = doc.split("\n").map(p => p.trim()).filter(p => p.length > 0);
    let chunks = [];

    paragraphs.forEach(paragraph => {
        const sentences = nlp(paragraph).sentences().out('array');
        let current = "";

        for (let sentence of sentences) {
            if ((current + sentence).length <= maxLen) {
                current += sentence + " ";
            } else {
                if (current.length >= minLen) {
                    chunks.push(current.trim());
                    current = sentence + " ";
                } else {
                    current += sentence + " ";
                }
            }
        }
        if (current.length >= minChar) {
            chunks.push(current.trim());
        }
    });

    return chunks;
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
