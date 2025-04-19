# build video upload youtube

- zip toàn bộ file mp3 trong  thư mục và đẩy lên google drive
```shell
zip audio.zip *.mp3
```
- tải lên drive đúng tên các file
1. audio.zip
2. content.txt

để upload được video lên youtube:
- tạo project mới trên google cloud
- tạo client dạng webapplication -> có test là email cần upload video
- vào https://developers.google.com/oauthplayground/
- điền client secret và client id vào
- chọn youtube api v3
- chọn scope là youtube
- authorization code
- copy token

- tạo 2 refresh token : GG_REFRESH_TOKEN và YT_REFRESH_TOKEN
tương ứng với 2 scope:
```
https://www.googleapis.com/auth/youtube.upload
https://www.googleapis.com/auth/youtube.channel-memberships.creator
https://www.googleapis.com/auth/youtube
```

```
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive.readonly
```

- config env secret:
1. YT_CLIENT_ID
2. YT_CLIENT_SECRET
3. YT_REFRESH_TOKEN
4. GG_REFRESH_TOKEN

- config env variable:
1. CONFIG_JSON
2. YOUTUBE_META_JSON