# file: scripts/download_drive_folder_files_all.py

import os
import io
import re
import sys
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# ✅ Tạo thư mục input nếu chưa có
os.makedirs("input", exist_ok=True)

# 🔗 Lấy folder_id từ URL
folder_url = os.environ["FOLDER_URL"]
match = re.search(r"/folders/([a-zA-Z0-9_-]+)", folder_url)
if not match:
    print("❌ Không thể lấy folder_id từ FOLDER_URL.")
    exit(1)
folder_id = match.group(1)
print(f"📂 Folder ID: {folder_id}")

# 🔐 Xác thực
creds = Credentials(
    None,
    refresh_token=os.environ["GG_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["YT_CLIENT_ID"],
    client_secret=os.environ["YT_CLIENT_SECRET"]
)
drive = build("drive", "v3", credentials=creds)

# 🔍 Lấy danh sách file trong folder
query = f"'{folder_id}' in parents and trashed = false"
results = drive.files().list(q=query, fields="files(id, name)").execute()
items = results.get("files", [])

if not items:
    print("⚠️ Không có file nào trong folder Google Drive.")
    # Không thoát với lỗi, vì có thể workflow chỉ cần chạy mà không có file
    exit(0) 

print(f"🔎 Tìm thấy {len(items)} file trong thư mục. Bắt đầu tải xuống...")

# ⬇️ Tải tất cả các file trong thư mục
for file in items:
    file_id = file["id"]
    file_name = file["name"]

    print(f"⬇️ Đang tải: {file_name}")
    request = drive.files().get_media(fileId=file_id)
    # Lưu file vào thư mục 'input'
    fh = io.FileIO(os.path.join("input", file_name), "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        if status:
            print(f"   ... {int(status.progress() * 100)}%")
    print(f"✅ Đã lưu: input/{file_name}")

print("✅ Tải xuống tất cả các file hoàn tất.")