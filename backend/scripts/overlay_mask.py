import subprocess
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent

INPUT_VIDEO = BASE_DIR / "input" / "video.mp4"
MASK_IMAGE = BASE_DIR / "output" / "mask.png"
OUTPUT_VIDEO = BASE_DIR / "output" / "output.mp4"

cmd = [
    "ffmpeg",
    "-y",
    "-i", str(INPUT_VIDEO),
    "-loop", "1",
    "-i", str(MASK_IMAGE),
    "-filter_complex",
    "[1:v]format=rgba,colorchannelmixer=aa=0.35[mask];[0:v][mask]overlay=0:0",
    "-t", "5",
    str(OUTPUT_VIDEO),
]

subprocess.run(cmd, check=True)
print(f"Saved overlaid video to {OUTPUT_VIDEO}")