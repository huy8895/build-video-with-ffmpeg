#!/usr/bin/env python3
"""
gemini_tts_generate_mp3.py
Create MP3 from content.txt using Google Gemini TTS
"""

import os
import mimetypes
import struct
import subprocess
from io import BytesIO
from google import genai
from google.genai import types


# ─────────────────── Utility helpers ────────────────────
def save_file(path: str, data: bytes):
    with open(path, "wb") as f:
        f.write(data)
    print(f"✅ Saved: {path}")


def parse_audio_mime_type(mime_type: str) -> dict:
    """Extract bits_per_sample & sample_rate from e.g. audio/L16;rate=24000"""
    bits, rate = 16, 24000
    for part in mime_type.split(";"):
        part = part.strip()
        if part.lower().startswith("rate="):
            try:
                rate = int(part.split("=")[1])
            except ValueError:
                pass
        elif part.startswith("audio/L"):
            try:
                bits = int(part.split("L")[1])
            except ValueError:
                pass
    return {"bits": bits, "rate": rate}


def pcm_to_wav(raw: bytes, mime_type: str) -> bytes:
    """Wrap raw PCM bytes with a WAV header (mono)."""
    p = parse_audio_mime_type(mime_type)
    bits, rate = p["bits"], p["rate"]
    num_channels, data_size = 1, len(raw)
    block_align = num_channels * (bits // 8)
    byte_rate = rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", chunk_size, b"WAVE",
        b"fmt ", 16, 1, num_channels, rate,
        byte_rate, block_align, bits,
        b"data", data_size
    )
    return header + raw


def wav_to_mp3(wav_bytes: bytes, sample_rate: int, bits: int, out_path: str):
    """Convert WAV/PCM ↦ MP3 via ffmpeg (stdin→file)."""
    fmt = f"s{bits}le" if bits in (16, 24, 32) else "s16le"
    cmd = [
        "ffmpeg", "-y",
        "-f", fmt,
        "-ar", str(sample_rate),
        "-ac", "1",
        "-i", "pipe:0",
        "-c:a", "libmp3lame",
        "-q:a", "4",
        out_path,
    ]
    proc = subprocess.run(cmd, input=wav_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(f"ffmpeg error: {proc.stderr.decode()[:400]}")
    print(f"🎧 MP3 created: {out_path}")


# ───────────────────── Gemini TTS ────────────────────────
def generate_mp3(text: str, voice: str, temperature: float, out_prefix: str = "output") -> str:
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    model = "gemini-2.5-flash-preview-tts"

    contents = [types.Content(role="user", parts=[types.Part.from_text(text=text)])]
    cfg = types.GenerateContentConfig(
        temperature=temperature,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
            )
        ),
    )

    # Collect ALL chunks
    raw_buffers = []
    mime_type = None
    for chunk in client.models.generate_content_stream(model=model, contents=contents, config=cfg):
        if (chunk.candidates and chunk.candidates[0].content and
                chunk.candidates[0].content.parts):
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                raw_buffers.append(part.inline_data.data)
                mime_type = part.inline_data.mime_type

    if not raw_buffers:
        print("❌ No audio returned.")
        return ""

    audio_bytes = b"".join(raw_buffers)

    # Case 1: API already gave us MP3
    if mime_type and mime_type.startswith("audio/mpeg"):
        out_path = f"{out_prefix}.mp3"
        save_file(out_path, audio_bytes)
        return out_path

    # Case 2: Raw PCM → MP3 via ffmpeg
    params = parse_audio_mime_type(mime_type or "audio/L16;rate=24000")
    wav_bytes = pcm_to_wav(audio_bytes, mime_type or "audio/L16;rate=24000")
    temp_pcm = BytesIO(wav_bytes).read()  # ensure bytes-like
    out_path = f"{out_prefix}.mp3"
    wav_to_mp3(temp_pcm, params["rate"], params["bits"], out_path)
    return out_path


# ──────────────────────── CLI ───────────────────────────
if __name__ == "__main__":
    import argparse, sys, textwrap

    parser = argparse.ArgumentParser(
        description="Generate MP3 with Gemini TTS",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Example:
              python gemini_tts_generate_mp3.py --voice Aoede --speed 1.0 --input content.txt
        """),
    )
    parser.add_argument("--voice", required=True, help="Voice name, e.g. Aoede")
    parser.add_argument("--speed", type=float, default=1.0, help="Temperature/speed")
    parser.add_argument("--input", default="content.txt", help="Input text file")
    args = parser.parse_args()

    if not os.path.isfile(args.input):
        sys.exit(f"❌ Input file not found: {args.input}")

    with open(args.input, "r", encoding="utf-8") as f:
        text_in = f.read().strip()

    out_file = generate_mp3(text_in, args.voice, args.speed)
    if out_file:
        print(f"::set-output name=output_file::{out_file}")  # for GitHub Actions
