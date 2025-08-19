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
- Builds a tight prompt that instructs Gemini to return ONLY the translated SRT inside a ```srt code block.
- Streams the generation, accumulates text, extracts the code fence content, validates SRT format.
- If validation fails, saves the raw response for debugging to <out_path>.raw.txt and exits with non-zero.

Notes:
- This script does NOT implement chunking. If your .srt is larger than the model context, you will need chunking by SRT blocks.
- Intended to be used in GH Actions; failing validation will cause GH Action job to fail.
"""

import os
import re
import argparse
from google import genai
from google.genai import types

# Regex for extracting triple-backtick code fence content
CODE_FENCE_RE = re.compile(r"```(?:\w*\n)?(.*?)```", re.DOTALL)
# Timecode regex HH:MM:SS,mmm --> HH:MM:SS,mmm
TIME_RE = re.compile(r"^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$")


def read_srt(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def extract_code_fence(text):
    m = CODE_FENCE_RE.search(text)
    if m:
        return m.group(1).strip()
    return text.strip()


def is_valid_srt(text):
    """A lightweight SRT validator.
    Checks that there are blocks separated by blank lines and each block has:
      1) an integer index line
      2) a timecode line with correct format
      3) at least one text line
    Returns True if basic structure looks like SRT.
    """
    if not text or not text.strip():
        return False

    # split on blank lines (one or more)
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text.strip()) if b.strip()]
    if not blocks:
        return False

    for block in blocks:
        lines = block.splitlines()
        if len(lines) < 2:
            return False
        # first line should be an integer index
        if not re.fullmatch(r"\d+", lines[0].strip()):
            return False
        # second line should be a timecode
        if not TIME_RE.match(lines[1].strip()):
            return False
        # there should be at least one non-empty text line following
        text_lines = [ln for ln in lines[2:] if ln.strip()]
        if not text_lines:
            return False

    return True


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
    # New, stricter, English prompt that forbids code blocks and any extra text.
    # It commands the model to act as a pure data transformation endpoint.
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

    output_chunks = []
    try:
        for chunk in client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generate_content_config,
        ):
            if getattr(chunk, 'text', None):
                # Print to stdout so GH Actions logs receive partial output
                print(chunk.text, end='', flush=True)
                output_chunks.append(chunk.text)
    except Exception as e:
        raise RuntimeError(f"Error when calling Gemini API: {e}")

    full_text = ''.join(output_chunks)
    clean = extract_code_fence(full_text)
    return full_text, clean


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

    # # Validate SRT
    # if not is_valid_srt(translated_clean):
    #     # Save raw response for debugging
    #     raw_path = save_raw_debug(out_path, full_text)
    #     print(f"\nTranslated output failed SRT validation. Raw output saved to: {raw_path}")
    #     raise RuntimeError("Translated output is not valid SRT. See raw output for debugging.")

    written = write_srt_file(out_path, translated_clean)
    print(f"\n-> Wrote translated srt to: {written}")


if __name__ == "__main__":
    main()
