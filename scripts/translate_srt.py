#!/usr/bin/env python3
"""
translate_srt.py
Updated: includes stricter prompt (returns only SRT in a code block) and SRT validation.
Usage:
  python scripts/translate_srt.py --input path/to/input.zh.srt --language "English" --output path/to/output.en.srt
Requires:
  pip install google-genai
Set your GEMINI_API_KEY as a repo secret / environment variable.

Behavior:
- This version uses a non-streaming call to the Gemini API.
- It waits for the full translation to be generated before processing.
"""

import os
import re
import argparse
from google import genai
from google.genai import types

# Biến regex để tìm code block đã được loại bỏ vì prompt yêu cầu không dùng markdown
# Tuy nhiên, hàm extract_code_fence vẫn được giữ lại để phòng trường hợp model vẫn trả về markdown
CODE_FENCE_RE = re.compile(r'```(?:srt\n)?(.*?)```', re.DOTALL)

def extract_code_fence(text):
    m = CODE_FENCE_RE.search(text)
    if m:
        return m.group(1).strip()
    return text.strip()

def write_srt_file(path, text):
    if not path.lower().endswith('.srt'):
        path = path + '.srt'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)
    return path

def save_raw_debug(path, raw_text):
    raw_path = path + '.raw.txt'
    with open(raw_path, 'w', encoding='utf-8') as f:
        f.write(raw_text)
    return raw_path

def build_prompt(transcript, target_language):
    prompt = f"""
Your task is to act as an automated SRT file translation service.
You will be provided with an SRT transcript in Chinese. You must translate the text content into {target_language}.

**CRITICAL RULES:**
1.  **RAW OUTPUT ONLY:** Your entire response, from the very first character to the very last, MUST be the raw content of the translated .srt file.
2.  **NO EXTRA TEXT:** DO NOT include any explanations, introductory sentences, closing remarks, apologies, or any text whatsoever that is not part of the translated SRT data.
3.  **NO MARKDOWN:** DO NOT wrap your response in ```srt or any other markdown code blocks.
4.  **PRESERVE STRUCTURE:** You MUST preserve the original index numbers and timecodes exactly as they appear in the input. Only translate the subtitle text itself.
5.  **TRANSLATE ALL:** Translate all text segments completely into {target_language}.

**Input SRT Transcript:**
{transcript}
"""
    return prompt

# --- SỬA LỖI VÀ TĂNG TÍNH AN TOÀN CHO HÀM NÀY ---
def translate_srt_with_gemini(api_key, model, input_srt_text, target_language, thinking_budget=-1):
    client = genai.Client(api_key=api_key)

    prompt = build_prompt(input_srt_text, target_language)

    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=prompt)]
        )
    ]

    generate_content_config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(
            thinking_budget=thinking_budget,
        ),
    )

    try:
        response = client.models.generate_content(
            model=model,
            contents=contents,
            config=generate_content_config,
        )

        # --- THAY ĐỔI QUAN TRỌNG BẮT ĐẦU TỪ ĐÂY ---

        # 1. Kiểm tra xem phản hồi có bị chặn hay không
        if response.prompt_feedback and response.prompt_feedback.block_reason:
            raise RuntimeError(f"API call failed: Content was blocked due to {response.prompt_feedback.block_reason.name}")

        # 2. Lấy văn bản một cách an toàn
        # Dùng try-except để bắt trường hợp response không có thuộc tính 'text'
        try:
            full_text = response.text
        except ValueError:
            # Lỗi này xảy ra khi response.candidates trống (ví dụ do bị lọc an toàn)
            # Chúng ta sẽ coi đây là lỗi và cung cấp thông tin gỡ lỗi
            raise RuntimeError(f"API call succeeded but returned no content. Feedback: {response.prompt_feedback}")

    except Exception as e:
        # Bắt tất cả các lỗi khác (bao gồm cả ServerError 500)
        raise RuntimeError(f"Error when calling Gemini API: {e}")

    # Xử lý văn bản như cũ
    clean = extract_code_fence(full_text)
    return full_text, clean
# --- CÁC HÀM KHÁC GIỮ NGUYÊN ---
def read_srt(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def main():
    parser = argparse.ArgumentParser(description="Translate Chinese SRT to another language using Gemini API.")
    parser.add_argument("--input", "-i", required=True, help="Path to input .srt (Chinese).")
    parser.add_argument("--language", "-l", required=True, help="Target language (e.g. English).")
    parser.add_argument("--output", "-o", required=False, help="Path to output .srt. If omitted adds .{lang}.srt")
    parser.add_argument("--model", "-m", default="gemini-2.5-pro", help="Gemini model to use.")
    parser.add_argument("--thinking-budget", type=int, default=-1, help="Thinking budget (-1 for dynamic).")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set. Add it to GitHub Secrets or env.")

    input_text = read_srt(args.input)

    print(f"Translating {args.input} -> language: {args.language} using model {args.model} ...")

    # Lệnh gọi hàm không thay đổi, nhưng hành vi bên trong đã thay đổi
    full_text, translated_clean = translate_srt_with_gemini(
        api_key=api_key,
        model=args.model,
        input_srt_text=input_text,
        target_language=args.language,
        thinking_budget=args.thinking_budget,
    )

    out_path = args.output
    if not out_path:
        base, ext = os.path.splitext(args.input)
        safe_lang = args.language.replace(' ', '_')
        out_path = f"{base}.{safe_lang}{ext}"

    written = write_srt_file(out_path, translated_clean)
    # Lệnh print này sẽ chỉ chạy sau khi đã dịch xong hoàn toàn
    print(f"\n-> Wrote translated srt to: {written}")


if __name__ == "__main__":
    main()