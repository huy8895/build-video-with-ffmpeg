import os
import io
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# Setup credentials
creds = Credentials(
    None,
    refresh_token=os.environ["YT_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["YT_CLIENT_ID"],
    client_secret=os.environ["YT_CLIENT_SECRET"]
)

# Create Drive API client
service = build("drive", "v3", credentials=creds)

# Get file ID and output name
file_id = os.environ["DRIVE_FILE_ID"]
file_name = os.environ.get("DRIVE_FILE_NAME", "downloaded_file.zip")

# Download file
request = service.files().get_media(fileId=file_id)
fh = io.FileIO(file_name, "wb")
downloader = MediaIoBaseDownload(fh, request)

done = False
while not done:
    status, done = downloader.next_chunk()
    print(f"Download {int(status.progress() * 100)}% complete.")

print(f"✅ File downloaded and saved as {file_name}")
print(f"📁 File saved: {os.path.abspath(file_name)}")

