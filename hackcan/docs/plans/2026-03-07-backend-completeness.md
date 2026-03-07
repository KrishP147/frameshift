# Backend Completeness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add missing edit types (add, delete), frame range support, BackgroundTasks for YOLO pre-computation, and status polling endpoint.

**Architecture:** Extend existing cloudinary_service.py with generative AI transforms (e_gen_remove, e_gen_replace for add). Refactor /edit to accept batch edit rules with start_frame/end_frame. Move YOLO detection into BackgroundTasks during /extract. Add GET /project/{id}/status for polling.

**Tech Stack:** FastAPI BackgroundTasks, Cloudinary generative AI (e_gen_remove, e_gen_replace), existing services

---

## Task 1: Add delete + add transforms to cloudinary_service.py

**Files:**
- Modify: `hackcan/backend/services/cloudinary_service.py`

**Step 1: Add apply_delete and apply_add functions**

Append to `cloudinary_service.py`:

```python
async def apply_delete(frame_public_id: str, mask_public_id: str) -> str:
    """Remove masked object using Cloudinary generative AI."""
    url = cloudinary.CloudinaryImage(frame_public_id).build_url(
        transformation=[
            {"overlay": mask_public_id.replace("/", ":"), "flags": "layer_apply"},
            {"effect": "gen_remove", "prompt": "remove the masked object"},
        ],
        secure=True,
    )
    return url


async def apply_add(frame_public_id: str, prompt: str, x: int, y: int, w: int, h: int) -> str:
    """Generate object from prompt and overlay at position."""
    url = cloudinary.CloudinaryImage(frame_public_id).build_url(
        transformation=[
            {"effect": f"gen_replace:from_natural;to_{prompt}",
             "x": x, "y": y, "width": w, "height": h, "crop": "fill"},
        ],
        secure=True,
    )
    return url
```

**Step 2: Verify imports work**

```bash
cd hackcan/backend
source venv/bin/activate
python -c "from services import cloudinary_service; print('OK')"
```

**Step 3: Commit**

```bash
git add hackcan/backend/services/cloudinary_service.py
git commit -m "feat: add delete (e_gen_remove) and add (gen_replace) transforms to cloudinary_service"
```

---

## Task 2: Refactor /edit to support batch edit rules with frame ranges

**Files:**
- Modify: `hackcan/backend/main.py:132-206`

**Step 1: Replace EditRequest model and /edit endpoint**

Replace the entire Edit section in main.py with:

```python
# --- Edit ---

from typing import List

class EditRule(BaseModel):
    edit_type: str  # "recolor", "resize", "replace", "add", "delete"
    start_frame: int
    end_frame: int
    color: Optional[str] = None  # hex without #, e.g. "FF0000"
    scale: Optional[float] = None
    prompt: Optional[str] = None  # for replace and add
    asset_x: Optional[int] = None  # for add positioning
    asset_y: Optional[int] = None
    asset_w: Optional[int] = None
    asset_h: Optional[int] = None

class EditRequest(BaseModel):
    project_id: str
    edit_rules: List[EditRule]

@app.post("/edit")
async def edit_frames(req: EditRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    frames_dir = project_dir / "frames"
    masks_dir = project_dir / "masks"
    edited_dir = project_dir / "edited"
    edited_dir.mkdir(exist_ok=True)

    frame_files = sorted(frames_dir.glob("frame_*.jpg"))
    mask_files = sorted(masks_dir.glob("mask_*.png"))

    if len(frame_files) == 0:
        return {"error": "No frames found. Run /extract first."}

    # Upload all frames to Cloudinary
    frame_ids = {}
    for f in frame_files:
        result = cloudinary_service.upload_file(str(f), folder=f"frameshift/{req.project_id}/frames")
        frame_ids[f.name] = result["public_id"]

    # Upload masks if they exist
    mask_ids = {}
    for m in mask_files:
        result = cloudinary_service.upload_file(str(m), folder=f"frameshift/{req.project_id}/masks")
        mask_ids[m.name] = result["public_id"]

    # Get mask bbox for positioning (if masks exist)
    bbox_x, bbox_y, bbox_w, bbox_h = 0, 0, 0, 0
    if mask_files:
        from PIL import Image
        import numpy as np
        anchor_mask = np.array(Image.open(mask_files[0]))
        rows = np.any(anchor_mask > 0, axis=1)
        cols = np.any(anchor_mask > 0, axis=0)
        if rows.any() and cols.any():
            y_min, y_max = np.where(rows)[0][[0, -1]]
            x_min, x_max = np.where(cols)[0][[0, -1]]
            bbox_x, bbox_y = int(x_min), int(y_min)
            bbox_w, bbox_h = int(x_max - x_min), int(y_max - y_min)

    frame_list = sorted(frame_ids.keys())
    mask_list = sorted(mask_ids.keys())
    total_frames = len(frame_list)

    # Determine which frames need edits
    frames_to_edit = set()
    for rule in req.edit_rules:
        for i in range(rule.start_frame, min(rule.end_frame + 1, total_frames + 1)):
            frames_to_edit.add(i)

    async def process_frame(index):
        frame_name = frame_list[index - 1]
        f_id = frame_ids[frame_name]
        m_id = mask_ids.get(mask_list[index - 1] if index - 1 < len(mask_list) else "", "")

        if index not in frames_to_edit:
            # Copy original frame unchanged
            import shutil as sh
            src = frames_dir / frame_name
            dst = edited_dir / f"frame_{index:04d}.jpg"
            sh.copy2(str(src), str(dst))
            return

        # Apply first matching rule for this frame
        url = None
        for rule in req.edit_rules:
            if rule.start_frame <= index <= rule.end_frame:
                if rule.edit_type == "recolor" and m_id:
                    url = await cloudinary_service.apply_recolor(f_id, m_id, rule.color)
                elif rule.edit_type == "resize" and m_id:
                    url = await cloudinary_service.apply_resize(f_id, m_id, bbox_x, bbox_y, bbox_w, bbox_h, rule.scale)
                elif rule.edit_type == "replace":
                    url = await cloudinary_service.apply_replace(f_id, m_id, bbox_x, bbox_y, bbox_w, bbox_h)
                elif rule.edit_type == "delete" and m_id:
                    url = await cloudinary_service.apply_delete(f_id, m_id)
                elif rule.edit_type == "add":
                    url = await cloudinary_service.apply_add(
                        f_id, rule.prompt,
                        rule.asset_x or bbox_x, rule.asset_y or bbox_y,
                        rule.asset_w or bbox_w, rule.asset_h or bbox_h,
                    )
                break

        save_path = edited_dir / f"frame_{index:04d}.jpg"
        if url:
            await cloudinary_service.download_url(url, save_path)
        else:
            import shutil as sh
            sh.copy2(str(frames_dir / frame_name), str(save_path))

    # Process in batches of 20 concurrent
    batch_size = 20
    for i in range(0, total_frames, batch_size):
        batch = [process_frame(j + 1) for j in range(i, min(i + batch_size, total_frames))]
        await asyncio.gather(*batch)

    return {
        "project_id": req.project_id,
        "edited_frame_count": total_frames,
        "edited_in_range": len(frames_to_edit),
        "status": "done",
    }
```

**Step 2: Test manually**

```bash
curl -X POST http://localhost:8000/edit -H "Content-Type: application/json" -d '{
  "project_id": "YOUR_ID",
  "edit_rules": [
    {"edit_type": "recolor", "start_frame": 1, "end_frame": 50, "color": "FF0000"}
  ]
}'
```

**Step 3: Commit**

```bash
git add hackcan/backend/main.py
git commit -m "feat: refactor /edit to support batch edit rules with frame ranges and 5 edit types"
```

---

## Task 3: Add BackgroundTasks for YOLO pre-computation during /extract

**Files:**
- Modify: `hackcan/backend/main.py:51-64` (extract section)
- Modify: `hackcan/backend/services/project_manager.py` (add status tracking)

**Step 1: Add status tracking to project_manager.py**

Replace entire file:

```python
import uuid
import json
from pathlib import Path

BASE_DIR = Path("/tmp/frameshift")

def create_project() -> dict:
    project_id = str(uuid.uuid4())[:8]
    project_dir = BASE_DIR / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / "frames").mkdir(exist_ok=True)
    (project_dir / "masks").mkdir(exist_ok=True)
    (project_dir / "edited").mkdir(exist_ok=True)

    _write_status(project_id, {"status": "created", "frame_count": 0, "detections": {}})

    return {"project_id": project_id, "project_dir": str(project_dir)}

def get_project_dir(project_id: str) -> Path:
    project_dir = BASE_DIR / project_id
    if not project_dir.exists():
        raise FileNotFoundError(f"Project {project_id} not found")
    return project_dir

def _status_path(project_id: str) -> Path:
    return BASE_DIR / project_id / "status.json"

def _write_status(project_id: str, data: dict):
    path = _status_path(project_id)
    path.write_text(json.dumps(data))

def update_status(project_id: str, **kwargs):
    path = _status_path(project_id)
    if path.exists():
        data = json.loads(path.read_text())
    else:
        data = {}
    data.update(kwargs)
    path.write_text(json.dumps(data))

def get_status(project_id: str) -> dict:
    path = _status_path(project_id)
    if not path.exists():
        return {"status": "not_found"}
    return json.loads(path.read_text())
```

**Step 2: Refactor /extract to use BackgroundTasks and add status endpoint**

Replace the extract section in main.py:

```python
from fastapi import FastAPI, UploadFile, File, BackgroundTasks

# --- Extract ---

class ExtractRequest(BaseModel):
    project_id: str

def _background_extract_and_detect(project_id: str):
    """Background task: extract frames, upload to Cloudinary, run YOLO on all."""
    project_dir = project_manager.get_project_dir(project_id)
    video_path = project_dir / "original.mp4"
    frames_dir = project_dir / "frames"

    # Extract frames
    project_manager.update_status(project_id, status="extracting")
    frame_count = ffmpeg_service.extract_frames(video_path, frames_dir)
    project_manager.update_status(project_id, status="detecting", frame_count=frame_count)

    # Run YOLO on all frames
    detections = {}
    frame_files = sorted(frames_dir.glob("frame_*.jpg"))
    for i, f in enumerate(frame_files, start=1):
        dets = yolo_service.detect(f)
        detections[str(i)] = dets

    project_manager.update_status(project_id, status="ready", detections=detections)

@app.post("/extract")
async def extract_frames(req: ExtractRequest, background_tasks: BackgroundTasks):
    project_manager.update_status(req.project_id, status="processing")
    background_tasks.add_task(_background_extract_and_detect, req.project_id)
    return {"project_id": req.project_id, "status": "processing"}


@app.get("/project/{project_id}/status")
async def get_project_status(project_id: str):
    return project_manager.get_status(project_id)
```

**Step 3: Test manually**

```bash
# Start extract (returns immediately)
curl -X POST http://localhost:8000/extract -H "Content-Type: application/json" -d '{"project_id": "YOUR_ID"}'

# Poll status
curl http://localhost:8000/project/YOUR_ID/status
# Should show: {"status": "extracting"} then {"status": "detecting"} then {"status": "ready", "detections": {...}}
```

**Step 4: Commit**

```bash
git add hackcan/backend/main.py hackcan/backend/services/project_manager.py
git commit -m "feat: add BackgroundTasks for YOLO pre-computation and status polling endpoint"
```

---

## Task Order

```
Task 1 (add/delete transforms) — no dependencies
  ↓
Task 2 (refactor /edit with batch rules + frame ranges) — depends on Task 1
  ↓
Task 3 (BackgroundTasks + status polling) — independent but do last
```
