import os
import json
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# Load YouTube metadata JSON from env
meta = json.loads(os.environ["YOUTUBE_META_JSON"])

# Override title with video_number
video_number = os.environ.get("VIDEO_NUMBER", "0")
meta["snippet"]["title"] = f"Video #{video_number}"

# Set up credentials
creds = Credentials(
    None,
    refresh_token=os.environ["YT_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["YT_CLIENT_ID"],
    client_secret=os.environ["YT_CLIENT_SECRET"],
    scopes=["https://www.googleapis.com/auth/youtube.upload"]
)

# Build API client
youtube = build("youtube", "v3", credentials=creds)

# Prepare media
media = MediaFileUpload("output.mp4", mimetype="video/mp4", resumable=True)

print("🚀 Uploading video...")
response = youtube.videos().insert(
    part="snippet,status",
    body=meta,
    media_body=media
).execute()

video_id = response["id"]
youtube_url = f"https://youtu.be/{video_id}"

print("✅ Upload successful!")
print("📺 Watch your video at:", youtube_url)

# Save link to file for later steps
with open("yt_link.txt", "w") as f:
    f.write(youtube_url + "\n")
