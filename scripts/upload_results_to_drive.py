import os
import re
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Lấy folder ID từ URL
folder_url = os.environ["FOLDER_URL"]
match = re.search(r"/folders/([a-zA-Z0-9_-]+)", folder_url)
if not match:
    print("❌ Không thể lấy folder_id từ FOLDER_URL.")
    exit(1)
folder_id = match.group(1)
print(f"📂 Folder ID: {folder_id}")

# Xác thực
creds = Credentials(
    None,
    refresh_token=os.environ["GG_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["YT_CLIENT_ID"],
    client_secret=os.environ["YT_CLIENT_SECRET"]
)
drive = build("drive", "v3", credentials=creds)

# Lấy danh sách file từ biến môi trường
file_list_str = os.environ.get("UPLOAD_FILES", "")
if not file_list_str:
    print("⚠️ Không có file nào được chỉ định để upload (UPLOAD_FILES rỗng).")
    exit(0)

file_names = file_list_str.split()
for file_name in file_names:
    if not os.path.exists(file_name):
        print(f"⚠️ File không tồn tại: {file_name}")
        continue

    file_metadata = {
        "name": os.path.basename(file_name),
        "parents": [folder_id]
    }
    media = MediaFileUpload(file_name, resumable=True)
    uploaded = drive.files().create(
        body=file_metadata,
        media_body=media,
        fields="id"
    ).execute()
    print(f"✅ Đã upload: {file_name} (ID: {uploaded.get('id')})")
