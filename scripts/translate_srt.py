#!/usr/bin/env python3
"""
translate_srt.py
Updated: Uses a stricter, English-based prompt that forbids markdown/code blocks.
The model is instructed to return ONLY raw SRT content.
Usage:
  python scripts/translate_srt.py --input path/to/input.zh.srt --language "English" --output path/to/output.en.srt
"""

import os
import re
import argparse
from google import genai
from google.genai import types

# Timecode regex remains the same
TIME_RE = re.compile(r"^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$")


def read_srt(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


# The extract_code_fence function is NO LONGER NEEDED.


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

    # We strip the whole text once at the beginning to handle potential leading/trailing whitespace
    clean_text = text.strip()

    blocks = [b.strip() for b in re.split(r"\n\s*\n", clean_text) if b.strip()]
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
    # Use strip() one last time to ensure clean output
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text.strip())
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

    # Added safety_settings to be less restrictive, which can sometimes help with formatting issues
    safety_settings = [
        {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
        {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
    ]

    generation_config = genai.types.GenerationConfig(
        # Set temperature to a lower value for more predictable, less "creative" output
        temperature=0.2
    )

    output_chunks = []
    full_text = ""
    try:
        model_instance = client.models.get(model)
        # Using the regular generate_content instead of stream for simplicity and atomicity,
        # but stream is also fine.
        response = model_instance.generate_content(
            contents=contents,
            generation_config=generation_config,
            safety_settings=safety_settings,
        )
        full_text = response.text
        # Print the full response at once
        print(full_text)

    except Exception as e:
        raise RuntimeError(f"Error when calling Gemini API: {e}")

    # Since we no longer use code blocks, the full_text IS the clean text.
    # We just strip any potential whitespace.
    clean_text = full_text.strip()
    return full_text, clean_text


def main():
    parser = argparse.ArgumentParser(description="Translate Chinese SRT to another language using Gemini API.")
    parser.add_argument("--input", "-i", required=True, help="Path to input .srt (Chinese).")
    parser.add_argument("--language", "-l", required=True, help="Target language (e.g. English).")
    parser.add_argument("--output", "-o", required=False, help="Path to output .srt. If omitted adds .{lang}.srt")
    parser.add_argument("--model", "-m", default="gemini-1.5-pro-latest", help="Gemini model to use.")
    parser.add_argument("--thinking-budget", type=int, default=-1, help="Thinking budget (deprecated for non-streaming).")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY environment variable not set. Add it to GitHub Secrets or env.")

    input_text = read_srt(args.input)

    print(f"Translating {args.input} -> language: {args.language} using model {args.model} ...")
    # The first return value is the raw response, the second is the one we'll validate
    raw_response, translated_srt = translate_srt_with_gemini(
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

    # Validate the cleaned SRT
    if not is_valid_srt(translated_srt):
        raw_path = save_raw_debug(out_path, raw_response)
        print(f"\nTranslated output failed SRT validation. Raw output saved to: {raw_path}")
        raise RuntimeError("Translated output is not valid SRT. See raw output for debugging.")

    written = write_srt_file(out_path, translated_srt)
    print(f"\n-> Wrote translated srt to: {written}")


if __name__ == "__main__":
    main()