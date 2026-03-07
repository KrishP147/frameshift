from fastapi import FastAPI, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import Optional, List
import shutil
import asyncio
import numpy as np

from services import cloudinary_service, project_manager, ffmpeg_service, yolo_service, sam2_service

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


# --- Extract ---

class ExtractRequest(BaseModel):
    project_id: str

def _background_extract(project_id: str):
    """Background task: extract frames, then kick off YOLO in background."""
    project_dir = project_manager.get_project_dir(project_id)
    video_path = project_dir / "original.mp4"
    frames_dir = project_dir / "frames"

    # Extract frames
    project_manager.update_status(project_id, status="extracting")
    try:
        frame_count = ffmpeg_service.extract_frames(video_path, frames_dir)
    except Exception as e:
        print(f"[extract] FFmpeg failed: {e}")
        project_manager.update_status(project_id, status="error", error=str(e))
        return

    # Read frame dimensions from first frame
    from PIL import Image
    first_frame = sorted(frames_dir.glob("frame_*.jpg"))[0]
    img = Image.open(first_frame)
    frame_width, frame_height = img.size

    # Mark ready immediately so frontend can show frames
    project_manager.update_status(project_id, status="ready", frame_count=frame_count,
                                   frame_width=frame_width, frame_height=frame_height,
                                   detecting=True, detections={})

    # Run YOLO on all frames, updating detections progressively
    detections = {}
    frame_files = sorted(frames_dir.glob("frame_*.jpg"))
    for i, f in enumerate(frame_files, start=1):
        dets = yolo_service.detect(f)
        detections[str(i)] = dets
        # Update every 10 frames so frontend can poll partial results
        if i % 10 == 0 or i == len(frame_files):
            project_manager.update_status(project_id, detections=detections, detected_frames=i)

    project_manager.update_status(project_id, detecting=False, detections=detections, detected_frames=len(frame_files))

@app.post("/extract")
async def extract_frames(req: ExtractRequest, background_tasks: BackgroundTasks):
    project_manager.update_status(req.project_id, status="processing")
    background_tasks.add_task(_background_extract, req.project_id)
    return {"project_id": req.project_id, "status": "processing"}


@app.get("/project/{project_id}/status")
async def get_project_status(project_id: str):
    return project_manager.get_status(project_id)


@app.get("/frame/{project_id}/{frame_index}")
async def get_frame(project_id: str, frame_index: int):
    project_dir = project_manager.get_project_dir(project_id)
    frame_path = project_dir / "frames" / f"frame_{frame_index:04d}.jpg"
    if not frame_path.exists():
        return {"error": "Frame not found"}
    return FileResponse(frame_path, media_type="image/jpeg")


# --- Detect ---

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


# --- Segment ---

class SegmentRequest(BaseModel):
    project_id: str
    frame_index: int
    click_x: int
    click_y: int

def _background_segment_and_propagate(project_id: str, frame_index: int, click_x: int, click_y: int):
    """Background task: segment the single clicked frame only."""
    project_dir = project_manager.get_project_dir(project_id)
    frame_path = project_dir / "frames" / f"frame_{frame_index:04d}.jpg"
    masks_dir = project_dir / "masks"
    masks_dir.mkdir(parents=True, exist_ok=True)

    project_manager.update_status(project_id, segmenting=True, segment_status="segmenting")

    mask = sam2_service.segment_frame(frame_path, click_x, click_y)

    # Save mask for just this frame
    from PIL import Image
    mask_img = (mask.astype(np.uint8)) * 255
    mask_path = masks_dir / f"mask_{frame_index:04d}.png"
    Image.fromarray(mask_img).save(mask_path)

    project_manager.update_status(
        project_id, segmenting=False, segment_status="done",
        mask_count=1, anchor_frame=frame_index,
    )

@app.post("/segment")
async def segment_object(req: SegmentRequest, background_tasks: BackgroundTasks):
    project_dir = project_manager.get_project_dir(req.project_id)
    frame_path = project_dir / "frames" / f"frame_{req.frame_index:04d}.jpg"

    if not frame_path.exists():
        return {"error": "Frame not found"}

    background_tasks.add_task(
        _background_segment_and_propagate,
        req.project_id, req.frame_index, req.click_x, req.click_y,
    )

    return {
        "project_id": req.project_id,
        "status": "processing",
        "anchor_frame": req.frame_index,
    }


@app.get("/mask/{project_id}/{mask_index}")
async def get_mask(project_id: str, mask_index: int):
    project_dir = project_manager.get_project_dir(project_id)
    mask_path = project_dir / "masks" / f"mask_{mask_index:04d}.png"
    if not mask_path.exists():
        return {"error": "Mask not found"}
    return FileResponse(mask_path, media_type="image/png")


# --- Edit ---

class EditRule(BaseModel):
    edit_type: str  # core: recolor, resize, replace, add, delete
                    # extras: bg_remove, bg_replace, gen_fill, enhance, upscale,
                    #         restore, blur, blur_region, drop_shadow, gen_recolor
    start_frame: int
    end_frame: int
    color: Optional[str] = None       # hex without #, e.g. "FF0000"
    scale: Optional[float] = None     # for resize
    prompt: Optional[str] = None      # for replace, add, bg_replace, gen_fill, gen_recolor
    blur_strength: Optional[int] = None  # for blur (default 500)
    asset_x: Optional[int] = None     # for add positioning
    asset_y: Optional[int] = None
    asset_w: Optional[int] = None
    asset_h: Optional[int] = None

class EditRequest(BaseModel):
    project_id: str
    edit_rules: List[EditRule]

async def _background_edit(project_id: str, edit_rules: List[EditRule]):
    """Background task: upload only the needed frames, apply edits, download results."""
    try:
        project_dir = project_manager.get_project_dir(project_id)
        frames_dir = project_dir / "frames"
        masks_dir = project_dir / "masks"

        # Collect unique frame indices to edit
        frames_to_edit: set[int] = set()
        for rule in edit_rules:
            for i in range(rule.start_frame, rule.end_frame + 1):
                frames_to_edit.add(i)

        total = len(frames_to_edit)
        project_manager.update_status(project_id, edit_status="uploading", edit_progress={"done": 0, "total": total})

        # Upload only the frames we need
        frame_ids: dict[int, str] = {}
        for idx in sorted(frames_to_edit):
            frame_path = frames_dir / f"frame_{idx:04d}.jpg"
            if not frame_path.exists():
                continue
            result = cloudinary_service.upload_file(str(frame_path), folder=f"frameshift/{project_id}/frames")
            frame_ids[idx] = result["public_id"]

        # Upload mask for the first frame if it exists (SAM 2 produces one mask per segment)
        mask_id = ""
        mask_files = sorted(masks_dir.glob("mask_*.png"))
        bbox_x, bbox_y, bbox_w, bbox_h = 0, 0, 0, 0
        if mask_files:
            result = cloudinary_service.upload_file(str(mask_files[0]), folder=f"frameshift/{project_id}/masks")
            mask_id = result["public_id"]
            from PIL import Image
            anchor_mask = np.array(Image.open(mask_files[0]))
            rows = np.any(anchor_mask > 0, axis=1)
            cols = np.any(anchor_mask > 0, axis=0)
            if rows.any() and cols.any():
                y_min, y_max = np.where(rows)[0][[0, -1]]
                x_min, x_max = np.where(cols)[0][[0, -1]]
                bbox_x, bbox_y = int(x_min), int(y_min)
                bbox_w, bbox_h = int(x_max - x_min), int(y_max - y_min)

        project_manager.update_status(project_id, edit_status="editing")
        completed = 0

        for idx in sorted(frames_to_edit):
            f_id = frame_ids.get(idx)
            if not f_id:
                completed += 1
                continue

            url = None
            for rule in edit_rules:
                if rule.start_frame <= idx <= rule.end_frame:
                    t = rule.edit_type

                    # ── Core edits (use SAM 2 mask) ──
                    if t == "recolor" and mask_id:
                        url = await cloudinary_service.apply_recolor(f_id, mask_id, rule.color, rule.prompt)
                    elif t == "resize" and mask_id:
                        url = await cloudinary_service.apply_resize(f_id, mask_id, bbox_x, bbox_y, bbox_w, bbox_h, rule.scale)
                    elif t == "replace" and mask_id:
                        url = await cloudinary_service.apply_replace(f_id, mask_id, rule.prompt or "object")
                    elif t == "delete" and mask_id:
                        url = await cloudinary_service.apply_delete(f_id, mask_id)
                    elif t == "add":
                        url = await cloudinary_service.apply_add(
                            f_id, rule.prompt or "object",
                            rule.asset_x or bbox_x, rule.asset_y or bbox_y,
                            rule.asset_w or bbox_w, rule.asset_h or bbox_h,
                        )
                    elif t == "blur_region" and mask_id:
                        url = await cloudinary_service.apply_blur_region(f_id, mask_id)

                    # ── Whole-frame edits (no mask needed) ──
                    elif t == "bg_remove":
                        url = await cloudinary_service.apply_background_remove(f_id)
                    elif t == "bg_replace":
                        url = await cloudinary_service.apply_background_replace(f_id, rule.prompt or "studio background")
                    elif t == "gen_fill":
                        url = await cloudinary_service.apply_generative_fill(f_id, rule.prompt)
                    elif t == "enhance":
                        url = await cloudinary_service.apply_enhance(f_id)
                    elif t == "upscale":
                        url = await cloudinary_service.apply_upscale(f_id)
                    elif t == "restore":
                        url = await cloudinary_service.apply_restore(f_id)
                    elif t == "blur":
                        url = await cloudinary_service.apply_blur(f_id, rule.blur_strength or 500)
                    elif t == "drop_shadow":
                        url = await cloudinary_service.apply_drop_shadow(f_id)
                    elif t == "gen_recolor":
                        url = await cloudinary_service.apply_generative_recolor(f_id, rule.prompt or "object", rule.color or "FF0000")

                    break

            # Download the edited frame back, overwriting the original
            if url:
                save_path = frames_dir / f"frame_{idx:04d}.jpg"
                await cloudinary_service.download_url(url, save_path)

            completed += 1
            project_manager.update_status(project_id, edit_progress={"done": completed, "total": total})

        project_manager.update_status(project_id, edit_status="done", edit_progress={"done": total, "total": total})

    except Exception as e:
        import traceback
        traceback.print_exc()
        project_manager.update_status(project_id, edit_status="error", edit_error=str(e))


@app.post("/edit")
async def edit_frames(req: EditRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    if not any((project_dir / "frames").glob("frame_*.jpg")):
        return {"error": "No frames found. Run /extract first."}

    project_manager.update_status(
        req.project_id,
        edit_status="uploading",
        edit_progress={"done": 0, "total": 0},
    )
    # Run as a proper async task instead of BackgroundTasks (which can't await)
    asyncio.ensure_future(_background_edit(req.project_id, req.edit_rules))
    return {"project_id": req.project_id, "edit_status": "uploading"}


# --- Render ---

class RenderRequest(BaseModel):
    project_id: str

@app.post("/render")
async def render_video(req: RenderRequest):
    project_dir = project_manager.get_project_dir(req.project_id)
    edited_dir = project_dir / "edited"
    output_path = project_dir / "output.mp4"

    status = project_manager.get_status(req.project_id)
    if status.get("edit_status") not in ("done", None, "idle"):
        return {"error": f"Edit not complete. Current edit_status: {status.get('edit_status')}"}

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
