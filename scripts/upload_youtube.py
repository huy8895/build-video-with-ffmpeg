import os
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

creds = Credentials(
    None,
    refresh_token=os.environ["YT_REFRESH_TOKEN"],
    token_uri="https://oauth2.googleapis.com/token",
    client_id=os.environ["YT_CLIENT_ID"],
    client_secret=os.environ["YT_CLIENT_SECRET"],
    scopes=["https://www.googleapis.com/auth/youtube.upload"]
)

youtube = build("youtube", "v3", credentials=creds)

request_body = {
    "snippet": {
        "title": "Video from GitHub Actions",
        "description": "This video was automatically uploaded from a GitHub Actions workflow.",
        "categoryId": "27",
        "tags": ["English", "Learning", "Automation"]
    },
    "status": {
        "privacyStatus": "unlisted"
    }
}

media = MediaFileUpload("output.mp4", mimetype="video/mp4", resumable=True)

print("🚀 Uploading video...")
response = youtube.videos().insert(
    part="snippet,status",
    body=request_body,
    media_body=media
).execute()

video_id = response["id"]
youtube_url = f"https://youtu.be/{video_id}"

print("✅ Upload successful!")
print("📺 Watch your video at:", youtube_url)

# Ghi URL vào file để các bước sau sử dụng
with open("yt_link.txt", "w") as f:
    f.write(youtube_url + "\n")


