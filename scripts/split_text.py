# split_text.py
"""
Chia văn bản thành các đoạn ≤ max_char, bảo toàn ranh giới câu.
Log ra tiến trình bằng icon để dễ theo dõi.
Yêu cầu: nltk (pip install nltk) – chỉ tải 'punkt' (~1 MB) lần đầu.
"""

import re
from typing import List

import nltk
from nltk.tokenize import sent_tokenize

# Bảo đảm tokenizer 'punkt' có sẵn (lần đầu CI tải rất nhanh)
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    print("📥  nltk: tải tokenizer 'punkt'…")
    nltk.download("punkt", quiet=True)


def _normalize(text: str) -> str:
    """
    Chuẩn hoá văn bản nhẹ:  ”foo”→ ”. foo”, gộp khoảng trắng thừa.
    """
    text = re.sub(r'”\s+', '” ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def split_text(text: str, max_char: int) -> List[str]:
    """
    Parameters
    ----------
    text : str
        Văn bản nguồn.
    max_char : int
        Giới hạn ký tự mỗi chunk.

    Returns
    -------
    List[str]
        Danh sách các đoạn đã cắt (dưới max_char).
    """
    print(f"🔍  Đang chuẩn hoá & tách câu…")
    text = _normalize(text)
    sentences = sent_tokenize(text)
    print(f"✏️   Tổng số câu phát hiện: {len(sentences)}")

    chunks, current = [], ""
    for idx, sentence in enumerate(sentences, 1):
        proposed = (current + " " + sentence).strip() if current else sentence
        if len(proposed) <= max_char:
            current = proposed
        else:
            if current:
                chunks.append(current)
                print(f"✂️   Tạo chunk #{len(chunks)} ({len(current)} ký tự)")
            current = sentence
    if current:
        chunks.append(current)
        print(f"✂️   Tạo chunk #{len(chunks)} ({len(current)} ký tự)")

    print(f"✅ Hoàn tất chia: {len(chunks)} chunk (≤{max_char} ký tự)\n")
    return chunks

