// align_srt_to_content.js
// ------------------------------------------------------------
// Compare every subtitle block (SRT) with the corresponding segment
// from content.txt (with or without newlines) and export a CSV report
// Columns: | srt_line | content_line | similarity |
// ------------------------------------------------------------
// USAGE
//   node align_srt_to_content.js --srt subtitle.srt --content content.txt \
//        [--out alignment.csv] [--threshold 0.85]
// ------------------------------------------------------------

const fs = require('fs-extra');
const minimist = require('minimist');

/* ----------------------- HELPERS ------------------------- */
function parseSRT(raw) {
  const srt = raw.replace(/\r/g, '');
  const regex = /(\d+)\s+(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})\s+([\s\S]*?)(?=\n{2}|$)/g;
  const blocks = [];
  let m;
  while ((m = regex.exec(srt)) !== null) {
    const text = m[4].trim(); // Keep original line breaks and structure
    if (text) blocks.push({ index: m[1], time: `${m[2]} --> ${m[3]}`, text });
  }
  return blocks; // Array of { index, time, text }
}

function splitContent(raw, srtBlocks) {
  const txt = raw.replace(/\r/g, '').trim();
  const segments = [];
  let lastPos = 0;

  for (let i = 0; i < srtBlocks.length; i++) {
    const srtText = srtBlocks[i].text;
    const sClean = cleanTxt(srtText).replace(/[\p{P}\p{S}]/gu, '').toLowerCase().trim();
    let bestPos = -1;
    let bestSim = 0;
    let bestSegment = '';

    // Search for the best match in the remaining text
    let remainingText = txt.slice(lastPos);
    let pos = 0;
    while ((pos = remainingText.toLowerCase().replace(/[\p{P}\p{S}]/gu, '').indexOf(sClean, pos)) !== -1) {
      const segment = remainingText.slice(pos, pos + srtText.length).trim();
      const sim = similarity(sClean, cleanTxt(segment).replace(/[\p{P}\p{S}]/gu, '').toLowerCase().trim());
      if (sim > bestSim) {
        bestSim = sim;
        bestPos = lastPos + pos;
        bestSegment = segment;
      }
      pos += 1;
    }

    // If no good match found (similarity < 0.5), try to find the next block's starting point
    if (bestSim < 0.5 && i + 1 < srtBlocks.length) {
      const nextSrtText = srtBlocks[i + 1].text;
      const nextClean = cleanTxt(nextSrtText).replace(/[\p{P}\p{S}]/gu, '').toLowerCase().trim();
      pos = remainingText.toLowerCase().replace(/[\p{P}\p{S}]/gu, '').indexOf(nextClean);
      if (pos !== -1) {
        bestSegment = remainingText.slice(0, pos).trim();
        bestPos = lastPos;
        bestSim = similarity(sClean, cleanTxt(bestSegment).replace(/[\p{P}\p{S}]/gu, '').toLowerCase().trim());
      }
    }

    if (bestPos === -1) {
      console.warn(`Warning: Could not find match for SRT block ${srtBlocks[i].index}: "${srtText}"`);
      segments.push('');
    } else {
      segments.push(bestSegment);
      lastPos = bestPos + bestSegment.length;
    }
  }

  if (lastPos < txt.length) {
    console.warn(`Warning: ${txt.length - lastPos} characters left unmatched in content.txt`);
  }

  return segments;
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
  return str.replace(/\s+/g, ' ').trim();
}

/* ------------------------- MAIN -------------------------- */
async function main() {
  const argv = minimist(process.argv.slice(2));
  const srtPath = argv.srt;
  const cttPath = argv.content;
  const outPath = argv.out || 'alignment_result.csv';
  const THR = parseFloat(argv.threshold || 0.85);
  if (!srtPath || !cttPath) {
    console.error('Usage: node align_srt_to_content.js --srt xxx.srt --content content.txt');
    process.exit(1);
  }

  /* ---- 1. Load files ---- */
  const srtBlocks = parseSRT(fs.readFileSync(srtPath, 'utf8'));
  const rawContent = fs.readFileSync(cttPath, 'utf8');
  const segments = splitContent(rawContent, srtBlocks);
  console.log(`Loaded ${srtBlocks.length} subtitle blocks, ${segments.length} content segments.`);

  /* ---- 2. Align SRT blocks with content segments ---- */
  const csvRows = ['srt_line,content_line,similarity'];
  let unmatchedCount = 0;

  for (let i = 0; i < srtBlocks.length; i++) {
    const srtText = srtBlocks[i].text;
    const sClean = cleanTxt(srtText);
    const contentText = i < segments.length ? segments[i] : '';
    const cClean = cleanTxt(contentText);
    const sim = similarity(sClean, cClean);
    const simPercent = (sim * 100).toFixed(2);

    csvRows.push(`"${srtText.replace(/"/g, '""')}","${contentText.replace(/"/g, '""')}",${simPercent}`);

    if (sim < THR) {
      unmatchedCount++;
      console.warn(`Warning: Low similarity (${simPercent}%) for SRT block ${srtBlocks[i].index}: "${srtText}" vs "${contentText}"`);
    }
  }

  if (srtBlocks.length !== segments.length) {
    console.warn(`Warning: Mismatch in counts - ${srtBlocks.length} SRT blocks vs ${segments.length} content segments`);
  }

  /* ---- 3. Save CSV ---- */
  fs.writeFileSync(outPath, csvRows.join('\n'), 'utf8');
  console.log(`CSV report saved ➜ ${outPath}`);
  if (unmatchedCount > 0) {
    console.log(`Found ${unmatchedCount} blocks with similarity below threshold (${THR * 100}%)`);
  } else {
    console.log('All blocks matched above threshold!');
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});