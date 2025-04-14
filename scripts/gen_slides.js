const PPTXGenJS = require("pptxgenjs");
const fs = require("fs");

const configKey = process.env.CONFIG_KEY;
console.log("CONFIG_KEY:", configKey);
if (!configKey) {
    console.error("❌ CONFIG_KEY not set");
    process.exit(1);
}
const config = JSON.parse(fs.readFileSync(`configs/${configKey}.json`, "utf8"));
console.log("CONFIG:", config);
const slideData = JSON.parse(fs.readFileSync("timings.json", "utf8"));

const pptx = new PPTXGenJS();
pptx.defineLayout({ name: "WIDESCREEN_HD", width: 10, height: 5.625 });
pptx.layout = "WIDESCREEN_HD";

slideData.forEach((item) => {
    const slide = pptx.addSlide();
    slide.background = { path: config.background };
    slide.addText(item.text, config.textOptions);
});

pptx.writeFile({ fileName: "slides.pptx" })
    .then(() => console.log("✅ Created slides.pptx"))
    .catch((err) => {
        console.error("❌ Error:", err);
        process.exit(1);
    });
