/**
 * split_text.js
 * Usage:  node split_text.js input.txt 1500
 * Output: chunks.json  (array of strings)
 */
import fs from "fs";
import nlp from "compromise";

const [,, inputFile = "content.txt", maxCharArg = "1500"] = process.argv;
const maxChar = parseInt(maxCharArg, 10);

if (!fs.existsSync(inputFile)) {
  console.error("❌ Input file not found:", inputFile);
  process.exit(1);
}

const text = fs.readFileSync(inputFile, "utf-8");
const doc = nlp(text);

// 1️⃣ tách câu, làm sạch giống đoạn JS gốc
let sentences = doc.sentences().out("array").flatMap(s => {
  const cleaned = s.replace(/\\.”\\s+/g, "”. ");
  return nlp(cleaned).sentences().out("array");
});

let current = "";
const chunks = [];

for (const sentence of sentences) {
  if ((current.length + sentence.length + 1) <= maxChar) {
    current += (current ? " " : "") + sentence;
  } else {
    if (current) chunks.push(current);
    current = sentence;
  }
}
if (current) chunks.push(current);

// 2️⃣ dump JSON
fs.writeFileSync("chunks.json", JSON.stringify(chunks, null, 2));
console.log(`📝  Split done → ${chunks.length} chunks, saved to chunks.json`);
