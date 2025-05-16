const PPTXGenJS = require("pptxgenjs");
const fs        = require("fs");
const nlp       = require("compromise");          // ← added

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

// Check if background.jpg exists in current directory
let backgroundPath = config.background;
if (fs.existsSync("background.jpg")) {
    console.log("✅ Using downloaded background.jpg for slide background.");
    backgroundPath = "background.jpg";
} else {
    console.log("ℹ️ Using default background from config.");
}


// ---- Helper to strip punctuation / “special characters” -------------------
function cleanText(raw) {
  // compromise.normalize removes punctuation & non-ASCII when options are true
  return nlp(raw)
    .normalize({
      punctuation: true,   // drop punctuation & symbols
      unicode:     true,   // simplify fancy Unicode
      whitespace:  true,   // collapse extra spaces / newlines
    })
    .out("text")
    .trim();
}

// ---- Build PPTX -----------------------------------------------------------
const pptx = new PPTXGenJS();
pptx.defineLayout({ name: "WIDESCREEN_HD", width: 10, height: 5.625 });
pptx.layout = "WIDESCREEN_HD";

slideData.forEach(({ text }) => {
  const slide = pptx.addSlide();
  slide.background = { path: backgroundPath };

  // Only strip special chars when this video is subtitle-only
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
