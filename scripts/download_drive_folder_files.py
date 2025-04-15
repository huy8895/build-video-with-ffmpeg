import os
import io
import re
import sys
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# ✅ Tạo thư mục input nếu chưa có
os.makedirs("input", exist_ok=True)

# 🧾 Lấy danh sách file cần tải từ dòng lệnh
requested_files = set(sys.argv[1:])  # Ví dụ: audio.zip content.txt
if not requested_files:
    print("⚠️ Không có file nào được yêu cầu tải. Kết thúc script.")
    exit(0)

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
    refresh_token=os.environ["YT_REFRESH_TOKEN"],
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
    print("❌ Không có file nào trong folder.")
    exit(1)

# ⬇️ Tải các file được yêu cầu
for file in items:
    file_id = file["id"]
    file_name = file["name"]

    if file_name not in requested_files:
        continue

    print(f"⬇️ Đang tải: {file_name}")
    request = drive.files().get_media(fileId=file_id)
    fh = io.FileIO(os.path.join("input", file_name), "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        if status:
            print(f"   ... {int(status.progress() * 100)}%")
    print(f"✅ Đã lưu: input/{file_name}")
