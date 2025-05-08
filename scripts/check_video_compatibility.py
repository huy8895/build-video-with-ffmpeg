import subprocess
import sys

def get_video_info(filename):
    cmd = [
        "ffprobe", "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filename
    ]
    width, height, r_frame_rate = subprocess.check_output(cmd).decode().strip().split('\n')
    fps = eval(r_frame_rate)

    cmd_audio = [
        "ffprobe", "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels",
        "-of", "default=noprint_wrappers=1:nokey=1",
        filename
    ]
    try:
        sample_rate, channels = subprocess.check_output(cmd_audio).decode().strip().split('\n')
    except subprocess.CalledProcessError:
        sample_rate, channels = "none", "none"  # no audio track

    return {
        "width": int(width),
        "height": int(height),
        "fps": float(fps),
        "sample_rate": sample_rate,
        "channels": channels
    }

def compare_videos(file1, file2):
    info1 = get_video_info(file1)
    info2 = get_video_info(file2)

    print(f"Info for {file1}: {info1}")
    print(f"Info for {file2}: {info2}")

    compatible = True

    for key in ["width", "height", "fps", "sample_rate", "channels"]:
        if info1[key] != info2[key]:
            print(f"⚠️ Mismatch in {key}: {file1}({info1[key]}) vs {file2}({info2[key]})")
            compatible = False

    if compatible:
        print("✅ Files are compatible for concat.")
    else:
        print("❌ Files are NOT compatible. Consider normalizing before concat.")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python check_video_compatibility.py intro.mp4 output.mp4")
        sys.exit(1)

    compare_videos(sys.argv[1], sys.argv[2])
