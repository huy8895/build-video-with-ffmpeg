# build video upload youtube

- zip toàn bộ file mp3 trong  thư mục và đẩy lên google drive
```shell
zip mp3_files.zip *.mp3
```

để upload được video lên youtube:
- tạo project mới trên google cloud
- tạo client dạng webapplication -> có test là email cần upload video
- vào https://developers.google.com/oauthplayground/
- điền client secret và client id vào
- chọn youtube api v3
- chọn scope là youtube
- authorization code
- copy token