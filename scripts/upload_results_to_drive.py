import os
import re
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Trích folder_id từ URL
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
    refresh_token=os.environ["YT_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["YT_CLIENT_ID"],
    client_secret=os.environ["YT_CLIENT_SECRET"]
)

drive = build("drive", "v3", credentials=creds)

# Danh sách file cần upload
upload_files = {
    "audio_adjusted.mp3": "audio_adjusted.mp3",
    "transcript.srt": "transcript.srt"
}

for local_name, drive_name in upload_files.items():
    if not os.path.exists(local_name):
        print(f"⚠️ File không tồn tại: {local_name}")
        continue

    file_metadata = {
        "name": drive_name,
        "parents": [folder_id]
    }
    media = MediaFileUpload(local_name, resumable=True)
    uploaded = drive.files().create(
        body=file_metadata,
        media_body=media,
        fields="id"
    ).execute()
    print(f"✅ Đã upload: {drive_name} (ID: {uploaded.get('id')})")
