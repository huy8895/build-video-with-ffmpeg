// align_srt_to_content.js
// ------------------------------------------------------------
// Compare every subtitle block (SRT) with the original sentence
// from content.txt and export a CSV report
// Columns: | srt_line | content_line | similarity |
// ------------------------------------------------------------
// USAGE
//   node align_srt_to_content.js --srt subtitle.srt --content content.txt \
//        [--out alignment.csv] [--threshold 0.85]
// ------------------------------------------------------------

const fs       = require('fs-extra');
const minimist = require('minimist');

/* ----------------------- HELPERS ------------------------- */
function parseSRT(raw) {
  // Accept either numbered or un‑numbered blocks
  const srt   = raw.replace(/\r/g, '');
  const regex = /(\d+\s+)?(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})\s+([\s\S]*?)(?=\n{2}|$)/g;
  const blocks = [];
  let m;
  while ((m = regex.exec(srt)) !== null) {
    const text = m[4].replace(/\n/g, ' ').trim();
    if (text) blocks.push(text);
  }
  return blocks; // array of strings
}

function splitContent(raw) {
  // 1) unify line‑breaks, 2) split by Chinese / Latin punctuation that ends a sentence
  const txt = raw.replace(/\r/g, '').replace(/\n+/g, '\n');
  const parts = txt.split(/(?<=[。！？!?])/); // keep punctuation at end
  return parts.map(s => s.trim()).filter(Boolean);
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // delete
        dp[i][j - 1] + 1,      // insert
        dp[i - 1][j - 1] + cost // replace
      );
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

function cleanTxt(str) {
  return str.replace(/\s+/g, '').trim();
}

/* ------------------------- MAIN -------------------------- */
async function main() {
  const argv = minimist(process.argv.slice(2));
  const srtPath  = argv.srt;
  const cttPath  = argv.content;
  const outPath  = argv.out || 'alignment_result.csv';
  const THR      = parseFloat(argv.threshold || 0.85);
  if (!srtPath || !cttPath) {
    console.error('Usage: node align_srt_to_content.js --srt xxx.srt --content content.txt');
    process.exit(1);
  }

  /* ---- 1. Load files ---- */
  const srtBlocks = parseSRT(fs.readFileSync(srtPath, 'utf8'));
  const sentences = splitContent(fs.readFileSync(cttPath, 'utf8'));
  console.log(`Loaded ${srtBlocks.length} subtitle blocks, ${sentences.length} sentences.`);

  /* ---- 2. Greedy align by heuristics ---- */
  const csvRows = [ 'srt_line,content_line,similarity' ];
  let ptr = 0; // current index in sentences[]

  for (const srtText of srtBlocks) {
    const sClean        = cleanTxt(srtText);
    let   bestIdx       = -1;
    let   bestSim       = 0;
    // search forwards within a window of 5 sentences to keep order
    for (let i = ptr; i < Math.min(ptr + 5, sentences.length); i++) {
      const cClean = cleanTxt(sentences[i]);
      // quick heuristics: first + last char, length diff
      const firstSame = sClean[0] === cClean[0];
      const lastSame  = sClean.slice(-1) === cClean.slice(-1);
      const lenClose  = Math.abs(sClean.length - cClean.length) <= Math.max(3, 0.2 * sClean.length);
      if (!firstSame || !lastSame || !lenClose) continue;
      const sim = similarity(sClean, cClean);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    // fallback: if nothing matched in window, take global best (rare)
    if (bestIdx === -1) {
      for (let i = 0; i < sentences.length; i++) {
        const sim = similarity(sClean, cleanTxt(sentences[i]));
        if (sim > bestSim) {
          bestSim = sim;
          bestIdx = i;
        }
      }
    }

    const matchedSentence = bestIdx >= 0 ? sentences[bestIdx] : '';
    const simPercent      = (bestSim * 100).toFixed(2);
    csvRows.push(`"${srtText.replace(/"/g, '""')}","${matchedSentence.replace(/"/g, '""')}",${simPercent}`);

    // advance pointer if similarity is good
    if (bestIdx >= ptr && bestSim >= THR) ptr = bestIdx + 1;
  }

  /* ---- 3. Save CSV ---- */
  fs.writeFileSync(outPath, csvRows.join('\n'), 'utf8');
  console.log(`CSV report saved ➜ ${outPath}`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
