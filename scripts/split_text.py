# split_text.py
"""
Chia văn bản thành các đoạn ≤ max_char, bảo toàn ranh giới câu.
Cần thư viện nltk (tokenizer tiếng Anh nhanh, không phụ thuộc model nặng).
"""

import re
from typing import List

import nltk
from nltk.tokenize import sent_tokenize

# Đảm bảo tokenizer 'punkt' có sẵn (lần đầu sẽ tải ~1 MB)
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:  # CI mới toanh
    nltk.download("punkt", quiet=True)


def _normalize(text: str) -> str:
    """
    Bóc tách một số cặp ký tự đặc biệt giống JS (”. → ”. )
    và chuẩn hoá khoảng trắng thừa.
    """
    text = re.sub(r'”\s+', '” ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def split_text(text: str, max_char: int) -> List[str]:
    """
    Parameters
    ----------
    text : str
        Văn bản nguồn (tiếng Anh hoặc đa ngôn ngữ đều được nếu kết thúc bằng .?!)
    max_char : int
        Giới hạn ký tự mỗi chunk

    Returns
    -------
    List[str]
        Danh sách các đoạn đã cắt
    """
    text = _normalize(text)
    sentences = sent_tokenize(text)

    chunks, current = [], ""
    for sentence in sentences:
        # Thêm khoảng trắng trước câu (trừ câu đầu)
        proposed = (current + " " + sentence).strip() if current else sentence
        if len(proposed) <= max_char:
            current = proposed
        else:
            if current:
                chunks.append(current)
            current = sentence  # start new chunk
    if current:
        chunks.append(current)
    return chunks


# ---------- ví dụ test nhanh ----------
if __name__ == "__main__":
    demo = ("Welcome back to Onyx Shadowing English. "
            "This is a tiny example. We want to cut it smartly! "
            "Each chunk must stay under 60 characters. Ready?")
    for i, part in enumerate(split_text(demo, max_char=60), 1):
        print(f"[{i}] {part} ({len(part)} chars)")
