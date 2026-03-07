import subprocess
from pathlib import Path

_FFMPEG = r"C:\Users\User\Downloads\ffmpeg-master-latest-win64-gpl-shared\ffmpeg-master-latest-win64-gpl-shared\bin\ffmpeg.exe"


def extract_frames(video_path: Path, output_dir: Path, fps: int = 30) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        _FFMPEG, "-y",
        "-i", str(video_path),
        "-vf", f"fps={fps}",
        str(output_dir / "frame_%04d.jpg"),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return len(list(output_dir.glob("frame_*.jpg")))


def encode_video(frames_dir: Path, output_path: Path, fps: int = 30) -> Path:
    cmd = [
        _FFMPEG, "-y",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame_%04d.jpg"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
