import os
import re
import io
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Lấy URL folder từ input
folder_url = os.environ["FOLDER_URL"]

# Regex tách folder_id
match = re.search(r"/folders/([a-zA-Z0-9_-]+)", folder_url)
if not match:
    print("❌ Không thể tách folder_id từ URL.")
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
save_dir = "downloads"
os.makedirs(save_dir, exist_ok=True)

# Lấy danh sách file trong folder
query = f"'{folder_id}' in parents and trashed = false"
results = drive.files().list(q=query, fields="files(id, name)").execute()
items = results.get("files", [])

if not items:
    print("❌ No files found in the folder.")
    exit(1)

print(f"📁 Found {len(items)} file(s) in folder.")

for file in items:
    file_id = file["id"]
    file_name = file["name"]
    print(f"⬇️ Downloading: {file_name}")

    request = drive.files().get_media(fileId=file_id)
    fh = io.FileIO(os.path.join(save_dir, file_name), "wb")
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    while not done:
        status, done = downloader.next_chunk()
        if status:
            print(f"   ... {int(status.progress() * 100)}%")

    print(f"✅ Saved: {file_name}")
