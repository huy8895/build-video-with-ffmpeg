# pip install google-genai
import os, mimetypes, struct
from google import genai
from google.genai import types


def save_binary_file(file_name: str, data: bytes):
    with open(file_name, "wb") as f:
        f.write(data)
    print(f"✅ File saved: {file_name}")


# ──────── Google sample helpers ────────
def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    parameters       = parse_audio_mime_type(mime_type)
    bits_per_sample  = parameters["bits_per_sample"]
    sample_rate      = parameters["rate"]
    num_channels     = 1
    data_size        = len(audio_data)
    byte_rate        = sample_rate * num_channels * bits_per_sample // 8
    block_align      = num_channels * bits_per_sample // 8
    chunk_size       = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", chunk_size, b"WAVE",
        b"fmt ", 16, 1, num_channels, sample_rate,
        byte_rate, block_align, bits_per_sample,
        b"data", data_size
    )
    return header + audio_data


def parse_audio_mime_type(mime_type: str) -> dict[str, int | None]:
    bits_per_sample, rate = 16, 24000
    for p in mime_type.split(";"):
        p = p.strip()
        if p.lower().startswith("rate="):
            try:
                rate = int(p.split("=")[1])
            except ValueError:
                pass
        elif p.startswith("audio/L"):
            try:
                bits_per_sample = int(p.split("L")[1])
            except ValueError:
                pass
    return {"bits_per_sample": bits_per_sample, "rate": rate}


# ───────────────────────────────────────
def generate(text: str, voice_name: str = "Zephyr", temperature: float = 1.0):
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    model  = "gemini-2.5-flash-preview-tts"

    contents = [types.Content(role="user",
                              parts=[types.Part.from_text(text=text)])]

    cfg = types.GenerateContentConfig(
        temperature=temperature,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(
                    voice_name=voice_name
                )
            )
        ),
    )

    print("⏳ Generating audio…")
    raw_audio   = bytearray()
    mime_type   = None
    for chunk in client.models.generate_content_stream(
        model=model, contents=contents, config=cfg
    ):
        if (chunk.candidates and chunk.candidates[0].content and
                chunk.candidates[0].content.parts):
            part = chunk.candidates[0].content.parts[0]
            if part.inline_data and part.inline_data.data:
                raw_audio.extend(part.inline_data.data)
                mime_type = part.inline_data.mime_type
            elif part.text:
                # Optional: print partial transcripts if you also request text
                print(part.text, end="", flush=True)

    if not raw_audio:
        raise RuntimeError("❌ No audio was generated.")

    # Nếu Gemini đã trả về đuôi chuẩn (.wav, .mp3, .ogg)
    ext = mimetypes.guess_extension(mime_type or "")
    if ext and ext != ".raw" and not ext.startswith(".bin"):
        filename = f"output{ext}"
        save_binary_file(filename, raw_audio)
        return filename

    # Ngược lại là raw PCM ⇒ gói WAV
    filename = "output.wav"
    wav_bytes = convert_to_wav(bytes(raw_audio), mime_type or "audio/L16;rate=24000")
    save_binary_file(filename, wav_bytes)
    return filename


# ────────────── CLI test ───────────────
if __name__ == "__main__":
    import argparse, pathlib, sys

    p = argparse.ArgumentParser(description="Gemini TTS sample (fixed WAV)")
    p.add_argument("--voice", default="Zephyr", help="Voice name, e.g. Zephyr, Aoede…")
    p.add_argument("--temp",  type=float, default=1.0, help="Temperature (speed / style)")
    p.add_argument("--input", default="content.txt", help="Input text file")
    args = p.parse_args()

    if not pathlib.Path(args.input).is_file():
        sys.exit(f"❌ Input file not found: {args.input}")

    with open(args.input, "r", encoding="utf-8") as f:
        text_in = f.read().strip()

    out = generate(text_in, args.voice, args.temp)
    print(f"\n🎧 Done! Audio file → {out}")
