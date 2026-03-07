# FrameShift AI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working hackathon demo where a user uploads a video, clicks an object, applies an edit (recolor/resize/replace), and sees the edit propagated across the entire video — with Cloudinary handling per-frame transformations and video delivery.

**Architecture:** Next.js frontend calls 6 FastAPI endpoints in sequence. Backend orchestrates YOLOv11 (detection), SAM 2 (segmentation + tracking), Cloudinary (per-frame transforms), and FFmpeg (frame extraction + re-encoding). All project data stored in /tmp/frameshift/{project_id}/.

**Tech Stack:** Next.js, Tailwind, Konva.js, FastAPI, YOLOv11, SAM 2, FFmpeg, Cloudinary SDK

---

## Task 1: Backend — Project manager + Cloudinary config

Sets up project directory structure, Cloudinary SDK, and the `/upload` endpoint.

**Files:**
- Create: `hackcan/backend/services/__init__.py`
- Create: `hackcan/backend/services/cloudinary_service.py`
- Create: `hackcan/backend/services/project_manager.py`
- Modify: `hackcan/backend/main.py`
- Modify: `hackcan/backend/.env.example`
- Modify: `hackcan/backend/requirements.txt` (add `httpx`)

**Step 1: Create project manager**

```python
# hackcan/backend/services/project_manager.py
import uuid
from pathlib import Path

BASE_DIR = Path("/tmp/frameshift")

def create_project() -> dict:
    project_id = str(uuid.uuid4())[:8]
    project_dir = BASE_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "frames").mkdir(exist_ok=True)
    (project_dir / "masks").mkdir(exist_ok=True)
    (project_dir / "edited").mkdir(exist_ok=True)
    return {"project_id": project_id, "project_dir": str(project_dir)}

def get_project_dir(project_id: str) -> Path:
    project_dir = BASE_DIR / project_id
    if not project_dir.exists():
        raise FileNotFoundError(f"Project {project_id} not found")
    return project_dir
```

**Step 2: Create Cloudinary service**

```python
# hackcan/backend/services/cloudinary_service.py
import os
import cloudinary
import cloudinary.uploader
import cloudinary.api

def configure():
    cloudinary.config(
        cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
        api_key=os.getenv("CLOUDINARY_API_KEY"),
        api_secret=os.getenv("CLOUDINARY_API_SECRET"),
        secure=True,
    )

def upload_file(file_path: str, folder: str = "frameshift", resource_type: str = "image") -> dict:
    result = cloudinary.uploader.upload(
        file_path,
        folder=folder,
        resource_type=resource_type,
    )
    return {
        "public_id": result["public_id"],
        "url": result["secure_url"],
        "width": result.get("width"),
        "height": result.get("height"),
    }

def get_url(public_id: str, transformations: list = None, resource_type: str = "image") -> str:
    options = {"secure": True}
    if transformations:
        options["transformation"] = transformations
    return cloudinary.CloudinaryImage(public_id).build_url(**options)
```

**Step 3: Create __init__.py**

```python
# hackcan/backend/services/__init__.py
```

**Step 4: Update main.py with /upload endpoint**

Replace the entire `hackcan/backend/main.py` with the new structure. Keep `/health`, replace `/analyze-frame` with `/detect`, replace stubs with real endpoint signatures.

```python
# hackcan/backend/main.py
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pydantic import BaseModel
import shutil

from services import cloudinary_service, project_manager

load_dotenv()
cloudinary_service.configure()

app = FastAPI(title="FrameShift AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# --- Upload ---

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    project = project_manager.create_project()
    project_dir = project_manager.get_project_dir(project["project_id"])

    video_path = project_dir / "original.mp4"
    with open(video_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    result = cloudinary_service.upload_file(str(video_path), resource_type="video")

    return {
        "project_id": project["project_id"],
        "video_url": result["url"],
        "public_id": result["public_id"],
    }
```

**Step 5: Test manually**

```bash
cd hackcan/backend
source venv/bin/activate
# Create .env with your Cloudinary credentials
uvicorn main:app --reload --port 8000
# In another terminal:
curl -X POST http://localhost:8000/upload -F "file=@input/15454886_2560_1440_60fps.mp4"
```

Expected: JSON with project_id, video_url (Cloudinary URL), public_id.

**Step 6: Commit**

```bash
git add hackcan/backend/services/ hackcan/backend/main.py
git commit -m "feat: add project manager, Cloudinary service, and /upload endpoint"
```

---

## Task 2: Backend — /extract endpoint (FFmpeg frame extraction)

**Files:**
- Create: `hackcan/backend/services/ffmpeg_service.py`
- Modify: `hackcan/backend/main.py` (add /extract route)

**Step 1: Create FFmpeg service**

```python
# hackcan/backend/services/ffmpeg_service.py
import subprocess
from pathlib import Path


def extract_frames(video_path: Path, output_dir: Path, fps: int = 30) -> int:
    output_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-i", str(video_path),
        "-vf", f"fps={fps}",
        str(output_dir / "frame_%04d.jpg"),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return len(list(output_dir.glob("frame_*.jpg")))


def encode_video(frames_dir: Path, output_path: Path, fps: int = 30) -> Path:
    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(fps),
        "-i", str(frames_dir / "frame_%04d.jpg"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        str(output_path),
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path
```

**Step 2: Add /extract endpoint to main.py**

Append to main.py:

```python
from services import ffmpeg_service

class ExtractRequest(BaseModel):
    project_id: str

@app.post("/extract")
async def extract_frames(req: ExtractRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    video_path = project_dir / "original.mp4"
    frames_dir = project_dir / "frames"

    frame_count = ffmpeg_service.extract_frames(video_path, frames_dir)

    return {"project_id": req.project_id, "frame_count": frame_count}
```

**Step 3: Add /frame endpoint to serve individual frames**

```python
@app.get("/frame/{project_id}/{frame_index}")
async def get_frame(project_id: str, frame_index: int):
    project_dir = project_manager.get_project_dir(project_id)
    frame_path = project_dir / "frames" / f"frame_{frame_index:04d}.jpg"
    if not frame_path.exists():
        return {"error": "Frame not found"}
    return FileResponse(frame_path, media_type="image/jpeg")
```

**Step 4: Test manually**

```bash
# After uploading a video and getting a project_id:
curl -X POST http://localhost:8000/extract -H "Content-Type: application/json" -d '{"project_id": "YOUR_ID"}'
# Then view a frame:
curl http://localhost:8000/frame/YOUR_ID/1 --output test_frame.jpg
```

**Step 5: Commit**

```bash
git add hackcan/backend/services/ffmpeg_service.py hackcan/backend/main.py
git commit -m "feat: add /extract and /frame endpoints for frame extraction"
```

---

## Task 3: Backend — /detect endpoint (YOLOv11)

**Files:**
- Create: `hackcan/backend/services/yolo_service.py`
- Modify: `hackcan/backend/main.py` (add /detect route)

**Step 1: Create YOLO service**

```python
# hackcan/backend/services/yolo_service.py
import torch
from ultralytics import YOLO
from pathlib import Path

_model = None

def get_model():
    global _model
    if _model is None:
        _model = YOLO("yolo11n.pt")
    return _model

def detect(frame_path: Path) -> list:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    model = get_model()
    results = model(str(frame_path), device=device, conf=0.45, iou=0.4, imgsz=1280)

    detections = []
    for r in results:
        if r.boxes is None:
            continue
        for box in r.boxes:
            detections.append({
                "label": r.names[int(box.cls[0].item())],
                "confidence": round(float(box.conf[0].item()), 4),
                "bbox": [round(v, 2) for v in box.xyxy[0].tolist()],
            })
    return detections
```

**Step 2: Add /detect endpoint to main.py**

```python
from services import yolo_service

class DetectRequest(BaseModel):
    project_id: str
    frame_index: int

@app.post("/detect")
async def detect_objects(req: DetectRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    frame_path = project_dir / "frames" / f"frame_{req.frame_index:04d}.jpg"

    if not frame_path.exists():
        return {"error": "Frame not found"}

    detections = yolo_service.detect(frame_path)
    return {"project_id": req.project_id, "frame_index": req.frame_index, "objects": detections}
```

**Step 3: Test manually**

```bash
curl -X POST http://localhost:8000/detect -H "Content-Type: application/json" -d '{"project_id": "YOUR_ID", "frame_index": 1}'
```

Expected: JSON with objects array containing label, confidence, bbox.

**Step 4: Commit**

```bash
git add hackcan/backend/services/yolo_service.py hackcan/backend/main.py
git commit -m "feat: add /detect endpoint with YOLOv11 object detection"
```

---

## Task 4: Backend — /segment endpoint (SAM 2 + propagation)

**Files:**
- Create: `hackcan/backend/services/sam2_service.py`
- Modify: `hackcan/backend/main.py` (add /segment route)

**Step 1: Create SAM 2 service**

```python
# hackcan/backend/services/sam2_service.py
import numpy as np
from PIL import Image
from pathlib import Path
import torch

_predictor = None

def get_predictor():
    global _predictor
    if _predictor is None:
        from sam2.build_sam import build_sam2
        from sam2.sam2_image_predictor import SAM2ImagePredictor

        device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
        base_dir = Path(__file__).resolve().parent.parent
        checkpoint = str(base_dir / "checkpoints" / "sam2_hiera_large.pt")
        model = build_sam2("sam2_hiera_l.yaml", checkpoint, device=device)
        _predictor = SAM2ImagePredictor(model)
    return _predictor


def segment_frame(frame_path: Path, click_x: int, click_y: int) -> np.ndarray:
    predictor = get_predictor()
    image = np.array(Image.open(frame_path).convert("RGB"))
    predictor.set_image(image)

    input_point = np.array([[click_x, click_y]])
    input_label = np.array([1])

    masks, scores, _ = predictor.predict(
        point_coords=input_point,
        point_labels=input_label,
        multimask_output=True,
    )
    return masks[np.argmax(scores)]


def propagate_masks(frames_dir: Path, anchor_index: int, anchor_mask: np.ndarray, masks_dir: Path) -> int:
    """
    For hackathon: apply the anchor mask to all frames.
    Full SAM 2 video propagation is a stretch improvement.
    This saves the anchor mask for every frame as a starting point.
    """
    masks_dir.mkdir(parents=True, exist_ok=True)
    frame_files = sorted(frames_dir.glob("frame_*.jpg"))

    mask_img = (anchor_mask * 255).astype(np.uint8)

    for i, frame_file in enumerate(frame_files, start=1):
        mask_path = masks_dir / f"mask_{i:04d}.png"
        Image.fromarray(mask_img).save(mask_path)

    return len(frame_files)
```

Note: `propagate_masks` currently copies the anchor mask to all frames. This works for static/slow-moving objects. For the full SAM 2 video propagation (tracking through motion), replace this function with SAM 2's `propagate_in_video()` — that's a stretch improvement.

**Step 2: Add /segment endpoint to main.py**

```python
from services import sam2_service

class SegmentRequest(BaseModel):
    project_id: str
    frame_index: int
    click_x: int
    click_y: int

@app.post("/segment")
async def segment_object(req: SegmentRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    frame_path = project_dir / "frames" / f"frame_{req.frame_index:04d}.jpg"
    masks_dir = project_dir / "masks"

    if not frame_path.exists():
        return {"error": "Frame not found"}

    mask = sam2_service.segment_frame(frame_path, req.click_x, req.click_y)
    mask_count = sam2_service.propagate_masks(
        project_dir / "frames", req.frame_index, mask, masks_dir
    )

    # Save anchor mask separately for frontend preview
    anchor_mask_path = masks_dir / f"mask_{req.frame_index:04d}.png"

    return {
        "project_id": req.project_id,
        "mask_count": mask_count,
        "anchor_frame": req.frame_index,
    }
```

**Step 3: Add /mask endpoint to serve masks**

```python
@app.get("/mask/{project_id}/{mask_index}")
async def get_mask(project_id: str, mask_index: int):
    project_dir = project_manager.get_project_dir(project_id)
    mask_path = project_dir / "masks" / f"mask_{mask_index:04d}.png"
    if not mask_path.exists():
        return {"error": "Mask not found"}
    return FileResponse(mask_path, media_type="image/png")
```

**Step 4: Test manually**

```bash
curl -X POST http://localhost:8000/segment -H "Content-Type: application/json" \
  -d '{"project_id": "YOUR_ID", "frame_index": 1, "click_x": 1340, "click_y": 1040}'
```

**Step 5: Commit**

```bash
git add hackcan/backend/services/sam2_service.py hackcan/backend/main.py
git commit -m "feat: add /segment endpoint with SAM 2 segmentation and mask propagation"
```

---

## Task 5: Backend — /edit endpoint (Cloudinary per-frame transforms)

**Files:**
- Modify: `hackcan/backend/services/cloudinary_service.py` (add transform functions)
- Modify: `hackcan/backend/main.py` (add /edit route)

**Step 1: Add transform functions to cloudinary_service.py**

Append to `cloudinary_service.py`:

```python
import httpx
from pathlib import Path


async def apply_recolor(frame_public_id: str, mask_public_id: str, color: str) -> str:
    """Apply color overlay using mask. Returns transformed image URL."""
    # color should be hex without #, e.g. "FF0000"
    url = cloudinary.CloudinaryImage(frame_public_id).build_url(
        transformation=[
            {"overlay": mask_public_id.replace("/", ":"), "effect": "colorize:80",
             "color": f"#{color}", "flags": "layer_apply"},
        ],
        secure=True,
    )
    return url


async def apply_replace(frame_public_id: str, replacement_public_id: str,
                         x: int, y: int, w: int, h: int) -> str:
    """Overlay replacement image at bbox position."""
    url = cloudinary.CloudinaryImage(frame_public_id).build_url(
        transformation=[
            {"overlay": replacement_public_id.replace("/", ":"),
             "width": w, "height": h, "crop": "scale"},
            {"flags": "layer_apply", "x": x, "y": y, "gravity": "north_west"},
        ],
        secure=True,
    )
    return url


async def apply_resize(frame_public_id: str, mask_public_id: str,
                        x: int, y: int, w: int, h: int, scale: float) -> str:
    """Scale the masked region by factor and overlay back."""
    new_w = int(w * scale)
    new_h = int(h * scale)
    offset_x = x - (new_w - w) // 2
    offset_y = y - (new_h - h) // 2

    url = cloudinary.CloudinaryImage(frame_public_id).build_url(
        transformation=[
            {"overlay": mask_public_id.replace("/", ":"),
             "width": new_w, "height": new_h, "crop": "scale"},
            {"flags": "layer_apply", "x": offset_x, "y": offset_y, "gravity": "north_west"},
        ],
        secure=True,
    )
    return url


async def download_url(url: str, save_path: Path):
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
        save_path.write_bytes(resp.content)
```

**Step 2: Add /edit endpoint to main.py**

```python
import asyncio
from typing import Optional
from services import cloudinary_service

class EditRequest(BaseModel):
    project_id: str
    edit_type: str  # "recolor", "resize", "replace"
    color: Optional[str] = None  # hex without #, e.g. "FF0000"
    scale: Optional[float] = None
    replacement_public_id: Optional[str] = None

@app.post("/edit")
async def edit_frames(req: EditRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    frames_dir = project_dir / "frames"
    masks_dir = project_dir / "masks"
    edited_dir = project_dir / "edited"
    edited_dir.mkdir(exist_ok=True)

    frame_files = sorted(frames_dir.glob("frame_*.jpg"))
    mask_files = sorted(masks_dir.glob("mask_*.png"))

    if len(frame_files) == 0 or len(mask_files) == 0:
        return {"error": "No frames or masks found. Run /extract and /segment first."}

    # Upload all frames and masks to Cloudinary
    frame_ids = {}
    mask_ids = {}

    for f in frame_files:
        result = cloudinary_service.upload_file(str(f), folder=f"frameshift/{req.project_id}/frames")
        frame_ids[f.name] = result["public_id"]

    for m in mask_files:
        result = cloudinary_service.upload_file(str(m), folder=f"frameshift/{req.project_id}/masks")
        mask_ids[m.name] = result["public_id"]

    # Get mask bbox from first mask for positioning
    from PIL import Image
    import numpy as np
    anchor_mask = np.array(Image.open(mask_files[0]))
    rows = np.any(anchor_mask > 0, axis=1)
    cols = np.any(anchor_mask > 0, axis=0)
    y_min, y_max = np.where(rows)[0][[0, -1]]
    x_min, x_max = np.where(cols)[0][[0, -1]]
    bbox_x, bbox_y = int(x_min), int(y_min)
    bbox_w, bbox_h = int(x_max - x_min), int(y_max - y_min)

    # Apply transforms and download results
    async def process_frame(frame_name, mask_name, index):
        f_id = frame_ids[frame_name]
        m_id = mask_ids[mask_name]

        if req.edit_type == "recolor":
            url = await cloudinary_service.apply_recolor(f_id, m_id, req.color)
        elif req.edit_type == "resize":
            url = await cloudinary_service.apply_resize(f_id, m_id, bbox_x, bbox_y, bbox_w, bbox_h, req.scale)
        elif req.edit_type == "replace":
            url = await cloudinary_service.apply_replace(f_id, req.replacement_public_id, bbox_x, bbox_y, bbox_w, bbox_h)
        else:
            return

        save_path = edited_dir / f"frame_{index:04d}.jpg"
        await cloudinary_service.download_url(url, save_path)

    # Process in batches of 20 concurrent
    batch_size = 20
    frame_list = sorted(frame_ids.keys())
    mask_list = sorted(mask_ids.keys())

    for i in range(0, len(frame_list), batch_size):
        batch = []
        for j in range(i, min(i + batch_size, len(frame_list))):
            batch.append(process_frame(frame_list[j], mask_list[j], j + 1))
        await asyncio.gather(*batch)

    return {"project_id": req.project_id, "edited_frame_count": len(frame_list), "status": "done"}
```

**Step 3: Test manually**

```bash
curl -X POST http://localhost:8000/edit -H "Content-Type: application/json" \
  -d '{"project_id": "YOUR_ID", "edit_type": "recolor", "color": "FF0000"}'
```

**Step 4: Commit**

```bash
git add hackcan/backend/services/cloudinary_service.py hackcan/backend/main.py
git commit -m "feat: add /edit endpoint with Cloudinary per-frame transforms"
```

---

## Task 6: Backend — /render endpoint (FFmpeg encode + Cloudinary upload)

**Files:**
- Modify: `hackcan/backend/main.py` (add /render route)

**Step 1: Add /render endpoint**

```python
class RenderRequest(BaseModel):
    project_id: str

@app.post("/render")
async def render_video(req: RenderRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    edited_dir = project_dir / "edited"
    output_path = project_dir / "output.mp4"

    edited_frames = sorted(edited_dir.glob("frame_*.jpg"))
    if len(edited_frames) == 0:
        return {"error": "No edited frames found. Run /edit first."}

    ffmpeg_service.encode_video(edited_dir, output_path)

    result = cloudinary_service.upload_file(str(output_path), resource_type="video")

    return {
        "project_id": req.project_id,
        "video_url": result["url"],
        "cloudinary_public_id": result["public_id"],
    }
```

**Step 2: Test manually**

```bash
curl -X POST http://localhost:8000/render -H "Content-Type: application/json" \
  -d '{"project_id": "YOUR_ID"}'
```

Expected: JSON with video_url pointing to Cloudinary CDN.

**Step 3: Commit**

```bash
git add hackcan/backend/main.py
git commit -m "feat: add /render endpoint with FFmpeg encode and Cloudinary upload"
```

---

## Task 7: Frontend — Landing page with Cloudinary upload

**Files:**
- Modify: `hackcan/frontend/src/app/page.tsx`
- Modify: `hackcan/frontend/src/app/layout.tsx`
- Modify: `hackcan/frontend/src/app/globals.css`

**Step 1: Install dependencies**

```bash
cd hackcan/frontend
npm install next-cloudinary
```

**Step 2: Create landing page**

```tsx
// hackcan/frontend/src/app/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
    const data = await res.json();

    // Auto-extract frames
    await fetch(`${API_URL}/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: data.project_id }),
    });

    setUploading(false);
    router.push(`/editor/${data.project_id}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-black text-white">
      <h1 className="text-5xl font-bold mb-4">FrameShift AI</h1>
      <p className="text-lg text-gray-400 mb-8">Edit one frame. AI updates the rest.</p>

      <label className="cursor-pointer bg-purple-600 hover:bg-purple-700 px-8 py-4 rounded-lg text-lg font-semibold transition">
        {uploading ? "Uploading & extracting frames..." : "Upload Video"}
        <input type="file" accept="video/*" onChange={handleUpload} className="hidden" />
      </label>
    </main>
  );
}
```

**Step 3: Clean up globals.css**

Keep only Tailwind imports in `globals.css`, remove Next.js boilerplate styles:

```css
/* hackcan/frontend/src/app/globals.css */
@import "tailwindcss";
```

**Step 4: Test**

```bash
cd hackcan/frontend && npm run dev
# Visit http://localhost:3000
# Upload a short video
# Should redirect to /editor/{project_id}
```

**Step 5: Commit**

```bash
git add hackcan/frontend/
git commit -m "feat: add landing page with video upload"
```

---

## Task 8: Frontend — Editor page (frame viewer + YOLO bboxes)

**Files:**
- Create: `hackcan/frontend/src/app/editor/[projectId]/page.tsx`

**Step 1: Install Konva**

```bash
cd hackcan/frontend
npm install konva react-konva
```

**Step 2: Create editor page**

```tsx
// hackcan/frontend/src/app/editor/[projectId]/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Stage, Layer, Rect, Image as KonvaImage } from "react-konva";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Detection {
  label: string;
  confidence: number;
  bbox: number[];
}

export default function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [frameCount, setFrameCount] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(1);
  const [frameImage, setFrameImage] = useState<HTMLImageElement | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [maskVisible, setMaskVisible] = useState(false);
  const [editType, setEditType] = useState<string>("recolor");
  const [editColor, setEditColor] = useState("#FF0000");
  const [editScale, setEditScale] = useState(1.5);
  const [processing, setProcessing] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 540 });
  const [imageSize, setImageSize] = useState({ width: 960, height: 540 });

  // Load frame count
  useEffect(() => {
    // Get frame count by trying to detect on frame 1
    loadFrame(1);
  }, [projectId]);

  async function loadFrame(index: number) {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = `${API_URL}/frame/${projectId}/${index}`;
    img.onload = () => {
      const scale = Math.min(960 / img.width, 540 / img.height);
      setCanvasSize({ width: img.width * scale, height: img.height * scale });
      setImageSize({ width: img.width, height: img.height });
      setFrameImage(img);
    };
    setCurrentFrame(index);

    // Run detection
    const res = await fetch(`${API_URL}/detect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId, frame_index: index }),
    });
    const data = await res.json();
    setDetections(data.objects || []);
  }

  async function handleCanvasClick(e: any) {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    const scaleX = imageSize.width / canvasSize.width;
    const scaleY = imageSize.height / canvasSize.height;
    const clickX = Math.round(pos.x * scaleX);
    const clickY = Math.round(pos.y * scaleY);

    setProcessing("Segmenting object...");
    const res = await fetch(`${API_URL}/segment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        frame_index: currentFrame,
        click_x: clickX,
        click_y: clickY,
      }),
    });
    const data = await res.json();
    setMaskVisible(true);
    setProcessing(`Segmented! ${data.mask_count} masks generated.`);
  }

  async function handleApplyEdit() {
    setProcessing(`Applying ${editType} edit to all frames...`);

    const editParams: any = { project_id: projectId, edit_type: editType };
    if (editType === "recolor") editParams.color = editColor.replace("#", "");
    if (editType === "resize") editParams.scale = editScale;

    const editRes = await fetch(`${API_URL}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editParams),
    });
    await editRes.json();

    setProcessing("Rendering final video...");
    const renderRes = await fetch(`${API_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: projectId }),
    });
    const renderData = await renderRes.json();
    setResultUrl(renderData.video_url);
    setProcessing("Done!");
  }

  const scaleX = canvasSize.width / imageSize.width;
  const scaleY = canvasSize.height / imageSize.height;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <h1 className="text-2xl font-bold mb-4">FrameShift Editor</h1>

      <div className="flex gap-6">
        {/* Canvas */}
        <div>
          <Stage
            width={canvasSize.width}
            height={canvasSize.height}
            onClick={handleCanvasClick}
            className="cursor-crosshair border border-gray-700 rounded"
          >
            <Layer>
              {frameImage && (
                <KonvaImage image={frameImage} width={canvasSize.width} height={canvasSize.height} />
              )}
              {detections.map((det, i) => (
                <Rect
                  key={i}
                  x={det.bbox[0] * scaleX}
                  y={det.bbox[1] * scaleY}
                  width={(det.bbox[2] - det.bbox[0]) * scaleX}
                  height={(det.bbox[3] - det.bbox[1]) * scaleY}
                  stroke="#00ff00"
                  strokeWidth={2}
                />
              ))}
            </Layer>
          </Stage>

          {/* Frame scrubber */}
          <div className="mt-4 flex items-center gap-4">
            <span>Frame: {currentFrame}</span>
            <input
              type="range"
              min={1}
              max={300}
              value={currentFrame}
              onChange={(e) => loadFrame(Number(e.target.value))}
              className="flex-1"
            />
          </div>
        </div>

        {/* Edit panel */}
        <div className="w-72 space-y-4">
          <h2 className="text-lg font-semibold">Edit Object</h2>

          <div className="space-y-2">
            <label className="block text-sm text-gray-400">Edit Type</label>
            <select
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className="w-full bg-gray-800 rounded px-3 py-2"
            >
              <option value="recolor">Recolor</option>
              <option value="resize">Resize</option>
              <option value="replace">Replace</option>
            </select>
          </div>

          {editType === "recolor" && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Color</label>
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="w-full h-10 rounded"
              />
            </div>
          )}

          {editType === "resize" && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-400">Scale: {editScale}x</label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={editScale}
                onChange={(e) => setEditScale(Number(e.target.value))}
                className="w-full"
              />
            </div>
          )}

          <button
            onClick={handleApplyEdit}
            disabled={!maskVisible}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-3 rounded-lg font-semibold transition"
          >
            Apply Edit
          </button>

          {processing && <p className="text-sm text-gray-400">{processing}</p>}

          {resultUrl && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2">Result</h3>
              <video src={resultUrl} controls className="w-full rounded" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 3: Test**

```bash
cd hackcan/frontend && npm run dev
# Navigate to /editor/YOUR_PROJECT_ID
# Should see frame with YOLO bounding boxes
# Click an object → triggers segmentation
# Select edit type → Apply Edit → see result video
```

**Step 4: Commit**

```bash
git add hackcan/frontend/
git commit -m "feat: add editor page with frame viewer, YOLO bboxes, and edit controls"
```

---

## Task 9: Integration test — full pipeline end-to-end

**Files:** No new files. This is a manual test.

**Step 1: Start both servers**

Terminal 1:
```bash
cd hackcan/backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
```

Terminal 2:
```bash
cd hackcan/frontend && npm run dev
```

**Step 2: Create .env file**

```bash
# hackcan/backend/.env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Step 3: Run full pipeline**

1. Go to `http://localhost:3000`
2. Upload a short video (5-10 sec)
3. Wait for redirect to editor
4. See frame with YOLO bounding boxes
5. Click an object
6. Wait for "Segmented!" message
7. Select "Recolor" + pick a color
8. Click "Apply Edit"
9. Wait for processing (30-75s)
10. Watch result video in the editor

**Step 4: Debug any issues**

Common issues:
- CORS errors → check FastAPI CORS middleware allows localhost:3000
- Cloudinary auth errors → check .env credentials
- SAM 2 memory errors → use smaller video or reduce frame count
- FFmpeg encoding errors → check frame naming pattern matches

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from end-to-end testing"
```

---

## Task Order & Dependencies

```
Task 1 (upload + cloudinary + project manager)
  ↓
Task 2 (extract frames)
  ↓
Task 3 (detect objects)
  ↓
Task 4 (segment + propagate)
  ↓
Task 5 (edit via cloudinary)
  ↓
Task 6 (render final video)
  ↓
Task 7 (frontend landing page)    ← can start after Task 1
  ↓
Task 8 (frontend editor page)     ← can start after Task 3
  ↓
Task 9 (integration test)
```

Tasks 7-8 (frontend) can be built in parallel with Tasks 4-6 (backend) if two people are working.

---

## Stretch Tasks (if time permits)

### Task 10: SAM 2 video propagation
Replace `propagate_masks()` with SAM 2's actual `propagate_in_video()` for real object tracking across frames with motion.

### Task 11: Supabase auth
Add login/signup, persist projects to Supabase database.

### Task 12: WebSocket progress
Replace polling with real-time progress updates during /edit and /render.

### Task 13: Remove edit type
Add inpainting for object removal using Cloudinary generative fill or a local model.
