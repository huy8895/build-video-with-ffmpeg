import os
import mimetypes
import struct
from google import genai
from google.genai import types

def save_binary_file(file_name, data):
    with open(file_name, "wb") as f:
        f.write(data)
    print(f"✅ Saved file: {file_name}")

def convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    parameters = parse_audio_mime_type(mime_type)
    bits_per_sample = parameters["bits_per_sample"]
    sample_rate = parameters["rate"]
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", chunk_size, b"WAVE",
        b"fmt ", 16, 1, num_channels, sample_rate,
        byte_rate, block_align, bits_per_sample,
        b"data", data_size
    )
    return header + audio_data

def parse_audio_mime_type(mime_type: str) -> dict:
    bits_per_sample = 16
    rate = 24000
    parts = mime_type.split(";")
    for param in parts:
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                rate = int(param.split("=")[1])
            except:
                pass
        elif param.startswith("audio/L"):
            try:
                bits_per_sample = int(param.split("L")[1])
            except:
                pass
    return {"bits_per_sample": bits_per_sample, "rate": rate}

def generate_tts(text, voice_name, temperature):
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    model = "gemini-2.5-flash-preview-tts"

    contents = [types.Content(role="user", parts=[types.Part.from_text(text=text)])]

    config = types.GenerateContentConfig(
        temperature=temperature,
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            )
        ),
    )

    file_index = 0
    for chunk in client.models.generate_content_stream(
        model=model, contents=contents, config=config
    ):
        if (not chunk.candidates or not chunk.candidates[0].content or
                not chunk.candidates[0].content.parts):
            continue

        inline_data = chunk.candidates[0].content.parts[0].inline_data
        if inline_data and inline_data.data:
            mime_type = inline_data.mime_type
            data_buffer = inline_data.data
            file_extension = mimetypes.guess_extension(mime_type) or ".wav"
            if file_extension != ".wav":
                data_buffer = convert_to_wav(data_buffer, mime_type)
                file_extension = ".wav"

            output_filename = f"output_{file_index}{file_extension}"
            save_binary_file(output_filename, data_buffer)
            print(f"::set-output name=output_file::{output_filename}")
            return output_filename
    print("❌ No audio was generated.")
    return None

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--voice", type=str, required=True, help="Voice name (e.g., Aoede)")
    parser.add_argument("--speed", type=float, default=1.0, help="Temperature/speed for voice")
    parser.add_argument("--input", type=str, default="content.txt", help="Input text file")
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"❌ Input file not found: {args.input}")
        exit(1)

    with open(args.input, "r", encoding="utf-8") as f:
        text = f.read()

    output_file = generate_tts(text, args.voice, args.speed)
    if output_file:
        print(f"🎧 TTS file created: {output_file}")