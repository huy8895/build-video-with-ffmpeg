#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Một script có thể tái sử dụng để tạo file âm thanh đa giọng nói (multi-speaker)
sử dụng API Text-to-Speech của Google Gemini.

Yêu cầu cài đặt:
pip install google-genai

Cách thiết lập API Key:
Bạn cần đặt biến môi trường GEMINI_API_KEY.
Trên Linux/macOS:
export GEMINI_API_KEY="YOUR_API_KEY"
Trên Windows (Command Prompt):
set GEMINI_API_KEY="YOUR_API_KEY"
Trên Windows (PowerShell):
$env:GEMINI_API_KEY="YOUR_API_KEY"

Ví dụ cách chạy script:
python create_tts.py \
    --text "Speaker 1: Xin chào! Chào mừng bạn đến với Gemini. Speaker 2: Chúng tôi có thể giúp gì cho bạn hôm nay?" \
    --speaker "Speaker 1:Zephyr" \
    --speaker "Speaker 2:Puck" \
    --output "welcome_dialog.wav"
"""

import os
import argparse
import struct
import mimetypes
from typing import Dict, List, Optional

from google import genai
from google.genai import types
from google.api_core import exceptions

def generate_multi_speaker_tts(
    api_key: str,
    text_to_speak: str,
    speaker_voices: Dict[str, str],
    output_filename: str,
    model: str = "gemini-1.5-pro-preview-tts" # Bạn có thể dùng model cũ hơn nếu cần
):
    """
    Tạo một file âm thanh từ văn bản sử dụng nhiều giọng nói.
    """
    print("1. Khởi tạo client kết nối tới Gemini API...")
    try:
        # ----- ĐÂY LÀ PHẦN SỬA LỖI -----
        # Thay vì genai.configure, chúng ta khởi tạo Client trực tiếp.
        # Đây là cú pháp cũ hơn nhưng vẫn hoạt động và không gây ra lỗi 'configure'.
        client = genai.Client(api_key=api_key)
        # --------------------------------

    except Exception as e:
        print(f"Lỗi khi khởi tạo client: {e}")
        return

    print("2. Chuẩn bị cấu hình giọng nói...")
    speaker_configs = [
        types.SpeakerVoiceConfig(
            speaker=speaker_label,
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            ),
        )
        for speaker_label, voice_name in speaker_voices.items()
    ]

    # Cấu trúc nội dung và config giống với code gốc ban đầu của bạn
    contents = [
        types.Content(
            role="user",
            parts=[
                types.Part.from_text(text=text_to_speak),
            ],
        ),
    ]

    generation_config = types.GenerateContentConfig(
        response_modalities=["audio"],
        speech_config=types.SpeechConfig(
            multi_speaker_voice_config=types.MultiSpeakerVoiceConfig(
                speaker_voice_configs=speaker_configs
            ),
        ),
    )

    print(f"3. Gửi yêu cầu tới model '{model}'...")
    try:
        # ----- ĐÂY LÀ PHẦN SỬA LỖI -----
        # Sử dụng client.models.generate_content_stream thay vì client.generate_content
        response_stream = client.models.generate_content_stream(
            model=model,
            contents=contents,
            config=generation_config,
        )
        # --------------------------------

        audio_chunks = []
        first_mime_type = None

        print("4. Nhận và xử lý luồng âm thanh...")
        for chunk in response_stream:
            # Logic xử lý chunk giữ nguyên như phiên bản đầu tiên của bạn
            if (
                chunk.candidates is not None
                and chunk.candidates[0].content is not None
                and chunk.candidates[0].content.parts is not None
                and chunk.candidates[0].content.parts[0].inline_data
                and chunk.candidates[0].content.parts[0].inline_data.data
            ):
                inline_data = chunk.candidates[0].content.parts[0].inline_data
                if not first_mime_type:
                    first_mime_type = inline_data.mime_type
                audio_chunks.append(inline_data.data)

        if not audio_chunks:
            print("Không nhận được dữ liệu âm thanh từ API.")
            # In ra văn bản phản hồi nếu có, để debug
            for chunk in response_stream:
                if chunk.text:
                    print(f"API Response Text: {chunk.text}")
            return

        print("5. Gộp các đoạn âm thanh và lưu file...")
        full_audio_data = b"".join(audio_chunks)
        wav_data = _convert_to_wav(full_audio_data, first_mime_type)

        with open(output_filename, "wb") as f:
            f.write(wav_data)
        print(f"✅ Đã lưu file âm thanh thành công vào: {output_filename}")

    except exceptions.PermissionDenied as e:
        print(f"Lỗi xác thực: API Key không hợp lệ hoặc chưa được cấp quyền. Chi tiết: {e}")
    except Exception as e:
        print(f"Đã xảy ra lỗi không mong muốn: {e}")


def _convert_to_wav(audio_data: bytes, mime_type: str) -> bytes:
    """Tạo header cho file WAV và ghép nó với dữ liệu âm thanh thô."""
    parameters = _parse_audio_mime_type(mime_type)
    bits_per_sample = parameters.get("bits_per_sample", 16)
    sample_rate = parameters.get("rate", 24000)
    num_channels = 1
    data_size = len(audio_data)
    bytes_per_sample = bits_per_sample // 8
    block_align = num_channels * bytes_per_sample
    byte_rate = sample_rate * block_align
    chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", chunk_size, b"WAVE", b"fmt ",
        16, 1, num_channels, sample_rate,
        byte_rate, block_align, bits_per_sample,
        b"data", data_size
    )
    return header + audio_data

def _parse_audio_mime_type(mime_type: str) -> Dict[str, int]:
    """Phân tích mime_type để lấy các thông số âm thanh."""
    params = {"bits_per_sample": 16, "rate": 24000} # Giá trị mặc định
    parts = mime_type.split(";")
    for param in parts:
        param = param.strip()
        if param.lower().startswith("rate="):
            try:
                params["rate"] = int(param.split("=", 1)[1])
            except (ValueError, IndexError):
                pass
        elif param.startswith("audio/L"):
            try:
                params["bits_per_sample"] = int(param.split("L", 1)[1])
            except (ValueError, IndexError):
                pass
    return params

def main():
    """Hàm chính để phân tích tham số dòng lệnh và chạy quá trình tạo TTS."""
    parser = argparse.ArgumentParser(
        description="Tạo file âm thanh đa giọng nói bằng Google Gemini TTS API.",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "-t", "--text",
        required=True,
        help="Văn bản cần chuyển đổi. Phải chứa nhãn người nói.\nVí dụ: \"Speaker 1: Hello. Speaker 2: Hi there.\""
    )
    parser.add_argument(
        "-s", "--speaker",
        required=True,
        action="append",
        help="Ánh xạ người nói tới giọng nói theo định dạng 'Label:VoiceName'.\nLặp lại tham số này cho mỗi người nói.\nVí dụ: --speaker \"Speaker 1:Zephyr\" --speaker \"Speaker 2:Puck\""
    )
    parser.add_argument(
        "-o", "--output",
        default="output.wav",
        help="Tên file đầu ra. Mặc định là 'output.wav'."
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("GEMINI_API_KEY"),
        help="API Key của Gemini. Mặc định sẽ đọc từ biến môi trường GEMINI_API_KEY."
    )

    args = parser.parse_args()

    if not args.api_key:
        print("Lỗi: Không tìm thấy API Key. Vui lòng cung cấp qua tham số --api-key hoặc đặt biến môi trường GEMINI_API_KEY.")
        return

    # Chuyển đổi danh sách speaker từ dòng lệnh thành từ điển
    try:
        speaker_voices = dict(s.split(":", 1) for s in args.speaker)
    except ValueError:
        print("Lỗi: Định dạng --speaker không hợp lệ. Vui lòng sử dụng định dạng 'Label:VoiceName'.")
        return

    generate_multi_speaker_tts(
        api_key=args.api_key,
        text_to_speak=args.text,
        speaker_voices=speaker_voices,
        output_filename=args.output
    )

if __name__ == "__main__":
    main()