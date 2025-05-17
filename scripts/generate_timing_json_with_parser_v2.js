// generate_timing_json_with_parser.js
const fs = require('fs-extra');
const nlp = require('compromise');
const minimist = require('minimist');

// ===== Subtitle Parser (From subtitle-parser.js) =====
function timeToMs(timeString) {
    const [hours, minutes, rest] = timeString.split(':');
    const [seconds, millis] = rest.split(',');
    return (
        parseInt(hours) * 3600000 +
        parseInt(minutes) * 60000 +
        parseInt(seconds) * 1000 +
        parseInt(millis)
    );
}

function parseSRT(data) {
    const srt = data.replace(/\r/g, '');
    const regex = /(\d+)\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n([\s\S]*?)(?=\n{2}|$)/g;
    const result = [];

    let match;
    while ((match = regex.exec(srt)) !== null) {
        const id = parseInt(match[1]);
        const start = timeToMs(match[2]);
        const end = timeToMs(match[3]);
        const text = match[4].replace(/\n/g, ' ').trim();

        result.push({id, start, end, text});
    }

    return result;
}

// ===== Helper Functions =====
function normalizeText(text) {
    // Chuyển tất cả thành chữ thường
    text = text.toLowerCase();

    // Tách các từ trong chuỗi dựa trên khoảng trắng, dấu gạch ngang và dấu gạch dài
    let words = text.split(/\s+|-|—/);

    // Tạo từ điển cho các từ số
    const numberWords = {
        'one': '1',
        'two': '2',
        'three': '3',
        'four': '4',
        'five': '5',
        'six': '6',
        'seven': '7',
        'eight': '8',
        'nine': '9',
        'ten': '10',
        'eleven': '11',
        'twelve': '12',
        'thirteen': '13',
        'fourteen': '14',
        'fifteen': '15',
        'sixteen': '16',
        'seventeen': '17',
        'eighteen': '18',
        'nineteen': '19',
        'twenty': '20',
        'twenty-one': '21',
        'twenty two': '22',
        'twenty-three': '23',
        'twenty-four': '24',
        'twenty-five': '25',
        'twenty-six': '26',
        'twenty-seven': '27',
        'twenty-eight': '28',
        'twenty-nine': '29',
        'thirty': '30'
    };


    // Loại bỏ dấu câu và thay thế từ số bằng số
    const filteredWords = words
        .map(word => word.replace(/[^\w\s]/g, '').trim())
        .map(word => numberWords[word] || word);

    // Ghép các từ lại thành chuỗi
    return filteredWords.join(' ').trim();
}

function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix = [];

    // Tạo ma trận khoảng cách
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Tính toán khoảng cách Levenshtein
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,    // xóa
                matrix[i][j - 1] + 1,    // thêm
                matrix[i - 1][j - 1] + cost // thay thế
            );
        }
    }

    return matrix[len1][len2];
}

function fuzzyMatchAverage(arr1, arr2) {
    let totalSimilarity = 0;

    // Với mỗi phần tử của arr1, tìm phần tử tương tự nhất trong arr2
    for (let a of arr1) {
        let bestSimilarity = 0;
        for (let b of arr2) {
            const distance = levenshteinDistance(a, b);
            const maxLen = Math.max(a.length, b.length);
            const similarity = 1 - (distance / maxLen);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
            }
        }
        totalSimilarity += bestSimilarity;
    }

    // Tính trung bình similarity cho toàn bộ arr1
    const avgSimilarity = totalSimilarity / arr1.length;
    return (avgSimilarity * 100).toFixed(2);
}

/**
 * Split raw text into slide-sized chunks, satisfying
 *   – maxCharLimit:  slide.length ≤ maxCharLimit   (hard cap)
 *   – minCharLimit:  slide.length ≥ minCharLimit   (best-effort)
 *
 * 1. Cắt theo câu → push() tự đảm bảo ≤ maxCharLimit (có cắt token dài).
 * 2. Hai lượt “mượn từ”:
 *      • Pass thuận  (trái → phải)  kéo từ slide kế tiếp.
 *      • Pass ngược  (phải → trái)  kéo từ slide trước.
 *    Nhờ đó hầu như không còn slide < minCharLimit trừ phi thực sự không còn chỗ.
 */
/**
 * Split raw text into slides whose length ∈ (½·maxCharLimit, maxCharLimit]
 * using inverse-Fibonacci word-ratios when a sentence is too long.
 *
 * @param {string} content        Full text
 * @param {number} maxCharLimit   Max characters per slide
 * @returns {string[]}            Slides
 */
function processRawContent(content, maxCharLimit, minCharLimit) {
    const halfMax    = minCharLimit ? minCharLimit : maxCharLimit / 2;

    /* ---------- inverse Fibonacci ratios: ½, ⅓, ⅕, ⅛, ⅒, … ---------- */
    const fib = [1, 1];
    while (fib.length < 12) fib.push(fib.at(-1) + fib.at(-2));
    const ratios = fib.slice(2).map(f => 1 / f);            // [½, ⅓, ⅕, ⅛, …]

    /* ---------- helper: pick a chunk of words that keeps slide in range ---------- */
    function takeChunk(words, currentLen) {
        const total = words.length;
        // 1) ưu tiên đoạn khiến slide đạt ngay ≥ halfMax
        for (const r of ratios) {
            const cnt = Math.max(1, Math.floor(total * r));
            const chunk = words.slice(0, cnt).join(" ");
            const len   = currentLen + chunk.length;
            if (len <= maxCharLimit && len >= halfMax) return {chunk, cnt};
        }
        // 2) nếu không đạt được ≥ halfMax, lấy đoạn lớn nhất vẫn ≤ maxCharLimit
        for (let cnt = total; cnt >= 1; --cnt) {
            const chunk = words.slice(0, cnt).join(" ");
            if (currentLen + chunk.length <= maxCharLimit)
                return {chunk, cnt};
        }
        // Không lấy được gì (hiếm): trả 0
        return {chunk: "", cnt: 0};
    }

    /* ---------- main loop ---------- */
    const slides     = [];
    let currentSlide = "";

    const sentences = nlp(content).sentences().out("array");
    for (let sentence of sentences) {
        sentence = sentence.trim();
        if (!sentence) continue;

        /* ===== 1. slide hiện tại RỖNG ===== */
        if (currentSlide === "") {
            if (sentence.length <= maxCharLimit) {
                currentSlide = sentence + " ";
                continue;
            }
            // câu quá dài → cắt theo tỉ lệ nghịch-Fib
            let words = nlp(sentence).terms().out("array");
            while (words.length) {
                const {chunk, cnt} = takeChunk(words, 0);
                currentSlide = chunk + " ";
                slides.push(currentSlide.trim());
                currentSlide = "";
                words = words.slice(cnt);
            }
            continue;
        }

        /* ===== 2. slide đã có nội dung ===== */
        if (currentSlide.length + sentence.length <= maxCharLimit) {
            // thêm nguyên câu
            currentSlide += sentence + " ";
            continue;
        }

        // 2.1 nếu thêm cả câu sẽ vượt max → phải chia
        let words = nlp(sentence).terms().out("array");

        // 2.1.a slide chưa đủ "dày" (< halfMax) → bồi cho đạt ≥ halfMax
        if (currentSlide.length < halfMax) {
            const need   = takeChunk(words, currentSlide.length);
            currentSlide += need.chunk + " ";
            words = words.slice(need.cnt);
        }

        // đẩy slide (đã chắc chắn ≥ halfMax)
        slides.push(currentSlide.trim());
        currentSlide = "";

        // 2.1.b xử lý phần còn lại của câu
        while (words.length) {
            if (words.join(" ").length <= maxCharLimit) {
                // còn lại đủ nhỏ → thành slide mới (hoặc slide cuối)
                currentSlide = words.join(" ") + " ";
                words = [];
            } else {
                const {chunk, cnt} = takeChunk(words, 0);
                currentSlide = chunk + " ";
                slides.push(currentSlide.trim());
                currentSlide = "";
                words = words.slice(cnt);
            }
        }
    }

    /* ---------- đẩy slide cuối (có thể < halfMax) ---------- */
    if (currentSlide.trim()) slides.push(currentSlide.trim());

    return slides;
}

// Hàm để tạo timing cho từng slide
function generateTimings(srtData, slides, matchThreshold, maxOffset) {
    console.log('generateTimings');
    // Mảng lưu kết quả thời gian
    const timings = [];
    // Tạo bản sao của srtData để thao tác
    let availableSrtData = [...srtData];
    let srtIndex = 0;
    let lastSlideEndTime = 0;
    let indexSlide = 0;
    // Duyệt qua từng slide
    for (const slide of slides) {
        console.debug('=== [start loop] each slide: ', indexSlide, slide);
        // Chuẩn hóa nội dung slide
        const normalizedSlide = normalizeText(slide);
        if (normalizedSlide.trim() === '') continue;
        let startIndex = null; // Vị trí bắt đầu của SRT khớp với slide
        let endIndex = null; // Vị trí kết thúc của SRT khớp với slide

        // Kiểm tra xem nội dung SRT có nằm trong slide không
        let slideSplit = normalizedSlide.split(' ').filter(word => word.trim() !== '');
        // console.debug('slideSplit: ', slideSplit);

        // tạo 1 mảng để lưu các từ trong slide tương ứng trong file srt
        let arraySrtSplit = [];

        // lặp qua các từ trong slide gốc và push vào mảng arraySrtSplit
        for (let i = 0; i < slideSplit.length; i++) {
            if(availableSrtData[i]){
                arraySrtSplit.push(normalizeText(availableSrtData[i].text));
            } else {
                console.error('Không tìm thấy từ trong SRT tương ứng với từ trong slide: ', slideSplit[i]);
            }

        }

        const lastSlideWord = slideSplit.at(-1);
        const lastSrtWord = arraySrtSplit.at(-1);

        // Nếu từ cuối của slide khác từ cuối của srt
        if (lastSlideWord !== lastSrtWord) {
            console.warn(
                'Trường hợp: từ cuối cùng trong slide không giống từ cuối cùng trong srt');
            console.warn('lastSlideWord:', lastSlideWord, 'lastSrtWord:',
                lastSrtWord);

            //TH1: Lùi từ cuối của srt split array đến giá trị trùng với từ cuối cùng trong slide
            //lặp lùi từ cuối cùng của srt đến giá trị maxOffset.
            let indexToPop = 0;
            for (let i = 0; i < maxOffset; i++) {
                let wordOfSrtAt = arraySrtSplit.at(-1 - i);
                if(lastSlideWord === wordOfSrtAt) {
                    console.warn('Khớp với từ cuối cùng trong SRT → loại bỏ từ cuối cùng của SRT', lastSlideWord, wordOfSrtAt);
                    indexToPop = i + 1; // +1 vì i bắt đầu từ 0
                    break;
                }
            }

            //Loại bỏ phần tử trong arraySrtSplit
            while(indexToPop > 1) {
                console.warn('Loại bỏ phần tử trong arraySrtSplit', arraySrtSplit.at(-1));
                arraySrtSplit.pop();
                indexToPop--;
            }

            //TH2: Tiến từ giá trị đầu tiên của availableSrtData đến giá trị trùng với từ cuối cùng của slide
            let indexToPush = 0;

            //Lặp tiến sang phải từ cuối dùng của srt đến maxOffset
            for (let i = 0; i < maxOffset; i++) {
                let nextSrtWord = availableSrtData.at(slideSplit.length + i);
                if(nextSrtWord && lastSlideWord === normalizeText(nextSrtWord.text)) {
                    console.warn('Khớp với từ trong array SRT tiếp theo → loại bỏ từ cuối cùng của SRT', lastSlideWord, normalizeText(nextSrtWord.text));
                    indexToPush = i + 1; // +1 vì i bắt đầu từ 0
                    break;
                }
            }

            //Thêm phần tử vào arraySrtSplit
            for (let i = 0; i < indexToPush; i++) {
                let nextSrtItem = normalizeText(availableSrtData[slideSplit.length + i].text);
                console.warn('Thêm phần tử vào arraySrtSplit', nextSrtItem);
                arraySrtSplit.push(nextSrtItem);
            }
        }
        // console.info('arraySrtSplit sau khi xử lý: ', arraySrtSplit);

        let equalWithPercentage = fuzzyMatchAverage(arraySrtSplit, slideSplit);

        console.log('equal array: ', equalWithPercentage);
        if (parseInt(equalWithPercentage) < 100) {
            console.warn('!== 100 equal array: ', equalWithPercentage)
            console.debug('normalizedSlide : ', normalizedSlide);
            console.debug('arraySrtSplit: ', arraySrtSplit);
        } else {
            console.debug('=== 100% ===> passed ===');
        }
        if (equalWithPercentage >= matchThreshold) {
            console.log('equalWithPercentage: ',equalWithPercentage);
            startIndex = 0;
            endIndex = srtIndex + arraySrtSplit.length - 1;
        } else {
            console.error('not equalWithPercentage: ',equalWithPercentage);
            throw Error('not equalWithPercentage');
        }

        if (startIndex == null || endIndex == null) {
            console.error('lỗi không tìm thấy SRT khớp cho slide: ', slide);
            throw  Error('startIndex == null || endIndex == null');
        }

        // Tính toán thời gian và thêm vào mảng timings
        if (startIndex !== null && endIndex !== null) {
            let startTime = 0;
            if( indexSlide === 0){
                startTime = 0; // Thời gian bắt đầu
            } else {
                startTime = lastSlideEndTime; // Thời gian bắt đầu = endtime của srt cuối cùng của slide trước.
            }
            let endTime = 0;
            //nếu là slide cuối cùng thì lấy endtime chính là endtime của srt cuối cùng
            if(endIndex === availableSrtData.length - 1) {
                endTime = availableSrtData[endIndex].end; // Thời gian kết thúc
                console.log("-->last word in in srt: ", availableSrtData[endIndex].text);
            }
            // nếu khoong thì lấy trung bình của srt cuối cùng sủa slide hiện tại và srt đầu của slide tiếp theo
            else {
                // endTime = (availableSrtData[endIndex + 1].start + availableSrtData[endIndex].end) / 2;
                endTime = (availableSrtData[endIndex + 1].start + availableSrtData[endIndex].end) * 0.5;
                console.log("--> end word of slide in srt: ", availableSrtData[endIndex].text);
            }
            lastSlideEndTime = endTime;
            const duration = endTime - startTime; // Thời lượng
            timings.push({
                slide: slide, // Nội dung slide gốc
                start: startTime, // Thời gian bắt đầu (giây hoặc mili giây tùy srtData)
                end: endTime, // Thời gian kết thúc
                duration: duration // Thời lượng của slide
            });

            // Loại bỏ các SRT entry đã khớp khỏi availableSrtData
            availableSrtData.splice(startIndex, endIndex - startIndex + 1);
        } else {
            // Nếu không tìm thấy mục SRT khớp, gán thời gian mặc định
            console.warn(`Không tìm thấy SRT khớp cho slide: "${slide}"`);
            timings.push({
                slide: slide,
                start: 0,
                end: 0,
                duration: 0
            });
        }
        console.debug('=== [end loop] each slide: ', indexSlide, slide);
        indexSlide++;
    }

    console.log('timings: ', timings);
    return timings; // Trả về mảng chứa thông tin thời gian cho từng slide
}

// ===== Main Entry Point =====
async function main() {
    const args = minimist(process.argv.slice(2));
    console.log("📜 Parsing arguments...");
    const srtPath = args.srt, contentPath = args.content;
    const maxChar = parseInt(args.maxChar || 200),
        minChar = parseInt(args.minChar || 100);
    const matchThreshold = parseInt(args.matchThreshold || 90);
    const maxOffset = parseInt(args.maxOffset || 3);
    console.log(`SRT: ${srtPath}`);
    console.log(`Content: ${contentPath}`);
    console.log(`Max char: ${maxChar}`);
    console.log(`Min char: ${minChar}`);
    console.log(`matchThreshold: ${matchThreshold}`);
    console.log(`maxOffset: ${maxOffset}`);


    console.log("📁 Reading files...");
    const srtContent = fs.readFileSync(srtPath, 'utf-8');
    const rawContent = fs.readFileSync(contentPath, 'utf-8');

    const srtData = parseSRT(srtContent);
    console.log(`📜 Loaded ${srtData.length} subtitle entries.`);

    const slides = processRawContent(rawContent, maxChar, minChar);
    const timings = generateTimings(srtData, slides, matchThreshold,maxOffset);

    const jsonData = timings.map(t => ({
        text: t.slide,
        timing: parseFloat((t.duration / 1000).toFixed(2))
    }));
    fs.writeJsonSync('slides-timing.json', jsonData, {spaces: 2});
    console.log("💾 File 'slides-timing.json' created successfully!");
}

main().catch(err => {
    console.error("🔥 Error:", err);
    process.exit(1);
});
